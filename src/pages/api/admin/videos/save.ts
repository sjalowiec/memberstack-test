import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { videoCatalogRepoForHost } from "../../../../lib/videos/videoCatalogRepo";
import { VideoCatalogConflictError } from "../../../../lib/videos/videoCatalogGithub";
import { VideoSaveError, type VideoSaveInput } from "../../../../lib/videos/videoCatalogSave";
import { saveCatalogVideo } from "../../../../lib/videos/videoCatalogService";
import {
  isMissingVideoPosterTable,
  setVideoPosterOverride,
} from "../../../../lib/videos/videoPosterStore";

export const prerender = false;

/** Uploaded VTTs are sent as text; this keeps a request well under function limits. */
const MAX_BODY_BYTES = 3 * 1024 * 1024;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseInput(body: unknown): VideoSaveInput | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "Request body must be a JSON object.";
  const row = body as Record<string, unknown>;
  const action = row.action === "create" || row.action === "update" ? row.action : null;
  if (!action) return 'action must be "create" or "update".';
  const status = row.status;
  if (status !== "draft" && status !== "published" && status !== "archived") {
    return "status must be draft, published, or archived.";
  }
  if (!row.video || typeof row.video !== "object" || Array.isArray(row.video)) return "video must be an object.";
  let vtt: VideoSaveInput["vtt"] = null;
  if (row.vtt !== undefined && row.vtt !== null) {
    const raw = row.vtt as Record<string, unknown>;
    if (typeof raw !== "object" || typeof raw.text !== "string") return "vtt must include the file text.";
    vtt = { filename: typeof raw.filename === "string" ? raw.filename : "transcript.vtt", text: raw.text };
  }
  return {
    action,
    status,
    contentId: typeof row.contentId === "string" || typeof row.contentId === "number" ? row.contentId : undefined,
    video: row.video as Record<string, unknown>,
    vtt,
  };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, error: "This save is too large. VTT files must be under 2 MB." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const input = parseInput(body);
  if (typeof input === "string") return jsonResponse({ ok: false, error: input }, 400);

  let repo;
  try {
    repo = videoCatalogRepoForHost(new URL(request.url).hostname);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video saves are not set up on this site.";
    return jsonResponse({ ok: false, error: message, step: "setup" }, 503);
  }

  let result;
  try {
    result = await saveCatalogVideo(repo, input, auth.member.email);
  } catch (error) {
    if (error instanceof VideoSaveError) return jsonResponse({ ok: false, error: error.message, step: "check" }, 400);
    if (error instanceof VideoCatalogConflictError) {
      return jsonResponse({ ok: false, error: `${error.message} Try saving again.`, step: "save" }, 409);
    }
    const message = error instanceof Error ? error.message : "The video could not be saved.";
    return jsonResponse({ ok: false, error: `${message} Nothing was saved.`, step: "save" }, 502);
  }

  // Keep the stored thumbnail in step with the saved record, so pages show the
  // new picture before the next deploy and an older stored one cannot win.
  let posterWarning: string | undefined;
  const posterUrl = typeof result.plan.record.posterUrl === "string" ? result.plan.record.posterUrl : "";
  try {
    await setVideoPosterOverride({ contentId: result.plan.contentId, posterUrl });
  } catch (error) {
    if (!isMissingVideoPosterTable(error)) {
      posterWarning = "The video was saved, but the stored thumbnail could not be updated. It will update with the next deploy.";
    }
  }

  return jsonResponse({
    ok: true,
    contentId: result.plan.contentId,
    added: result.plan.added,
    video: result.plan.record,
    transcript: result.plan.transcript,
    summary: result.plan.summary,
    persistedVia: result.commit.persistedVia,
    branch: result.commit.branch ?? null,
    commitSha: result.commit.commitSha ?? null,
    posterWarning,
  });
};
