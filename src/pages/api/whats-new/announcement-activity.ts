import type { APIRoute } from "astro";

import { bearerTokenFromRequest } from "../../../../netlify/functions/lib/member-auth.js";
import { getMemberstackAdminClient } from "../../../../netlify/functions/lib/memberstack-admin.js";
import { buildWhatsNewAnnouncementActivityEvent } from "../../../lib/whatsNew/announcementActivity";
import {
  ensureWhatsNewAnnouncementSchema,
  getPublicWhatsNewAnnouncement,
  insertWhatsNewAnnouncementActivity,
} from "../../../lib/whatsNew/store";

export const prerender = false;

const MEMBER_ID = /^mem_(?:sb_)?[a-z0-9]+$/i;

async function verifiedMemberId(request: Request): Promise<string | null> {
  const token = bearerTokenFromRequest(request);
  if (!token) return null;
  const client = getMemberstackAdminClient();
  if (!client) return null;
  try {
    const verified = await client.verifyMemberToken(token);
    const id = typeof verified?.id === "string" ? verified.id.trim() : "";
    return MEMBER_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Best-effort display and Read more tracking. Preview never calls this route. */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const built = buildWhatsNewAnnouncementActivityEvent(body, {
    verifiedMemberId: await verifiedMemberId(request),
  });
  if (!built.ok) {
    return Response.json({ ok: false, error: built.error }, { status: 400 });
  }

  try {
    await ensureWhatsNewAnnouncementSchema();
    const current = await getPublicWhatsNewAnnouncement();
    if (!current || current.id !== built.event.cardId) {
      return Response.json({ ok: false, error: "Announcement is not active." }, { status: 400 });
    }
    await insertWhatsNewAnnouncementActivity(built.event);
  } catch (error) {
    console.error(
      "announcement activity write failed",
      error instanceof Error ? error.name : "Error",
    );
    return Response.json(
      { ok: false, error: "Announcement activity could not be saved." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
};
