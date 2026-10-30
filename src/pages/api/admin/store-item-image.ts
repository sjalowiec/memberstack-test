import type { APIRoute } from "astro";
import { requireAdminForRequest } from "../../../lib/admin/requireAdminRequest";
import { storeItemAstroDev, storeItemAstroEnv } from "../../../lib/shop/storeItemAstroEnv";
import {
  netlifyStoreItemImageBlob,
  saveStoreItemImage,
  saveStoreItemImageBlob,
  type StoreItemImageKind,
} from "../../../lib/shop/storeItemImage";
import { resolveStoreItemWriteAccess } from "../../../lib/shop/storeItemPersist";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isImageKind(value: unknown): value is StoreItemImageKind {
  return value === "cable" || value === "ebook" || value === "download";
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status);
  }

  const access = resolveStoreItemWriteAccess({
    hostname: new URL(request.url).hostname,
    isViteDev: storeItemAstroDev.isViteDev,
    env: storeItemAstroEnv(),
  });
  if (!access.ok) return jsonResponse({ ok: false, error: access.error }, 403);

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
  if (!isImageKind(payload.kind)) {
    return jsonResponse({ ok: false, error: "Choose a cable, download, or eBook image." }, 400);
  }
  const filename = typeof payload.filename === "string" ? payload.filename : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const dataBase64 = typeof payload.dataBase64 === "string" ? payload.dataBase64 : "";
  if (!filename || !dataBase64) {
    return jsonResponse({ ok: false, error: "Choose an image file to upload." }, 400);
  }

  try {
    const saved =
      access.mode === "filesystem"
        ? saveStoreItemImage(payload.kind, { filename, mimeType, dataBase64 })
        : await saveStoreItemImageBlob({ filename, mimeType, dataBase64 }, netlifyStoreItemImageBlob());
    const stored = access.mode === "blob" || payload.kind === "download" ? saved.url : saved.filename;
    return jsonResponse({ ok: true, filename: saved.filename, url: saved.url, stored });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the image.";
    const status = /too large|empty|JPG, PNG, or WebP|required|unique image name/i.test(message) ? 400 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
};
