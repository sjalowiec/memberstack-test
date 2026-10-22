import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { saveHelpHubImage } from "../../../../lib/helpHub/imageStore";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }

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

  const payload = body as Record<string, unknown>;
  const filename = typeof payload.filename === "string" ? payload.filename : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const dataBase64 = typeof payload.dataBase64 === "string" ? payload.dataBase64 : "";
  if (!filename || !dataBase64) {
    return jsonResponse({ ok: false, error: "filename and dataBase64 are required." }, 400);
  }

  try {
    const saved = await saveHelpHubImage({ filename, mimeType, dataBase64 });
    return jsonResponse({ ok: true, filename: saved.filename, url: saved.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the image.";
    const status = /too large|empty|JPG, PNG, or WebP|required|unique image name/i.test(message) ? 400 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
};
