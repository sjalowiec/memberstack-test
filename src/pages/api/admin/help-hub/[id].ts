import type { APIRoute } from "astro";
import {
  readHelpHubFile,
  writeHelpHubFile,
  sortHelpHubTipsBySortOrder,
  getTipId,
  normalizeRelatedLessons,
  stripLegacyHelpHubTipFields,
} from "../../../../lib/helpHubAdminFile";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function slugTaken(
  tips: Record<string, unknown>[],
  slug: string,
  exceptId: number
): boolean {
  return tips.some((t) => {
    const sid = typeof t.slug === "string" ? t.slug.trim() : "";
    if (sid !== slug) return false;
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

export const PUT: APIRoute = async ({ params, request }) => {
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

  let tips: Record<string, unknown>[];
  try {
    tips = readHelpHubFile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const idx = tips.findIndex((t) => getTipId(t) === urlId);
  if (idx === -1) {
    return jsonResponse({ ok: false, error: `No tip with id ${urlId}.` }, 404);
  }

  if (slugTaken(tips, slug, urlId)) {
    return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
  }

  const existing = tips[idx];
  const row: Record<string, unknown> = {
    ...existing,
    ...body,
  };
  row.id = urlId;
  row.title = title;
  row.slug = slug;
  row.category = category;
  row.status = status;
  stripLegacyHelpHubTipFields(row);
  row.relatedLessons = normalizeRelatedLessons(body.relatedLessons);

  tips[idx] = row;

  try {
    writeHelpHubFile(tips);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const ordered = sortHelpHubTipsBySortOrder(tips);
  return jsonResponse({ ok: true, tips: ordered, tip: row });
};

export const DELETE: APIRoute = async ({ params }) => {
  const urlId = parseUrlId(params.id);
  if (urlId === null) {
    return jsonResponse({ ok: false, error: "Invalid tip id in URL." }, 400);
  }

  let tips: Record<string, unknown>[];
  try {
    tips = readHelpHubFile();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const next = tips.filter((t) => getTipId(t) !== urlId);
  if (next.length === tips.length) {
    return jsonResponse({ ok: false, error: `No tip with id ${urlId}.` }, 404);
  }

  try {
    writeHelpHubFile(next);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, tips: sortHelpHubTipsBySortOrder(next) });
};
