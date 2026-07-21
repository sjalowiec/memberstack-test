import type { APIRoute } from "astro";

import {
  deleteStoreFulfillment,
  updateStoreFulfillment,
  validateStoreFulfillmentId,
} from "../../../../lib/watson/storeFulfillments";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateStoreFulfillmentId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await updateStoreFulfillment({
      id: idResult.value,
      memberid: typeof bodyResult.body.memberid === "string" ? bodyResult.body.memberid : "",
      shopifyOrderNumber: bodyResult.body.shopifyOrderNumber,
      productDescription: bodyResult.body.productDescription,
      productVariantId: bodyResult.body.productVariantId,
      supplierOption: bodyResult.body.supplierOption,
      supplierOther: bodyResult.body.supplierOther,
      carrier: bodyResult.body.carrier,
      trackingNumber: bodyResult.body.trackingNumber,
      actualShippingCost: bodyResult.body.actualShippingCost,
      customerShippingCharge: bodyResult.body.customerShippingCharge,
      boxCount: bodyResult.body.boxCount,
      shipDate: bodyResult.body.shipDate,
      supplierInvoiceNumber: bodyResult.body.supplierInvoiceNumber,
      destinationState: bodyResult.body.destinationState,
      destinationPostal: bodyResult.body.destinationPostal,
      internalNotes: bodyResult.body.internalNotes,
      shopifyOrderId: bodyResult.body.shopifyOrderId,
    });

    if (!result.ok) {
      const status = result.error === "Fulfillment record not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }

    return watsonJsonResponse({ ok: true, fulfillment: result.value });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update fulfillment record.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  const idResult = validateStoreFulfillmentId(id);
  if (!idResult.ok) {
    return watsonJsonResponse({ ok: false, error: idResult.error }, 400);
  }

  try {
    const result = await deleteStoreFulfillment(idResult.value);
    if (!result.ok) {
      const status = result.error === "Fulfillment record not found." ? 404 : 400;
      return watsonJsonResponse({ ok: false, error: result.error }, status);
    }

    return watsonJsonResponse({ ok: true, id: result.value.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete fulfillment record.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
