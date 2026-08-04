import type { APIRoute } from "astro";

import {
  createTipOfTheWeek,
  listAllTipOfTheWeek,
} from "../../../../lib/tipOfTheWeek/store";
import { resolveVideoForTip } from "../../../../lib/tipOfTheWeek/map";
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
    const tips = await listAllTipOfTheWeek();
    return watsonJsonResponse({ ok: true, tips });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list Tip of the Week.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await createTipOfTheWeek(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    const video = resolveVideoForTip(result.value);
    return watsonJsonResponse(
      {
        ok: true,
        tip: result.value,
        video,
        warning: result.warning ?? null,
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create Tip of the Week.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
