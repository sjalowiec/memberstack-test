import type { APIRoute } from "astro";
import deployedCatalog from "../../../../data/videos-public.json";
import deployedAudit from "../../../../data/transcripts/generated/audit.json";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import type { PublicVideoRow } from "../../../../lib/lessonVideo";
import { catalogTranscriptVimeoId } from "../../../../lib/transcripts/generateCatalogTranscripts";
import { videoCatalogRepoForHost } from "../../../../lib/videos/videoCatalogRepo";
import { parseVideoCatalog } from "../../../../lib/videos/videoCatalogSave";
import { videoLiveState } from "../../../../lib/videos/videoCatalogService";
import { videoContentIdKey } from "../../../../lib/videos/videoPosterOverrides";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type AuditRecord = { vimeoId?: string; access?: string; sourceSha256?: string };

function auditRecord(audit: unknown, vimeoId: string): AuditRecord | null {
  const records = (audit as { records?: AuditRecord[] } | null)?.records;
  if (!vimeoId || !Array.isArray(records)) return null;
  return records.find((record) => record.vimeoId === vimeoId) ?? null;
}

/**
 * Is the saved version of a video what this deploy serves?
 * Compares the latest saved record and transcript with the copies this
 * deploy was built from, so it needs no deploy API or extra credentials.
 */
export const GET: APIRoute = async ({ request, cookies, url }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  const key = videoContentIdKey(url.searchParams.get("content_id"));
  if (!key) return jsonResponse({ ok: false, error: "content_id is required." }, 400);

  try {
    const repo = videoCatalogRepoForHost(url.hostname);
    const snapshot = await repo.readSnapshot();
    const saved = parseVideoCatalog(snapshot.catalogRaw).find(
      (video) => videoContentIdKey(video.content_id) === key,
    );
    if (!saved) return jsonResponse({ ok: false, error: `Video ${key} is not in the saved catalog.` }, 404);

    const vimeoId = catalogTranscriptVimeoId(saved as PublicVideoRow);
    const savedTranscript = auditRecord(JSON.parse(snapshot.generated.audit), vimeoId);
    const liveTranscript = auditRecord(deployedAudit, vimeoId);
    const transcriptLive =
      (savedTranscript?.sourceSha256 ?? null) === (liveTranscript?.sourceSha256 ?? null) &&
      (savedTranscript?.access ?? null) === (liveTranscript?.access ?? null);

    const record = videoLiveState(saved, Array.isArray(deployedCatalog) ? deployedCatalog : []);
    return jsonResponse({
      ok: true,
      contentId: key,
      record,
      transcriptLive,
      live: record === "live" && transcriptLive,
      savedRef: snapshot.ref,
      branch: repo.branch ?? null,
      deployedCommit: String(import.meta.env.COMMIT_REF ?? "") || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check the deployed site.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
