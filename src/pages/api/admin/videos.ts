import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeVideoForSave } from "../../../lib/videosPublicRecord";
import { stableVideoKey } from "../../../lib/lessonVideo";
import { applyVideoPosterOverrides, planVideoPosterSave } from "../../../lib/videos/videoPosterOverrides";
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
    headers: { "Content-Type": "application/json" },
  });
}

function readVideosArray(): unknown[] {
  const raw = readFileSync(VIDEOS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("videos-public.json must contain a JSON array.");
  }
  return data;
}

export const GET: APIRoute = async () => {
  try {
    const data = readVideosArray();
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
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
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

  let source: unknown[];
  try {
    source = readVideosArray();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const plan = planVideoPosterSave(source, videos);
  if (!plan.ok) return jsonResponse({ ok: false, error: plan.error }, 400);

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
};
