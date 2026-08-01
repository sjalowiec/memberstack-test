import type { APIRoute } from "astro";

import {
  getPublicBillboardSettings,
  listPublicWhatsNewCards,
} from "../../../lib/whatsNew/store";
import { groupWhatsNewCardsByColumn } from "../../../lib/whatsNew/public";

export const prerender = false;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Public read-only: published, non-archived cards + active billboard. */
export const GET: APIRoute = async () => {
  try {
    const cards = await listPublicWhatsNewCards();
    let billboard = null;
    try {
      billboard = await getPublicBillboardSettings();
    } catch {
      billboard = null;
    }
    return jsonResponse({
      ok: true,
      cards,
      board: groupWhatsNewCardsByColumn(cards),
      billboard,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load What's New.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
