import type { APIRoute } from "astro";

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  getActiveCampaignKinListId,
  type ActiveCampaignListStatus,
} from "../../../lib/activecampaign/client";
import { getMemberstackAdminClient } from "../../../../netlify/functions/lib/memberstack-admin.js";
import { loadExpiredLegacyMembersReport } from "../../../lib/watson/expiredLegacyMembersReport";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * GET: read-only list of expired legacy members.
 * Does not change dates, plans, tags, subscriptions, automations, or reminders.
 */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) return auth;

  const client = getMemberstackAdminClient();
  if (!client) {
    return watsonJsonResponse(
      { ok: false, error: "Memberstack admin API is not configured." },
      500,
    );
  }

  const acConfig = getActiveCampaignConfig();
  const listId = getActiveCampaignKinListId();
  const ac = acConfig && listId ? createActiveCampaignClient(acConfig) : null;

  try {
    const report = await loadExpiredLegacyMembersReport({
      listMembers: client,
      listStatusForEmail: ac
        ? async (email): Promise<ActiveCampaignListStatus | "no_contact" | null> => {
            const contact = await ac.findContactByEmail(email);
            if (!contact) return "no_contact";
            return ac.getListStatus(contact.id, listId as string);
          }
        : undefined,
    });
    return watsonJsonResponse(report);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safe =
      raw && !/postgres:|password|secret|api[_-]?key|sk_/i.test(raw)
        ? raw.slice(0, 300)
        : "Expired legacy member report failed.";
    return watsonJsonResponse({ ok: false, error: safe }, 500);
  }
};
