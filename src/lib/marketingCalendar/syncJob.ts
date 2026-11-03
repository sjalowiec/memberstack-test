import { randomUUID } from "node:crypto";

import { MarketingCalendarError, scrubSensitive } from "./errors";
import { runMarketingCalendarSync, type MarketingCalendarSyncReport } from "./runSync";
import {
  createBlobSyncJobStore,
  isHeartbeatFresh,
  isLockExpired,
  isSyncJobId,
  lockExpiry,
  type LockRecord,
  type SyncJobRecord,
  type SyncJobStore,
} from "./syncJobStore";

export const MARKETING_CALENDAR_BACKGROUND_PATH = "/.netlify/functions/marketing-calendar-sync-background";

const START_FAILED = "The sync could not be started. Run it again.";
const ABANDONED = "The sync stopped before it finished. Run it again.";
const GENERIC_FAILURE = "Marketing calendar sync failed.";

export interface SyncJobPublic {
  ok: true;
  status: SyncJobRecord["status"];
  jobId: string;
  created: number;
  updated: number;
  skipped: number;
  deleted: 0;
  error: string | null;
  changes: SyncJobRecord["changes"];
  proposedDeletions: SyncJobRecord["proposedDeletions"];
  skippedConflicts: SyncJobRecord["skippedConflicts"];
}

export type StartSyncResult =
  | { outcome: "started" | "already-running"; jobId: string }
  | { outcome: "start-failed"; error: string };

export type ExecuteSyncResult = {
  ran: boolean;
  status: SyncJobRecord["status"] | "skipped";
  reason?: string;
};

type Dispatch = (input: { origin: string; jobId: string; token: string }) => Promise<"accepted" | "unreachable">;

function emptyJob(id: string, startedAt: string): SyncJobRecord {
  return {
    id,
    status: "running",
    startedAt,
    finishedAt: null,
    error: null,
    executionId: null,
    created: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    changes: [],
    proposedDeletions: [],
    skippedConflicts: [],
  };
}

export function publicSyncJob(job: SyncJobRecord): SyncJobPublic {
  return {
    ok: true,
    status: job.status,
    jobId: job.id,
    created: job.created,
    updated: job.updated,
    skipped: job.skipped,
    deleted: 0,
    error: job.error,
    changes: job.changes,
    proposedDeletions: job.proposedDeletions,
    skippedConflicts: job.skippedConflicts,
  };
}

function failureMessage(error: unknown): string {
  if (error instanceof MarketingCalendarError) return error.message;
  return GENERIC_FAILURE;
}

async function updateRunningJob(
  store: SyncJobStore,
  id: string,
  patch: Partial<SyncJobRecord>,
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await store.getJob(id);
    if (!current.record || current.record.status !== "running" || !current.etag) return;
    const written = await store.writeJob({ ...current.record, ...patch, id, deleted: 0 }, { onlyIfMatch: current.etag });
    if (written.modified) return;
  }
}

/** Records which worker owns the job. Fails if that job is no longer running. */
async function stampJobExecution(store: SyncJobStore, id: string, executionId: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await store.getJob(id);
    if (!current.record || current.record.status !== "running" || !current.etag) return false;
    const written = await store.writeJob({ ...current.record, executionId }, { onlyIfMatch: current.etag });
    if (written.modified) return true;
  }
  return false;
}

/**
 * Writes results only for the worker that still owns this run.
 * An older worker loses once a newer claim has stamped its execution id.
 */
async function updateOwnedRunningJob(
  store: SyncJobStore,
  id: string,
  executionId: string,
  patch: Partial<SyncJobRecord>,
): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await store.getJob(id);
    if (!current.record || current.record.status !== "running" || !current.etag) return false;
    if (current.record.executionId !== executionId) return false;
    const written = await store.writeJob(
      { ...current.record, ...patch, id, executionId, deleted: 0 },
      { onlyIfMatch: current.etag },
    );
    if (written.modified) return true;
  }
  return false;
}

async function expireOwnedLock(
  store: SyncJobStore,
  owner: { token: string; executionId: string | null },
): Promise<void> {
  const current = await store.getLock();
  if (!current.record || !current.etag) return;
  if (current.record.token !== owner.token) return;
  if (owner.executionId === null) {
    if (current.record.executionId) return;
  } else if (current.record.executionId !== owner.executionId) {
    return;
  }
  await store.writeLock(
    { ...current.record, expiresAt: new Date(0).toISOString(), heartbeatAt: new Date(0).toISOString() },
    { onlyIfMatch: current.etag },
  );
}

export async function dispatchMarketingCalendarBackground(input: {
  origin: string;
  jobId: string;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<"accepted" | "unreachable"> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetchImpl(`${input.origin}${MARKETING_CALENDAR_BACKGROUND_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: input.jobId, token: input.token }),
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status === 202 || response.status === 200) return "accepted";
    return "unreachable";
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || name === "TimeoutError") return "accepted";
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export async function startMarketingCalendarSync(input: {
  store?: SyncJobStore;
  origin: string;
  now?: Date;
  createId?: () => string;
  dispatch?: Dispatch;
}): Promise<StartSyncResult> {
  const store = input.store ?? createBlobSyncJobStore();
  const now = input.now ?? new Date();
  const createId = input.createId ?? randomUUID;
  const dispatch = input.dispatch ?? ((job) => dispatchMarketingCalendarBackground({ ...job, origin: input.origin }));
  const current = await store.getLock();
  if (current.record && !isLockExpired(current.record, now)) {
    return { outcome: "already-running", jobId: current.record.jobId };
  }

  if (current.record?.jobId) {
    await updateRunningJob(store, current.record.jobId, {
      status: "failed",
      finishedAt: now.toISOString(),
      error: ABANDONED,
    });
  }

  const jobId = createId();
  const token = createId();
  if (!isSyncJobId(jobId) || !isSyncJobId(token)) {
    return { outcome: "start-failed", error: START_FAILED };
  }
  const lock: LockRecord = {
    jobId,
    token,
    executionId: null,
    heartbeatAt: null,
    acquiredAt: now.toISOString(),
    expiresAt: lockExpiry(now),
  };
  const condition = current.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true as const };
  const written = await store.writeLock(lock, condition);
  if (!written.modified) {
    const winner = await store.getLock();
    if (winner.record && !isLockExpired(winner.record, now)) {
      return { outcome: "already-running", jobId: winner.record.jobId };
    }
    return { outcome: "start-failed", error: START_FAILED };
  }

  const jobWritten = await store.writeJob(emptyJob(jobId, now.toISOString()), { onlyIfNew: true });
  if (!jobWritten.modified) {
    await expireOwnedLock(store, { token, executionId: null });
    return { outcome: "start-failed", error: START_FAILED };
  }

  const accepted = await dispatch({ origin: input.origin, jobId, token }).catch(() => "unreachable" as const);
  if (accepted === "unreachable") {
    await updateRunningJob(store, jobId, {
      status: "failed",
      finishedAt: now.toISOString(),
      error: START_FAILED,
    });
    await expireOwnedLock(store, { token, executionId: null });
    return { outcome: "start-failed", error: START_FAILED };
  }
  return { outcome: "started", jobId };
}

export async function readMarketingCalendarSyncJob(input: {
  store?: SyncJobStore;
  jobId: string;
  now?: Date;
}): Promise<SyncJobPublic | null> {
  if (!isSyncJobId(input.jobId)) return null;
  const store = input.store ?? createBlobSyncJobStore();
  const now = input.now ?? new Date();
  const found = await store.getJob(input.jobId);
  if (!found.record) return null;
  if (found.record.status !== "running") return publicSyncJob(found.record);

  const lock = await store.getLock();
  const held = lock.record?.jobId === input.jobId && !isLockExpired(lock.record, now);
  if (held) return publicSyncJob(found.record);

  await updateRunningJob(store, input.jobId, {
    status: "failed",
    finishedAt: now.toISOString(),
    error: ABANDONED,
  });
  const reread = await store.getJob(input.jobId);
  return publicSyncJob(reread.record ?? { ...found.record, status: "failed", error: ABANDONED, finishedAt: now.toISOString() });
}

async function claimExecution(
  store: SyncJobStore,
  jobId: string,
  token: string,
  now: Date,
  createId: () => string,
): Promise<{ claimed: true; executionId: string } | { claimed: false; reason: string }> {
  const current = await store.getLock();
  if (!current.record || !current.etag) return { claimed: false, reason: "missing" };
  if (current.record.jobId !== jobId || current.record.token !== token) return { claimed: false, reason: "not-owner" };
  if (isLockExpired(current.record, now)) return { claimed: false, reason: "expired" };
  if (isHeartbeatFresh(current.record, now)) return { claimed: false, reason: "in-progress" };
  const executionId = createId();
  if (!isSyncJobId(executionId)) return { claimed: false, reason: "invalid-execution" };
  const written = await store.writeLock(
    {
      ...current.record,
      executionId,
      heartbeatAt: now.toISOString(),
      expiresAt: lockExpiry(now),
    },
    { onlyIfMatch: current.etag },
  );
  if (!written.modified) return { claimed: false, reason: "lost-race" };
  const stamped = await stampJobExecution(store, jobId, executionId);
  if (!stamped) {
    await expireOwnedLock(store, { token, executionId });
    return { claimed: false, reason: "lost-race" };
  }
  return { claimed: true, executionId };
}

async function renewHeartbeat(
  store: SyncJobStore,
  owner: { jobId: string; token: string; executionId: string },
  now: Date,
): Promise<boolean> {
  const current = await store.getLock();
  if (!current.record || !current.etag) return false;
  if (
    current.record.jobId !== owner.jobId ||
    current.record.token !== owner.token ||
    current.record.executionId !== owner.executionId
  ) {
    return false;
  }
  const written = await store.writeLock(
    { ...current.record, heartbeatAt: now.toISOString(), expiresAt: lockExpiry(now) },
    { onlyIfMatch: current.etag },
  );
  return written.modified;
}

function jobFromReport(job: SyncJobRecord, report: MarketingCalendarSyncReport, finishedAt: string): SyncJobRecord {
  return {
    ...job,
    status: "succeeded",
    finishedAt,
    error: null,
    created: report.created,
    updated: report.updated,
    skipped: report.skippedConflicts.length,
    deleted: 0,
    changes: report.changes,
    proposedDeletions: report.proposedDeletions,
    skippedConflicts: report.skippedConflicts,
  };
}

export async function executeMarketingCalendarSyncJob(input: {
  store?: SyncJobStore;
  env?: NodeJS.ProcessEnv;
  jobId: string;
  token: string;
  now?: () => Date;
  createId?: () => string;
  heartbeatIntervalMs?: number;
  sync?: typeof runMarketingCalendarSync;
}): Promise<ExecuteSyncResult> {
  const store = input.store ?? createBlobSyncJobStore();
  const now = input.now ?? (() => new Date());
  const createId = input.createId ?? randomUUID;
  const sync = input.sync ?? runMarketingCalendarSync;
  const claim = await claimExecution(store, input.jobId, input.token, now(), createId);
  if (!claim.claimed) {
    if (claim.reason === "expired") {
      await updateRunningJob(store, input.jobId, {
        status: "failed",
        finishedAt: now().toISOString(),
        error: ABANDONED,
      });
    }
    return { ran: false, status: "skipped", reason: claim.reason };
  }

  const owner = { jobId: input.jobId, token: input.token, executionId: claim.executionId };
  const intervalMs = input.heartbeatIntervalMs ?? 0;
  let chain: Promise<void> = Promise.resolve();
  let stop = false;
  const timer =
    intervalMs > 0
      ? setInterval(() => {
          chain = chain.then(async () => {
            if (stop) return;
            try {
              await renewHeartbeat(store, owner, now());
            } catch {
              // A missed refresh expires the lease. It does not start a second sync.
            }
          });
        }, intervalMs)
      : null;

  try {
    try {
      const report = await sync({ env: input.env ?? process.env, dryRun: false });
      stop = true;
      await chain;
      const current = await store.getJob(input.jobId);
      const saved =
        current.record != null &&
        (await updateOwnedRunningJob(
          store,
          input.jobId,
          claim.executionId,
          jobFromReport(current.record, report, now().toISOString()),
        ));
      if (!saved) return { ran: false, status: "skipped", reason: "lost-lease" };
      return { ran: true, status: "succeeded" };
    } catch (error) {
      stop = true;
      await chain;
      const message = scrubSensitive(failureMessage(error)).slice(0, 500);
      const saved = await updateOwnedRunningJob(store, input.jobId, claim.executionId, {
        status: "failed",
        finishedAt: now().toISOString(),
        error: message,
      });
      console.error("[marketing-calendar-sync]", message);
      if (!saved) return { ran: false, status: "skipped", reason: "lost-lease" };
      return { ran: true, status: "failed" };
    }
  } finally {
    if (timer) clearInterval(timer);
    stop = true;
    await chain;
    await expireOwnedLock(store, owner);
  }
}

export function backgroundSyncBody(value: unknown): { jobId: string; token: string } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { jobId?: unknown; token?: unknown };
  if (typeof body.jobId !== "string" || typeof body.token !== "string") return null;
  if (!isSyncJobId(body.jobId) || !isSyncJobId(body.token)) return null;
  return { jobId: body.jobId, token: body.token };
}
