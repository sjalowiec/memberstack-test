import type { APIRoute } from "astro";

import { runLegacyRenewalReminders } from "../../../lib/watson/legacyRenewalReminders";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * GET: production dry run of the legacy renewal reminder job.
 * Always dry-run. Does not tag, subscribe, email, or change dates or plans.
 */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;

  try {
    const result = await runLegacyRenewalReminders({
      dryRun: true,
      triggerSource: "manual",
      productionWritesAllowed: false,
    });
    return watsonJsonResponse({
      ok: result.ok,
      dryRun: true,
      reminderLiveEnabled: process.env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true",
      todayLosAngeles: result.todayLosAngeles,
      error: result.errorMessage,
      windows: result.windows.map((windowSummary) => ({
        windowDays: windowSummary.windowDays,
        tagName: windowSummary.tagName,
        candidatesFound: windowSummary.candidatesFound,
        wouldTag: windowSummary.wouldTag,
        tagged: windowSummary.tagged,
        skippedActivePaid: windowSummary.skippedActivePaid,
        skippedComplimentary: windowSummary.skippedComplimentary,
        skippedNotSubscribed: windowSummary.skippedNotSubscribed,
        skippedAlreadyTagged: windowSummary.skippedAlreadyTagged,
        skippedUnsubscribed: windowSummary.skippedUnsubscribed,
        skippedBounced: windowSummary.skippedBounced,
        skippedUnconfirmed: windowSummary.skippedUnconfirmed,
        skippedStaffOrTest: windowSummary.skippedStaffOrTest,
        skippedAmbiguous: windowSummary.skippedAmbiguous,
        skippedMissingEmail: windowSummary.skippedMissingEmail,
        failures: windowSummary.failures,
      })),
      totals: {
        candidatesFound: result.totals.candidatesFound,
        wouldTag: result.totals.wouldTag,
        tagged: result.totals.tagged,
        skippedActivePaid: result.totals.skippedActivePaid,
        skippedComplimentary: result.totals.skippedComplimentary,
        skippedNotSubscribed: result.totals.skippedNotSubscribed,
        skippedAlreadyTagged: result.totals.skippedAlreadyTagged,
        failures: result.totals.failures,
      },
    });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safe =
      raw && !/postgres:|password|secret|api[_-]?key|sk_/i.test(raw)
        ? raw.slice(0, 300)
        : "Legacy renewal dry run failed.";
    return watsonJsonResponse({ ok: false, dryRun: true, error: safe }, 500);
  }
};
