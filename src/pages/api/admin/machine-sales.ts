import type { APIRoute } from "astro";
import {
  applyListingSave,
  readMachineSalesListings,
  shopListingImageSrcs,
  type ListingSaveMode,
} from "../../../lib/machines/machineSalesListings";
import {
  isMachineSalesDevWriteAllowed,
  persistMachineSalesListings,
} from "../../../lib/machines/machineSalesPersist";

export const prerender = false;

const adminEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function productionBlockedResponse() {
  return jsonResponse(
    {
      ok: false,
      error: "Machines for Sale can only be saved from DEV, not from production.",
    },
    403,
  );
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
  const hostname = new URL(request.url).hostname;
  if (!isMachineSalesDevWriteAllowed(hostname, adminEnv)) {
    return productionBlockedResponse();
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
    const persisted = await persistMachineSalesListings(applied.listings, {
      hostname,
      env: adminEnv,
    });
    return jsonResponse({
      ok: true,
      listings: persisted.listings,
      listingImages: shopListingImageSrcs(persisted.listings),
      persistedVia: persisted.persistedVia,
      branch: persisted.branch ?? null,
      commitSha: persisted.commitSha ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write machine sale listings.";
    const status = /only be saved from DEV|production/i.test(message) ? 403 : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }
};
