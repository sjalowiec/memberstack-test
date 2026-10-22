import type { APIRoute } from "astro";

import { createStudioSession, listStudioSessions } from "../../../../lib/studio/sessionStore";
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
    const sessions = await listStudioSessions();
    return watsonJsonResponse({ ok: true, sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list Studio sessions.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await createStudioSession(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse(
        { ok: false, error: result.error, field: result.field ?? null },
        400,
      );
    }
    return watsonJsonResponse({ ok: true, session: result.value }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the Studio session.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
