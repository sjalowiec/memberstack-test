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

/** Hosted DEV Netlify site (`https://kin-dev.netlify.app`). Not production. */
export const KIN_DEV_SITE_NAME = "kin-dev";
export const KIN_DEV_SITE_ID = "3196ab5e-c5a1-4cd4-a13a-980523087e9a";
export const KIN_DEV_HOST = "kin-dev.netlify.app";

/** LIVE Memberstack owner allowed to read Pattern Activity on kin-dev only. */
export const KIN_DEV_PATTERN_ACTIVITY_ADMIN_MEMBER_ID = "mem_cms4tl24v00eb0sqx143i4a9r";
export const KIN_DEV_PATTERN_ACTIVITY_ADMIN_EMAIL = "sue@knititnow.com";

/** @param {string | undefined} value Comma/space/semicolon separated allowlist. */
function parseAdminAllowList(value) {
  return new Set(
    String(value || "")
      .split(/[\s,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hostnameFromNetlifyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

/**
 * True only on the hosted kin-dev Netlify site. Uses Netlify-provided site env
 * (`SITE_NAME` / `SITE_ID` / `URL`), never the request Host header — so production
 * cannot be flipped by a spoofed host.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isKinDevNetlifySite(env = process.env) {
  const siteName = String(env.SITE_NAME || "").trim().toLowerCase();
  if (siteName === KIN_DEV_SITE_NAME) return true;
  const siteId = String(env.SITE_ID || "").trim().toLowerCase();
  if (siteId === KIN_DEV_SITE_ID) return true;
  return hostnameFromNetlifyUrl(env.URL || env.DEPLOY_PRIME_URL) === KIN_DEV_HOST;
}

/**
 * JWT-verified kin-dev owner check. Client headers are ignored.
 * @param {string} [verifiedMemberId]
 * @param {string} [verifiedEmail]
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isKinDevPatternActivityOwner(verifiedMemberId = "", verifiedEmail = "", env = process.env) {
  if (!isKinDevNetlifySite(env)) return false;
  const memberId = String(verifiedMemberId || "").trim().toLowerCase();
  if (memberId && memberId === KIN_DEV_PATTERN_ACTIVITY_ADMIN_MEMBER_ID) return true;
  const email = String(verifiedEmail || "").trim().toLowerCase();
  return Boolean(email && email === KIN_DEV_PATTERN_ACTIVITY_ADMIN_EMAIL);
}

/**
 * Admin-only gate for activity reporting (the GET endpoint).
 *
 * Production: JWT-verified member id must be in `PATTERN_ACTIVITY_ADMIN_MEMBER_IDS`, or
 * JWT-verified Memberstack email in `PATTERN_ACTIVITY_ADMIN_EMAILS`.
 * Local dev only (`ALLOW_DEV_PATTERN_USER`): always allowed. Never true in production.
 * Hosted kin-dev only: the LIVE owner identity in {@link isKinDevPatternActivityOwner}
 * is allowed even when those env allowlists are missing from the function runtime.
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
  if (isKinDevPatternActivityOwner(verifiedMemberId, verifiedEmail)) return true;

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

/**
 * TEMPORARY: identity/allowlist match flags for an authenticated 403.
 * Never includes allowlist contents. Does not grant access.
 *
 * @param {string} [verifiedMemberId]
 * @param {string} [verifiedEmail]
 */
export function describeActivityAdmin403(verifiedMemberId = "", verifiedEmail = "") {
  const userId = String(verifiedMemberId || "").trim();
  const email = String(verifiedEmail || "").trim();
  const idList = parseAdminAllowList(process.env.PATTERN_ACTIVITY_ADMIN_MEMBER_IDS);
  const emailList = parseAdminAllowList(process.env.PATTERN_ACTIVITY_ADMIN_EMAILS);
  return {
    userId,
    email,
    userIdMatched: Boolean(userId && idList.has(userId.toLowerCase())),
    emailMatched: Boolean(email && emailList.has(email.toLowerCase())),
    emailsConfigured: emailList.size > 0,
    memberIdsConfigured: idList.size > 0,
    emailLookupSucceeded: Boolean(email),
  };
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
 * Site that stored the event. Kin-dev is checked before CONTEXT=production,
 * because hosted DEV deploys also set CONTEXT=production.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function activityEnvironment(env = process.env) {
  if (isAllowDevPatternUser()) return "localhost";
  if (isKinDevNetlifySite(env)) return "dev";
  const host = hostnameFromNetlifyUrl(env.URL || env.DEPLOY_PRIME_URL || "");
  if (host === "knititnow.com" || host === "www.knititnow.com" || host === "app.knititnow.com") {
    return "production";
  }
  if (String(env.CONTEXT || "").trim().toLowerCase() === "production") return "production";
  return "dev";
}

/** Authenticated member id is the verified user id. Guest hashes are not member ids. */
function stampActivityIdentity(metadata, userId) {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...metadata } : {};
  if (String(userId).startsWith("mem_")) base.memberId = userId;
  else delete base.memberId;
  return base;
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
  event.environment = activityEnvironment();

  const metadata = stampActivityIdentity(raw.metadata, safeUserId);
  if (metadata) {
    raw = { ...raw, metadata };
  }

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
