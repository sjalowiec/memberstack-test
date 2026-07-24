import type { APIRoute } from "astro";

import { getDakLicenseByOrderId, upsertDakLicense } from "../../../../../lib/watson/dakLicenses";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const orderId = context.params.orderId ? decodeURIComponent(context.params.orderId) : "";
  if (!orderId.trim()) {
    return watsonJsonResponse({ ok: false, error: "Order ID is required." }, 400);
  }

  try {
    const license = await getDakLicenseByOrderId(orderId.trim());
    return watsonJsonResponse({ ok: true, license });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load DesignaKnit license.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const PUT: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const orderId = context.params.orderId ? decodeURIComponent(context.params.orderId) : "";
  if (!orderId.trim()) {
    return watsonJsonResponse({ ok: false, error: "Order ID is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await upsertDakLicense({
      shopifyOrderId: orderId.trim(),
      licenseNumber: bodyResult.body.licenseNumber,
      licenseAssignedDate: bodyResult.body.licenseAssignedDate,
      fulfillmentStatus: bodyResult.body.fulfillmentStatus,
      internalNotes: bodyResult.body.internalNotes,
      memberid: bodyResult.body.memberid,
    });
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }
    return watsonJsonResponse({ ok: true, license: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save DesignaKnit license.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
