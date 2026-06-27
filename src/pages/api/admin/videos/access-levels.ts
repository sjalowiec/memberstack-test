import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyVideoAccessLevelPatches,
  type VideoAccessLevelUpdate,
} from "../../../../lib/videoAccessLevelPatch";

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

/** Patch only `access_level` by unique `content_id`  does not re-validate full catalog keys. */
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

  let videos: unknown[];
  try {
    videos = readVideosArray();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const result = applyVideoAccessLevelPatches(videos, updates);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, 400);
  }

  try {
    writeFileSync(VIDEOS_JSON_PATH, JSON.stringify(videos, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({
    ok: true,
    updated: result.updated,
    notFound: result.notFound,
  });
};
