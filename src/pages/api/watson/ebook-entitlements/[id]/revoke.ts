import type { APIRoute } from "astro";

import { ensureWatsonEbookEntitlementsTable } from "../../../../../lib/watson/ebookCustomerContext";
import { revokeEbookEntitlement } from "../../../../../lib/watson/ebookEntitlements";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const id = context.params.id ? decodeURIComponent(context.params.id) : "";
  if (!id.trim()) {
    return watsonJsonResponse({ ok: false, error: "Entitlement ID is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    await ensureWatsonEbookEntitlementsTable();
    const result = await revokeEbookEntitlement(id.trim(), bodyResult.body.revokedBy);
    if (!result.ok) {
      return watsonJsonResponse({ ok: false, error: result.error }, result.status);
    }
    return watsonJsonResponse({ ok: true, entitlement: result.entitlement });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to revoke ebook entitlement.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
