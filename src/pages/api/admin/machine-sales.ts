import type { APIRoute } from "astro";
import {
  applyListingSave,
  readMachineSalesListings,
  shopListingImageSrcs,
  writeMachineSalesListings,
  type ListingSaveMode,
} from "../../../lib/machines/machineSalesListings";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const GET: APIRoute = async () => {
  try {
    const listings = readMachineSalesListings();
    return jsonResponse({
      ok: true,
      listings,
      listingImages: shopListingImageSrcs(listings),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read machine sale listings.";
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

  if (!body || typeof body !== "object") {
    return jsonResponse({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const mode = payload.mode;
  if (mode !== "new" && mode !== "edit") {
    return jsonResponse({ ok: false, error: 'Body must include mode: "new" | "edit".' }, 400);
  }

  try {
    const current = readMachineSalesListings();
    const applied = applyListingSave(current, {
      listing: payload.listing,
      mode: mode as ListingSaveMode,
    });
    if (!applied.ok) return jsonResponse({ ok: false, error: applied.error }, 400);
    writeMachineSalesListings(applied.listings);
    return jsonResponse({
      ok: true,
      listings: applied.listings,
      listingImages: shopListingImageSrcs(applied.listings),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write machine sale listings.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
