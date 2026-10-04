/**
 * Scheduled complimentary membership expiration cleanup.
 *
 * Removes only `pln_complimentary-membership-30-days-ai28093g` after the Watson
 * access-through date (`watson_complimentary_access.access_through`) is strictly
 * before today in America/Los_Angeles. Paid plans and legacy plans are not removed.
 * Site access is already denied by hasMemberAccess before this job runs.
 *
 * Scheduled runs perform live removals only when
 * COMPLIMENTARY_EXPIRY_LIVE_ENABLED === "true" AND this is the published
 * production site. kin-dev's own deploys also use Netlify CONTEXT=production
 * and can reach the live Memberstack key, so they always stay dry-run.
 * Manual HTTP is dry-run unless ?confirm=LIVE and X-Complimentary-Expiry-Secret
 * matches COMPLIMENTARY_EXPIRY_SECRET, and only on that same production site.
 */
import {
  runComplimentaryExpiry,
  type ComplimentaryExpiryResult,
} from "../../src/lib/watson/complimentaryExpiry";
import {
  isKinDevMemberstackRuntime,
  isMemberstackProductionRuntime,
} from "./lib/memberstack-admin.js";
import {
  isConfirmedLive,
  isScheduledInvocation,
  resolveExpiryExecution,
  type ExpiryExecutionDecision,
} from "./legacy-annual-expiry";

/** Published knititnow.com Netlify site. kin-dev must not remove live plans. */
export const PRODUCTION_COMPLIMENTARY_EXPIRY_SITE_ID =
  "7a6a8dde-c0a0-4a21-960d-dff3f0ba358b";

/**
 * True only for the production site's production runtime. kin-dev, branch
 * deploys, deploy previews, and any unknown site stay false.
 */
export function isComplimentaryExpiryLiveRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isKinDevMemberstackRuntime(env)) return false;
  if (!isMemberstackProductionRuntime(env)) return false;
  const siteId = String(env.SITE_ID || "").trim().toLowerCase();
  return siteId === PRODUCTION_COMPLIMENTARY_EXPIRY_SITE_ID;
}

export function complimentaryExpiryWillDryRun(
  env: NodeJS.ProcessEnv,
  decision: ExpiryExecutionDecision,
): boolean {
  if (!decision.authorized) return true;
  return decision.dryRun || !isComplimentaryExpiryLiveRuntime(env);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function isComplimentaryScheduledLiveEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.COMPLIMENTARY_EXPIRY_LIVE_ENABLED === "true";
}

function summarize(result: ComplimentaryExpiryResult) {
  return {
    ok: result.ok,
    dryRun: result.dryRun,
    triggerSource: result.triggerSource,
    todayLosAngeles: result.todayLosAngeles,
    candidatesFound: result.candidatesFound,
    complimentaryPlansRemoved: result.complimentaryPlansRemoved,
    skippedAlreadyRemoved: result.skippedAlreadyRemoved,
    skippedNotFound: result.skippedNotFound,
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
  const configuredSecret = (process.env.COMPLIMENTARY_EXPIRY_SECRET ?? "").trim();
  const providedSecret = (req.headers.get("x-complimentary-expiry-secret") ?? "").trim();
  const liveRuntime = isComplimentaryExpiryLiveRuntime(process.env);
  const decision = resolveExpiryExecution({
    scheduled: isScheduledInvocation(bodyText),
    confirmLive: isConfirmedLive(url),
    providedSecret: providedSecret || null,
    configuredSecret: configuredSecret || null,
    liveEnabled: isComplimentaryScheduledLiveEnabled(process.env) && liveRuntime,
  });

  if (!decision.authorized) {
    return json(
      {
        ok: false,
        error:
          "A live manual complimentary cleanup requires a valid X-Complimentary-Expiry-Secret header.",
      },
      decision.status,
    );
  }

  try {
    const result = await runComplimentaryExpiry({
      dryRun: complimentaryExpiryWillDryRun(process.env, decision),
      triggerSource: decision.triggerSource,
    });
    console.log("[complimentary-expiry]", summarize(result));
    return json({ ok: result.ok, result, error: result.errorMessage }, result.ok ? 200 : 502);
  } catch (error) {
    console.error("complimentary-expiry failed:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Complimentary expiry cleanup failed.",
      },
      500,
    );
  }
};
