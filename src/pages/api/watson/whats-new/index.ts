import type { APIRoute } from "astro";

import {
  createWhatsNewCard,
  listAllWhatsNewCards,
} from "../../../../lib/whatsNew/store";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  try {
    const cards = await listAllWhatsNewCards();
    return watsonJsonResponse({ ok: true, cards });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list What's New cards.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await createWhatsNewCard(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    return watsonJsonResponse({ ok: true, card: result.value }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create What's New card.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
