import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../../lib/admin/requireAdminRequest";
import { HelpHubCategoryError } from "../../../../../lib/helpHub/categoryManage";
import {
  createManagedHelpHubCategory,
  loadHelpHubCategoriesForAdmin,
} from "../../../../../lib/helpHub/loadCategories";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof HelpHubCategoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return jsonResponse({ ok: false, error: error.message, code: error.code }, status);
  }
  const message = error instanceof Error ? error.message : "Could not update Help Hub categories.";
  return jsonResponse({ ok: false, error: message }, 500);
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }
  try {
    const categories = await loadHelpHubCategoriesForAdmin();
    return jsonResponse({ ok: true, categories });
  } catch (error) {
    return errorResponse(error);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
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
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label) return jsonResponse({ ok: false, error: "label is required." }, 400);
  try {
    const result = await createManagedHelpHubCategory(label, auth.member);
    return jsonResponse({ ok: true, categories: result.categories, category: result.created });
  } catch (error) {
    return errorResponse(error);
  }
};
