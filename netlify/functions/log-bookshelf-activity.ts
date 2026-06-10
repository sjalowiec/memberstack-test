/**
 * Lightweight, PUBLIC activity log for the Machine Knitter's Bookshelf.
 *
 * The bookshelf catalog is public (no login required), so this endpoint accepts
 * anonymous events — unlike `pattern-activity-log`, which is member-gated. It
 * mirrors that function's storage approach: append-only, one Netlify Blob per
 * event under `events/{YYYY-MM-DD}/{id}.json` in the `bookshelf-activity-log`
 * store, kept separate from any other data.
 *
 * - POST: append one event. Always best-effort; the client never blocks on it.
 * - GET:  list recent events for local verification ONLY (enabled when
 *         `ALLOW_DEV_PATTERN_USER === "true"`, which is set in `netlify.toml`
 *         `[dev.environment]` and can never be true in a production deploy).
 *         Otherwise returns 403 so stored data is never exposed publicly.
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "bookshelf-activity-log";
const EVENT_PREFIX = "events/";

const ALLOWED_EVENT_TYPES = new Set([
  "bookshelf_viewed",
  "bookshelf_book_viewed",
  "bookshelf_search_used",
  "bookshelf_filter_used",
  "bookshelf_library_add",
  "bookshelf_library_remove",
]);

const ALLOWED_FILTER_TYPES = new Set(["topic", "tag", "scope"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isLocalDev(): boolean {
  return String(process.env.ALLOW_DEV_PATTERN_USER || "").trim() === "true";
}

function cleanString(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

/** Non-negative integer from arbitrary input, or undefined when not a finite number. */
function cleanCount(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(Math.floor(n), 100000));
}

function getEventStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function eventKey(id: string, createdAt: string): string {
  const day = (createdAt || new Date().toISOString()).slice(0, 10);
  return `${EVENT_PREFIX}${sanitizeKeySegment(day)}/${sanitizeKeySegment(id)}.json`;
}

/**
 * Builds the stored record from an untrusted client body. Returns `{ ok: false }`
 * when the event type is missing/unknown. NOTE: we intentionally never store the
 * raw search term — only its length and the result count.
 */
function normalizeEvent(raw: unknown): { ok: true; event: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  const body = raw as Record<string, unknown>;

  const eventType = cleanString(body.eventType, 60);
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return { ok: false, error: `Unknown eventType "${eventType}".` };
  }

  const createdAt = cleanString(body.createdAt, 40) || new Date().toISOString();
  const id = sanitizeKeySegment(cleanString(body.id, 80)) || crypto.randomUUID();

  const event: Record<string, unknown> = { id, eventType, createdAt };

  const visitorId = sanitizeKeySegment(cleanString(body.visitorId, 80));
  if (visitorId) event.visitorId = visitorId;
  const memberId = cleanString(body.memberId, 120);
  if (memberId) event.memberId = memberId;
  const sourcePage = cleanString(body.sourcePage, 300);
  if (sourcePage) event.sourcePage = sourcePage;

  const bookId = cleanString(body.bookId, 80);
  if (bookId) event.bookId = bookId;
  const bookTitle = cleanString(body.bookTitle, 300);
  if (bookTitle) event.bookTitle = bookTitle;

  const searchLength = cleanCount(body.searchLength);
  if (searchLength !== undefined) event.searchLength = searchLength;
  const resultCount = cleanCount(body.resultCount);
  if (resultCount !== undefined) event.resultCount = resultCount;

  const filterType = cleanString(body.filterType, 40);
  if (filterType && ALLOWED_FILTER_TYPES.has(filterType)) event.filterType = filterType;
  const filterValue = cleanString(body.filterValue, 200);
  if (filterValue) event.filterValue = filterValue;

  return { ok: true, event };
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET") {
    if (!isLocalDev()) {
      return jsonResponse({ ok: false, error: "Not available." }, 403);
    }
    try {
      const store = getEventStore();
      const { blobs } = await store.list({ prefix: EVENT_PREFIX });
      const keys = blobs
        .map((b) => b.key)
        .filter((k): k is string => typeof k === "string" && k.endsWith(".json"))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 500);
      const events: unknown[] = [];
      for (const key of keys) {
        const raw = await store.get(key, { type: "text" });
        if (!raw) continue;
        try {
          events.push(JSON.parse(raw));
        } catch {
          /* skip unparseable blob */
        }
      }
      return jsonResponse({ ok: true, count: events.length, events });
    } catch (err) {
      console.error("log-bookshelf-activity list failed:", err);
      return jsonResponse({ ok: false, error: "Failed to load activity." }, 500);
    }
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const normalized = normalizeEvent(body);
    if (!normalized.ok) {
      return jsonResponse({ ok: false, error: normalized.error }, 400);
    }

    try {
      const store = getEventStore();
      const { id, createdAt } = normalized.event as { id: string; createdAt: string };
      await store.set(eventKey(id, createdAt), JSON.stringify(normalized.event), {
        metadata: {
          eventType: String(normalized.event.eventType ?? ""),
          createdAt: String(createdAt ?? ""),
          bookId: String(normalized.event.bookId ?? ""),
        },
      });
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error("log-bookshelf-activity append failed:", err);
      return jsonResponse({ ok: false, error: "Failed to record activity." }, 500);
    }
  }

  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
};
