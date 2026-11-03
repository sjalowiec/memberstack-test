/**
 * KIN marketing calendar sync.
 *
 * Browser requests do not run a sync. Sync Now starts the background worker
 * from the admin page. A scheduled invocation stays read-only until
 * MARKETING_CALENDAR_SYNC_LIVE_ENABLED is exactly "true", and even then it
 * only starts that same worker. The evening schedule is not enabled here.
 */
import { MarketingCalendarError } from "../../src/lib/marketingCalendar/errors";
import { scheduledSyncIsLive } from "../../src/lib/marketingCalendar/runSync";
import { startMarketingCalendarSync } from "../../src/lib/marketingCalendar/syncJob";
import type { SyncJobStore } from "../../src/lib/marketingCalendar/syncJobStore";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isScheduledBody(bodyText: string): boolean {
  if (!bodyText) return false;
  try {
    const parsed = JSON.parse(bodyText) as { next_run?: unknown };
    return typeof parsed.next_run === "string";
  } catch {
    return false;
  }
}

function siteOrigin(env: NodeJS.ProcessEnv): string | null {
  const raw = (env.URL || env.DEPLOY_PRIME_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function handleMarketingCalendarRequest(
  req: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    store?: SyncJobStore;
    now?: () => Date;
    createId?: () => string;
    dispatch?: (input: { origin: string; jobId: string; token: string }) => Promise<"accepted" | "unreachable">;
  } = {},
): Promise<Response> {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch {
    bodyText = "";
  }

  const env = deps.env ?? process.env;
  if (!isScheduledBody(bodyText)) {
    return json({ ok: false, error: "Sync from the admin page." }, 401);
  }
  if (!scheduledSyncIsLive(env)) {
    return json({
      ok: true,
      scheduled: true,
      dryRun: true,
      liveEnabled: false,
      writesPerformed: 0,
      created: 0,
      updated: 0,
      deleted: 0,
    });
  }

  const origin = siteOrigin(env);
  if (!origin) {
    return json(
      { ok: false, scheduled: true, liveEnabled: true, error: "The sync could not be started. Run it again." },
      502,
    );
  }

  try {
    const started = await startMarketingCalendarSync({
      store: deps.store,
      origin,
      now: deps.now?.(),
      createId: deps.createId,
      dispatch: deps.dispatch,
    });
    if (started.outcome === "start-failed") {
      return json({ ok: false, scheduled: true, liveEnabled: true, deleted: 0, error: started.error }, 502);
    }
    return json({
      ok: true,
      scheduled: true,
      liveEnabled: true,
      dryRun: false,
      status: "running",
      jobId: started.jobId,
      alreadyRunning: started.outcome === "already-running",
      writesPerformed: 0,
      deleted: 0,
    });
  } catch (error) {
    const message =
      error instanceof MarketingCalendarError ? error.message : "Marketing calendar sync failed.";
    console.error("[marketing-calendar-sync]", message);
    return json({ ok: false, scheduled: true, liveEnabled: true, deleted: 0, error: message }, 502);
  }
}

export default function marketingCalendarSync(req: Request): Promise<Response> {
  return handleMarketingCalendarRequest(req);
}
