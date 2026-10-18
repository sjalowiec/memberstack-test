import type { APIRoute } from "astro";

import {
  ensureWhatsNewAnnouncementSchema,
  getWhatsNewPopupAnnouncement,
  upsertWhatsNewPopupAnnouncement,
} from "../../../../lib/whatsNew/store";
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
    await ensureWhatsNewAnnouncementSchema();
    const announcement = await getWhatsNewPopupAnnouncement();
    return watsonJsonResponse({ ok: true, announcement });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load the pop-up announcement.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

/** Saves the pop-up draft only. Does not update the What's New entry it was copied from. */
export const PUT: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    await ensureWhatsNewAnnouncementSchema();
    const result = await upsertWhatsNewPopupAnnouncement(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    return watsonJsonResponse({ ok: true, announcement: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save the pop-up announcement.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
