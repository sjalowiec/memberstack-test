import type { APIRoute } from "astro";

import { getStudioSessionById, updateStudioSession } from "../../../../lib/studio/sessionStore";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = typeof context.params.id === "string" ? context.params.id.trim() : "";
  if (!id) return watsonJsonResponse({ ok: false, error: "Session id is required." }, 400);

  try {
    const session = await getStudioSessionById(id);
    if (!session) return watsonJsonResponse({ ok: false, error: "Session not found." }, 404);
    return watsonJsonResponse({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the Studio session.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = typeof context.params.id === "string" ? context.params.id.trim() : "";
  if (!id) return watsonJsonResponse({ ok: false, error: "Session id is required." }, 400);

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await updateStudioSession(id, bodyResult.body);
    if (!result.ok) {
      const status = result.error === "Session not found." ? 404 : 400;
      return watsonJsonResponse(
        { ok: false, error: result.error, field: result.field ?? null },
        status,
      );
    }
    return watsonJsonResponse({ ok: true, session: result.value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save the Studio session.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
