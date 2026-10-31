import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../lib/admin/requireAdminRequest";
import { normalizeVideoForSave } from "../../../lib/videosPublicRecord";
import { stableVideoKey } from "../../../lib/lessonVideo";
import { assignNewVideoContentIds, catalogSlugSaveError } from "../../../lib/videos/videoIdentity";
import { applyVideoPosterOverrides, planVideoPosterSave, videoContentIdKey } from "../../../lib/videos/videoPosterOverrides";
import {
  loadMergedVideoCatalog,
  saveVideoCatalogEdits,
  VIDEO_CATALOG_SAVED_MESSAGE,
  videoCatalogErrorMessage,
} from "../../../lib/videos/videoCatalogStore";
import {
  isMissingVideoPosterTable,
  listVideoPosterOverrides,
  replaceVideoPosterOverrides,
  upsertVideoPosterOverride,
  videoPosterErrorMessage,
} from "../../../lib/videos/videoPosterStore";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function posterOf(video: unknown): string {
  if (!video || typeof video !== "object") return "";
  const poster = (video as { posterUrl?: unknown }).posterUrl;
  return typeof poster === "string" ? poster.trim() : "";
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  try {
    const data = await loadMergedVideoCatalog();
    let videos = data;
    try {
      const overrides = await listVideoPosterOverrides();
      videos = applyVideoPosterOverrides(data, overrides);
    } catch (error) {
      if (!isMissingVideoPosterTable(error)) {
        return jsonResponse(
          { ok: false, error: "Saved thumbnails could not be loaded. Nothing was changed." },
          500,
        );
      }
    }
    return jsonResponse({ ok: true, videos });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read the video catalog";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

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

  if (!Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "Request body must be a JSON array of videos." }, 400);
  }

  let source: unknown[];
  try {
    source = await loadMergedVideoCatalog();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read the video catalog";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const prepared = assignNewVideoContentIds(source as Array<{ content_id?: unknown }>, body);
  if (!prepared.ok) return jsonResponse({ ok: false, error: prepared.error }, 400);

  const seen = new Set<string>();
  const videos: Record<string, unknown>[] = [];

  for (let i = 0; i < prepared.videos.length; i++) {
    const n = normalizeVideoForSave(prepared.videos[i], i);
    if (!n.ok) return jsonResponse({ ok: false, error: n.error }, 400);
    const key = stableVideoKey(n.video as Parameters<typeof stableVideoKey>[0]);
    if (!key) {
      return jsonResponse(
        { ok: false, error: `Video ${i + 1}: could not derive stable key (slug or content_id).` },
        400
      );
    }
    if (seen.has(key)) {
      return jsonResponse(
        { ok: false, error: `Duplicate catalog key "${key}". Slug (or content_id) must be unique.` },
        400
      );
    }
    seen.add(key);
    videos.push(n.video);
  }

  const slugError = catalogSlugSaveError(
    source as Array<{ content_id?: unknown; slug?: unknown }>,
    videos,
  );
  if (slugError) return jsonResponse({ ok: false, error: slugError }, 400);

  const plan = planVideoPosterSave(source, videos);
  if (plan.ok) {
    try {
      await replaceVideoPosterOverrides(plan.overrides);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: videoPosterErrorMessage(error, "The thumbnail could not be stored. Nothing was saved."),
        },
        500,
      );
    }

    const overrides = new Map(plan.overrides.map((override) => [override.contentId, override.posterUrl]));
    return jsonResponse({
      ok: true,
      videos: applyVideoPosterOverrides(source, overrides),
      message: plan.message,
    });
  }

  if (plan.reason !== "catalog-change") return jsonResponse({ ok: false, error: plan.error }, 400);

  let savedVideos: unknown[];
  try {
    savedVideos = await saveVideoCatalogEdits(videos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/nothing was saved/i.test(message)) {
      return jsonResponse({ ok: false, error: message }, 400);
    }
    return jsonResponse(
      { ok: false, error: videoCatalogErrorMessage(error, "The video could not be saved. Nothing was saved.") },
      500,
    );
  }

  const sourceById = new Map<string, unknown>();
  for (const row of source) {
    const contentId = videoContentIdKey((row as { content_id?: unknown }).content_id);
    if (contentId) sourceById.set(contentId, row);
  }
  for (const video of videos) {
    const contentId = videoContentIdKey(video.content_id);
    if (!contentId) continue;
    const nextPoster = posterOf(video);
    if (nextPoster === posterOf(sourceById.get(contentId))) continue;
    try {
      await upsertVideoPosterOverride(contentId, nextPoster);
    } catch (error) {
      if (!isMissingVideoPosterTable(error)) {
        return jsonResponse(
          {
            ok: true,
            videos: savedVideos,
            message: `${VIDEO_CATALOG_SAVED_MESSAGE} The thumbnail store could not be updated.`,
          },
        );
      }
    }
  }

  try {
    const overrides = await listVideoPosterOverrides();
    savedVideos = applyVideoPosterOverrides(savedVideos, overrides);
  } catch (error) {
    if (!isMissingVideoPosterTable(error)) {
      return jsonResponse(
        {
          ok: true,
          videos: savedVideos,
          message: `${VIDEO_CATALOG_SAVED_MESSAGE} The thumbnail store could not be read.`,
        },
      );
    }
  }

  return jsonResponse({ ok: true, videos: savedVideos, message: VIDEO_CATALOG_SAVED_MESSAGE });
};
