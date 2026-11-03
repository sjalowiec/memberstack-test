/**
 * Long-running calendar sync. Netlify returns 202 to the caller and keeps
 * this worker afterward, so the browser is not held open until Google replies.
 * The admin page and a live scheduled invocation start it only after the blob
 * lock is stored. A retry of this same request cannot start a second sync.
 */
import { HEARTBEAT_INTERVAL_MS } from "../../src/lib/marketingCalendar/syncJobStore";
import {
  backgroundSyncBody,
  executeMarketingCalendarSyncJob,
} from "../../src/lib/marketingCalendar/syncJob";
import type { SyncJobStore } from "../../src/lib/marketingCalendar/syncJobStore";
import type { runMarketingCalendarSync } from "../../src/lib/marketingCalendar/runSync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleMarketingCalendarBackground(
  req: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    store?: SyncJobStore;
    sync?: typeof runMarketingCalendarSync;
    now?: () => Date;
    createId?: () => string;
  } = {},
): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const claimed = backgroundSyncBody(body);
  if (!claimed) return json({ ok: false, ran: false }, 400);

  try {
    const result = await executeMarketingCalendarSyncJob({
      store: deps.store,
      env: deps.env,
      jobId: claimed.jobId,
      token: claimed.token,
      now: deps.now,
      createId: deps.createId,
      heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
      sync: deps.sync,
    });
    console.log("[marketing-calendar-sync]", result.ran ? result.status : (result.reason ?? result.status));
    return json({ ok: true, ran: result.ran, status: result.status });
  } catch (error) {
    console.error(
      "[marketing-calendar-sync]",
      error instanceof Error ? error.name : "sync-failed",
    );
    return json({ ok: false, ran: false }, 500);
  }
}

export const config = { background: true };

export default function marketingCalendarSyncBackground(req: Request): Promise<Response> {
  return handleMarketingCalendarBackground(req);
}
