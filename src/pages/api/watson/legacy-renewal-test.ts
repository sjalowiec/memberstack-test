import type { APIRoute } from "astro";

import { isProductionActiveCampaignWriteRuntime } from "../../../lib/watson/complimentaryCampaignSync";
import {
  applyExplicitLegacyRenewalTest,
  preflightLegacyRenewalTestContact,
} from "../../../lib/watson/legacyRenewalSingleContactTest";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * GET: read-only preflight for nosub1@knititnow.com only.
 * POST: apply the 7-day tag to that same address only, and only with ?confirm=TEST.
 * The address is fixed in code. This route does not accept another email and
 * does not run the bulk reminder job. kin-dev stays dry-run.
 */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;
  const preflight = await preflightLegacyRenewalTestContact();
  return watsonJsonResponse({
    ...preflight,
    reminderLiveEnabled: process.env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true",
    applied: false,
  });
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;
  if (context.url.searchParams.get("confirm") !== "TEST") {
    return watsonJsonResponse(
      { ok: false, applied: false, error: "Confirmation required." },
      400,
    );
  }
  const result = await applyExplicitLegacyRenewalTest({
    productionWritesAllowed: isProductionActiveCampaignWriteRuntime(process.env),
  });
  return watsonJsonResponse({
    ...result,
    reminderLiveEnabled: process.env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true",
  });
};
