import type { APIRoute } from "astro";

import {
  loadAllSkillBuilderReactionTotals,
  skillBuilderReactionDisplayRows,
} from "../../../../../lib/skillBuilders/skillBuilderReactionsAggregate";
import { requireWatsonSessionJson, watsonJsonResponse } from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/** Aggregated Skill Builder reaction totals for every known builder — no visitor IDs. */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  try {
    const rows = await loadAllSkillBuilderReactionTotals();
    return watsonJsonResponse({
      ok: true,
      contentType: "skill-builder",
      rows: rows.map((row) => ({
        ...row,
        display: skillBuilderReactionDisplayRows(row),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Skill Builder reaction totals.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
