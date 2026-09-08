import type { HelpHubPageTip } from "./prepareTipPage";

export const HELP_HUB_PREVIEW_PATH = "/help-hub/preview";

export type HelpHubPreviewParseResult =
  | { ok: true; mode: "document"; tip: HelpHubPageTip }
  | { ok: true; mode: "slug"; slug: string }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function requireTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeRelatedLessons(value: unknown): (string | number)[] {
  if (!Array.isArray(value)) return [];
  const out: (string | number)[] = [];
  for (const item of value) {
    if (typeof item === "number" && Number.isFinite(item)) {
      out.push(item);
      continue;
    }
    const text = String(item ?? "").trim();
    if (!text) continue;
    if (/^\d+$/.test(text)) {
      out.push(Number(text));
      continue;
    }
    out.push(text);
  }
  return out;
}

function stripLegacyHelpHubTipFields(row: Record<string, unknown>): void {
  delete row.relatedLessonId;
  delete row.relatedLesson;
  delete row.lessonCta;
  delete row.lessonIDs;
  delete row.readyToPublish;
}

export function toHelpHubPreviewTip(doc: Record<string, unknown>): HelpHubPageTip {
  const tip: Record<string, unknown> = { ...doc };
  stripLegacyHelpHubTipFields(tip);
  if (Object.prototype.hasOwnProperty.call(tip, "relatedLessons")) {
    tip.relatedLessons = normalizeRelatedLessons(tip.relatedLessons);
  }
  return tip as HelpHubPageTip;
}

/**
 * Parse an authenticated preview POST body.
 * Prefers an in-memory editor document so unsaved fields can be previewed.
 * A slug-only body loads a saved draft on the server and never persists.
 */
export function parseHelpHubPreviewBody(body: unknown): HelpHubPreviewParseResult {
  const root = asRecord(body);
  if (!root) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const document = asRecord(root.document) ?? asRecord(root.tip);
  if (document) {
    const title = requireTrimmed(document.title) ?? requireTrimmed(document.question);
    const slug = requireTrimmed(document.slug);
    if (!title || !slug) {
      return { ok: false, error: "Preview document requires title and slug." };
    }
    return { ok: true, mode: "document", tip: toHelpHubPreviewTip(document) };
  }

  const slug = requireTrimmed(root.slug);
  if (slug) {
    return { ok: true, mode: "slug", slug };
  }

  return { ok: false, error: "Preview requires a document or a saved slug." };
}

export async function resolveHelpHubPreviewTip(
  body: unknown,
  loadBySlug: (slug: string) => Promise<HelpHubPageTip | Record<string, unknown> | null>,
): Promise<
  | { ok: true; tip: HelpHubPageTip }
  | { ok: false; status: number; error: string }
> {
  const parsed = parseHelpHubPreviewBody(body);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }
  if (parsed.mode === "document") {
    return { ok: true, tip: parsed.tip };
  }
  const saved = await loadBySlug(parsed.slug);
  if (!saved) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return { ok: true, tip: toHelpHubPreviewTip(saved as Record<string, unknown>) };
}

export function helpHubPreviewUrlExposesDocument(url: string): boolean {
  return /[?&](?:data|document|tip)=/i.test(url);
}

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Site origin with a trailing slash, suitable for <base href>. */
export function helpHubPreviewBaseHref(origin: string): string {
  const trimmed = String(origin || "").trim();
  if (!trimmed || trimmed === "null" || /^blob:/i.test(trimmed) || /^about:/i.test(trimmed)) {
    return "";
  }
  try {
    const url = new URL(trimmed.endsWith("/") ? trimmed : `${trimmed}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.origin}/`;
  } catch {
    return "";
  }
}

/**
 * Insert <base href="https://origin/"> immediately after charset (or <head>)
 * so root-relative /_astro CSS, images, and scripts resolve against the site
 * instead of about:blank or a blob: URL.
 */
export function htmlWithHelpHubPreviewBase(html: string, originOrBase: string): string {
  const baseHref = helpHubPreviewBaseHref(originOrBase);
  if (!baseHref) return html;
  const baseTag = `<base href="${escapeHtmlAttr(baseHref)}">`;
  const withoutBase = html.replace(/<base\b[^>]*>/gi, "");
  const headMatch = withoutBase.match(/<head\b[^>]*>/i);
  if (!headMatch || headMatch.index === undefined) {
    return `${baseTag}${withoutBase}`;
  }
  const headEnd = headMatch.index + headMatch[0].length;
  const afterHead = withoutBase.slice(headEnd);
  const charset = afterHead.match(/^\s*<meta\b[^>]*charset[^>]*>/i);
  const insertAt = charset ? headEnd + charset[0].length : headEnd;
  return withoutBase.slice(0, insertAt) + baseTag + withoutBase.slice(insertAt);
}

export function collectPreviewStylesheetHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (!/\brel\s*=\s*(["']?)stylesheet\1/i.test(tag)) continue;
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (href) hrefs.push(href);
  }
  return hrefs;
}

export function previewAssetAbsoluteUrl(assetHref: string, baseHref: string): string {
  return new URL(assetHref, helpHubPreviewBaseHref(baseHref) || baseHref).href;
}

export function previewAssetResolvesToSiteOrigin(assetHref: string, originOrBase: string): boolean {
  const base = helpHubPreviewBaseHref(originOrBase);
  if (!base) return false;
  let absolute: URL;
  try {
    absolute = new URL(assetHref, base);
  } catch {
    return false;
  }
  if (absolute.protocol === "blob:" || absolute.protocol === "about:") return false;
  const isRootOrRelative = assetHref.startsWith("/") || !/^[a-z][a-z0-9+.-]*:/i.test(assetHref);
  if (isRootOrRelative) {
    return absolute.origin === new URL(base).origin;
  }
  return absolute.protocol === "http:" || absolute.protocol === "https:";
}
