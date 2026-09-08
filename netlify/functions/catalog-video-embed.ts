/**
 * GET /.netlify/functions/catalog-video-embed?contentId=
 *
 * Returns the Vimeo player URL only after playback is allowed:
 *   - Intentionally public/open/free/tip videos: no membership required
 *   - Member-only catalog videos: verified JWT + hasMemberAccess
 *
 * Individual course lesson videos are not served here; those stay on gated
 * course pages (`canAccessCourse`, including individual course purchase).
 */
import videosPublic from "../../src/data/videos-public.json";
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../src/lib/memberAccessServer";
import { resolveCatalogVideoEmbed } from "../../src/lib/videos/resolveCatalogVideoEmbed";
import type { PublicVideoRow } from "../../src/lib/lessonVideo";

const catalog = videosPublic as PublicVideoRow[];

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405));
  }

  const url = new URL(req.url);
  const contentId = url.searchParams.get("contentId")?.trim() ?? "";
  if (!contentId) {
    return withCors(jsonResponse({ ok: false, error: "contentId is required." }, 400));
  }
  const enableVimeoPlayerApi = url.searchParams.get("playerApi") === "1";

  const resolved = resolveCatalogVideoEmbed(catalog, contentId, { enableVimeoPlayerApi });
  if (!resolved.ok) {
    return withCors(jsonResponse({ ok: false, error: "Video is not available." }, 404));
  }

  if (resolved.access === "open") {
    return withCors(
      jsonResponse({
        ok: true,
        iframeSrc: resolved.iframeSrc,
        title: resolved.title,
      }),
    );
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return withCors(jsonResponse({ ok: false, error: auth.error }, auth.status));
  }

  const client = getMemberstackAdminClient();
  if (!client?.getMember) {
    return withCors(
      jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503),
    );
  }

  let record: unknown;
  try {
    record = await client.getMember(auth.member.id);
  } catch (err) {
    console.error("catalog-video-embed: getMember failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503),
    );
  }

  let hasAccess = false;
  try {
    const evaluated = await evaluateMemberAccessForRecord(record);
    hasAccess = evaluated.hasMemberAccess;
  } catch (err) {
    console.error("catalog-video-embed: access evaluation failed:", err);
    hasAccess = false;
  }

  if (!hasAccess) {
    return withCors(jsonResponse({ ok: false, error: "Membership required." }, 403));
  }

  return withCors(
    jsonResponse({
      ok: true,
      iframeSrc: resolved.iframeSrc,
      title: resolved.title,
    }),
  );
};
