import type { APIRoute } from "astro";

import { deleteWatsonNote, updateWatsonNote, validateWatsonNoteId } from "../../../../lib/watson/watsonNotes";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateWatsonNoteId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await updateWatsonNote({
      id: idResult.value,
      noteText: bodyResult.body.noteText,
      category: bodyResult.body.category,
    });

    if (!result.ok) {
      const status = result.error === "Note not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }

    return watsonJsonResponse({ ok: true, note: result.value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update note.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateWatsonNoteId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  try {
    const result = await deleteWatsonNote(idResult.value);
    if (!result.ok) {
      const status = result.error === "Note not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }

    return watsonJsonResponse({ ok: true, id: result.value.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete note.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
