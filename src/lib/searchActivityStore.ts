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
  } catch {
    return null;
  }
}

async function backend(): Promise<BlobLike> {
  if (!backendPromise) {
    backendPromise = (async () => {
      const blobs = await netlifyBlobBackend();
      if (blobs) return blobs;
      if (resolveSearchActivityEnvironment() === "production") {
        throw new Error("Search activity store is unavailable.");
      }
      return fileBackend(LOCAL_DIR);
    })();
  }
  return backendPromise;
}

/** Test hook. Production code does not pass a directory. */
export function resetSearchActivityBackendForTests(): void {
  backendPromise = null;
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
  const store = await backend();
  await store.set(searchActivityEventKey(event), JSON.stringify(event));
}

const MAX_EVENTS = 5000;

export async function listSearchActivityEvents(): Promise<SearchActivityEvent[]> {
  const store = await backend();
  const { blobs } = await store.list({ prefix: SEARCH_ACTIVITY_EVENT_PREFIX });
  const keys = blobs
    .map((blob) => blob.key)
    .filter((key) => key.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, MAX_EVENTS);
  const events: SearchActivityEvent[] = [];
  for (const key of keys) {
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SearchActivityEvent;
      if (!parsed || typeof parsed !== "object") continue;
      if (!isSearchActivityArea(parsed.area)) continue;
      if (typeof parsed.createdAt !== "string") continue;
      events.push(parsed);
    } catch {
      /* skip a damaged record */
    }
  }
  return events;
}
