import type { APIRoute } from "astro";

import {
  createWatsonNote,
  getMemberWatsonNotes,
  validateWatsonNoteMemberid,
} from "../../../../../lib/watson/watsonNotes";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberid = context.params.memberid ? decodeURIComponent(context.params.memberid) : "";
  const validated = validateWatsonNoteMemberid(memberid);
  if (!validated.ok) {
    return watsonJsonResponse({ ok: false, error: validated.error }, 400);
  }

  try {
    const notes = await getMemberWatsonNotes(validated.value);
    return watsonJsonResponse({ ok: true, notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Watson notes.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberid = context.params.memberid ? decodeURIComponent(context.params.memberid) : "";
  const memberidResult = validateWatsonNoteMemberid(memberid);
  if (!memberidResult.ok) {
    return watsonJsonResponse({ ok: false, error: memberidResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await createWatsonNote({
      memberid: memberidResult.value,
      noteText: bodyResult.body.noteText,
      category: bodyResult.body.category,
      createdBy: bodyResult.body.createdBy,
    });

    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }

    return watsonJsonResponse({ ok: true, note: result.value }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create note.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
