import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../lib/admin/requireAdminRequest";
import { normalizeVideoForSave } from "../../../lib/videosPublicRecord";
import { stableVideoKey, type PublicVideoRow } from "../../../lib/lessonVideo";
import { catalogTranscriptVimeoId } from "../../../lib/transcripts/generateCatalogTranscripts";
import {
  applyVideoPosterOverrides,
  planVideoPosterSave,
  videoContentIdKey,
} from "../../../lib/videos/videoPosterOverrides";
import { videoCatalogRepoForHost, type VideoCatalogSnapshot } from "../../../lib/videos/videoCatalogRepo";
import {
  nextVideoContentId,
  parseVideoCatalog,
  transcriptStateForVimeoId,
  type VideoTranscriptState,
} from "../../../lib/videos/videoCatalogSave";
import {
  catalogSaveMessage,
  updateCatalogText,
  videoCatalogFileSaveBlocker,
} from "../../../lib/videos/videoCatalogFile";
import {
  isMissingVideoPosterTable,
  listVideoPosterOverrides,
  replaceVideoPosterOverrides,
  videoPosterErrorMessage,
} from "../../../lib/videos/videoPosterStore";

export const prerender = false;

const VIDEOS_JSON_PATH = join(process.cwd(), "src", "data", "videos-public.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function readVideosFile(): { raw: string; videos: unknown[] } {
  const raw = readFileSync(VIDEOS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("videos-public.json must contain a JSON array.");
  }
  return { raw, videos: data };
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  try {
    // The latest saved catalog (GitHub on hosted sites), so drafts saved since
    // the last deploy show up. Falls back to this deploy's copy, read-only.
    let data: unknown[];
    let snapshot: VideoCatalogSnapshot | null = null;
    let save: { canSave: boolean; mode?: string; branch?: string; warning?: string };
    try {
      const repo = videoCatalogRepoForHost(new URL(request.url).hostname);
      snapshot = await repo.readSnapshot();
      data = parseVideoCatalog(snapshot.catalogRaw);
      save = { canSave: true, mode: repo.mode, branch: repo.branch };
    } catch (error) {
      data = readVideosFile().videos;
      const reason = error instanceof Error ? error.message : "The saved catalog could not be read.";
      save = { canSave: false, warning: `${reason} Showing this deploy's copy; saving is turned off.` };
    }

    // Editor saves store one video's thumbnail at a time, so showing catalog
    // pictures while thumbnail storage is down cannot wipe other stored ones.
    let videos = data;
    let posterWarning: string | undefined;
    try {
      const overrides = await listVideoPosterOverrides();
      videos = applyVideoPosterOverrides(data, overrides);
    } catch (error) {
      if (!isMissingVideoPosterTable(error)) {
        posterWarning = "Stored thumbnails could not be loaded, so catalog pictures are shown.";
      }
    }

    const transcripts: Record<string, VideoTranscriptState> = {};
    if (snapshot) {
      for (const video of data as Record<string, unknown>[]) {
        const key = videoContentIdKey(video.content_id);
        if (key) transcripts[key] = transcriptStateForVimeoId(snapshot, catalogTranscriptVimeoId(video as PublicVideoRow));
      }
    }
    return jsonResponse({
      ok: true,
      videos,
      transcripts,
      nextContentId: nextVideoContentId(data as Record<string, unknown>[]),
      save,
      posterWarning,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
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

  const seen = new Set<string>();
  const videos: Record<string, unknown>[] = [];

  for (let i = 0; i < body.length; i++) {
    const n = normalizeVideoForSave(body[i], i);
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

  let sourceFile: { raw: string; videos: unknown[] };
  try {
    sourceFile = readVideosFile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
  const source = sourceFile.videos;

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

  const hostedBlocker = videoCatalogFileSaveBlocker();
  if (hostedBlocker) return jsonResponse({ ok: false, error: hostedBlocker }, 409);

  const updated = updateCatalogText(sourceFile.raw, source as Record<string, unknown>[], videos);
  if (!updated.ok) return jsonResponse({ ok: false, error: updated.error }, 400);

  try {
    writeFileSync(VIDEOS_JSON_PATH, updated.text, "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write videos-public.json";
    return jsonResponse(
      {
        ok: false,
        error: `The video catalog file could not be written, so nothing was saved. ${message}`,
      },
      500,
    );
  }

  let savedVideos: unknown[];
  try {
    savedVideos = readVideosFile().videos;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  let message = catalogSaveMessage(updated);
  const posterPlan = planVideoPosterSave(savedVideos, videos);
  if (posterPlan.ok) {
    try {
      await replaceVideoPosterOverrides(posterPlan.overrides);
      const overrides = new Map(posterPlan.overrides.map((override) => [override.contentId, override.posterUrl]));
      savedVideos = applyVideoPosterOverrides(savedVideos, overrides);
    } catch (error) {
      if (!isMissingVideoPosterTable(error)) {
        message = `${message} The thumbnail store could not be updated.`;
      }
    }
  }

  return jsonResponse({ ok: true, videos: savedVideos, message });
};
