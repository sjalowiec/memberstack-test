import type { APIRoute } from "astro";

import {
  countNewContactMessages,
  deleteContactMessage,
  getContactMessageById,
  updateContactMessage,
} from "../../../../lib/contact/contactMessagesDb";
import { deleteContactUpload } from "../../../../lib/contact/contactUploads";
import {
  isContactMessageStatus,
  normalizeInternalNotes,
  validateContactMessageId,
} from "../../../../lib/contact/contactMessageRecord";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const idResult = validateContactMessageId(
    context.params.id ? decodeURIComponent(context.params.id) : "",
  );
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  try {
    const message = await getContactMessageById(idResult.value);
    if (!message) {
      return watsonJsonResponse({ ok: false, error: "Message not found." }, 404);
    }
    return watsonJsonResponse({ ok: true, message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load contact message.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const idResult = validateContactMessageId(
    context.params.id ? decodeURIComponent(context.params.id) : "",
  );
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { body } = bodyResult;
  const patch: {
    status?: "new" | "responded" | "closed";
    internalNotes?: string | null;
  } = {};

  if ("status" in body) {
    if (!isContactMessageStatus(body.status)) {
      return watsonJsonResponse({ ok: false, error: "Invalid status." }, 400);
    }
    patch.status = body.status;
  }

  if ("internal_notes" in body) {
    const notes = normalizeInternalNotes(body.internal_notes);
    if (!notes.ok) {
      return watsonJsonResponse({ ok: false, error: notes.error }, 400);
    }
    patch.internalNotes = notes.value;
  }

  if (!("status" in patch) && !("internalNotes" in patch)) {
    return watsonJsonResponse(
      { ok: false, error: "Provide status and/or internal notes to update." },
      400,
    );
  }

  try {
    const result = await updateContactMessage(idResult.value, patch);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }
    return watsonJsonResponse({ ok: true, message: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update contact message.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const idResult = validateContactMessageId(
    context.params.id ? decodeURIComponent(context.params.id) : "",
  );
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  try {
    const result = await deleteContactMessage(idResult.value);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }

    let newCount: number | null = null;
    try {
      newCount = await countNewContactMessages();
    } catch (error) {
      console.error(
        "[watson] Contact message count unavailable after delete:",
        error instanceof Error ? error.message : "unknown error",
      );
    }

    const blobKey = result.value.attachmentBlobKey;
    if (blobKey) {
      try {
        const removed = await deleteContactUpload(blobKey);
        if (!removed) {
          console.error("[watson] Contact attachment was not deleted with the message.");
        }
      } catch (error) {
        console.error(
          "[watson] Contact attachment delete failed:",
          error instanceof Error ? error.message : "unknown error",
        );
      }
    }

    return watsonJsonResponse({
      ok: true,
      id: result.value.id,
      newCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete contact message.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
