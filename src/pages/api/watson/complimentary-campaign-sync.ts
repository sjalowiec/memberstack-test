import type { APIRoute } from "astro";

import {
  complimentaryCampaignAstroEnv,
  observedComplimentaryCampaignHosts,
} from "../../../lib/watson/complimentaryCampaignAstroEnv";
import {
  complimentaryCampaignSyncWillWrite,
  runComplimentaryCampaignSync,
} from "../../../lib/watson/complimentaryCampaignSync";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * POST: sync saved Watson complimentary dates to ActiveCampaign.
 * Production writes. DEV returns a dry run and does not write.
 * Does not send email or change list subscription status.
 */
export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const campaignEnv = complimentaryCampaignAstroEnv({
    requestUrl: context.url,
    request: context.request,
  });
  const liveWrite = complimentaryCampaignSyncWillWrite(campaignEnv);
  try {
    const result = await runComplimentaryCampaignSync({ liveWrite });
    return watsonJsonResponse({
      ok: result.ok,
      liveWrite: result.liveWrite,
      hosts: observedComplimentaryCampaignHosts(context.url, context.request),
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Complimentary campaign sync failed.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
