import type { APIRoute } from "astro";

import { updateKnitAblePublishDate } from "../../../../lib/knit-ables/scheduleStore";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const slug = context.params.slug;
  if (!slug || !slug.trim()) {
    return watsonJsonResponse({ ok: false, error: "Knit-able slug is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;
  if (!Object.prototype.hasOwnProperty.call(bodyResult.body, "publishDate")) {
    return watsonJsonResponse(
      {
        ok: false,
        error: "Publish date is required. Send null to keep this Knit-able unpublished.",
      },
      400,
    );
  }

  try {
    const result = await updateKnitAblePublishDate(slug, bodyResult.body.publishDate);
    if (!result.ok) {
      const status = result.error === "Unknown Knit-able." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }
    return watsonJsonResponse({ ok: true, knitAble: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the Knit-able publish date.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
