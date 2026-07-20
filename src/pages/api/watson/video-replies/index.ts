import type { APIRoute } from "astro";

import {
  getVideoRepliesStore,
  listVideoReplies,
  saveVideoReply,
  VideoReplyValidationError,
  withAdminPresentation,
} from "../../../../lib/videoReplies/videoRepliesStore";
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

  try {
    const store = getVideoRepliesStore();
    const replies = await listVideoReplies(store);
    const origin = context.url.origin;
    return watsonJsonResponse({
      ok: true,
      replies: replies.map((reply) => withAdminPresentation(reply, origin)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list video replies.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { body } = bodyResult;

  try {
    const store = getVideoRepliesStore();
    const reply = await saveVideoReply(store, {
      memberName: typeof body.memberName === "string" ? body.memberName : "",
      memberEmail: typeof body.memberEmail === "string" ? body.memberEmail : "",
      topic: typeof body.topic === "string" ? body.topic : "",
      vimeoUrl: typeof body.vimeoUrl === "string" ? body.vimeoUrl : "",
      privateNotes: typeof body.privateNotes === "string" ? body.privateNotes : "",
    });

    return watsonJsonResponse(
      {
        ok: true,
        reply: withAdminPresentation(reply, context.url.origin),
      },
      201,
    );
  } catch (error) {
    if (error instanceof VideoReplyValidationError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    const message =
      error instanceof Error ? error.message : "Unable to create video reply.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
