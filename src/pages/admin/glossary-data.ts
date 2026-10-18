import type { APIRoute } from "astro";
import { glossaryErrorMessage } from "../../lib/glossary/glossaryEntries";
import { loadGlossaryEntries, saveGlossaryEntries } from "../../lib/glossary/loadGlossaryEntries";

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

export const GET: APIRoute = async () => {
  try {
    const entries = await loadGlossaryEntries();
    return jsonResponse(entries);
  } catch (error) {
    const message = glossaryErrorMessage(error, "Could not load saved glossary entries.");
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse(
      {
        ok: false,
        error: "Content-Type must be application/json. Your changes are still in the editor.",
      },
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Invalid JSON body. Your changes are still in the editor." },
      400,
    );
  }

  try {
    await saveGlossaryEntries(body);
  } catch (error) {
    const message = glossaryErrorMessage(
      error,
      "Could not save glossary. Your changes are still in the editor.",
    );
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
    return jsonResponse({ ok: false, error: message }, status);
  }

  return jsonResponse({ ok: true, success: true });
};
