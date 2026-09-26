import type { APIRoute } from "astro";
import { getStore } from "@netlify/blobs";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../../lib/admin/requireAdminRequest";
import { scanPatternErrataImpact } from "../../../../../lib/patterns/errata/patternErrataImpact";
import { getPatternErrataById } from "../../../../../lib/patterns/errata/patternErrataStore";
import { PATTERN_INSPECTOR_BLOB_STORE } from "../../../../../lib/watson/patternInspector";
import { isWatsonSessionAuthenticated } from "../../../../../lib/watson/watsonAuth";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Read-only impact report. Lists saved-pattern blobs and classifies them.
 * There is no write method: saved patterns are not updated and no email is sent.
 */
export const GET: APIRoute = async ({ request, cookies, params }) => {
  const auth = await requireAdminForRequest(request, cookies);
  // The edit page is behind Netlify basic auth and does not prove a Memberstack
  // admin. Watson's signed session is the admin check Sue can already pass.
  // A Memberstack member who is not on the allowlist and has no Watson session
  // is still denied. This route stays read-only.
  if (!auth.ok && !isWatsonSessionAuthenticated(cookies)) {
    return json(adminAuthErrorBody(auth), auth.status);
  }

  const id = typeof params.id === "string" ? params.id.trim() : "";
  if (!id) return json({ ok: false, error: "Missing correction id." }, 400);

  try {
    const errata = await getPatternErrataById(id);
    if (!errata) return json({ ok: false, error: "Correction not found." }, 404);
    const store = getStore({ name: PATTERN_INSPECTOR_BLOB_STORE, consistency: "strong" });
    const report = await scanPatternErrataImpact(errata, store);
    return json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build the impact report.";
    return json({ ok: false, error: message }, 500);
  }
};
