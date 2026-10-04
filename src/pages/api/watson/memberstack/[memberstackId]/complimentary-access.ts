import type { APIRoute } from "astro";

import { complimentaryCampaignAstroEnv } from "../../../../../lib/watson/complimentaryCampaignAstroEnv";
import {
  complimentaryCampaignSyncWillWrite,
  runComplimentaryCampaignSync,
} from "../../../../../lib/watson/complimentaryCampaignSync";
import { updateComplimentaryAccessThrough } from "../../../../../lib/watson/complimentaryAccess";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * PATCH: upsert `watson_complimentary_access.access_through` for this
 * Memberstack member. Does not change legacy paid-through or Memberstack.
 */
export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberstackId = context.params.memberstackId
    ? decodeURIComponent(context.params.memberstackId)
    : "";
  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await updateComplimentaryAccessThrough({
      memberstackId,
      accessThroughYmd: bodyResult.body.accessThroughYmd as string,
      updatedBy:
        typeof bodyResult.body.updatedBy === "string" ? bodyResult.body.updatedBy : undefined,
    });

    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }

    let campaignSync: { ok: boolean; skipped?: string; error?: string } = {
      ok: true,
      skipped: "not_production",
    };
    if (complimentaryCampaignSyncWillWrite(complimentaryCampaignAstroEnv())) {
      try {
        const synced = await runComplimentaryCampaignSync({
          liveWrite: true,
          onlyMemberstackIds: [result.value.memberstackId],
        });
        campaignSync = synced.ok
          ? { ok: true }
          : { ok: false, error: synced.errorMessage ?? "ActiveCampaign sync failed." };
      } catch (error) {
        campaignSync = {
          ok: false,
          error: error instanceof Error ? error.message : "ActiveCampaign sync failed.",
        };
      }
    }

    return watsonJsonResponse({
      ok: true,
      memberstackId: result.value.memberstackId,
      oldAccessThroughYmd: result.value.oldAccessThroughYmd,
      newAccessThroughYmd: result.value.newAccessThroughYmd,
      oldAccessThroughDisplay: result.value.oldAccessThroughDisplay,
      newAccessThroughDisplay: result.value.newAccessThroughDisplay,
      campaignSync,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to update complimentary access-through date.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
