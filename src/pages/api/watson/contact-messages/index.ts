import type { APIRoute } from "astro";

import { listContactMessages, countNewContactMessages } from "../../../../lib/contact/contactMessagesDb";
import { parseContactMessageFilter } from "../../../../lib/contact/contactMessageRecord";
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
    const filter = parseContactMessageFilter(context.url.searchParams.get("filter"));
    const [messages, newCount] = await Promise.all([
      listContactMessages(filter),
      countNewContactMessages(),
    ]);
    return watsonJsonResponse({
      ok: true,
      filter,
      newCount,
      messages,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list contact messages.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
