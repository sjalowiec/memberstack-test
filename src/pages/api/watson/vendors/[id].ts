import type { APIRoute } from "astro";

import { getVendorById, updateVendor, validateVendorId } from "../../../../lib/watson/vendors";
import {
  readWatsonJsonBody,
  requireWatsonSessionJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateVendorId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  try {
    const vendor = await getVendorById(idResult.value);
    if (!vendor) {
      return watsonJsonResponse({ ok: false, error: "Vendor not found." }, 404);
    }
    return watsonJsonResponse({ ok: true, vendor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load vendor.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonSessionJson(context);
  if (!auth.ok) return auth;

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateVendorId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) return bodyResult.response;

  try {
    const result = await updateVendor(idResult.value, bodyResult.body);
    if (!result.ok) {
      const status = result.error === "Vendor not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }
    return watsonJsonResponse({ ok: true, vendor: result.value });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update vendor.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
