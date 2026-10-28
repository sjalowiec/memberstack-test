import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import {
  accessLevelsMatchCatalog,
  applyVideoAccessLevelPatches,
  type VideoAccessLevelUpdate,
} from "../../../../lib/videoAccessLevelPatch";
import {
  HOSTED_ACCESS_LEVEL_SAVE_ERROR,
  patchCatalogAccessLevelText,
  videoCatalogFileSaveBlocker,
} from "../../../../lib/videos/videoCatalogFile";

export const prerender = false;

const VIDEOS_JSON_PATH = join(process.cwd(), "src", "data", "videos-public.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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

/** Patch only `access_level` by unique `content_id` - does not re-validate full catalog keys. */
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

  let source: { raw: string; videos: unknown[] };
  try {
    source = readVideosFile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const result = applyVideoAccessLevelPatches(source.videos, updates);
  if (!result.ok) {
    return jsonResponse({ ok: false, error: result.error }, 400);
  }

  if (videoCatalogFileSaveBlocker()) {
    return jsonResponse({ ok: false, error: HOSTED_ACCESS_LEVEL_SAVE_ERROR }, 409);
  }

  const patched = patchCatalogAccessLevelText(source.raw, result.updated);
  if (!patched.ok) return jsonResponse({ ok: false, error: patched.error }, 400);

  try {
    writeFileSync(VIDEOS_JSON_PATH, patched.text, "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write videos-public.json";
    return jsonResponse({ ok: false, error: `The access change was not saved. ${message}` }, 500);
  }

  let confirmedRaw: string;
  try {
    confirmedRaw = readFileSync(VIDEOS_JSON_PATH, "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read videos-public.json";
    return jsonResponse(
      { ok: false, error: `The access change could not be confirmed. ${message}` },
      500,
    );
  }

  let confirmedVideos: unknown;
  try {
    confirmedVideos = JSON.parse(confirmedRaw) as unknown;
  } catch {
    confirmedVideos = null;
  }
  const confirmed =
    confirmedRaw === patched.text &&
    Array.isArray(confirmedVideos) &&
    accessLevelsMatchCatalog(confirmedVideos, result.updated);

  if (!confirmed) {
    try {
      writeFileSync(VIDEOS_JSON_PATH, source.raw, "utf-8");
    } catch {
      return jsonResponse(
        {
          ok: false,
          error:
            "The access change could not be confirmed in src/data/videos-public.json, and the previous catalog could not be restored.",
        },
        500,
      );
    }
    return jsonResponse(
      {
        ok: false,
        error:
          "The access change could not be confirmed in src/data/videos-public.json, so the previous catalog was restored. Nothing was saved.",
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    updated: result.updated,
    notFound: result.notFound,
  });
};
