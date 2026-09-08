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
