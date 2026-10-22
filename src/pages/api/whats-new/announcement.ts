import type { APIRoute } from "astro";

import {
  ensureWhatsNewAnnouncementSchema,
  getPublicWhatsNewAnnouncement,
} from "../../../lib/whatsNew/store";

export const prerender = false;

/** Public read-only: the single current pop-up, or nothing. */
export const GET: APIRoute = async () => {
  try {
    await ensureWhatsNewAnnouncementSchema();
    const announcement = await getPublicWhatsNewAnnouncement();
    return Response.json(
      { ok: true, announcement },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load announcement.";
    return Response.json(
      { ok: false, error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
};
