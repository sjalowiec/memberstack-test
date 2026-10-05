import type { APIRoute } from "astro";

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
} from "../../../lib/activecampaign/client";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * Read-only check that each legacy renewal tag is the start trigger of an
 * ActiveCampaign automation. Does not apply tags or run the reminder job.
 */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;

  const config = getActiveCampaignConfig();
  if (!config) {
    return watsonJsonResponse(
      { ok: false, error: "ActiveCampaign is not configured." },
      500,
    );
  }

  try {
    const report = await createActiveCampaignClient(config).describeLegacyRenewalTriggers?.();
    if (!report) {
      return watsonJsonResponse({ ok: false, error: "Trigger check is unavailable." }, 500);
    }
    return watsonJsonResponse({
      ok: true,
      ...report,
      reminderLiveEnabled: process.env.LEGACY_RENEWAL_REMINDER_LIVE_ENABLED === "true",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trigger check failed.";
    return watsonJsonResponse(
      { ok: false, error: message.replace(/Api-Token[^\\s]*/gi, "[redacted]") },
      500,
    );
  }
};
