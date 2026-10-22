import type { APIRoute } from "astro";
import { loadPublicGlossaryEntry } from "../../../../lib/glossary/loadGlossaryEntries";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** Read one saved glossary entry. This route does not write. */
export const GET: APIRoute = async ({ params }) => {
  const glossaryId = Number(params.id);
  if (!Number.isInteger(glossaryId)) {
    return jsonResponse({ ok: false, error: "Glossary id is not valid." }, 400);
  }

  const entry = await loadPublicGlossaryEntry(glossaryId);
  if (!entry) {
    return jsonResponse({ ok: false, error: "Glossary entry was not found." }, 404);
  }

  return jsonResponse(entry);
};
