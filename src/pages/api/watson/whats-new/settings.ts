import type { APIRoute } from "astro";

import {
  getWhatsNewBillboardSettings,
  upsertWhatsNewBillboardSettings,
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
    const settings = await getWhatsNewBillboardSettings();
    return watsonJsonResponse({ ok: true, settings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load billboard settings.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await upsertWhatsNewBillboardSettings(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    return watsonJsonResponse({ ok: true, settings: result.value });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to save billboard settings.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
