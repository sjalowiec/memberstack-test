import type { APIRoute } from "astro";

import {
  deleteWhatsNewCard,
  updateWhatsNewCard,
  WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR,
} from "../../../../lib/whatsNew/store";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = context.params.id;
  if (!id) {
    return watsonJsonResponse({ ok: false, error: "Card id is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await updateWhatsNewCard(id, bodyResult.body);
    if (!result.ok) {
      const status = result.error === "Update card not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }
    return watsonJsonResponse({ ok: true, card: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update What's New card.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = context.params.id;
  if (!id || !id.trim()) {
    return watsonJsonResponse({ ok: false, error: "Card id is required." }, 400);
  }

  try {
    const result = await deleteWhatsNewCard(id);
    if (!result.ok) {
      const status =
        result.error === "Delete card not found."
          ? 404
          : result.error === WHATS_NEW_DELETE_ACTIVE_PUBLISHED_ERROR
            ? 409
            : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }
    return watsonJsonResponse({ ok: true, card: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete What's New card.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
