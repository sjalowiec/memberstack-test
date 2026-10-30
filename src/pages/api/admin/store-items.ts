import type { APIRoute } from "astro";
import { requireAdminForRequest } from "../../../lib/admin/requireAdminRequest";
import { isStoreItemKind, type StoreItemInput } from "../../../lib/shop/storeItemCatalog";
import { storeItemAstroDev, storeItemAstroEnv } from "../../../lib/shop/storeItemAstroEnv";
import { listStoreItemsForRequest, saveStoreItemForRequest } from "../../../lib/shop/storeItemLive";
import { resolveStoreItemWriteAccess } from "../../../lib/shop/storeItemPersist";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requestContext(request: Request) {
  return {
    hostname: new URL(request.url).hostname,
    isViteDev: storeItemAstroDev.isViteDev,
    env: storeItemAstroEnv(),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const listed = await listStoreItemsForRequest(requestContext(request));
  if (!listed.ok) return jsonResponse({ ok: false, error: listed.error }, 500);
  const access = resolveStoreItemWriteAccess(requestContext(request));
  return jsonResponse({
    ok: true,
    items: listed.items,
    writeBlocked: access.ok ? null : access.error,
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status);
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
  const mode = payload.mode;
  if (mode !== "create" && mode !== "edit") {
    return jsonResponse({ ok: false, error: "Save mode must be create or edit." }, 400);
  }
  const item = payload.item;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return jsonResponse({ ok: false, error: "Include the store item to save." }, 400);
  }
  const input = item as StoreItemInput;
  if (!isStoreItemKind(input.kind)) {
    return jsonResponse({ ok: false, error: "Choose a product type." }, 400);
  }

  const saved = await saveStoreItemForRequest(mode, input, requestContext(request));
  if (!saved.ok) return jsonResponse({ ok: false, error: saved.error }, 400);
  return jsonResponse({ ok: true, item: saved.item });
};
