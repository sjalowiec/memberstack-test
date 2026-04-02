import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeVideoForSave } from "../../../lib/videosPublicRecord";
import { stableVideoKey } from "../../../lib/lessonVideo";

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
    return jsonResponse({ ok: true, videos: data });
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

  try {
    writeFileSync(VIDEOS_JSON_PATH, JSON.stringify(videos, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, videos });
};
