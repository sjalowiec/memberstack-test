/**
 * KIN marketing calendar sync.
 *
 * Browser requests do not run a sync. The admin page is the manual control.
 * Netlify's evening schedule calls this function, and that run stays read-only
 * until MARKETING_CALENDAR_SYNC_LIVE_ENABLED is exactly "true".
 */
import { MarketingCalendarError } from "../../src/lib/marketingCalendar/errors";
import {
  publicSyncSummary,
  runMarketingCalendarSync,
  scheduledSyncIsLive,
} from "../../src/lib/marketingCalendar/runSync";

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

export async function handleMarketingCalendarRequest(
  req: Request,
  deps: {
    env?: NodeJS.ProcessEnv;
    sync?: typeof runMarketingCalendarSync;
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

  try {
    const sync = deps.sync ?? runMarketingCalendarSync;
    const result = await sync({ env, dryRun: false });
    console.log("[marketing-calendar-sync]", publicSyncSummary(result));
    return json({ scheduled: true, liveEnabled: true, ...publicSyncSummary(result) });
  } catch (error) {
    const message =
      error instanceof MarketingCalendarError
        ? error.message
        : "Marketing calendar sync failed.";
    console.error("[marketing-calendar-sync]", message);
    return json({ ok: false, scheduled: true, dryRun: true, writesPerformed: 0, deleted: 0, error: message }, 502);
  }
}

export default function marketingCalendarSync(req: Request): Promise<Response> {
  return handleMarketingCalendarRequest(req);
}
