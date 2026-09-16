import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../../../lib/admin/requireAdminRequest";
import { helpHubCategoryErrorResponse } from "../../../../../../lib/helpHub/categoryApiErrors";
import { restoreManagedHelpHubCategory } from "../../../../../../lib/helpHub/loadCategories";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function parseUrlId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }
  const id = parseUrlId(params.id);
  if (id === null) return jsonResponse({ ok: false, error: "Invalid category id in URL." }, 400);
  try {
    const categories = await restoreManagedHelpHubCategory(id, auth.member);
    return jsonResponse({ ok: true, categories });
  } catch (error) {
    return helpHubCategoryErrorResponse(error);
  }
};
