import type { APIRoute } from "astro";

import {
  createStoreFulfillment,
  getMemberStoreFulfillments,
  validateStoreFulfillmentMemberid,
} from "../../../../../lib/watson/storeFulfillments";
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

  const memberid = context.params.memberid ? decodeURIComponent(context.params.memberid) : "";
  const validated = validateStoreFulfillmentMemberid(memberid);
  if (!validated.ok) {
    return watsonJsonResponse({ ok: false, error: validated.error }, 400);
  }

  try {
    const fulfillments = await getMemberStoreFulfillments(validated.value);
    return watsonJsonResponse({ ok: true, fulfillments });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load store fulfillments.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberid = context.params.memberid ? decodeURIComponent(context.params.memberid) : "";
  const memberidResult = validateStoreFulfillmentMemberid(memberid);
  if (!memberidResult.ok) {
    return watsonJsonResponse({ ok: false, error: memberidResult.error }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    const result = await createStoreFulfillment({
      memberid: memberidResult.value,
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
      return watsonJsonResponse({ ok: false, error: result.error }, 400);
    }

    return watsonJsonResponse({ ok: true, fulfillment: result.value }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create fulfillment record.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
