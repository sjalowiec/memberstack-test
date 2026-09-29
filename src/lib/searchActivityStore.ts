/**
 * Append-only search activity store.
 * Netlify Blobs on a configured site. Local astro dev uses a gitignored
 * directory under `.netlify/` so a dev check can read the same events back.
 * Search terms are never written to application logs.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getStore, type Store } from "@netlify/blobs";

import {
  classifySearchTerm,
  cleanResultCount,
  isSearchActivityArea,
  resolveSearchActivityEnvironment,
  resolveStoredIdentity,
  type SearchActivityEvent,
} from "./searchActivity";

export const SEARCH_ACTIVITY_BLOB_STORE = "search-activity-log";
export const SEARCH_ACTIVITY_EVENT_PREFIX = "events/";

const LOCAL_DIR = path.join(process.cwd(), ".netlify", "search-activity-dev");

type BlobLike = {
  set(key: string, value: string): Promise<void>;
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>;
  get(key: string, options: { type: "text" }): Promise<string | null>;
};

let backendPromise: Promise<BlobLike> | null = null;
let connectOverride: (() => Promise<BlobLike>) | null = null;

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "Error";
}

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function searchActivityEventKey(event: { id: string; createdAt: string }): string {
  const day = event.createdAt.slice(0, 10);
  return `${SEARCH_ACTIVITY_EVENT_PREFIX}${sanitizeKeySegment(day)}/${sanitizeKeySegment(event.id)}.json`;
}

function fileBackend(directory: string): BlobLike {
  return {
    async set(key, value) {
      const file = path.join(directory, key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, value, "utf8");
    },
    async list() {
      const eventsDir = path.join(directory, "events");
      const blobs: Array<{ key: string }> = [];
      let days: string[] = [];
      try {
        days = await readdir(eventsDir);
      } catch {
        return { blobs };
      }
      for (const day of days) {
        const dayDir = path.join(eventsDir, day);
        let files: string[] = [];
        try {
          files = await readdir(dayDir);
        } catch {
          continue;
        }
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          blobs.push({ key: `${SEARCH_ACTIVITY_EVENT_PREFIX}${day}/${file}` });
        }
      }
      return { blobs };
    },
    async get(key) {
      try {
        return await readFile(path.join(directory, key), "utf8");
      } catch {
        return null;
      }
    },
  };
}

async function netlifyBlobBackend(): Promise<BlobLike | null> {
  try {
    const store: Store = getStore({
      name: SEARCH_ACTIVITY_BLOB_STORE,
      consistency: "strong",
    });
    await store.list({ prefix: SEARCH_ACTIVITY_EVENT_PREFIX });
    return {
      set: (key, value) => store.set(key, value),
      list: (options) => store.list(options),
      get: (key, options) => store.get(key, options),
    };
  } catch (error) {
    if (resolveSearchActivityEnvironment() === "production") throw error;
    return null;
  }
}

async function connectBackend(): Promise<BlobLike> {
  if (connectOverride) return connectOverride();
  const blobs = await netlifyBlobBackend();
  if (blobs) return blobs;
  if (resolveSearchActivityEnvironment() === "production") {
    throw new Error("Search activity store is unavailable.");
  }
  return fileBackend(LOCAL_DIR);
}

/**
 * A successful connection is reused. A failed connection is not: one storage
 * error must not make every later read on this server fail.
 */
async function backend(): Promise<BlobLike> {
  if (backendPromise) return backendPromise;
  const pending = connectBackend();
  backendPromise = pending;
  try {
    return await pending;
  } catch (error) {
    if (backendPromise === pending) backendPromise = null;
    throw error;
  }
}

function dropBackend(): void {
  backendPromise = null;
}

/** Test hook. Production code does not pass a directory. */
export function resetSearchActivityBackendForTests(): void {
  backendPromise = null;
  connectOverride = null;
}

/** Test hook for a connector that can fail and then recover. */
export function useSearchActivityConnectorForTests(
  connect: (() => Promise<BlobLike>) | null,
): void {
  backendPromise = null;
  connectOverride = connect;
}

export function useFileSearchActivityBackendForTests(directory: string): void {
  backendPromise = Promise.resolve(fileBackend(directory));
}

export function buildSearchActivityEvent(
  raw: unknown,
  options: {
    verifiedMemberId?: string | null;
    now?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): { ok: true; event: SearchActivityEvent } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  const body = raw as Record<string, unknown>;
  if (!isSearchActivityArea(body.area)) {
    return { ok: false, error: "Search area must be global or video." };
  }
  const resultCount = cleanResultCount(body.resultCount);
  if (resultCount === null) {
    return { ok: false, error: "Result count is required." };
  }

  const omittedFlag = body.termOmitted === "personal";
  const classified = classifySearchTerm(body.term);
  if (!omittedFlag && classified.empty) {
    return { ok: false, error: "Search term required." };
  }

  const identity = resolveStoredIdentity({
    verifiedMemberId: options.verifiedMemberId,
    clientIdentity: body.identity,
  });

  const event: SearchActivityEvent = {
    id: randomUUID(),
    createdAt: options.now ?? new Date().toISOString(),
    area: body.area,
    resultCount,
    identity: identity.identity,
    environment: resolveSearchActivityEnvironment(options.env),
  };
  if (identity.memberId) event.memberId = identity.memberId;

  const omit = omittedFlag || (!classified.empty && classified.omit);
  if (omit) {
    event.termOmitted = "personal";
  } else if (!classified.empty) {
    event.term = classified.term;
  }

  return { ok: true, event };
}

export async function appendSearchActivityEvent(event: SearchActivityEvent): Promise<void> {
  try {
    const store = await backend();
    await store.set(searchActivityEventKey(event), JSON.stringify(event));
  } catch (error) {
    dropBackend();
    throw error;
  }
}

const MAX_EVENTS = 5000;

export type SearchActivityRead = {
  events: SearchActivityEvent[];
  /** Records that were listed but could not be read. A total failure throws instead. */
  unreadable: number;
};

async function readStore(store: BlobLike): Promise<SearchActivityRead> {
  const listed = await store.list({ prefix: SEARCH_ACTIVITY_EVENT_PREFIX });
  const blobs = Array.isArray(listed?.blobs) ? listed.blobs : [];
  const keys = blobs
    .map((blob) => blob?.key)
    .filter((key): key is string => typeof key === "string" && key.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_EVENTS);
  const events: SearchActivityEvent[] = [];
  let unreadable = 0;
  for (const key of keys) {
    try {
      const raw = await store.get(key, { type: "text" });
      if (typeof raw !== "string" || !raw) continue;
      const parsed = JSON.parse(raw) as SearchActivityEvent;
      if (!parsed || typeof parsed !== "object") {
        unreadable += 1;
        continue;
      }
      if (!isSearchActivityArea(parsed.area) || typeof parsed.createdAt !== "string") {
        unreadable += 1;
        continue;
      }
      events.push(parsed);
    } catch {
      unreadable += 1;
    }
  }
  if (keys.length > 0 && events.length === 0 && unreadable === keys.length) {
    throw new Error("Search activity records could not be read.");
  }
  return { events, unreadable };
}

export async function listSearchActivityEvents(): Promise<SearchActivityRead> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const store = await backend();
      return await readStore(store);
    } catch (error) {
      dropBackend();
      lastError = error;
    }
  }
  console.error("search activity read failed", errorName(lastError));
  throw lastError instanceof Error ? lastError : new Error("Search activity store is unavailable.");
}
