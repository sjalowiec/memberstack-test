import type { APIRoute } from "astro";
import { requireAdminForRequest, adminAuthErrorBody } from "../../../../lib/admin/requireAdminRequest";
import {
  getTipId,
  mergeHelpHubPutUpdate,
  normalizeRelatedLessons,
  sortHelpHubTipsBySortOrder,
} from "../../../../lib/helpHubAdminFile";
import { isHelpHubStatus } from "../../../../lib/helpHub/document";
import {
  isUniqueViolation,
  loadHelpHubTipById,
  loadHelpHubTipsForAdmin,
  removeHelpHubTip,
  saveExistingHelpHubTip,
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
  exceptId: number,
): boolean {
  const needle = slug.trim().toLowerCase();
  return tips.some((t) => {
    const sid = typeof t.slug === "string" ? t.slug.trim().toLowerCase() : "";
    if (sid !== needle) return false;
    const id = getTipId(t);
    if (id === exceptId) return false;
    return true;
  });
}

function parseUrlId(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }

  const urlId = parseUrlId(params.id);
  if (urlId === null) {
    return jsonResponse({ ok: false, error: "Invalid tip id in URL." }, 400);
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

  if (slugTaken(tips, slug, urlId)) {
    return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
  }

  const existing = await loadHelpHubTipById(urlId);
  if (!existing) {
    return jsonResponse({ ok: false, error: `No tip with id ${urlId}.` }, 404);
  }

  if (Object.prototype.hasOwnProperty.call(body, "relatedLessons")) {
    body.relatedLessons = normalizeRelatedLessons(body.relatedLessons);
  }

  const row = mergeHelpHubPutUpdate(existing, body, {
    id: urlId,
    title,
    slug,
    category,
    status,
  });

  try {
    const tip = await saveExistingHelpHubTip(
      urlId,
      row,
      { slug, status, title, category },
      auth.member,
    );
    if (!tip) {
      return jsonResponse({ ok: false, error: `No tip with id ${urlId}.` }, 404);
    }
    const ordered = sortHelpHubTipsBySortOrder(await loadHelpHubTipsForAdmin());
    return jsonResponse({ ok: true, tips: ordered, tip });
  } catch (e) {
    if (isUniqueViolation(e)) {
      return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
    }
    const message = e instanceof Error ? e.message : "Could not update Help Hub tip.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse(adminAuthErrorBody(auth), auth.status);
  }

  const urlId = parseUrlId(params.id);
  if (urlId === null) {
    return jsonResponse({ ok: false, error: "Invalid tip id in URL." }, 400);
  }

  try {
    const removed = await removeHelpHubTip(urlId, auth.member);
    if (!removed) {
      return jsonResponse({ ok: false, error: `No tip with id ${urlId}.` }, 404);
    }
    const ordered = sortHelpHubTipsBySortOrder(await loadHelpHubTipsForAdmin());
    return jsonResponse({ ok: true, tips: ordered });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not delete Help Hub tip.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
