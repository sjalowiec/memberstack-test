import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { EVENT_COLOR, KIN_MARKETING_CALENDAR_ID } from "./constants";
import { MarketingCalendarError } from "./errors";
import { createGoogleCalendarClient } from "./googleCalendarClient";
import { requestJson } from "./http";
import { applyEnvText, assertDryRunArgs } from "./localEnv";
import { parseServiceAccount, resolveCalendarId, signServiceAccountJwt } from "./serviceAccount";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const serviceAccount = {
  type: "service_account",
  client_email: "marketing-sync@example.iam.gserviceaccount.com",
  private_key: pem,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("marketing calendar auth and http", () => {
  it("rejects a different calendar id before any request", () => {
    expect(() => resolveCalendarId({ GOOGLE_CALENDAR_ID: "primary" })).toThrow(/KIN marketing/);
    expect(resolveCalendarId({})).toBe(KIN_MARKETING_CALENDAR_ID);
  });

  it("signs a service-account token request without putting the key in the error", () => {
    const account = parseServiceAccount(JSON.stringify(serviceAccount));
    const jwt = signServiceAccountJwt(account, 1_700_000_000);
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as {
      iss: string;
      scope: string;
    };
    expect(payload.iss).toBe(account.clientEmail);
    expect(payload.scope).toContain("calendar.events");
    expect(payload.scope).toContain("calendar.calendarlist");

    expect(() => parseServiceAccount('{"private_key":"secret-key-value"}')).toThrow(MarketingCalendarError);
    try {
      parseServiceAccount('{"private_key":"secret-key-value"}');
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain("secret-key-value");
    }
  });

  it("does not retry a 401 and scrubs a token echoed in an error body", async () => {
    let calls = 0;
    await expect(
      requestJson({
        url: "https://example.test/campaigns",
        label: "ActiveCampaign",
        sleep: async () => undefined,
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse({ error: "Api-Token: super-secret-token" }, 401);
        },
      }),
    ).rejects.toThrow(/redacted/);
    expect(calls).toBe(1);
    try {
      await requestJson({
        url: "https://example.test/campaigns",
        label: "ActiveCampaign",
        sleep: async () => undefined,
        fetchImpl: async () => jsonResponse({ error: "Api-Token: super-secret-token" }, 401),
      });
    } catch (error) {
      expect(error instanceof Error ? error.message : "").not.toContain("super-secret-token");
    }
  });

  it("retries a 503 and then reads the JSON body", async () => {
    let calls = 0;
    const body = await requestJson({
      url: "https://example.test/campaigns",
      label: "ActiveCampaign",
      sleep: async () => undefined,
      fetchImpl: async () => {
        calls += 1;
        return calls === 1 ? jsonResponse({ message: "busy" }, 503) : jsonResponse({ ok: true });
      },
    });
    expect(calls).toBe(2);
    expect(body).toEqual({ ok: true });
  });

  it("refuses calendar event reads until access is confirmed, and refuses writes by default", async () => {
    const calls: string[] = [];
    const client = createGoogleCalendarClient({
      account: parseServiceAccount(JSON.stringify(serviceAccount)),
      calendarId: KIN_MARKETING_CALENDAR_ID,
      fetchImpl: async (url) => {
        calls.push(String(url));
        return jsonResponse({});
      },
    });

    await expect(client.listOwnedEvents()).rejects.toThrow(/has not been confirmed/);
    await expect(client.insertEvent({ extendedProperties: { private: {} } })).rejects.toThrow(
      /writes are not enabled/,
    );
    expect(calls).toEqual([]);
  });

  it("stops before reading events when the calendar name or role is wrong", async () => {
    const calls: string[] = [];
    const client = createGoogleCalendarClient({
      account: parseServiceAccount(JSON.stringify(serviceAccount)),
      calendarId: KIN_MARKETING_CALENDAR_ID,
      now: new Date("2026-10-13T15:00:00Z"),
      sleep: async () => undefined,
      fetchImpl: async (url) => {
        const href = String(url);
        calls.push(href);
        if (href.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "ya29.test-token" });
        return jsonResponse({
          summary: "Personal",
          accessRole: "reader",
          timeZone: "America/Los_Angeles",
        });
      },
    });

    await expect(client.verifyAccess()).rejects.toThrow(/not KIN marketing/);
    expect(calls.some((url) => url.includes("/events"))).toBe(false);
  });

  it("confirms a shared calendar by name and role before reading events", async () => {
    const calls: string[] = [];
    const client = createGoogleCalendarClient({
      account: parseServiceAccount(JSON.stringify(serviceAccount)),
      calendarId: KIN_MARKETING_CALENDAR_ID,
      now: new Date("2026-10-13T15:00:00Z"),
      sleep: async () => undefined,
      fetchImpl: async (url) => {
        const href = String(url);
        calls.push(href);
        if (href.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "ya29.test-token" });
        if (href.includes("/calendarList/")) return new Response("missing", { status: 404 });
        if (href.includes("timeMax=1970-01-01")) {
          return jsonResponse({
            summary: "KIN marketing",
            accessRole: "writer",
            timeZone: "America/Phoenix",
            items: [],
          });
        }
        if (href.includes("/events")) return jsonResponse({ items: [] });
        return jsonResponse({ summary: "KIN marketing", timeZone: "America/Los_Angeles" });
      },
    });

    await expect(client.verifyAccess()).resolves.toMatchObject({
      summary: "KIN marketing",
      accessRole: "writer",
      timeZone: "America/Phoenix",
    });
    expect(calls.some((url) => url.includes("/events") && !url.includes("timeMax=1970-01-01"))).toBe(false);
    await client.listOwnedEvents();
    expect(calls.some((url) => url.includes("/events") && !url.includes("timeMax=1970-01-01"))).toBe(true);
  });

  it("builds a peacock scheduled event only for an explicitly enabled writer", async () => {
    const bodies: string[] = [];
    const client = createGoogleCalendarClient({
      account: parseServiceAccount(JSON.stringify(serviceAccount)),
      calendarId: KIN_MARKETING_CALENDAR_ID,
      allowWrites: true,
      now: new Date("2026-10-13T15:00:00Z"),
      sleep: async () => undefined,
      fetchImpl: async (url, init) => {
        const href = String(url);
        if (href.includes("oauth2.googleapis.com")) return jsonResponse({ access_token: "ya29.test-token" });
        if (href.includes("/calendarList/")) {
          return jsonResponse({
            summary: "KIN marketing",
            accessRole: "writer",
            timeZone: "America/Los_Angeles",
          });
        }
        bodies.push(String(init?.body ?? ""));
        return jsonResponse({ id: "created-1" });
      },
    });
    await client.verifyAccess();
    await client.insertEvent({
      summary: "What's New",
      colorId: EVENT_COLOR.scheduled,
      extendedProperties: {
        private: { kinCampaignId: "42", kinSource: "activecampaign", kinSync: "kin-marketing" },
      },
    });
    expect(JSON.parse(bodies[0] ?? "{}")).toMatchObject({
      colorId: "7",
      extendedProperties: { private: { kinCampaignId: "42" } },
    });
  });

  it("loads env names without replacing existing values, and the script stays dry-run only", () => {
    const env: NodeJS.ProcessEnv = { ACTIVECAMPAIGN_API_KEY: "already" };
    expect(applyEnvText('ACTIVECAMPAIGN_API_KEY="other"\nACTIVECAMPAIGN_BASE_URL="https://example.test"', env)).toEqual([
      "ACTIVECAMPAIGN_BASE_URL",
    ]);
    expect(env.ACTIVECAMPAIGN_API_KEY).toBe("already");
    expect(env.ACTIVECAMPAIGN_BASE_URL).toBe("https://example.test");
    expect(() => assertDryRunArgs(["--live"])).toThrow(/dry-run only/);
    expect(() => assertDryRunArgs(["--dry-run"])).not.toThrow();
  });
});
