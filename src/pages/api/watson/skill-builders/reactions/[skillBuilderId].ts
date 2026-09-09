import type { APIRoute } from "astro";

import {
  loadSkillBuilderReactionTotals,
  skillBuilderReactionDisplayRows,
} from "../../../../../lib/skillBuilders/skillBuilderReactionsAggregate";
import { isSkillBuilderFeedbackId } from "../../../../../lib/skillBuilders/skillBuilderFeedback";
import { requireWatsonSessionJson, watsonJsonResponse } from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/** Aggregated reaction totals for one Skill Builder — no visitor IDs. */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const skillBuilderId =
    typeof context.params.skillBuilderId === "string" ? context.params.skillBuilderId.trim() : "";
  if (!skillBuilderId || !isSkillBuilderFeedbackId(skillBuilderId)) {
    return watsonJsonResponse({ ok: false, error: "skillBuilderId is required." }, 400);
  }

  try {
    const totals = await loadSkillBuilderReactionTotals(skillBuilderId);
    return watsonJsonResponse({
      ok: true,
      contentType: "skill-builder",
      skillBuilderId: totals.skillBuilderId,
      total: totals.total,
      byReaction: totals.byReaction,
      rows: skillBuilderReactionDisplayRows(totals),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Skill Builder reaction totals.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
