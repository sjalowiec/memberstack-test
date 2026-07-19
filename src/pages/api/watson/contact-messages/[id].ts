import type { APIRoute } from "astro";

import {
  getContactMessage,
  getContactMessagesStore,
  isContactMessageStatus,
  updateContactMessage,
} from "../../../../lib/contact/contactMessagesStore";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

const ADMIN_NOTES_MAX_LENGTH = 10_000;

function parseId(raw: string | undefined): string {
  return raw ? decodeURIComponent(raw).trim() : "";
}

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = parseId(context.params.id);
  if (!id) {
    return watsonJsonResponse({ ok: false, error: "Message id is required." }, 400);
  }

  try {
    const store = getContactMessagesStore();
    const message = await getContactMessage(store, id);
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

  const id = parseId(context.params.id);
  if (!id) {
    return watsonJsonResponse({ ok: false, error: "Message id is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { body } = bodyResult;
  const patch: {
    status?: import("../../../../lib/contact/contactMessagesStore").ContactMessageStatus;
    admin_notes?: string | null;
  } = {};

  if ("status" in body) {
    if (!isContactMessageStatus(body.status)) {
      return watsonJsonResponse({ ok: false, error: "Invalid status." }, 400);
    }
    patch.status = body.status;
  }

  if ("admin_notes" in body) {
    if (body.admin_notes === null) {
      patch.admin_notes = null;
    } else if (typeof body.admin_notes !== "string") {
      return watsonJsonResponse(
        { ok: false, error: "admin_notes must be a string or null." },
        400,
      );
    } else if (body.admin_notes.length > ADMIN_NOTES_MAX_LENGTH) {
      return watsonJsonResponse(
        { ok: false, error: `admin_notes must be at most ${ADMIN_NOTES_MAX_LENGTH} characters.` },
        400,
      );
    } else {
      patch.admin_notes = body.admin_notes;
    }
  }

  if (!("status" in patch) && !("admin_notes" in patch)) {
    return watsonJsonResponse(
      { ok: false, error: "Provide status and/or admin_notes to update." },
      400,
    );
  }

  try {
    const store = getContactMessagesStore();
    const message = await updateContactMessage(store, id, patch);
    if (!message) {
      return watsonJsonResponse({ ok: false, error: "Message not found." }, 404);
    }
    return watsonJsonResponse({ ok: true, message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update contact message.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
