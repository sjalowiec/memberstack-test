import { describe, expect, it } from "vitest";

import { handleMarketingCalendarRequest } from "../marketing-calendar-sync";

describe("marketing calendar scheduled function", () => {
  it("does not sync a browser request or reveal campaign data", async () => {
    let called = false;
    const response = await handleMarketingCalendarRequest(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync", {
        method: "POST",
        headers: { "X-Marketing-Calendar-Secret": "correct" },
        body: JSON.stringify({ confirm: "LIVE" }),
      }),
      {
        env: { MARKETING_CALENDAR_SYNC_SECRET: "correct", MARKETING_CALENDAR_SYNC_LIVE_ENABLED: "true" },
        sync: async () => {
          called = true;
          throw new Error("should not run");
        },
      },
    );
    expect(response.status).toBe(401);
    expect(called).toBe(false);
    expect(await response.json()).toEqual({ ok: false, error: "Sync from the admin page." });
  });

  it("does not write on the evening schedule until live sync is enabled", async () => {
    let called = false;
    const response = await handleMarketingCalendarRequest(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync", {
        method: "POST",
        body: JSON.stringify({ next_run: "2026-10-14T04:00:00.000Z" }),
      }),
      {
        env: {},
        sync: async () => {
          called = true;
          throw new Error("should not run");
        },
      },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(called).toBe(false);
    expect(body).toMatchObject({ scheduled: true, dryRun: true, liveEnabled: false, writesPerformed: 0, deleted: 0 });
    expect(JSON.stringify(body)).not.toContain("Subject");
  });
});
