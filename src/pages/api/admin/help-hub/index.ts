import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../lib/admin/requireAdminRequest";
import {
  getTipId,
  normalizeRelatedLessons,
  sortHelpHubTipsBySortOrder,
  stripLegacyHelpHubTipFields,
} from "../../../../lib/helpHubAdminFile";
import { isHelpHubStatus } from "../../../../lib/helpHub/document";
import {
  isUniqueViolation,
  loadHelpHubTipsForAdmin,
  saveNewHelpHubTip,
} from "../../../../lib/helpHub/loadTips";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function slugTaken(
  tips: Record<string, unknown>[],
  slug: string,
  exceptId: number | null,
): boolean {
  const needle = slug.trim().toLowerCase();
  return tips.some((t) => {
    const sid = typeof t.slug === "string" ? t.slug.trim().toLowerCase() : "";
    if (sid !== needle) return false;
    const id = getTipId(t);
    if (exceptId !== null && id === exceptId) return false;
    return true;
  });
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }

  try {
    const tips = sortHelpHubTipsBySortOrder(await loadHelpHubTipsForAdmin());
    return jsonResponse({ ok: true, tips });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read Help Hub tips.";
    return jsonResponse({ ok: false, error: message }, 500);
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

  const title = requireNonEmptyString(body.title);
  const slug = requireNonEmptyString(body.slug);
  const category = requireNonEmptyString(body.category);
  const status = requireNonEmptyString(body.status);

  if (!title) return jsonResponse({ ok: false, error: "title is required." }, 400);
  if (!slug) return jsonResponse({ ok: false, error: "slug is required." }, 400);
  if (!category) return jsonResponse({ ok: false, error: "category is required." }, 400);
  if (!status) return jsonResponse({ ok: false, error: "status is required." }, 400);
  if (!isHelpHubStatus(status)) {
    return jsonResponse({ ok: false, error: "status must be draft, published, or review." }, 400);
  }

  let tips: Record<string, unknown>[];
  try {
    tips = await loadHelpHubTipsForAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read Help Hub tips.";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  if (slugTaken(tips, slug, null)) {
    return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
  }

  const row: Record<string, unknown> = { ...body };
  delete row.id;
  delete row.sortOrder;
  row.title = title;
  row.slug = slug;
  row.category = category;
  row.status = status;
  stripLegacyHelpHubTipFields(row);
  row.relatedLessons = normalizeRelatedLessons(body.relatedLessons);

  try {
    const tip = await saveNewHelpHubTip(row, { slug, status, title, category }, auth.member);
    const ordered = sortHelpHubTipsBySortOrder(await loadHelpHubTipsForAdmin());
    return jsonResponse({ ok: true, tips: ordered, tip });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
    }
    const message = e instanceof Error ? e.message : "Could not save Help Hub tip.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
