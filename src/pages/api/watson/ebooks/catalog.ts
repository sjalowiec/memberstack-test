import type { APIRoute } from "astro";

import { listApprovedEbookCatalogForAdmin } from "../../../../lib/watson/ebookEntitlements";
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

  return watsonJsonResponse({
    ok: true,
    ebooks: listApprovedEbookCatalogForAdmin(),
  });
};
