import type { APIRoute } from "astro";
import { fetchVimeoCatalogPoster } from "../../../../lib/vimeoCatalogPoster";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ url }) => {
  const rawId = url.searchParams.get("vimeo_id")?.trim() ?? "";
  if (!/^\d+$/.test(rawId)) {
    return jsonResponse({ ok: false, error: "vimeo_id must be a number." }, 400);
  }
  const vimeoId = Number(rawId);
  if (!Number.isSafeInteger(vimeoId) || vimeoId <= 0) {
    return jsonResponse({ ok: false, error: "vimeo_id must be a number." }, 400);
  }

  const rawHash = url.searchParams.get("vimeo_hash")?.trim() ?? "";
  if (rawHash && !/^[A-Za-z0-9]+$/.test(rawHash)) {
    return jsonResponse({ ok: false, error: "vimeo_hash is not valid." }, 400);
  }

  const result = await fetchVimeoCatalogPoster(vimeoId, rawHash || undefined);
  if (!result.ok) return jsonResponse(result, 404);
  return jsonResponse(result);
};
