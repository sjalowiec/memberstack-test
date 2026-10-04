/**
 * Scheduled complimentary membership expiration cleanup.
 *
 * Removes only `pln_complimentary-membership-30-days-ai28093g` after the Watson
 * access-through date (`watson_complimentary_access.access_through`) is strictly
 * before today in America/Los_Angeles. Paid plans and legacy plans are not removed.
 * Site access is already denied by hasMemberAccess before this job runs.
 *
 * Scheduled runs perform live removals only when
 * COMPLIMENTARY_EXPIRY_LIVE_ENABLED === "true". Manual HTTP is dry-run unless
 * ?confirm=LIVE and X-Complimentary-Expiry-Secret matches COMPLIMENTARY_EXPIRY_SECRET.
 */
import {
  runComplimentaryExpiry,
  type ComplimentaryExpiryResult,
} from "../../src/lib/watson/complimentaryExpiry";
import {
  isConfirmedLive,
  isScheduledInvocation,
  resolveExpiryExecution,
} from "./legacy-annual-expiry";

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
  const decision = resolveExpiryExecution({
    scheduled: isScheduledInvocation(bodyText),
    confirmLive: isConfirmedLive(url),
    providedSecret: providedSecret || null,
    configuredSecret: configuredSecret || null,
    liveEnabled: isComplimentaryScheduledLiveEnabled(process.env),
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
      dryRun: decision.dryRun,
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
