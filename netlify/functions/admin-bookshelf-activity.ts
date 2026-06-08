/**
 * Admin-only reporting for the Machine Knitter's Bookshelf activity log.
 *
 * Reads the append-only events written by `log-bookshelf-activity` (one Netlify
 * Blob per event under `events/{YYYY-MM-DD}/{id}.json` in the
 * `bookshelf-activity-log` store) and returns a summarized JSON report.
 *
 * - GET only. Admin-gated with the SAME allowlist used by the pattern-activity
 *   dashboard ({@link isActivityAdmin}): member id / email allowlist in prod,
 *   always-on in local dev (`ALLOW_DEV_PATTERN_USER`). Regular members get 403.
 * - Defaults to the last 30 days; optional `?days=7|30|90`.
 * - Defensive: missing/malformed blobs are skipped, never thrown.
 *
 * Privacy: the tracking function intentionally stores only `searchLength` (never
 * the raw search term), so no search text is ever read or returned here.
 */
import { getStore } from "@netlify/blobs";
import { isActivityAdmin } from "./lib/pattern-activity-store.js";
import {
  jsonResponse,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";

const STORE_NAME = "bookshelf-activity-log";
const EVENT_PREFIX = "events/";

const ALLOWED_DAYS = new Set([7, 30, 90]);
const DEFAULT_DAYS = 30;
const TOP_BOOKS_LIMIT = 10;
const RECENT_EVENTS_LIMIT = 50;
/** Safety cap on how many blobs we read in one report. */
const MAX_EVENTS_SCANNED = 5000;

interface BookshelfEvent {
  id?: string;
  eventType?: string;
  createdAt?: string;
  visitorId?: string;
  memberId?: string;
  sourcePage?: string;
  bookId?: string;
  bookTitle?: string;
  searchLength?: number;
  resultCount?: number;
  filterType?: string;
  filterValue?: string;
}

interface BookTally {
  bookId: string;
  bookTitle: string;
  count: number;
}

interface RecentEvent {
  id?: string;
  eventType: string;
  createdAt: string;
  bookId?: string;
  bookTitle?: string;
  resultCount?: number;
  filterType?: string;
}

interface BookshelfActivitySummary {
  days: number;
  since: string;
  totalEvents: number;
  bookshelfViewed: number;
  uniqueVisitors: number;
  bookDetailViews: number;
  searchesUsed: number;
  filtersUsed: number;
  libraryAdds: number;
  libraryRemoves: number;
  mostViewedBooks: BookTally[];
  mostAddedBooks: BookTally[];
  recentEvents: RecentEvent[];
}

function getEventStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

/** Reads `?days=`; only 7/30/90 are honored, anything else falls back to 30. */
function resolveDays(url: URL): number {
  const raw = parseInt(url.searchParams.get("days") ?? "", 10);
  return ALLOWED_DAYS.has(raw) ? raw : DEFAULT_DAYS;
}

/** `YYYY-MM-DD` for the start of the window (inclusive), `days` ago in UTC. */
function cutoffDateString(days: number): string {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}

/** Pulls the `YYYY-MM-DD` day bucket out of an `events/<day>/<id>.json` key. */
function dayFromKey(key: string): string | null {
  const match = key.match(/^events\/(\d{4}-\d{2}-\d{2})\//);
  return match ? match[1] : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Tolerant parse of one stored blob; returns null for anything malformed. */
function parseEvent(raw: string): BookshelfEvent | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    if (typeof parsed.eventType !== "string" || typeof parsed.createdAt !== "string") {
      return null;
    }
    return parsed as BookshelfEvent;
  } catch {
    return null;
  }
}

/** Builds top-N book tallies (by id, falling back to title) from a list of events. */
function topBooks(events: BookshelfEvent[]): BookTally[] {
  const tallies = new Map<string, BookTally>();
  for (const event of events) {
    const bookId = typeof event.bookId === "string" ? event.bookId.trim() : "";
    const bookTitle = typeof event.bookTitle === "string" ? event.bookTitle.trim() : "";
    const groupKey = bookId || bookTitle;
    if (!groupKey) continue;
    const existing = tallies.get(groupKey);
    if (existing) {
      existing.count += 1;
      if (!existing.bookTitle && bookTitle) existing.bookTitle = bookTitle;
    } else {
      tallies.set(groupKey, {
        bookId: bookId || groupKey,
        bookTitle: bookTitle || bookId || "Untitled",
        count: 1,
      });
    }
  }
  return [...tallies.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_BOOKS_LIMIT);
}

function summarize(events: BookshelfEvent[], days: number, since: string): BookshelfActivitySummary {
  const visitors = new Set<string>();
  const detailViews: BookshelfEvent[] = [];
  const libraryAddEvents: BookshelfEvent[] = [];

  let bookshelfViewed = 0;
  let bookDetailViews = 0;
  let searchesUsed = 0;
  let filtersUsed = 0;
  let libraryAdds = 0;
  let libraryRemoves = 0;

  for (const event of events) {
    if (typeof event.visitorId === "string" && event.visitorId) {
      visitors.add(event.visitorId);
    }
    switch (event.eventType) {
      case "bookshelf_viewed":
        bookshelfViewed += 1;
        break;
      case "bookshelf_book_viewed":
        bookDetailViews += 1;
        detailViews.push(event);
        break;
      case "bookshelf_search_used":
        searchesUsed += 1;
        break;
      case "bookshelf_filter_used":
        filtersUsed += 1;
        break;
      case "bookshelf_library_add":
        libraryAdds += 1;
        libraryAddEvents.push(event);
        break;
      case "bookshelf_library_remove":
        libraryRemoves += 1;
        break;
      default:
        break;
    }
  }

  const recentEvents: RecentEvent[] = [...events]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, RECENT_EVENTS_LIMIT)
    .map((event) => {
      const recent: RecentEvent = {
        id: event.id,
        eventType: String(event.eventType),
        createdAt: String(event.createdAt),
      };
      if (typeof event.bookId === "string" && event.bookId) recent.bookId = event.bookId;
      if (typeof event.bookTitle === "string" && event.bookTitle) recent.bookTitle = event.bookTitle;
      if (typeof event.resultCount === "number") recent.resultCount = event.resultCount;
      if (typeof event.filterType === "string" && event.filterType) recent.filterType = event.filterType;
      return recent;
    });

  return {
    days,
    since,
    totalEvents: events.length,
    bookshelfViewed,
    uniqueVisitors: visitors.size,
    bookDetailViews,
    searchesUsed,
    filtersUsed,
    libraryAdds,
    libraryRemoves,
    mostViewedBooks: topBooks(detailViews),
    mostAddedBooks: topBooks(libraryAddEvents),
    recentEvents,
  };
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  // Resolve identity (401 when signed out), then enforce the admin allowlist (403).
  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }
  if (!isActivityAdmin(req)) {
    return withCors(jsonResponse({ ok: false, error: "Admin access required." }, 403));
  }

  const url = new URL(req.url);
  const days = resolveDays(url);
  const since = cutoffDateString(days);

  try {
    const store = getEventStore();
    const { blobs } = await store.list({ prefix: EVENT_PREFIX });

    // Keep only keys inside the requested window, newest day first, bounded.
    const keys = blobs
      .map((blob) => blob.key)
      .filter((key): key is string => typeof key === "string" && key.endsWith(".json"))
      .filter((key) => {
        const day = dayFromKey(key);
        return day !== null && day >= since;
      })
      .sort((a, b) => b.localeCompare(a))
      .slice(0, MAX_EVENTS_SCANNED);

    const events: BookshelfEvent[] = [];
    for (const key of keys) {
      let raw: string | null = null;
      try {
        raw = await store.get(key, { type: "text" });
      } catch {
        continue; // a single unreadable blob must not fail the whole report
      }
      if (!raw) continue;
      const event = parseEvent(raw);
      if (event) events.push(event);
    }

    return withCors(jsonResponse({ ok: true, summary: summarize(events, days, since) }));
  } catch (err) {
    console.error("admin-bookshelf-activity report failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to load bookshelf activity." }, 500));
  }
};
