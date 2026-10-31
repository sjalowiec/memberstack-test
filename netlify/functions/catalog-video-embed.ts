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
import { loadMergedVideoCatalog } from "../../src/lib/videos/videoCatalogStore";
import { requireMember } from "./lib/member-auth.js";
import { jsonResponse, withCors } from "./lib/custom-pattern-projects-store.js";
import { getMemberstackAdminClient } from "./lib/memberstack-admin.js";
import { evaluateMemberAccessForRecord } from "../../src/lib/memberAccessServer";
import { resolveCatalogVideoEmbed } from "../../src/lib/videos/resolveCatalogVideoEmbed";
import { resolveVideoDetailJumpLinks } from "../../src/lib/jumplinks/jumplinksByContent";
import { findPublicCatalogVideoByContentId } from "../../src/lib/videoPublic";
import { vimeoNumericIdFromPublicVideo, type PublicVideoRow } from "../../src/lib/lessonVideo";
import memberCatalogTranscripts from "../../src/data/transcripts/generated/member.json";
import { paragraphsForVimeoId } from "../../src/lib/transcripts/catalogTranscriptData";

function noStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function authorizedEmbedBody(
  resolved: {
    iframeSrc: string;
    title: string;
  },
  contentId: string,
  transcript: string[],
  catalog: PublicVideoRow[],
) {
  const row = findPublicCatalogVideoByContentId(catalog, contentId);
  const jumplinks = resolveVideoDetailJumpLinks(row, contentId).links;
  return {
    ok: true as const,
    iframeSrc: resolved.iframeSrc,
    title: resolved.title,
    ...(jumplinks.length > 0 ? { jumplinks } : {}),
    ...(transcript.length > 0 ? { transcript } : {}),
  };
}

function memberTranscriptFor(contentId: string, catalog: PublicVideoRow[]): string[] {
  const row = findPublicCatalogVideoByContentId(catalog, contentId);
  const vimeoId =
    (row ? vimeoNumericIdFromPublicVideo(row) : null) ??
    (row?.vimeo_id_public != null || row?.vimeo_id != null
      ? String(row.vimeo_id_public ?? row.vimeo_id).trim()
      : "");
  return paragraphsForVimeoId(memberCatalogTranscripts, vimeoId);
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return noStore(withCors(new Response(null, { status: 204 })));
  }
  if (req.method !== "GET") {
    return noStore(withCors(jsonResponse({ ok: false, error: "Method not allowed." }, 405)));
  }

  const catalog = (await loadMergedVideoCatalog()) as PublicVideoRow[];

  const url = new URL(req.url);
  const contentId = url.searchParams.get("contentId")?.trim() ?? "";
  if (!contentId) {
    return noStore(withCors(jsonResponse({ ok: false, error: "contentId is required." }, 400)));
  }
  const enableVimeoPlayerApi = url.searchParams.get("playerApi") === "1";

  const resolved = resolveCatalogVideoEmbed(catalog, contentId, { enableVimeoPlayerApi });
  if (!resolved.ok) {
    return noStore(withCors(jsonResponse({ ok: false, error: "Video is not available." }, 404)));
  }

  if (resolved.access === "open") {
    return noStore(withCors(jsonResponse(authorizedEmbedBody(resolved, contentId, [], catalog))));
  }

  const auth = await requireMember(req);
  if (!auth.ok) {
    return noStore(withCors(jsonResponse({ ok: false, error: auth.error }, auth.status)));
  }

  // Local dev preview identity (ALLOW_DEV_PATTERN_USER). Never returned in production.
  if (auth.mode === "dev") {
    return noStore(
      withCors(
        jsonResponse(authorizedEmbedBody(resolved, contentId, memberTranscriptFor(contentId, catalog), catalog)),
      ),
    );
  }

  const client = getMemberstackAdminClient();
  if (!client?.getMember) {
    return noStore(
      withCors(jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503)),
    );
  }

  let record: unknown;
  try {
    record = await client.getMember(auth.member.id);
  } catch (err) {
    console.error("catalog-video-embed: getMember failed:", err);
    return noStore(
      withCors(jsonResponse({ ok: false, error: "Membership access is unavailable right now." }, 503)),
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
    return noStore(withCors(jsonResponse({ ok: false, error: "Membership required." }, 403)));
  }

  return noStore(
    withCors(
      jsonResponse(authorizedEmbedBody(resolved, contentId, memberTranscriptFor(contentId, catalog), catalog)),
    ),
  );
};
