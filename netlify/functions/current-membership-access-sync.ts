/**
 * Reconciliation of ActiveCampaign "Current membership access".
 *
 * This function is not scheduled, so a manual request can return totals.
 * A request body with next_run writes only when
 * CURRENT_MEMBERSHIP_ACCESS_SYNC_LIVE_ENABLED is exactly "true" and this is
 * the production site. kin-dev stays dry-run. Does not send email or edit
 * other contact fields.
 */
import { isScheduledInvocation } from "./legacy-annual-expiry";
import {
  currentMembershipAccessSyncWillWrite,
  runCurrentMembershipAccessSync,
} from "../../src/lib/activecampaign/currentMembershipAccessSync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function summarizeCurrentMembershipAccessSync(result: {
  liveWrite: boolean;
  fieldReady: boolean;
  fieldValuesKnown: boolean;
  written: number;
  remainingWrites: number;
  failures: unknown[];
  census: {
    watsonYesCount: number;
    watsonNoCount: number;
    unresolvedCount: number;
    memberstackTruncated: boolean;
  } | null;
  plan: {
    activeCampaignYesCount: number;
    matchedYesCount: number;
    matchedNoCount: number;
    unchanged: number;
    wouldWrite: Array<{ value: "yes" | "no"; previous: string | null }>;
    missingFromActiveCampaign: unknown[];
    missingFromWatson: unknown[];
    duplicateContacts: unknown[];
    unresolved: unknown[];
  } | null;
  errorMessage: string | null;
}) {
  return {
    liveWrite: result.liveWrite,
    fieldReady: result.fieldReady,
    fieldValuesKnown: result.fieldValuesKnown,
    written: result.written,
    remainingWrites: result.remainingWrites,
    failures: result.failures.length,
    watsonYesCount: result.census?.watsonYesCount ?? null,
    watsonNoCount: result.census?.watsonNoCount ?? null,
    unresolvedCount: result.census?.unresolvedCount ?? null,
    memberstackTruncated: result.census?.memberstackTruncated ?? null,
    activeCampaignYesCount: result.plan?.activeCampaignYesCount ?? null,
    matchedYesCount: result.plan?.matchedYesCount ?? null,
    matchedNoCount: result.plan?.matchedNoCount ?? null,
    unchanged: result.plan?.unchanged ?? null,
    wouldWriteYes: result.plan?.wouldWrite.filter((write) => write.value === "yes").length ?? null,
    wouldWriteNo: result.plan?.wouldWrite.filter((write) => write.value === "no").length ?? null,
    wouldChangeYesToNo:
      result.plan?.wouldWrite.filter((write) => write.value === "no" && write.previous === "yes")
        .length ?? null,
    missingFromActiveCampaign: result.plan?.missingFromActiveCampaign.length ?? null,
    missingFromWatson: result.plan?.missingFromWatson.length ?? null,
    duplicateContacts: result.plan?.duplicateContacts.length ?? null,
    errorMessage: result.errorMessage,
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

  const scheduled = isScheduledInvocation(bodyText);
  const liveWrite = scheduled && currentMembershipAccessSyncWillWrite();
  const url = new URL(req.url);
  const maxWrites = Number(url.searchParams.get("maxWrites") || "");
  const detail = url.searchParams.get("detail") === "1";

  try {
    const result = await runCurrentMembershipAccessSync({
      liveWrite,
      maxWrites: Number.isFinite(maxWrites) && maxWrites > 0 ? maxWrites : undefined,
      sampleEmails: ["jigglybaa629@gmail.com", "4theotherbrother@gmail.com"],
    });
    console.log("[current-membership-access-sync]", summarizeCurrentMembershipAccessSync(result));
    console.log("[current-membership-access-sync] samples", JSON.stringify(result.samples));
    if (result.failures.length) {
      console.log(
        "[current-membership-access-sync] failures",
        JSON.stringify(result.failures.slice(0, 20)),
      );
    }
    if (result.plan) {
      console.log(
        "[current-membership-access-sync] gaps",
        JSON.stringify({
          missingFromActiveCampaign: result.plan.missingFromActiveCampaign,
          duplicateContacts: result.plan.duplicateContacts,
          unresolved: result.plan.unresolved,
          missingFromWatson: result.plan.missingFromWatson,
        }),
      );
    }
    const summary = summarizeCurrentMembershipAccessSync(result);
    return json(
      {
        ok: result.ok,
        result: summary,
        samples: result.samples,
        gaps: detail
          ? {
              missingFromActiveCampaign: result.plan?.missingFromActiveCampaign ?? [],
              missingFromWatson: result.plan?.missingFromWatson ?? [],
              duplicateContacts: result.plan?.duplicateContacts ?? [],
              unresolved: result.plan?.unresolved ?? [],
            }
          : undefined,
        error: result.errorMessage,
      },
      result.ok ? 200 : 502,
    );
  } catch (error) {
    console.error("current-membership-access-sync failed:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Current membership access sync failed.",
      },
      500,
    );
  }
};
