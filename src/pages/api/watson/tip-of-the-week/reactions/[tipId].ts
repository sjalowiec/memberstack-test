import type { APIRoute } from "astro";

import {
  loadTipReactionTotals,
  tipReactionDisplayRows,
} from "../../../../../lib/tipOfTheWeek/reactionsAggregate";
import { requireWatsonSessionJson, watsonJsonResponse } from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/** Aggregated reaction totals for one tipId — no visitor IDs. */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const tipId =
    typeof context.params.tipId === "string" ? context.params.tipId.trim() : "";
  if (!tipId) {
    return watsonJsonResponse({ ok: false, error: "tipId is required." }, 400);
  }

  try {
    const totals = await loadTipReactionTotals(tipId);
    return watsonJsonResponse({
      ok: true,
      tipId: totals.tipId,
      total: totals.total,
      byReaction: totals.byReaction,
      rows: tipReactionDisplayRows(totals),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load reaction totals.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
