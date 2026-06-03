/**
 * Lightweight pattern activity log.
 *
 * - POST: append one activity event for any logged-in user (id resolved from `X-KBM-Member-Id`).
 * - GET:  return recent events across all users for the admin dashboard — **admin-only**
 *         (see {@link isActivityAdmin}); regular members receive 403.
 *
 * Events are stored in the `pattern-activity-log` Blobs store, separate from saved project JSON.
 * Logging is best-effort; the client never blocks on the response.
 */
import {
  jsonResponse,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import {
  appendActivityEvent,
  getActivityStore,
  isActivityAdmin,
  listActivityEvents,
  normalizeActivityEvent,
} from "./lib/pattern-activity-store.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }

  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }

  if (req.method === "GET") {
    // Reporting is admin-only — never expose other users' activity/emails to regular members.
    if (!isActivityAdmin(req)) {
      return withCors(jsonResponse({ ok: false, error: "Admin access required." }, 403));
    }
    const url = new URL(req.url);
    const limitParam = parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 2000) : 1000;
    try {
      const store = getActivityStore();
      const events = await listActivityEvents(store, { limit });
      return withCors(jsonResponse({ ok: true, events, authMode: user.mode }));
    } catch (err) {
      console.error("pattern-activity-log list failed:", err);
      return withCors(jsonResponse({ ok: false, error: "Failed to load activity." }, 500));
    }
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return withCors(jsonResponse({ ok: false, error: "Invalid JSON body." }, 400));
    }

    const normalized = normalizeActivityEvent(body, user.userId);
    if (!normalized.ok) {
      return withCors(jsonResponse({ ok: false, error: normalized.error }, 400));
    }

    try {
      const store = getActivityStore();
      const { event } = await appendActivityEvent(store, normalized.event);
      return withCors(jsonResponse({ ok: true, event, authMode: user.mode }));
    } catch (err) {
      console.error("pattern-activity-log append failed:", err);
      return withCors(jsonResponse({ ok: false, error: "Failed to record activity." }, 500));
    }
  }

  return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
};
