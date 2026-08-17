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
        event.metadata = JSON.parse(serialized);
      }
    } catch {
      /* ignore non-serializable metadata */
    }
  }

  return { ok: true, event };
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

/**
 * Reads stored events (most recent buckets first, bounded). Returns parsed event objects.
 * @param {import("@netlify/blobs").Store} store
 * @param {{ limit?: number }} [options]
 */
export async function listActivityEvents(store, options = {}) {
  const limit = Number.isFinite(options.limit) ? Math.max(0, Math.floor(options.limit)) : 1000;
  const { blobs } = await store.list({ prefix: ACTIVITY_EVENT_PREFIX });
  const keys = blobs
    .map((blob) => blob.key)
    .filter((key) => typeof key === "string" && key.endsWith(".json"))
    // Date bucket prefix means lexical desc ≈ newest day first.
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);

  const events = [];
  for (const key of keys) {
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      events.push(JSON.parse(raw));
    } catch {
      /* skip unparseable blob */
    }
  }
  return events;
}
