import type { APIRoute } from "astro";

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
} from "../../../lib/activecampaign/client";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";
import { legacyRenewalReminderLiveEnabled } from "../../../lib/watson/legacyRenewalReminderLiveFlag";

export const prerender = false;

const REMINDER_PUBLISH_MARKER = "live-flag-2";

function reminderLiveEnabled(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  return legacyRenewalReminderLiveEnabled({
    LEGACY_RENEWAL_REMINDER_LIVE_ENABLED: env?.["LEGACY_RENEWAL_REMINDER_LIVE_ENABLED"],
  });
}

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
      reminderLiveEnabled: reminderLiveEnabled(),
      reminderPublishMarker: REMINDER_PUBLISH_MARKER,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trigger check failed.";
    return watsonJsonResponse(
      { ok: false, error: message.replace(/Api-Token[^\\s]*/gi, "[redacted]") },
      500,
    );
  }
};
