import type { APIRoute } from "astro";

import { loadHeaderSearchRecords, searchHeaderCatalog } from "../../lib/headerSearchCatalog";

export const prerender = false;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

/** Published videos, active glossary entries, and published Help Hub tips. */
export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get("q") ?? "";
  try {
    const records = await loadHeaderSearchRecords();
    return jsonResponse({ results: searchHeaderCatalog(records, query) });
  } catch (error) {
    console.error("Header search catalog failed.", error);
    return jsonResponse({ ok: false }, 503);
  }
};
