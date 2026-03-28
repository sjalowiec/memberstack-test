import type { APIRoute } from "astro";
import {
  readHelpHubFile,
  writeHelpHubFile,
  nextHelpHubId,
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

function requireNonEmptyString(value: unknown, label: string): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function slugTaken(
  tips: Record<string, unknown>[],
  slug: string,
  exceptId: number | null
): boolean {
  return tips.some((t) => {
    const sid = typeof t.slug === "string" ? t.slug.trim() : "";
    if (sid !== slug) return false;
    const id = getTipId(t);
    if (exceptId !== null && id === exceptId) return false;
    return true;
  });
}

export const GET: APIRoute = async () => {
  try {
    const tips = readHelpHubFile();
    return jsonResponse({ ok: true, tips });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const title = requireNonEmptyString(body.title, "title");
  const slug = requireNonEmptyString(body.slug, "slug");
  const category = requireNonEmptyString(body.category, "category");
  const status = requireNonEmptyString(body.status, "status");

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

  if (slugTaken(tips, slug, null)) {
    return jsonResponse({ ok: false, error: `slug "${slug}" is already in use.` }, 400);
  }

  const newId = nextHelpHubId(tips);
  const row: Record<string, unknown> = { ...body };
  delete row.id;
  row.id = newId;
  row.title = title;
  row.slug = slug;
  row.category = category;
  row.status = status;
  stripLegacyHelpHubTipFields(row);
  row.relatedLessons = normalizeRelatedLessons(body.relatedLessons);

  tips.push(row);

  try {
    writeHelpHubFile(tips);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write help-hub.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, tips, tip: row });
};
