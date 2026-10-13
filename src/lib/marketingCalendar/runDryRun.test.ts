import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { KIN_MARKETING_CALENDAR_ID } from "./constants";
import { runMarketingCalendarDryRun } from "./runDryRun";
import { parseServiceAccount } from "./serviceAccount";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const serviceAccountJson = JSON.stringify({
  type: "service_account",
  client_email: "marketing-sync@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function env(): NodeJS.ProcessEnv {
  return {
    ACTIVECAMPAIGN_API_KEY: "test-api-key",
    ACTIVECAMPAIGN_BASE_URL: "https://knitbymachine.activehosted.com",
    GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: serviceAccountJson,
  };
}

describe("marketing calendar dry run", () => {
  it("plans creates, deletes, and conflicts without writing calendar events", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const report = await runMarketingCalendarDryRun({
      env: env(),
      now: new Date("2026-10-13T15:00:00Z"),
      sleep: async () => undefined,
      fetchImpl: async (url, init) => {
        const href = String(url);
        const method = init?.method ?? "GET";
        calls.push({ method, url: href });
        if (href.includes("googleapis.com") && method !== "GET" && !href.includes("oauth2.googleapis.com")) {
          throw new Error(`calendar write attempted: ${method}`);
        }
        if (href.includes("oauth2.googleapis.com")) return json({ access_token: "ya29.test-token" });
        if (href.includes("/calendarList/")) {
          return json({ summary: "KIN marketing", accessRole: "writer", timeZone: "America/Los_Angeles" });
        }
        if (href.includes("/events") && href.includes("privateExtendedProperty")) {
          return json({
            items: [
              {
                id: "owned-draft",
                summary: "Cleared draft",
                description: "Knit It Now marketing sync",
                colorId: "9",
                start: { dateTime: "2026-10-08T09:00:00-07:00" },
                end: { dateTime: "2026-10-08T09:30:00-07:00" },
                extendedProperties: {
                  private: { kinCampaignId: "15", kinSource: "activecampaign", kinSync: "kin-marketing" },
                },
              },
            ],
          });
        }
        if (href.includes("/events")) {
          return json({
            items: [
              {
                id: "manual-plan",
                summary: "Planned October email",
                start: { dateTime: "2026-10-20T11:00:00-07:00" },
                end: { dateTime: "2026-10-20T12:00:00-07:00" },
              },
              {
                id: "reminder-instance",
                summary: "Needs attention",
                recurringEventId: "reminder-series",
                start: { dateTime: "2026-10-13T09:00:00-07:00" },
                end: { dateTime: "2026-10-13T09:30:00-07:00" },
              },
            ],
          });
        }
        if (href.includes("/api/3/users/me")) return json({ user: { timezone: "America/Los_Angeles" } });
        if (href.includes("/api/3/messages/9")) return json({ message: { subject: "What's New — October" } });
        if (href.includes("/api/3/campaigns")) {
          return json({
            meta: { total: "3" },
            campaigns: [
              {
                id: "42",
                name: "internal-whats-new",
                type: "single",
                status: "1",
                seriesid: "0",
                scheduleddate: "2026-10-20T11:00:00-07:00",
                sdate: null,
                ldate: null,
                message_id: "9",
              },
              {
                id: "15",
                name: "cleared draft",
                type: "single",
                status: "0",
                scheduleddate: null,
                sdate: null,
                ldate: null,
                message_id: "0",
              },
              {
                id: "3",
                name: "automation",
                type: "responder",
                status: "1",
                scheduleddate: "2026-10-20T11:00:00-07:00",
              },
            ],
          });
        }
        throw new Error(`unexpected url ${href}`);
      },
    });

    expect(report.writesPerformed).toBe(0);
    expect(report.writesEnabled).toBe(false);
    expect(report.calendar).toMatchObject({ id: KIN_MARKETING_CALENDAR_ID, summary: "KIN marketing", accessRole: "writer" });
    expect(report.serviceAccountEmail).toBe("marketing-sync@example.iam.gserviceaccount.com");
    expect(report.campaignsFound).toBe(3);
    expect(report.counts).toMatchObject({ create: 1, delete: 1, skip: 1 });
    expect(report.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "create",
          campaignId: "42",
          title: "internal-whats-new",
          colorId: "7",
        }),
        expect.objectContaining({ action: "delete", campaignId: "15", googleEventId: "owned-draft" }),
      ]),
    );
    expect(report.possibleConflicts).toEqual([
      expect.objectContaining({ manualEventId: "manual-plan", reason: "start-time" }),
    ]);
    expect(report.untouched.nonRecurringEvents.map((event) => event.id)).toEqual(["manual-plan"]);
    expect(report.untouched.recurringSeries).toEqual([{ id: "reminder-series", summary: "Needs attention" }]);
    expect(report.skipReasons["not-broadcast:responder"]).toBe(1);
    expect(JSON.stringify(report)).not.toContain("test-api-key");
    expect(JSON.stringify(report)).not.toContain("PRIVATE KEY");
    expect(calls.some((call) => call.method === "DELETE" || call.method === "PATCH")).toBe(false);
    const calendarList = calls.findIndex((call) => call.url.includes("/calendarList/"));
    const events = calls.findIndex((call) => call.url.includes("/events"));
    expect(calendarList).toBeGreaterThanOrEqual(0);
    expect(events).toBeGreaterThan(calendarList);
  });

  it("does not read events when the service account cannot change the calendar", async () => {
    const calls: string[] = [];
    await expect(
      runMarketingCalendarDryRun({
        env: env(),
        sleep: async () => undefined,
        fetchImpl: async (url) => {
          const href = String(url);
          calls.push(href);
          if (href.includes("oauth2.googleapis.com")) return json({ access_token: "ya29.test-token" });
          if (href.includes("/calendarList/")) {
            return json({ summary: "KIN marketing", accessRole: "reader", timeZone: "America/Los_Angeles" });
          }
          throw new Error(`should not request ${href}`);
        },
      }),
    ).rejects.toThrow(/Make changes to events/);
    expect(calls.some((url) => url.includes("/events") || url.includes("/api/3/"))).toBe(false);
  });

  it("rejects a masked API key before any ActiveCampaign or Google request", async () => {
    let called = false;
    await expect(
      runMarketingCalendarDryRun({
        env: { ...env(), ACTIVECAMPAIGN_API_KEY: `${"*".repeat(16)}wxyz` },
        fetchImpl: async () => {
          called = true;
          return json({});
        },
      }),
    ).rejects.toThrow(/masked ActiveCampaign API key/);
    expect(called).toBe(false);
  });

  it("does not call Google when the calendar id is not KIN marketing", async () => {
    let called = false;
    await expect(
      runMarketingCalendarDryRun({
        env: { ...env(), GOOGLE_CALENDAR_ID: "primary" },
        fetchImpl: async () => {
          called = true;
          return json({});
        },
      }),
    ).rejects.toThrow(/does not match/);
    expect(called).toBe(false);
    expect(parseServiceAccount(serviceAccountJson).clientEmail).toContain("iam.gserviceaccount.com");
  });
});
