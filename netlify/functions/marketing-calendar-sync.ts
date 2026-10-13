/**
 * Manual dry run for the KIN marketing calendar.
 *
 * This function never writes calendar events and is not scheduled.
 * Automatic synchronization stays off until a dry run is approved.
 */
import { timingSafeEqual } from "node:crypto";

import { MANUAL_SECRET_HEADER } from "../../src/lib/marketingCalendar/constants";
import { MarketingCalendarError } from "../../src/lib/marketingCalendar/errors";
import {
  runMarketingCalendarDryRun,
  type DryRunReport,
} from "../../src/lib/marketingCalendar/runDryRun";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function secretsMatch(provided: string, configured: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(configured);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
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
    run?: (input: { env: NodeJS.ProcessEnv }) => Promise<DryRunReport>;
  } = {},
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const env = deps.env ?? process.env;
  const configuredSecret = (env.MARKETING_CALENDAR_SYNC_SECRET || "").trim();
  if (!configuredSecret) {
    return json(
      {
        ok: false,
        dryRun: true,
        writesEnabled: false,
        error: "MARKETING_CALENDAR_SYNC_SECRET is not set.",
      },
      503,
    );
  }

  const providedSecret = (req.headers.get(MANUAL_SECRET_HEADER) || "").trim();
  if (!secretsMatch(providedSecret, configuredSecret)) {
    return json(
      {
        ok: false,
        dryRun: true,
        writesEnabled: false,
        error: "A manual dry run requires a valid X-Marketing-Calendar-Secret header.",
      },
      401,
    );
  }

  let bodyText = "";
  if (req.method === "POST") {
    try {
      bodyText = await req.text();
    } catch {
      bodyText = "";
    }
  }
  const url = new URL(req.url);
  const liveRequestIgnored = (url.searchParams.get("confirm") ?? "").trim().toUpperCase() === "LIVE";
  const automaticSyncIgnored = isScheduledBody(bodyText);

  try {
    const run = deps.run ?? runMarketingCalendarDryRun;
    const result = await run({ env });
    console.log("[marketing-calendar-sync]", {
      dryRun: true,
      writesPerformed: 0,
      campaignsFound: result.campaignsFound,
      create: result.counts.create,
      update: result.counts.update,
      delete: result.counts.delete,
      conflict: result.counts.conflict,
    });
    return json({
      ok: true,
      dryRun: true,
      writesEnabled: false,
      writesPerformed: 0,
      liveRequestIgnored,
      automaticSyncIgnored,
      automaticSyncEnabled: false,
      result,
    });
  } catch (error) {
    const message =
      error instanceof MarketingCalendarError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Marketing calendar dry run failed.";
    console.error("[marketing-calendar-sync]", message);
    return json({ ok: false, dryRun: true, writesEnabled: false, writesPerformed: 0, error: message }, 502);
  }
}

export default function marketingCalendarSync(req: Request): Promise<Response> {
  return handleMarketingCalendarRequest(req);
}
