import type { APIRoute } from "astro";

import {
  getShopifySyncStatus,
  syncShopifyOrders,
} from "../../../../lib/watson/shopifyOrdersSync";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  try {
    const status = await getShopifySyncStatus();
    return watsonJsonResponse({ ok: true, status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load Shopify sync status.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  try {
    const result = await syncShopifyOrders({ triggerSource: "manual" });
    return watsonJsonResponse(
      {
        ok: result.ok,
        result,
        error: result.errorMessage,
      },
      result.ok ? 200 : 502,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify sync failed unexpectedly.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
