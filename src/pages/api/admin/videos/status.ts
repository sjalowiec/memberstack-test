import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { loadMergedVideoCatalog } from "../../../../lib/videos/videoCatalogStore";
import { videoContentIdKey } from "../../../../lib/videos/videoPosterOverrides";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * The live site reads the database catalog, so a saved video is available
 * without waiting for a rebuild.
 */
export const GET: APIRoute = async ({ request, cookies, url }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  const key = videoContentIdKey(url.searchParams.get("content_id"));
  if (!key) return jsonResponse({ ok: false, error: "content_id is required." }, 400);

  try {
    const catalog = await loadMergedVideoCatalog();
    const saved = catalog.find(
      (video) =>
        Boolean(video) &&
        typeof video === "object" &&
        videoContentIdKey((video as Record<string, unknown>).content_id) === key,
    );
    if (!saved) return jsonResponse({ ok: false, error: `Video ${key} is not in the saved catalog.` }, 404);
    return jsonResponse({
      ok: true,
      contentId: key,
      record: "live",
      transcriptLive: true,
      live: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check the saved catalog.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
