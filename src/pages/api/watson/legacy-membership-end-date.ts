import type { APIRoute } from "astro";

import { getMemberstackAdminClient } from "../../../../netlify/functions/lib/memberstack-admin.js";
import { loadLegacyMembershipEndDate } from "../../../lib/watson/legacyMembershipEndDate";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * GET: read-only latest legacy paid-through date.
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

  try {
    return watsonJsonResponse(await loadLegacyMembershipEndDate({ listMembers: client }));
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safe =
      raw && !/postgres:|password|secret|api[_-]?key|sk_/i.test(raw)
        ? raw.slice(0, 300)
        : "Legacy membership end-date report failed.";
    return watsonJsonResponse({ ok: false, error: safe }, 500);
  }
};
