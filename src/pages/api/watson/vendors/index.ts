import type { APIRoute } from "astro";

import {
  createVendor,
  listVendors,
  parseVendorStatusFilter,
} from "../../../../lib/watson/vendors";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  try {
    const vendors = await listVendors({
      q: context.url.searchParams.get("q") ?? "",
      status: parseVendorStatusFilter(context.url.searchParams.get("status")),
    });
    return watsonJsonResponse({ ok: true, vendors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to list vendors.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await createVendor(bodyResult.body);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    return watsonJsonResponse({ ok: true, vendor: result.value }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create vendor.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
