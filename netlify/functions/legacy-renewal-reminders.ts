/**
 * Scheduled + manual legacy annual renewal reminders.
 *
 * Tags legacy annual members in ActiveCampaign at 30 / 7 / 1 day before their
 * Watson paid-through date so per-tag automations send renewal emails. Before
 * tagging, each member is re-checked in Memberstack (authoritative for whether
 * they already repurchased) and skipped when an active paid plan exists. The
 * authoritative Watson paid-through date is written to the "Legacy Membership
 * Paid Through" ActiveCampaign date field before the tag is applied.
 *
 * This job never modifies Watson dates and is completely independent of the
 * legacy annual EXPIRATION reconciliation (`legacy-annual-expiry`).
 *
 * Requires Netlify env:
 *   WATSON_DATABASE_URL
 *   MEMBERSTACK_SECRET_KEY (live) / MEMBERSTACK_SANDBOX_SECRET_KEY (non-prod)
 *   ACTIVECAMPAIGN_API_KEY
 *   ACTIVECAMPAIGN_BASE_URL
 *   ACTIVECAMPAIGN_KIN_LIST_ID
 *   ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID
 * Optional:
 *   LEGACY_RENEWAL_REMINDER_LIVE_ENABLED  (must be exactly "true" for a SCHEDULED
 *     run to perform live changes; anything else keeps scheduled runs dry-run)
 *   LEGACY_RENEWAL_REMINDER_SECRET        (required to authorize a manual live run;
 *     sent as header X-Legacy-Renewal-Secret)
 *
 * Modes (mirrors legacy-annual-expiry):
 *   - Scheduled (cron, see netlify.toml): LIVE only when
 *     LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true"; otherwise DRY-RUN.
 *   - Manual HTTP GET/POST: DRY-RUN by default. A live manual run requires BOTH
 *     ?confirm=LIVE AND a correct X-Legacy-Renewal-Secret header.
 */
import {
  runLegacyRenewalReminders,
  type LegacyRenewalReminderResult,
} from "../../src/lib/watson/legacyRenewalReminders";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Netlify scheduled invocations send a JSON body containing `next_run`. */
export function isScheduledInvocation(bodyText: string): boolean {
  if (!bodyText) return false;
  try {
    const parsed = JSON.parse(bodyText) as { next_run?: unknown };
    return Boolean(parsed && typeof parsed.next_run === "string");
  } catch {
    return false;
  }
}

export function isConfirmedLive(url: URL): boolean {
  return (url.searchParams.get("confirm") ?? "").trim().toUpperCase() === "LIVE";
}

/**
 * A scheduled run may perform live changes only when the deployment has been
 * explicitly opted in with LEGACY_RENEWAL_REMINDER_LIVE_ENABLED set to exactly
 * "true". Any other value keeps scheduled runs in dry-run mode.
 */
export function isScheduledLiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true";
}

export interface ReminderExecutionRequest {
  scheduled: boolean;
  confirmLive: boolean;
  providedSecret: string | null;
  configuredSecret: string | null;
  liveEnabled: boolean;
}

export type ReminderExecutionDecision =
  | { authorized: true; dryRun: boolean; triggerSource: "manual" | "scheduled" }
  | { authorized: false; status: number; error: string };

/**
 * Resolve whether an invocation may run, and in which mode. Pure and testable.
 * Identical safety semantics to legacy-annual-expiry.
 */
export function resolveReminderExecution(
  request: ReminderExecutionRequest,
): ReminderExecutionDecision {
  if (request.scheduled) {
    return {
      authorized: true,
      dryRun: !request.liveEnabled,
      triggerSource: "scheduled",
    };
  }

  if (!request.confirmLive) {
    return { authorized: true, dryRun: true, triggerSource: "manual" };
  }

  const secretConfigured = Boolean(request.configuredSecret);
  const secretMatches =
    secretConfigured && request.providedSecret === request.configuredSecret;
  if (!secretMatches) {
    return {
      authorized: false,
      status: 401,
      error:
        "A live manual renewal-reminder run requires a valid X-Legacy-Renewal-Secret header.",
    };
  }

  return { authorized: true, dryRun: false, triggerSource: "manual" };
}

function summarize(result: LegacyRenewalReminderResult) {
  return {
    ok: result.ok,
    dryRun: result.dryRun,
    triggerSource: result.triggerSource,
    todayLosAngeles: result.todayLosAngeles,
    totals: result.totals,
  };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
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
  const configuredSecret = (process.env.LEGACY_RENEWAL_REMINDER_SECRET ?? "").trim();
  const providedSecret = (req.headers.get("x-legacy-renewal-secret") ?? "").trim();

  const decision = resolveReminderExecution({
    scheduled: isScheduledInvocation(bodyText),
    confirmLive: isConfirmedLive(url),
    providedSecret: providedSecret || null,
    configuredSecret: configuredSecret || null,
    liveEnabled: isScheduledLiveEnabled(process.env),
  });

  if (!decision.authorized) {
    return json({ ok: false, error: decision.error }, decision.status);
  }

  try {
    const result = await runLegacyRenewalReminders({
      dryRun: decision.dryRun,
      triggerSource: decision.triggerSource,
    });
    console.log("[legacy-renewal-reminders]", summarize(result));
    return json(
      { ok: result.ok, result, error: result.errorMessage },
      result.ok ? 200 : 502,
    );
  } catch (error) {
    console.error("legacy-renewal-reminders failed:", error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Legacy renewal reminder run failed.",
      },
      500,
    );
  }
};
