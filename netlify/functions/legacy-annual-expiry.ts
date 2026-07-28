/**
 * Scheduled legacy annual membership expiration reconciliation.
 *
 * Removes the free legacy membership plan (`pln_legacy-membership-t012x0xw0`)
 * from Memberstack members whose Watson paid-through date
 * (`legacy_members.subscriptionexpiring`) is strictly before today in
 * America/Los_Angeles - unless the member also holds another active paid
 * membership (a renewed member keeps access). Memberstack plan connections stay
 * authoritative for access; this job only removes plan connections.
 *
 * Requires Netlify env:
 *   WATSON_DATABASE_URL
 *   MEMBERSTACK_SECRET_KEY (live) / MEMBERSTACK_SANDBOX_SECRET_KEY (non-prod)
 * Optional:
 *   LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED  (must be exactly "true" for a SCHEDULED
 *     run to perform live changes; anything else keeps scheduled runs dry-run)
 *   LEGACY_ANNUAL_EXPIRY_SECRET        (required to authorize a manual live run;
 *     sent as header X-Legacy-Expiry-Secret)
 *
 * Modes:
 *   - Scheduled invocation (cron, see netlify.toml): LIVE only when
 *     LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED === "true"; otherwise DRY-RUN.
 *   - Manual HTTP GET/POST: DRY-RUN by default. A live manual run requires BOTH
 *     ?confirm=LIVE AND a correct X-Legacy-Expiry-Secret header. A manual live
 *     run does NOT depend on LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED (the explicit
 *     confirmation + secret are the safeguard).
 *
 * Schedule is configured in netlify.toml.
 */
import {
  runLegacyAnnualExpiry,
  type LegacyAnnualExpiryResult,
} from "../../src/lib/watson/legacyAnnualExpiry";

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
 * explicitly opted in with LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED set to exactly
 * "true". Any other value (unset, "false", "TRUE", "1", whitespace) keeps
 * scheduled runs in dry-run mode.
 */
export function isScheduledLiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED === "true";
}

export interface ExpiryExecutionRequest {
  /** True when invoked by the Netlify scheduler (cron). */
  scheduled: boolean;
  /** True when `?confirm=LIVE` was supplied (manual live intent). */
  confirmLive: boolean;
  /** Value of the X-Legacy-Expiry-Secret header (trimmed), or null. */
  providedSecret: string | null;
  /** Value of LEGACY_ANNUAL_EXPIRY_SECRET (trimmed), or null when unset. */
  configuredSecret: string | null;
  /** Whether LEGACY_ANNUAL_EXPIRY_LIVE_ENABLED === "true". */
  liveEnabled: boolean;
}

export type ExpiryExecutionDecision =
  | { authorized: true; dryRun: boolean; triggerSource: "manual" | "scheduled" }
  | { authorized: false; status: number; error: string };

/**
 * Resolve whether an invocation may run, and in which mode. Pure and testable.
 *
 * - Scheduled: always allowed; live only when {@link ExpiryExecutionRequest.liveEnabled}.
 * - Manual without `?confirm=LIVE`: allowed, dry-run.
 * - Manual with `?confirm=LIVE`: allowed live ONLY when a secret is configured
 *   and the provided header matches it; otherwise rejected (401). Independent of
 *   liveEnabled.
 */
export function resolveExpiryExecution(
  request: ExpiryExecutionRequest,
): ExpiryExecutionDecision {
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
        "A live manual reconciliation requires a valid X-Legacy-Expiry-Secret header.",
    };
  }

  return { authorized: true, dryRun: false, triggerSource: "manual" };
}

function summarize(result: LegacyAnnualExpiryResult) {
  return {
    ok: result.ok,
    dryRun: result.dryRun,
    triggerSource: result.triggerSource,
    todayLosAngeles: result.todayLosAngeles,
    candidatesFound: result.candidatesFound,
    legacyPlansRemoved: result.legacyPlansRemoved,
    skippedAlreadyRemoved: result.skippedAlreadyRemoved,
    skippedActivePaid: result.skippedActivePaid,
    skippedNoUniqueMatch: result.skippedNoUniqueMatch,
    failures: result.failures,
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
  const configuredSecret = (process.env.LEGACY_ANNUAL_EXPIRY_SECRET ?? "").trim();
  const providedSecret = (req.headers.get("x-legacy-expiry-secret") ?? "").trim();

  const decision = resolveExpiryExecution({
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
    const result = await runLegacyAnnualExpiry({
      dryRun: decision.dryRun,
      triggerSource: decision.triggerSource,
    });
    console.log("[legacy-annual-expiry]", summarize(result));
    return json(
      { ok: result.ok, result, error: result.errorMessage },
      result.ok ? 200 : 502,
    );
  } catch (error) {
    console.error("legacy-annual-expiry failed:", error);
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Legacy annual expiry reconciliation failed.",
      },
      500,
    );
  }
};
