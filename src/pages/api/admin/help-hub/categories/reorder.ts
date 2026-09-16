import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../../lib/admin/requireAdminRequest";
import { HelpHubCategoryError } from "../../../../../lib/helpHub/categoryManage";
import { reorderManagedHelpHubCategories } from "../../../../../lib/helpHub/loadCategories";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const PUT: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const ids = Array.isArray(body.ids)
    ? body.ids.map((value) => Number(value)).filter((value) => Number.isFinite(value))
    : [];
  try {
    const categories = await reorderManagedHelpHubCategories(ids, auth.member);
    return jsonResponse({ ok: true, categories });
  } catch (error) {
    if (error instanceof HelpHubCategoryError) {
      return jsonResponse({ ok: false, error: error.message, code: error.code }, 400);
    }
    const message = error instanceof Error ? error.message : "Could not reorder categories.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
