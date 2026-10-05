import type { APIRoute } from "astro";

import { getMemberstackAdminClient } from "../../../../netlify/functions/lib/memberstack-admin.js";
import { loadLegacyRenewalDiagnostic } from "../../../lib/watson/legacyRenewalDiagnostic";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../lib/watson/watsonApiAuth";

export const prerender = false;

/**
 * GET: read-only legacy renewal counts.
 * Uses this server's Memberstack admin client and Watson database.
 * Does not change members, dates, plans, tags, fields, or automations.
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
    const report = await loadLegacyRenewalDiagnostic({
      listMembers: client,
    });
    return watsonJsonResponse(report);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    const safe =
      raw && !/postgres:|password|secret|api[_-]?key|sk_/i.test(raw)
        ? raw.slice(0, 300)
        : "Legacy renewal diagnostic failed.";
    return watsonJsonResponse({ ok: false, error: safe }, 500);
  }
};
