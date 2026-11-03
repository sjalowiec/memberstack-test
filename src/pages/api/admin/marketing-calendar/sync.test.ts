import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminForRequest = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/admin/requireAdminRequest", () => ({
  requireAdminForRequest,
  adminAuthErrorBody: (auth: { error: string }) => ({ ok: false, error: auth.error }),
}));

import { handleMarketingCalendarAdminStatus, handleMarketingCalendarAdminSync } from "./sync";
import { createMemorySyncJobStore } from "../../../../lib/marketingCalendar/syncJobStore";
import { executeMarketingCalendarSyncJob } from "../../../../lib/marketingCalendar/syncJob";
import type { MarketingCalendarSyncReport } from "../../../../lib/marketingCalendar/runSync";

const cookies = { get: () => undefined };
const owner = { ok: true as const, member: { id: "mem_owner", email: "owner@example.test" }, mode: "verified" as const };

let idSequence = 0;
function nextId(): string {
  idSequence += 1;
  return `00000000-0000-4000-8000-${String(idSequence).padStart(12, "0")}`;
}

describe("marketing calendar admin sync", () => {
  beforeEach(() => {
    requireAdminForRequest.mockReset();
  });

  it("rejects a request that is not the site owner before any sync", async () => {
    requireAdminForRequest.mockResolvedValue({ ok: false, status: 401, error: "Sign in required." });
    const store = createMemorySyncJobStore();
    const dispatch = vi.fn(async () => "accepted" as const);
    const response = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
      { store, dispatch },
    );
    expect(response.status).toBe(401);
    expect(dispatch).not.toHaveBeenCalled();
    expect(await store.getLock()).toEqual({ record: null });
    expect(await response.json()).toEqual({ ok: false, error: "Sign in required." });
  });

  it("starts the background job and returns before any calendar write", async () => {
    requireAdminForRequest.mockResolvedValue(owner);
    const store = createMemorySyncJobStore();
    const dispatch = vi.fn(async () => "accepted" as const);
    const response = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
      { store, createId: nextId, dispatch, now: () => new Date("2026-11-03T12:00:00.000Z") },
    );
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body).toMatchObject({ ok: true, status: "running", alreadyRunning: false });
    expect(body.jobId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain("private_key");
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("returns the same running job when Sync Now is clicked again", async () => {
    requireAdminForRequest.mockResolvedValue(owner);
    const store = createMemorySyncJobStore();
    const dispatch = vi.fn(async () => "accepted" as const);
    const deps = { store, createId: nextId, dispatch, now: () => new Date("2026-11-03T12:00:00.000Z") };
    const first = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
      deps,
    );
    const second = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
      deps,
    );
    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(second.status).toBe(202);
    expect(secondBody).toMatchObject({ ok: true, status: "running", alreadyRunning: true, jobId: firstBody.jobId });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("polls the finished counts", async () => {
    requireAdminForRequest.mockResolvedValue(owner);
    const store = createMemorySyncJobStore();
    const now = new Date("2026-11-03T12:00:00.000Z");
    let token = "";
    const started = await handleMarketingCalendarAdminSync(
      new Request("https://example.test/api/admin/marketing-calendar/sync", { method: "POST" }),
      cookies,
      {
        store,
        createId: nextId,
        now: () => now,
        dispatch: async (job) => {
          token = job.token;
          return "accepted";
        },
      },
    );
    const { jobId } = await started.json();
    const result: MarketingCalendarSyncReport = {
      ok: true,
      dryRun: false,
      created: 4,
      updated: 5,
      deleted: 0,
      writesPerformed: 9,
      calendar: { summary: "KIN marketing", timeZone: "America/Los_Angeles" },
      changes: [],
      proposedDeletions: [],
      skippedConflicts: [
        {
          campaignId: "9",
          title: "Manual match",
          manualSummary: "Manual match",
          reason: "title",
        },
      ],
    };
    await executeMarketingCalendarSyncJob({
      store,
      jobId,
      token,
      now: () => now,
      createId: nextId,
      sync: async () => result,
    });
    const poll = await handleMarketingCalendarAdminStatus(
      new Request(`https://example.test/api/admin/marketing-calendar/sync?job=${jobId}`, { method: "GET" }),
      cookies,
      { store, now: () => now },
    );
    expect(poll.status).toBe(200);
    expect(await poll.json()).toMatchObject({
      ok: true,
      status: "succeeded",
      created: 4,
      updated: 5,
      skipped: 1,
      deleted: 0,
    });
  });
});
