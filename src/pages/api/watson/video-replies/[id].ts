import type { APIRoute } from "astro";

import {
  disableVideoReply,
  getVideoRepliesStore,
  getVideoReplyById,
  markVideoReplySent,
  updateVideoReplyFields,
  VideoReplyValidationError,
  withAdminPresentation,
} from "../../../../lib/videoReplies/videoRepliesStore";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

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
    return watsonJsonResponse({ ok: false, error: "Video reply id is required." }, 400);
  }

  try {
    const store = getVideoRepliesStore();
    const reply = await getVideoReplyById(store, id);
    if (!reply) {
      return watsonJsonResponse({ ok: false, error: "Video reply not found." }, 404);
    }
    return watsonJsonResponse({
      ok: true,
      reply: withAdminPresentation(reply, context.url.origin),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load video reply.";
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
    return watsonJsonResponse({ ok: false, error: "Video reply id is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const { body } = bodyResult;
  const action = typeof body.action === "string" ? body.action.trim() : "";

  try {
    const store = getVideoRepliesStore();

    if (action === "mark_sent") {
      const reply = await markVideoReplySent(store, id, {
        force: body.force === true,
      });
      if (!reply) {
        return watsonJsonResponse({ ok: false, error: "Video reply not found." }, 404);
      }
      return watsonJsonResponse({
        ok: true,
        reply: withAdminPresentation(reply, context.url.origin),
      });
    }

    if (action === "disable") {
      const reply = await disableVideoReply(store, id);
      if (!reply) {
        return watsonJsonResponse({ ok: false, error: "Video reply not found." }, 404);
      }
      return watsonJsonResponse({
        ok: true,
        reply: withAdminPresentation(reply, context.url.origin),
      });
    }

    if (action === "update" || !action) {
      const patch: {
        memberName?: string;
        memberEmail?: string;
        topic?: string;
        vimeoUrl?: string;
        privateNotes?: string | null;
      } = {};

      if ("memberName" in body) {
        if (typeof body.memberName !== "string") {
          return watsonJsonResponse({ ok: false, error: "memberName must be a string." }, 400);
        }
        patch.memberName = body.memberName;
      }
      if ("memberEmail" in body) {
        if (typeof body.memberEmail !== "string") {
          return watsonJsonResponse({ ok: false, error: "memberEmail must be a string." }, 400);
        }
        patch.memberEmail = body.memberEmail;
      }
      if ("topic" in body) {
        if (typeof body.topic !== "string") {
          return watsonJsonResponse({ ok: false, error: "topic must be a string." }, 400);
        }
        patch.topic = body.topic;
      }
      if ("vimeoUrl" in body) {
        if (typeof body.vimeoUrl !== "string") {
          return watsonJsonResponse({ ok: false, error: "vimeoUrl must be a string." }, 400);
        }
        patch.vimeoUrl = body.vimeoUrl;
      }
      if ("privateNotes" in body) {
        if (body.privateNotes === null) {
          patch.privateNotes = null;
        } else if (typeof body.privateNotes !== "string") {
          return watsonJsonResponse(
            { ok: false, error: "privateNotes must be a string or null." },
            400,
          );
        } else {
          patch.privateNotes = body.privateNotes;
        }
      }

      if (Object.keys(patch).length === 0) {
        return watsonJsonResponse(
          { ok: false, error: "Provide fields to update, or an action." },
          400,
        );
      }

      const reply = await updateVideoReplyFields(store, id, patch);
      if (!reply) {
        return watsonJsonResponse({ ok: false, error: "Video reply not found." }, 404);
      }
      return watsonJsonResponse({
        ok: true,
        reply: withAdminPresentation(reply, context.url.origin),
      });
    }

    return watsonJsonResponse({ ok: false, error: "Unknown action." }, 400);
  } catch (error) {
    if (error instanceof VideoReplyValidationError) {
      return watsonJsonResponse({ ok: false, error: error.message }, 400);
    }
    const message =
      error instanceof Error ? error.message : "Unable to update video reply.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
