import type { APIRoute } from "astro";

import { grantCustomerEbook, loadCustomerEbookLibrary } from "../../../../../../lib/watson/customerEbookLibrary";
import {
  ensureWatsonEbookEntitlementsTable,
  resolveEbookCustomerContextFromMemberstack,
} from "../../../../../../lib/watson/ebookCustomerContext";
import {
  readWatsonJsonBody,
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../../../lib/watson/watsonApiAuth";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberstackId = context.params.memberstackId
    ? decodeURIComponent(context.params.memberstackId)
    : "";
  if (!memberstackId.trim()) {
    return watsonJsonResponse({ ok: false, error: "Memberstack ID is required." }, 400);
  }

  try {
    await ensureWatsonEbookEntitlementsTable();
    const resolved = await resolveEbookCustomerContextFromMemberstack(memberstackId.trim());
    if (!resolved.ok) {
      return watsonJsonResponse({ ok: false, error: resolved.error }, resolved.status);
    }
    const library = await loadCustomerEbookLibrary(resolved.context);
    return watsonJsonResponse({ ok: true, ...library });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load ebook entitlements.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  const memberstackId = context.params.memberstackId
    ? decodeURIComponent(context.params.memberstackId)
    : "";
  if (!memberstackId.trim()) {
    return watsonJsonResponse({ ok: false, error: "Memberstack ID is required." }, 400);
  }

  const bodyResult = await readWatsonJsonBody(context.request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  try {
    await ensureWatsonEbookEntitlementsTable();
    const resolved = await resolveEbookCustomerContextFromMemberstack(memberstackId.trim());
    if (!resolved.ok) {
      return watsonJsonResponse({ ok: false, error: resolved.error }, resolved.status);
    }

    const result = await grantCustomerEbook({
      ...resolved.context,
      itemId: bodyResult.body.itemId,
      reason: bodyResult.body.reason,
      note: bodyResult.body.note,
      sourceStoreTransactionId: bodyResult.body.sourceStoreTransactionId,
      grantedBy: bodyResult.body.grantedBy,
    });

    if (!result.ok && result.duplicate) {
      return watsonJsonResponse(result, 409);
    }
    if (!result.ok) {
      return watsonJsonResponse(result, 400);
    }
    return watsonJsonResponse(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to grant ebook entitlement.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
