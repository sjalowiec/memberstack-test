import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { normalizeVideoForSave } from "../../../../lib/videosPublicRecord";
import {
  accessLevelsMatchCatalog,
  applyVideoAccessLevelPatches,
  type VideoAccessLevelUpdate,
} from "../../../../lib/videoAccessLevelPatch";
import {
  loadMergedVideoCatalog,
  saveVideoCatalogEdits,
  videoCatalogErrorMessage,
} from "../../../../lib/videos/videoCatalogStore";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Patch only `access_level` by unique `content_id`. */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const updatesRaw = (body as Record<string, unknown>).updates;
  if (!Array.isArray(updatesRaw)) {
    return jsonResponse({ ok: false, error: 'Request body must include an "updates" array.' }, 400);
  }

  const updates: VideoAccessLevelUpdate[] = updatesRaw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { content_id: "", access_level: "" };
    }
    const row = item as Record<string, unknown>;
    return {
      content_id: row.content_id as string | number,
      access_level: String(row.access_level ?? ""),
    };
  });

  let source: unknown[];
  try {
    source = await loadMergedVideoCatalog();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read the video catalog";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const result = applyVideoAccessLevelPatches(source, updates);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, 400);
  }

  const videos: Record<string, unknown>[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const normalized = normalizeVideoForSave(source[i], i);
    if (!normalized.ok) return jsonResponse({ ok: false, error: normalized.error }, 400);
    videos.push(normalized.video);
  }

  let saved: unknown[];
  try {
    saved = await saveVideoCatalogEdits(videos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/nothing was saved/i.test(message)) {
      return jsonResponse({ ok: false, error: message }, 400);
    }
    return jsonResponse(
      { ok: false, error: videoCatalogErrorMessage(error, "The access change was not saved.") },
      500,
    );
  }

  if (!accessLevelsMatchCatalog(saved, result.updated)) {
    return jsonResponse(
      { ok: false, error: "The access change could not be confirmed, so it was not kept." },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    updated: result.updated,
    notFound: result.notFound,
  });
};
