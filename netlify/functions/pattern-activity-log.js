/**
 * Lightweight pattern activity log.
 *
 * - POST: append one activity event for a logged-in user (id from verified Bearer JWT),
 *         or a Hat guest generation after email capture (hashed guest id, never raw email).
 * - GET:  return events for the admin dashboard — **admin-only**
 *         (see {@link isActivityAdmin}); regular members receive 403.
 *
 * Events are stored in the `pattern-activity-log` Blobs store, separate from saved project JSON.
 * Logging is best-effort; the client never blocks on the response.
 */
import { isValidEmailAddress } from "../../src/lib/email/validateEmailAddress.ts";
import { guestActivityUserIdFromEmail } from "../../src/lib/patterns/patternActivityIdentity.ts";
import {
  jsonResponse,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import { resolveVerifiedProjectUserId } from "./lib/require-member-access.js";
import {
  ACTIVITY_LIST_MAX,
  appendActivityEvent,
  getActivityStore,
  isActivityAdmin,
  listActivityEvents,
  normalizeActivityEvent,
} from "./lib/pattern-activity-store.js";

function cleanString(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * Unauthenticated Hat generation after email capture.
 * Server recomputes the guest userId from the email; client userId is ignored.
 */
async function normalizeGuestHatGeneration(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Event body required." };
  }
  if (cleanString(raw.eventType, 60) !== "pattern_generated") {
    return { ok: false, error: "Sign in required." };
  }
  if (cleanString(raw.patternSystem, 60) !== "hat") {
    return { ok: false, error: "Sign in required." };
  }
  const userEmail = cleanString(raw.userEmail || raw.guestEmail, 200);
  if (!userEmail || !isValidEmailAddress(userEmail)) {
    return { ok: false, error: "A valid email is required." };
  }
  const userId = await guestActivityUserIdFromEmail(userEmail);
  const withMembership = {
    ...raw,
    userEmail,
    patternSystem: "hat",
    eventType: "pattern_generated",
    metadata: {
      ...(raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? raw.metadata
        : {}),
      membership: "free",
    },
  };
  return normalizeActivityEvent(withMembership, userId);
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return withCors(jsonResponse({ ok: false, error: "Invalid JSON body." }, 400));
    }

    const user = await resolveVerifiedProjectUserId(req);
    let normalized;
    let authMode = "member";
    if ("error" in user) {
      if (user.status !== 401) {
        return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
      }
      normalized = await normalizeGuestHatGeneration(body);
      authMode = "guest";
      if (!normalized.ok) {
        return withCors(jsonResponse({ ok: false, error: normalized.error }, 401));
      }
    } else {
      normalized = normalizeActivityEvent(body, user.userId);
      authMode = user.mode;
      if (!normalized.ok) {
        return withCors(jsonResponse({ ok: false, error: normalized.error }, 400));
      }
    }

    try {
      const store = getActivityStore();
      const { event } = await appendActivityEvent(store, normalized.event);
      return withCors(jsonResponse({ ok: true, event, authMode }));
    } catch (err) {
      console.error("pattern-activity-log append failed:", err);
      return withCors(jsonResponse({ ok: false, error: "Failed to record activity." }, 500));
    }
  }

  const user = await resolveVerifiedProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }

  if (req.method === "GET") {
    if (!isActivityAdmin(req, user.userId, user.email)) {
      return withCors(jsonResponse({ ok: false, error: "Admin access required." }, 403));
    }
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
    const offsetParam = parseInt(url.searchParams.get("offset") ?? "", 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, ACTIVITY_LIST_MAX)
        : 200;
    const offset = Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    try {
      const store = getActivityStore();
      const listed = await listActivityEvents(store, {
        limit,
        offset,
        from: from || undefined,
        to: to || undefined,
      });
      return withCors(
        jsonResponse({
          ok: true,
          events: listed.events,
          total: listed.total,
          offset: listed.offset,
          limit: listed.limit,
          hasMore: listed.hasMore,
          truncated: listed.truncated,
          authMode: user.mode,
        }),
      );
    } catch (err) {
      console.error("pattern-activity-log list failed:", err);
      return withCors(jsonResponse({ ok: false, error: "Failed to load activity." }, 500));
    }
  }

  return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
};
