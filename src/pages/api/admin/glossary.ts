import type { APIRoute } from "astro";

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

const MOVED = "Reload the glossary editor. Nothing was saved. Your changes are still in the editor.";

/** The old filesystem endpoint no longer writes. Saving lives at /admin/glossary-data. */
export const GET: APIRoute = async () => {
  return jsonResponse({ ok: false, error: "Reload the glossary editor to load saved entries." }, 409);
};

export const POST: APIRoute = async () => {
  return jsonResponse({ ok: false, error: MOVED }, 409);
};
