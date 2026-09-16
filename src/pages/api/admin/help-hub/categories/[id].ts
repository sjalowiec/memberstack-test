import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../../lib/admin/requireAdminRequest";
import { HelpHubCategoryError } from "../../../../../lib/helpHub/categoryManage";
import {
  deleteManagedHelpHubCategory,
  renameManagedHelpHubCategory,
} from "../../../../../lib/helpHub/loadCategories";

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

function errorResponse(error: unknown) {
  if (error instanceof HelpHubCategoryError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return jsonResponse({ ok: false, error: error.message, code: error.code }, status);
  }
  const message = error instanceof Error ? error.message : "Could not update Help Hub category.";
  return jsonResponse({ ok: false, error: message }, 500);
}

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }
  const id = parseUrlId(params.id);
  if (id === null) return jsonResponse({ ok: false, error: "Invalid category id in URL." }, 400);
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
    const categories = await renameManagedHelpHubCategory(id, label, auth.member);
    return jsonResponse({ ok: true, categories });
  } catch (error) {
    return errorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }
  const id = parseUrlId(params.id);
  if (id === null) return jsonResponse({ ok: false, error: "Invalid category id in URL." }, 400);
  try {
    const categories = await deleteManagedHelpHubCategory(id, auth.member);
    return jsonResponse({ ok: true, categories });
  } catch (error) {
    return errorResponse(error);
  }
};
