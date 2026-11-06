import { getStore } from "@netlify/blobs";

import type { ProposedDeletion, SkippedConflict, SyncChange } from "./runSync";

/** Strongly consistent Netlify Blobs store. Not process memory. */
export const MARKETING_CALENDAR_SYNC_STORE = "marketing-calendar-sync";
export const MARKETING_CALENDAR_LOCK_KEY = "lock";

/**
 * A live worker refreshes this every few seconds. A crashed worker stops
 * refreshing, so the next sync can take the lock without waiting 15 minutes.
 */
export const LOCK_TTL_MS = 3 * 60 * 1000;

/** Longer than the refresh interval, shorter than Netlify's background retry delay. */
export const HEARTBEAT_STALE_MS = 90 * 1000;

export const HEARTBEAT_INTERVAL_MS = 15 * 1000;

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WriteCondition = { onlyIfNew: true } | { onlyIfMatch: string };

export interface LockRecord {
  jobId: string;
  token: string;
  executionId: string | null;
  heartbeatAt: string | null;
  acquiredAt: string;
  expiresAt: string;
}

export interface SyncJobRecord {
  id: string;
  status: "running" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  /** Worker that currently owns this run. Result writes must match it. */
  executionId: string | null;
  created: number;
  updated: number;
  skipped: number;
  deleted: 0;
  changes: SyncChange[];
  proposedDeletions: ProposedDeletion[];
  skippedConflicts: SkippedConflict[];
}

export interface Stored<T> {
  record: T | null;
  etag?: string;
}

export interface SyncJobStore {
  getLock(): Promise<Stored<LockRecord>>;
  writeLock(record: LockRecord, condition: WriteCondition): Promise<{ modified: boolean; etag?: string }>;
  getJob(id: string): Promise<Stored<SyncJobRecord>>;
  writeJob(record: SyncJobRecord, condition: WriteCondition): Promise<{ modified: boolean; etag?: string }>;
}

export function isSyncJobId(value: string): boolean {
  return JOB_ID_RE.test(value);
}

export function jobKey(id: string): string {
  return `jobs/${id}`;
}

export function isLockExpired(lock: LockRecord, now: Date): boolean {
  const expires = Date.parse(lock.expiresAt);
  return !Number.isFinite(expires) || expires <= now.getTime();
}

export function isHeartbeatFresh(lock: LockRecord, now: Date): boolean {
  if (!lock.executionId || !lock.heartbeatAt) return false;
  const heartbeat = Date.parse(lock.heartbeatAt);
  return Number.isFinite(heartbeat) && now.getTime() - heartbeat < HEARTBEAT_STALE_MS;
}

export function lockExpiry(now: Date): string {
  return new Date(now.getTime() + LOCK_TTL_MS).toISOString();
}

function isStringArrayField(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function parseLockRecord(value: unknown): LockRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LockRecord>;
  if (!isSyncJobId(String(record.jobId ?? "")) || !isSyncJobId(String(record.token ?? ""))) return null;
  if (typeof record.acquiredAt !== "string" || typeof record.expiresAt !== "string") return null;
  if (record.executionId != null && typeof record.executionId !== "string") return null;
  if (record.heartbeatAt != null && typeof record.heartbeatAt !== "string") return null;
  return {
    jobId: record.jobId as string,
    token: record.token as string,
    executionId: record.executionId ?? null,
    heartbeatAt: record.heartbeatAt ?? null,
    acquiredAt: record.acquiredAt,
    expiresAt: record.expiresAt,
  };
}

export function parseSyncJobRecord(value: unknown): SyncJobRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<SyncJobRecord>;
  if (!isSyncJobId(String(record.id ?? ""))) return null;
  if (record.status !== "running" && record.status !== "succeeded" && record.status !== "failed") return null;
  if (typeof record.startedAt !== "string") return null;
  if (record.finishedAt != null && typeof record.finishedAt !== "string") return null;
  if (record.error != null && typeof record.error !== "string") return null;
  if (record.executionId != null && typeof record.executionId !== "string") return null;
  if (record.deleted !== 0) return null;
  if (!isStringArrayField(record.changes) || !isStringArrayField(record.proposedDeletions)) return null;
  if (!isStringArrayField(record.skippedConflicts)) return null;
  return {
    id: record.id,
    status: record.status,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt ?? null,
    error: record.error ?? null,
    executionId: record.executionId ?? null,
    created: numberOrZero(record.created),
    updated: numberOrZero(record.updated),
    skipped: numberOrZero(record.skipped),
    deleted: 0,
    changes: record.changes as SyncChange[],
    proposedDeletions: record.proposedDeletions as ProposedDeletion[],
    skippedConflicts: record.skippedConflicts as SkippedConflict[],
  };
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

type ConditionalBlobStore = {
  getWithMetadata(
    key: string,
    options: { type: "json"; consistency: "strong" },
  ): Promise<{ data: unknown; etag?: string } | null>;
  set(
    key: string,
    data: string,
    options?: { onlyIfNew?: boolean; onlyIfMatch?: string },
  ): Promise<{ modified: boolean; etag?: string }>;
};

/**
 * Conditional writes go through `set`, not `setJSON`.
 * @netlify/blobs 10.7.4 `setJSON` does not send If-Match / If-None-Match,
 * so two simultaneous writes would both report success.
 */
export function createBlobSyncJobStore(
  blobs: ConditionalBlobStore = getStore({
    name: MARKETING_CALENDAR_SYNC_STORE,
    consistency: "strong",
  }) as ConditionalBlobStore,
): SyncJobStore {
  return {
    async getLock() {
      const found = await blobs.getWithMetadata(MARKETING_CALENDAR_LOCK_KEY, {
        type: "json",
        consistency: "strong",
      });
      if (!found) return { record: null };
      return { record: parseLockRecord(found.data), etag: found.etag };
    },
    async writeLock(record, condition) {
      const written = await blobs.set(MARKETING_CALENDAR_LOCK_KEY, JSON.stringify(record), condition);
      return { modified: written.modified, etag: written.etag };
    },
    async getJob(id) {
      const found = await blobs.getWithMetadata(jobKey(id), { type: "json", consistency: "strong" });
      if (!found) return { record: null };
      return { record: parseSyncJobRecord(found.data), etag: found.etag };
    },
    async writeJob(record, condition) {
      const written = await blobs.set(jobKey(record.id), JSON.stringify(record), condition);
      return { modified: written.modified, etag: written.etag };
    },
  };
}

export function createMemorySyncJobStore(): SyncJobStore {
  let lock: { record: LockRecord; etag: string } | null = null;
  const jobs = new Map<string, { record: SyncJobRecord; etag: string }>();
  let sequence = 0;
  const nextEtag = () => `etag-${++sequence}`;

  return {
    async getLock() {
      if (!lock) return { record: null };
      return { record: structuredClone(lock.record), etag: lock.etag };
    },
    async writeLock(record, condition) {
      if ("onlyIfNew" in condition && condition.onlyIfNew) {
        if (lock) return { modified: false };
      } else if (!lock || lock.etag !== condition.onlyIfMatch) {
        return { modified: false };
      }
      const etag = nextEtag();
      lock = { record: structuredClone(record), etag };
      return { modified: true, etag };
    },
    async getJob(id) {
      const found = jobs.get(id);
      if (!found) return { record: null };
      return { record: structuredClone(found.record), etag: found.etag };
    },
    async writeJob(record, condition) {
      const found = jobs.get(record.id);
      if ("onlyIfNew" in condition && condition.onlyIfNew) {
        if (found) return { modified: false };
      } else if (!found || found.etag !== condition.onlyIfMatch) {
        return { modified: false };
      }
      const etag = nextEtag();
      jobs.set(record.id, { record: structuredClone(record), etag });
      return { modified: true, etag };
    },
  };
}
