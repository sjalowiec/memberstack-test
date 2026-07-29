import type { APIRoute } from "astro";

import { updateLegacyPaidThrough } from "../../../../../lib/watson/legacyPaidThrough";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * PATCH: update only `legacy_members.subscriptionexpiring` for this member.
 * Never writes expiration data to Memberstack.
 */
export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberid = context.params.memberid ? decodeURIComponent(context.params.memberid) : "";
  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await updateLegacyPaidThrough({
      memberid,
      paidThroughYmd: bodyResult.body.paidThroughYmd as string,
      updatedBy:
        typeof bodyResult.body.updatedBy === "string" ? bodyResult.body.updatedBy : undefined,
    });

    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }

    return watsonJsonResponse({
      ok: true,
      memberid: result.value.memberid,
      oldPaidThroughYmd: result.value.oldPaidThroughYmd,
      newPaidThroughYmd: result.value.newPaidThroughYmd,
      oldPaidThroughDisplay: result.value.oldPaidThroughDisplay,
      newPaidThroughDisplay: result.value.newPaidThroughDisplay,
      subscriptionexpiring: result.value.member.subscriptionexpiring,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update legacy paid-through date.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
