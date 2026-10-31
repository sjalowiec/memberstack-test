import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { validatePendingAccessLevel } from "../../../../lib/videoAccessLevel";
import { videoCatalogRepoForHost } from "../../../../lib/videos/videoCatalogRepo";
import { VideoSaveError } from "../../../../lib/videos/videoCatalogSave";
import { saveCatalogAccessLevels, type AccessLevelUpdate } from "../../../../lib/videos/videoCatalogService";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Patch only `access_level` by unique `content_id`, in one commit (GitHub on
 * hosted sites). Each changed video's transcript moves to the matching public
 * or member file in the same commit.
 */
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
  if (!Array.isArray(updatesRaw) || updatesRaw.length === 0) {
    return jsonResponse({ ok: false, error: 'Request body must include an "updates" array.' }, 400);
  }

  const updates: AccessLevelUpdate[] = [];
  for (let i = 0; i < updatesRaw.length; i++) {
    const item = updatesRaw[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return jsonResponse({ ok: false, error: `Update ${i + 1} must be an object.` }, 400);
    }
    const row = item as Record<string, unknown>;
    const id = String(row.content_id ?? "").trim();
    if (!id) return jsonResponse({ ok: false, error: `Update ${i + 1}: content_id is required.` }, 400);
    const validated = validatePendingAccessLevel(row.access_level);
    if (!validated.ok) return jsonResponse({ ok: false, error: `Video ${id}: ${validated.error}` }, 400);
    updates.push({ content_id: row.content_id as string | number, access_level: validated.access_level });
  }

  let repo;
  try {
    repo = videoCatalogRepoForHost(new URL(request.url).hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video saves are not set up on this site.";
    return jsonResponse({ ok: false, error: message }, 503);
  }

  try {
    const result = await saveCatalogAccessLevels(repo, updates, auth.member.email);
    return jsonResponse({
      ok: true,
      updated: result.updated,
      notFound: result.notFound,
      commitSha: result.commit?.commitSha ?? null,
      branch: result.commit?.branch ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Access levels could not be saved.";
    return jsonResponse({ ok: false, error: message }, error instanceof VideoSaveError ? 400 : 502);
  }
};
