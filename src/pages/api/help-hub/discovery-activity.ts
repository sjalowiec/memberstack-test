import type { APIRoute } from "astro";

import { bearerTokenFromRequest } from "../../../../netlify/functions/lib/member-auth.js";
import { getMemberstackAdminClient } from "../../../../netlify/functions/lib/memberstack-admin.js";
import { buildHelpHubDiscoveryActivityEvent } from "../../../lib/helpHub/discoveryActivity";
import { appendHelpHubDiscoveryEvent } from "../../../lib/helpHub/discoveryActivityStore";
import { loadHelpHubTipBySlug } from "../../../lib/helpHub/loadTips";

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

/** Best-effort discovery tracking. Draft and missing Help Hubs are not recorded. */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const built = buildHelpHubDiscoveryActivityEvent(body, {
    verifiedMemberId: await verifiedMemberId(request),
  });
  if (!built.ok) {
    return Response.json({ ok: false, error: built.error }, { status: 400 });
  }

  try {
    const tip = await loadHelpHubTipBySlug(built.event.slug, { publicOnly: true });
    if (!tip) {
      return Response.json({ ok: false, error: "Help Hub is not published." }, { status: 400 });
    }
    await appendHelpHubDiscoveryEvent(built.event);
  } catch (error) {
    console.error(
      "help hub discovery activity write failed",
      error instanceof Error ? error.name : "Error",
    );
    return Response.json(
      { ok: false, error: "Help Hub discovery activity could not be saved." },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
};
