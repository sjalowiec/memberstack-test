/**
 * Netlify Blobs access for lightweight pattern activity events.
 * Append-style log: one blob per event under `events/{YYYY-MM-DD}/{id}.json`
 * in store `pattern-activity-log`. Kept separate from saved Custom Pattern project JSON.
 */
import { getStore } from "@netlify/blobs";
import {
  isAllowDevPatternUser,
  sanitizeKeySegment,
} from "./custom-pattern-projects-store.js";

export const PATTERN_ACTIVITY_BLOB_STORE = "pattern-activity-log";
export const ACTIVITY_EVENT_PREFIX = "events/";

const ALLOWED_EVENT_TYPES = new Set([
  "pattern_started",
  "pattern_generated",
  "pattern_saved",
  "pattern_updated",
  "pattern_opened",
  "pattern_printed",
]);

export function getActivityStore() {
  return getStore({
    name: PATTERN_ACTIVITY_BLOB_STORE,
    consistency: "strong",
  });
}

/** @param {string | undefined} value Comma/space/semicolon separated allowlist. */
function parseAdminAllowList(value) {
  return new Set(
    String(value || "")
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Admin-only gate for activity reporting (the GET endpoint).
 *
 * Production: JWT-verified member id must be in `PATTERN_ACTIVITY_ADMIN_MEMBER_IDS`, or
 * JWT-verified Memberstack email in `PATTERN_ACTIVITY_ADMIN_EMAILS`.
 * Local dev only (`ALLOW_DEV_PATTERN_USER`): always allowed. Never true in production.
 *
 * When a verified email is provided it is authoritative — a client `X-KBM-Member-Email`
 * header cannot grant (or deny) access. The client header is a compatibility fallback
 * only when JWT auth did not return an email.
 *
 * @param {Request} req
 * @param {string} [verifiedMemberId] JWT-verified member id from {@link resolveVerifiedProjectUserId}
 * @param {string} [verifiedEmail] JWT-verified Memberstack email from the same helper
 */
export function isActivityAdmin(req, verifiedMemberId = "", verifiedEmail = "") {
  if (isAllowDevPatternUser()) return true;

  const memberId = String(verifiedMemberId || req.headers.get("x-kbm-member-id") || "")
    .trim()
    .toLowerCase();
  if (memberId && parseAdminAllowList(process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS).has(memberId)) {
    return true;
  }

  const serverEmail = String(verifiedEmail || "").trim().toLowerCase();
  const clientEmail = (req.headers.get("x-kbm-member-email") || "").trim().toLowerCase();
  const email = serverEmail || clientEmail;
  if (email && parseAdminAllowList(process.env.PATTERN_ACTIVITY_ADMIN_EMAILS).has(email)) {
    return true;
  }

  return false;
}

/** @param {unknown} value */
function cleanString(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Blob key for an event: date bucket + id so listings group by day and stay roughly ordered.
 * @param {{ id?: string, createdAt?: string }} event
 */
export function activityEventKey(event) {
  const createdAt = cleanString(event?.createdAt) || new Date().toISOString();
  const day = createdAt.slice(0, 10);
  const id = sanitizeKeySegment(event?.id || crypto.randomUUID());
  return `${ACTIVITY_EVENT_PREFIX}${sanitizeKeySegment(day)}/${id}.json`;
}

/**
 * Normalizes a client-sent event into a stored record. `userId` is authoritative (server-resolved)
 * and overrides any client value. Returns `{ ok: false }` when required fields are missing/invalid.
 * @param {Record<string, unknown>} raw
 * @param {string} userId
 */
export function normalizeActivityEvent(raw, userId) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  const safeUserId = sanitizeKeySegment(userId);
  if (!safeUserId) {
    return { ok: false, error: "userId required." };
  }
  const eventType = cleanString(raw.eventType, 60);
  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return { ok: false, error: `Unknown eventType "${eventType}".` };
  }
  const patternSystem = cleanString(raw.patternSystem, 60) || "unknown";

  const createdAt = cleanString(raw.createdAt, 40) || new Date().toISOString();
  const id =
    sanitizeKeySegment(typeof raw.id === "string" ? raw.id : "") || crypto.randomUUID();

  /** @type {Record<string, unknown>} */
  const event = {
    id,
    userId: safeUserId,
    patternSystem,
    eventType,
    createdAt,
  };

  const userEmail = cleanString(raw.userEmail, 200);
  if (userEmail) event.userEmail = userEmail;
  const patternId = cleanString(raw.patternId, 200);
  if (patternId) event.patternId = patternId;
  const patternTitle = cleanString(raw.patternTitle, 200);
  if (patternTitle) event.patternTitle = patternTitle;
  const mode = cleanString(raw.mode, 60);
  if (mode) event.mode = mode;
  const sourcePage = cleanString(raw.sourcePage, 300);
  if (sourcePage) event.sourcePage = sourcePage;

  if (
    raw.metadata &&
    typeof raw.metadata === "object" &&
    !Array.isArray(raw.metadata)
  ) {
    // Keep metadata small; cap serialized size to avoid runaway blobs.
    try {
      const serialized = JSON.stringify(raw.metadata);
      if (serialized && serialized.length <= 2000) {
        event.metadata = sanitizeActivityMetadata(JSON.parse(serialized));
      }
    } catch {
      /* ignore non-serializable metadata */
    }
  }

  return { ok: true, event };
}

/** Only persist a known membership value; leave historical/unknown events without one. */
export function sanitizeActivityMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }
  const next = { ...metadata };
  if (next.membership !== "free" && next.membership !== "member") {
    delete next.membership;
  }
  return next;
}

/**
 * Appends one event blob (never read-modify-write, so concurrent logs don't collide).
 * @param {import("@netlify/blobs").Store} store
 * @param {Record<string, unknown>} event
 */
export async function appendActivityEvent(store, event) {
  const key = activityEventKey(event);
  await store.set(key, JSON.stringify(event), {
    metadata: {
      userId: String(event.userId ?? ""),
      eventType: String(event.eventType ?? ""),
      patternSystem: String(event.patternSystem ?? ""),
      createdAt: String(event.createdAt ?? ""),
    },
  });
  return { key, event };
}

export const ACTIVITY_LIST_MAX = 2000;

function utcDay(value) {
  const day = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function dayFromActivityKey(key) {
  const match = String(key).match(/^events\/(\d{4}-\d{2}-\d{2})\//);
  return match ? match[1] : "";
}

function eachUtcDay(fromDay, toDay) {
  const days = [];
  const start = new Date(`${fromDay}T00:00:00.000Z`);
  const end = new Date(`${toDay}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return days;
  }
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    days.push(cursor.toISOString().slice(0, 10));
  }
  return days;
}

async function listActivityKeys(store, fromDay, toDay) {
  if (fromDay && toDay) {
    const span = eachUtcDay(fromDay, toDay);
    if (span.length > 0 && span.length <= 31) {
      const keys = [];
      for (const day of span) {
        const { blobs } = await store.list({ prefix: `${ACTIVITY_EVENT_PREFIX}${day}/` });
        for (const blob of blobs) {
          if (typeof blob.key === "string" && blob.key.endsWith(".json")) {
            keys.push(blob.key);
          }
        }
      }
      return keys;
    }
  }

  const { blobs } = await store.list({ prefix: ACTIVITY_EVENT_PREFIX });
  return blobs
    .map((blob) => blob.key)
    .filter((key) => {
      if (typeof key !== "string" || !key.endsWith(".json")) return false;
      if (!fromDay && !toDay) return true;
      const day = dayFromActivityKey(key);
      if (!day) return false;
      if (fromDay && day < fromDay) return false;
      if (toDay && day > toDay) return false;
      return true;
    });
}

/**
 * Reads stored events (most recent buckets first, bounded).
 * When `from`/`to` are set (ISO or YYYY-MM-DD), only those date buckets are scanned.
 *
 * @param {import("@netlify/blobs").Store} store
 * @param {{ limit?: number, offset?: number, from?: string, to?: string }} [options]
 */
export async function listActivityEvents(store, options = {}) {
  const limit = Number.isFinite(options.limit)
    ? Math.max(0, Math.min(ACTIVITY_LIST_MAX, Math.floor(options.limit)))
    : 200;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const fromDay = utcDay(options.from);
  const toDay = utcDay(options.to);

  const keys = (await listActivityKeys(store, fromDay, toDay)).sort((a, b) =>
    b.localeCompare(a),
  );
  const total = keys.length;
  const pageKeys = keys.slice(offset, offset + limit);

  const events = [];
  for (const key of pageKeys) {
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (options.from && parsed?.createdAt && parsed.createdAt < options.from) continue;
      if (options.to && parsed?.createdAt && parsed.createdAt > options.to) continue;
      events.push(parsed);
    } catch {
      /* skip unparseable blob */
    }
  }
  return {
    events,
    total,
    offset,
    limit,
    hasMore: offset + pageKeys.length < total,
    truncated: total > ACTIVITY_LIST_MAX && !fromDay && !toDay,
  };
}
