import type { APIRoute } from "astro";

import {
  computeContactMessageCounts,
  getContactMessagesStore,
  listContactMessages,
  matchesListFilter,
  type ContactMessageListFilter,
} from "../../../../lib/contact/contactMessagesStore";
import {
  requireWatsonAdminJson,
  watsonJsonResponse,
} from "../../../../lib/watson/watsonApiAuth";

export const prerender = false;

const FILTERS: ContactMessageListFilter[] = [
  "all",
  "open",
  "new",
  "in_progress",
  "waiting_for_customer",
  "resolved",
];

function parseFilter(value: string | null): ContactMessageListFilter {
  if (value && (FILTERS as string[]).includes(value)) {
    return value as ContactMessageListFilter;
  }
  return "open";
}

export const GET: APIRoute = async (context) => {
  const auth = await requireWatsonAdminJson(context);
  if (!auth.ok) {
    return auth;
  }

  try {
    const filter = parseFilter(context.url.searchParams.get("filter"));
    const store = getContactMessagesStore();
    const allMessages = await listContactMessages(store, { filter: "all" });
    const messages = allMessages.filter((message) => matchesListFilter(message, filter));
    const counts = computeContactMessageCounts(allMessages);

    return watsonJsonResponse({
      ok: true,
      filter,
      counts,
      messages,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to list contact messages.";
    return watsonJsonResponse({ ok: false, error: message }, 500);
  }
};
