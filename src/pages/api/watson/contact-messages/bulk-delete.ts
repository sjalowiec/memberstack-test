import type { APIRoute } from "astro";

import { deleteContactMessageAttachments } from "../../../../lib/contact/contactMessageCleanup";
import {
  countNewContactMessages,
  deleteContactMessages,
} from "../../../../lib/contact/contactMessagesDb";
import { parseContactMessageIds } from "../../../../lib/contact/contactMessageRecord";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const idsResult = parseContactMessageIds(bodyResult.body.ids);
  if (!idsResult.ok) {
    return watsonJsonResponse({ ok: false, error: idsResult.error }, 400);
  }

  try {
    const result = await deleteContactMessages(idsResult.value);
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

    await deleteContactMessageAttachments(
      result.value.map((message) => message.attachmentBlobKey),
    );

    return watsonJsonResponse({
      ok: true,
      deletedIds: result.value.map((message) => message.id),
      deletedCount: result.value.length,
      newCount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete contact messages.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
