import type { APIRoute } from "astro";

import { resolveVideoForTip } from "../../../../../lib/tipOfTheWeek/map";
import { requireWatsonSessionJson, watsonJsonResponse } from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

/** Resolve Learning Library catalog metadata for a content_id (Watson preview). */
export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const contentId =
    typeof context.params.contentId === "string"
      ? context.params.contentId.trim()
      : "";
  if (!/^\d{1,12}$/.test(contentId)) {
    return watsonJsonResponse(
      { ok: false, error: "Learning Library content ID must be numeric." },
      400,
    );
  }

  const video = resolveVideoForTip({ videoContentId: contentId });
  if (!video) {
    return watsonJsonResponse(
      {
        ok: false,
        error: `No Learning Library video found for content ID ${contentId}.`,
      },
      404,
    );
  }

  return watsonJsonResponse({ ok: true, video });
};
