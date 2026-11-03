import { describe, expect, it, vi } from "vitest";

import { startMarketingCalendarSync } from "../../../src/lib/marketingCalendar/syncJob";
import { createMemorySyncJobStore } from "../../../src/lib/marketingCalendar/syncJobStore";
import { handleMarketingCalendarBackground } from "../marketing-calendar-sync-background";
import { handleMarketingCalendarRequest } from "../marketing-calendar-sync";

let idSequence = 0;
function nextId(): string {
  idSequence += 1;
  return `00000000-0000-4000-8000-${String(idSequence).padStart(12, "0")}`;
}

describe("marketing calendar scheduled function", () => {
  it("does not sync a browser request or reveal campaign data", async () => {
    const dispatch = vi.fn(async () => "accepted" as const);
    const response = await handleMarketingCalendarRequest(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync", {
        method: "POST",
        headers: { "X-Marketing-Calendar-Secret": "correct" },
        body: JSON.stringify({ confirm: "LIVE" }),
      }),
      {
        env: { MARKETING_CALENDAR_SYNC_SECRET: "correct", MARKETING_CALENDAR_SYNC_LIVE_ENABLED: "true" },
        dispatch,
      },
    );
    expect(response.status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: false, error: "Sync from the admin page." });
  });

  it("does not write on a scheduled invocation until live sync is enabled", async () => {
    const dispatch = vi.fn(async () => "accepted" as const);
    const response = await handleMarketingCalendarRequest(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync", {
        method: "POST",
        body: JSON.stringify({ next_run: "2026-10-14T04:00:00.000Z" }),
      }),
      { env: {}, dispatch },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(dispatch).not.toHaveBeenCalled();
    expect(body).toMatchObject({ scheduled: true, dryRun: true, liveEnabled: false, writesPerformed: 0, deleted: 0 });
    expect(JSON.stringify(body)).not.toContain("Subject");
  });

  it("starts the shared background job once when a live scheduled invocation arrives", async () => {
    const store = createMemorySyncJobStore();
    const dispatch = vi.fn(async () => "accepted" as const);
    const env = { MARKETING_CALENDAR_SYNC_LIVE_ENABLED: "true", URL: "https://knititnow.com" };
    const request = () =>
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync", {
        method: "POST",
        body: JSON.stringify({ next_run: "2026-11-04T04:00:00.000Z" }),
      });
    const first = await handleMarketingCalendarRequest(request(), {
      env,
      store,
      dispatch,
      createId: nextId,
      now: () => new Date("2026-11-03T12:00:00.000Z"),
    });
    const second = await handleMarketingCalendarRequest(request(), {
      env,
      store,
      dispatch,
      createId: nextId,
      now: () => new Date("2026-11-03T12:00:00.000Z"),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ scheduled: true, liveEnabled: true, status: "running", deleted: 0 });
    expect(await second.json()).toMatchObject({ alreadyRunning: true });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({ origin: "https://knititnow.com" });
  });
});

describe("marketing calendar background function", () => {
  it("rejects a request that does not carry a stored job token", async () => {
    const sync = vi.fn(async () => {
      throw new Error("should not run");
    });
    const response = await handleMarketingCalendarBackground(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync-background", {
        method: "POST",
        body: JSON.stringify({ jobId: "not-a-job", token: "nope" }),
      }),
      { sync },
    );
    expect(response.status).toBe(400);
    expect(sync).not.toHaveBeenCalled();
  });

  it("runs the stored job and returns without throwing when the sync fails", async () => {
    const store = createMemorySyncJobStore();
    const now = new Date("2026-11-03T12:00:00.000Z");
    let token = "";
    const started = await startMarketingCalendarSync({
      store,
      origin: "https://knititnow.com",
      now,
      createId: nextId,
      dispatch: async (job) => {
        token = job.token;
        return "accepted";
      },
    });
    if (started.outcome !== "started") throw new Error("job did not start");
    const response = await handleMarketingCalendarBackground(
      new Request("https://example.test/.netlify/functions/marketing-calendar-sync-background", {
        method: "POST",
        body: JSON.stringify({ jobId: started.jobId, token }),
      }),
      {
        store,
        now: () => now,
        createId: nextId,
        sync: async () => {
          throw new Error("calendar down");
        },
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, ran: true, status: "failed" });
    const lock = await store.getLock();
    expect(lock.record && Date.parse(lock.record.expiresAt) <= now.getTime()).toBe(true);
  });
});
