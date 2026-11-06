import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { MarketingCalendarError } from "./errors";
import type { MarketingCalendarSyncReport } from "./runSync";
import { marketingCalendarSyncMessage, MARKETING_CALENDAR_SYNCING_MESSAGE } from "./syncJobClient";
import {
  executeMarketingCalendarSyncJob,
  readMarketingCalendarSyncJob,
  startMarketingCalendarSync,
} from "./syncJob";
import {
  createBlobSyncJobStore,
  createMemorySyncJobStore,
  LOCK_TTL_MS,
  MARKETING_CALENDAR_LOCK_KEY,
  type SyncJobStore,
} from "./syncJobStore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

let idSequence = 0;
function nextId(): string {
  idSequence += 1;
  return `00000000-0000-4000-8000-${String(idSequence).padStart(12, "0")}`;
}

function report(overrides: Partial<MarketingCalendarSyncReport> = {}): MarketingCalendarSyncReport {
  return {
    ok: true,
    dryRun: false,
    created: 1,
    updated: 2,
    skippedConflicts: [],
    deleted: 0,
    writesPerformed: 3,
    calendar: { summary: "KIN marketing", timeZone: "America/Los_Angeles" },
    changes: [
      {
        action: "create",
        campaignId: "50",
        title: "October note",
        date: "2026-10-20",
        status: "scheduled",
        eventAt: "2026-10-20T09:00:00-07:00",
      },
    ],
    proposedDeletions: [],
    ...overrides,
  };
}

const origin = "https://knititnow.com";
const startTime = new Date("2026-11-03T12:00:00.000Z");

async function startedJob(store = createMemorySyncJobStore(), dispatch = vi.fn(async () => "accepted" as const)) {
  const started = await startMarketingCalendarSync({
    store,
    origin,
    now: startTime,
    createId: nextId,
    dispatch,
  });
  if (started.outcome === "start-failed") throw new Error(started.error);
  const lock = await store.getLock();
  return { started, store, dispatch, token: lock.record?.token ?? "" };
}

describe("marketing calendar background sync", () => {
  it("starts one job and returns before the sync runs", async () => {
    const sync = vi.fn(async () => report());
    const { started, dispatch, store, token } = await startedJob();
    expect(started.outcome).toBe("started");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(sync).not.toHaveBeenCalled();
    const running = await readMarketingCalendarSyncJob({ store, jobId: started.jobId, now: startTime });
    expect(running).toMatchObject({ status: "running", created: 0, updated: 0, skipped: 0, deleted: 0 });

    const finished = await executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync,
    });
    expect(finished).toEqual({ ran: true, status: "succeeded" });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledWith({ env: process.env, dryRun: false });
    const job = await readMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      now: new Date(startTime.getTime() + 1000),
    });
    expect(job).toMatchObject({
      status: "succeeded",
      created: 1,
      updated: 2,
      skipped: 0,
      deleted: 0,
    });
    expect(job?.changes[0]).toMatchObject({ action: "create", campaignId: "50", date: "2026-10-20" });
    expect(JSON.stringify(job)).not.toContain("private_key");
    expect(await store.getLock()).toMatchObject({
      record: expect.objectContaining({ expiresAt: "1970-01-01T00:00:00.000Z" }),
    });
  });

  it("lets only one of two simultaneous Sync Now requests start", async () => {
    const inner = createMemorySyncJobStore();
    let entered = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store: SyncJobStore = {
      async getLock() {
        const found = await inner.getLock();
        entered += 1;
        if (entered <= 2) {
          if (entered === 2) release();
          await gate;
        }
        return found;
      },
      writeLock: (record, condition) => inner.writeLock(record, condition),
      getJob: (id) => inner.getJob(id),
      writeJob: (record, condition) => inner.writeJob(record, condition),
    };
    const dispatch = vi.fn(async () => "accepted" as const);
    const input = { store, origin, now: startTime, createId: nextId, dispatch };
    const [first, second] = await Promise.all([
      startMarketingCalendarSync(input),
      startMarketingCalendarSync(input),
    ]);
    const started = [first, second].find((result) => result.outcome === "started");
    const other = [first, second].find((result) => result.outcome !== "started");
    expect(started?.outcome).toBe("started");
    expect(other).toEqual({
      outcome: "already-running",
      jobId: started && "jobId" in started ? started.jobId : "",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ jobId: started && "jobId" in started ? started.jobId : "" }));
  });

  it("does not start a second sync while the lock is held", async () => {
    const store = createMemorySyncJobStore();
    const dispatch = vi.fn(async () => "accepted" as const);
    const createId = nextId;
    const first = await startMarketingCalendarSync({ store, origin, now: startTime, createId, dispatch });
    const second = await startMarketingCalendarSync({ store, origin, now: startTime, createId, dispatch });
    expect(first.outcome).toBe("started");
    expect(second).toEqual({ outcome: "already-running", jobId: first.outcome === "started" ? first.jobId : "" });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("lets only one of two concurrent workers run, including a retry of the same job", async () => {
    const { started, store, token } = await startedJob();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const sync = vi.fn(async () => {
      calls += 1;
      await gate;
      return report();
    });
    const input = {
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync,
    };
    const first = executeMarketingCalendarSyncJob(input);
    await vi.waitFor(() => expect(calls).toBe(1));
    const second = await executeMarketingCalendarSyncJob({ ...input, sync: vi.fn(async () => report()) });
    expect(second).toMatchObject({ ran: false, reason: "in-progress" });
    release();
    await first;
    expect(calls).toBe(1);
  });

  it("lets a stale background retry take over a dead worker exactly once", async () => {
    const { started, store, token } = await startedJob();
    const current = await store.getLock();
    if (!current.record || !current.etag) throw new Error("missing lock");
    await store.writeLock(
      {
        ...current.record,
        executionId: "00000000-0000-4000-8000-000000000099",
        heartbeatAt: new Date(startTime.getTime() - 120_000).toISOString(),
        expiresAt: new Date(startTime.getTime() + 60_000).toISOString(),
      },
      { onlyIfMatch: current.etag },
    );
    let calls = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sync = vi.fn(async () => {
      calls += 1;
      await gate;
      return report();
    });
    const input = { store, jobId: started.jobId, token, now: () => startTime, createId: nextId, sync };
    const first = executeMarketingCalendarSyncJob(input);
    await vi.waitFor(() => expect(calls).toBe(1));
    const duplicate = await executeMarketingCalendarSyncJob({
      ...input,
      sync: vi.fn(async () => report()),
    });
    expect(duplicate.ran).toBe(false);
    release();
    expect((await first).ran).toBe(true);
    expect(calls).toBe(1);
  });

  it("does not let an expired worker overwrite a newer worker's lock or results", async () => {
    const { started, store, token } = await startedJob();
    let releaseOld = () => {};
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    let oldEntered = false;
    const oldRun = executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () => {
        oldEntered = true;
        await oldGate;
        return report({ created: 1, updated: 0 });
      },
    });
    await vi.waitFor(() => expect(oldEntered).toBe(true));

    const current = await store.getLock();
    if (!current.record || !current.etag) throw new Error("missing lock");
    await store.writeLock(
      { ...current.record, heartbeatAt: new Date(startTime.getTime() - 120_000).toISOString() },
      { onlyIfMatch: current.etag },
    );

    let releaseNew = () => {};
    const newGate = new Promise<void>((resolve) => {
      releaseNew = resolve;
    });
    let newEntered = false;
    const newRun = executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () => {
        newEntered = true;
        await newGate;
        return report({ created: 9, updated: 4 });
      },
    });
    await vi.waitFor(() => expect(newEntered).toBe(true));
    const ownedByNew = await store.getLock();
    const newExecutionId = ownedByNew.record?.executionId;
    expect(newExecutionId).toBeTruthy();

    releaseOld();
    expect(await oldRun).toMatchObject({ ran: false, status: "skipped", reason: "lost-lease" });
    expect(await store.getJob(started.jobId)).toMatchObject({
      record: expect.objectContaining({ status: "running", created: 0, executionId: newExecutionId }),
    });
    expect((await store.getLock()).record?.executionId).toBe(newExecutionId);
    expect(Date.parse((await store.getLock()).record?.expiresAt ?? "")).toBeGreaterThan(startTime.getTime());

    releaseNew();
    expect(await newRun).toEqual({ ran: true, status: "succeeded" });
    const job = await readMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      now: new Date(startTime.getTime() + 1000),
    });
    expect(job).toMatchObject({ status: "succeeded", created: 9, updated: 4, deleted: 0 });
  });

  it("does not let a finished older worker replace a newer sync", async () => {
    const { started, store, token } = await startedJob();
    let releaseOld = () => {};
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    let oldEntered = false;
    const oldRun = executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () => {
        oldEntered = true;
        await oldGate;
        return report({ created: 1, updated: 1 });
      },
    });
    await vi.waitFor(() => expect(oldEntered).toBe(true));

    const later = new Date(startTime.getTime() + LOCK_TTL_MS + 1000);
    const dispatch = vi.fn(async () => "accepted" as const);
    const newer = await startMarketingCalendarSync({
      store,
      origin,
      now: later,
      createId: nextId,
      dispatch,
    });
    expect(newer.outcome).toBe("started");
    if (newer.outcome !== "started") return;
    const newerLock = await store.getLock();
    const newerToken = newerLock.record?.token ?? "";
    await executeMarketingCalendarSyncJob({
      store,
      jobId: newer.jobId,
      token: newerToken,
      now: () => later,
      createId: nextId,
      sync: async () => report({ created: 7, updated: 3 }),
    });

    releaseOld();
    expect(await oldRun).toMatchObject({ ran: false, reason: "lost-lease" });
    const newerJob = await readMarketingCalendarSyncJob({
      store,
      jobId: newer.jobId,
      now: new Date(later.getTime() + 1000),
    });
    expect(newerJob).toMatchObject({ status: "succeeded", created: 7, updated: 3, deleted: 0 });
    const lock = await store.getLock();
    expect(lock.record?.jobId).toBe(newer.jobId);
    expect(lock.record?.token).toBe(newerToken);
    expect(lock.record?.executionId).not.toBeNull();
    expect(Date.parse(lock.record?.expiresAt ?? "")).toBeLessThanOrEqual(later.getTime());
  });

  it("refuses a worker that does not hold the lock token", async () => {
    const { started, store } = await startedJob();
    const sync = vi.fn(async () => report());
    const result = await executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token: "00000000-0000-4000-8000-000000009999",
      now: () => startTime,
      createId: nextId,
      sync,
    });
    expect(result).toMatchObject({ ran: false, reason: "not-owner" });
    expect(sync).not.toHaveBeenCalled();
  });

  it("releases the lock when the sync fails and records a safe error", async () => {
    const { started, store, token } = await startedJob();
    const failed = await executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () => {
        throw new Error('private_key "secret"');
      },
    });
    expect(failed).toEqual({ ran: true, status: "failed" });
    const job = await readMarketingCalendarSyncJob({ store, jobId: started.jobId, now: startTime });
    expect(job?.status).toBe("failed");
    expect(job?.error).toBe("Marketing calendar sync failed.");
    expect(JSON.stringify(job)).not.toContain("private_key");
    const lock = await store.getLock();
    expect(lock.record && Date.parse(lock.record.expiresAt) <= startTime.getTime()).toBe(true);

    const dispatch = vi.fn(async () => "accepted" as const);
    const again = await startMarketingCalendarSync({
      store,
      origin,
      now: new Date(startTime.getTime() + 1000),
      createId: nextId,
      dispatch,
    });
    expect(again.outcome).toBe("started");
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("keeps a caught calendar error for the page and still does not delete", async () => {
    const { started, store, token } = await startedJob();
    await executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () => {
        throw new MarketingCalendarError("ActiveCampaign returned HTTP 504.");
      },
    });
    const job = await readMarketingCalendarSyncJob({ store, jobId: started.jobId, now: startTime });
    expect(job?.error).toBe("ActiveCampaign returned HTTP 504.");
    expect(job?.deleted).toBe(0);
  });

  it("stores proposed deletions without applying them", async () => {
    const { started, store, token } = await startedJob();
    await executeMarketingCalendarSyncJob({
      store,
      jobId: started.jobId,
      token,
      now: () => startTime,
      createId: nextId,
      sync: async () =>
        report({
          proposedDeletions: [
            { campaignId: "44", title: "Old send", googleEventId: "owned-2", reason: "schedule-cleared" },
          ],
          skippedConflicts: [
            {
              campaignId: "42",
              title: "October What's New",
              manualSummary: "October What's New",
              reason: "title",
            },
          ],
        }),
    });
    const job = await readMarketingCalendarSyncJob({ store, jobId: started.jobId, now: startTime });
    expect(job).toMatchObject({ deleted: 0, skipped: 1 });
    expect(job?.proposedDeletions).toEqual([
      expect.objectContaining({ campaignId: "44", reason: "schedule-cleared" }),
    ]);
  });

  it("expires an abandoned lock so a later sync can start", async () => {
    const { started, store } = await startedJob();
    const later = new Date(startTime.getTime() + LOCK_TTL_MS + 1000);
    const abandoned = await readMarketingCalendarSyncJob({ store, jobId: started.jobId, now: later });
    expect(abandoned).toMatchObject({
      status: "failed",
      error: "The sync stopped before it finished. Run it again.",
    });
    const dispatch = vi.fn(async () => "accepted" as const);
    const again = await startMarketingCalendarSync({
      store,
      origin,
      now: later,
      createId: nextId,
      dispatch,
    });
    expect(again.outcome).toBe("started");
    if (again.outcome === "started") expect(again.jobId).not.toBe(started.jobId);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not keep the lock when the background worker cannot be reached", async () => {
    const store = createMemorySyncJobStore();
    const started = await startMarketingCalendarSync({
      store,
      origin,
      now: startTime,
      createId: nextId,
      dispatch: async () => "unreachable",
    });
    expect(started).toEqual({
      outcome: "start-failed",
      error: "The sync could not be started. Run it again.",
    });
    const lock = await store.getLock();
    expect(lock.record && Date.parse(lock.record.expiresAt) <= startTime.getTime()).toBe(true);
    const retry = await startMarketingCalendarSync({
      store,
      origin,
      now: startTime,
      createId: nextId,
      dispatch: async () => "accepted",
    });
    expect(retry.outcome).toBe("started");
  });

  it("writes the lock with a conditional set, which Netlify Blobs actually enforces", async () => {
    const writes: Array<{ key: string; body: string; options?: { onlyIfNew?: boolean; onlyIfMatch?: string } }> = [];
    const store = createBlobSyncJobStore({
      async getWithMetadata() {
        return null;
      },
      async set(key, data, options) {
        writes.push({ key, body: data, options });
        return { modified: true, etag: "etag-1" };
      },
    });
    const written = await store.writeLock(
      {
        jobId: "00000000-0000-4000-8000-000000000010",
        token: "00000000-0000-4000-8000-000000000011",
        executionId: null,
        heartbeatAt: null,
        acquiredAt: startTime.toISOString(),
        expiresAt: new Date(startTime.getTime() + LOCK_TTL_MS).toISOString(),
      },
      { onlyIfNew: true },
    );
    expect(written).toEqual({ modified: true, etag: "etag-1" });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.key).toBe(MARKETING_CALENDAR_LOCK_KEY);
    expect(writes[0]?.options).toEqual({ onlyIfNew: true });
    expect(JSON.parse(writes[0]?.body ?? "{}")).toMatchObject({ jobId: "00000000-0000-4000-8000-000000000010" });
  });

  it("describes the running job and the finished counts", () => {
    expect(marketingCalendarSyncMessage({ status: "running" })).toBe(MARKETING_CALENDAR_SYNCING_MESSAGE);
    expect(marketingCalendarSyncMessage({ status: "running" })).toBe("Syncing your calendar...");
    expect(marketingCalendarSyncMessage({ status: "succeeded", created: 1, updated: 2, skipped: 3 })).toBe(
      "Added 1, updated 2, skipped 3.",
    );
    expect(marketingCalendarSyncMessage({ status: "failed", error: "ActiveCampaign returned HTTP 504." })).toBe(
      "ActiveCampaign returned HTTP 504.",
    );
    const page = readFileSync(resolve(root, "src/pages/admin/marketing-calendar.astro"), "utf8");
    expect(page).toContain("MARKETING_CALENDAR_SYNCING_MESSAGE");
    expect(page).toContain('method: "GET"');
  });
});
