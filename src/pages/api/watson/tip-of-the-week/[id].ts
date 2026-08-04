import type { APIRoute } from "astro";

import { resolveVideoForTip } from "../../../../lib/tipOfTheWeek/map";
import {
  archiveTipOfTheWeek,
  getTipOfTheWeekById,
  updateTipOfTheWeek,
} from "../../../../lib/tipOfTheWeek/store";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id =
    typeof context.params.id === "string" ? context.params.id.trim() : "";
  if (!id) {
    return watsonJsonResponse({ ok: false, error: "Tip id is required." }, 400);
  }

  try {
    const tip = await getTipOfTheWeekById(id);
    if (!tip) {
      return watsonJsonResponse({ ok: false, error: "Tip not found." }, 404);
    }
    return watsonJsonResponse({
      ok: true,
      tip,
      video: resolveVideoForTip(tip),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load tip.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id =
    typeof context.params.id === "string" ? context.params.id.trim() : "";
  if (!id) {
    return watsonJsonResponse({ ok: false, error: "Tip id is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const action =
      typeof bodyResult.body.action === "string"
        ? bodyResult.body.action.trim()
        : "";

    const result =
      action === "archive"
        ? await archiveTipOfTheWeek(id)
        : await updateTipOfTheWeek(id, bodyResult.body);

    if (!result.ok) {
      const status = result.error === "Tip not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }

    return watsonJsonResponse({
      ok: true,
      tip: result.value,
      video: resolveVideoForTip(result.value),
      warning: "warning" in result ? result.warning ?? null : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update tip.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
