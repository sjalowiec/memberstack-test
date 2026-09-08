import type { MemberLessonRecord } from "./types";
import {
  helpHubPreviewBaseHref,
  htmlWithHelpHubPreviewBase,
  helpHubPreviewUrlExposesDocument,
  collectPreviewStylesheetHrefs,
  previewAssetAbsoluteUrl,
  previewAssetResolvesToSiteOrigin,
} from "../helpHub/previewDocument";

export const LESSON_PREVIEW_PATH = "/lessons/preview";

export type LessonPreviewParseResult =
  | { ok: true; mode: "document"; lesson: MemberLessonRecord }
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

export function toLessonPreviewRecord(doc: Record<string, unknown>): MemberLessonRecord {
  const lesson: Record<string, unknown> = { ...doc };
  const idRaw = lesson.id;
  const id =
    typeof idRaw === "number" && Number.isFinite(idRaw)
      ? Math.floor(idRaw)
      : typeof idRaw === "string" && /^\s*\d+\s*$/.test(idRaw)
        ? parseInt(idRaw.trim(), 10)
        : 0;
  const slug = typeof lesson.slug === "string" ? lesson.slug : "";
  const status = typeof lesson.status === "string" ? lesson.status : "draft";
  return {
    ...lesson,
    id,
    slug,
    status,
  };
}

/**
 * Parse an authenticated preview POST body.
 * Prefers an in-memory editor document so unsaved fields can be previewed.
 * A slug-only body loads a saved draft on the server and never persists.
 */
export function parseLessonPreviewBody(body: unknown): LessonPreviewParseResult {
  const root = asRecord(body);
  if (!root) {
    return { ok: false, error: "Request body must be a JSON object." };
  }

  const document = asRecord(root.document) ?? asRecord(root.lesson);
  if (document) {
    const title = requireTrimmed(document.title);
    const slug = requireTrimmed(document.slug);
    if (!title || !slug) {
      return { ok: false, error: "Preview document requires title and slug." };
    }
    return { ok: true, mode: "document", lesson: toLessonPreviewRecord(document) };
  }

  const slug = requireTrimmed(root.slug);
  if (slug) {
    return { ok: true, mode: "slug", slug };
  }

  return { ok: false, error: "Preview requires a document or a saved slug." };
}

export async function resolveLessonPreviewRecord(
  body: unknown,
  loadBySlug: (slug: string) => Promise<MemberLessonRecord | Record<string, unknown> | null>,
): Promise<
  | { ok: true; lesson: MemberLessonRecord }
  | { ok: false; status: number; error: string }
> {
  const parsed = parseLessonPreviewBody(body);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error };
  }
  if (parsed.mode === "document") {
    return { ok: true, lesson: parsed.lesson };
  }
  const saved = await loadBySlug(parsed.slug);
  if (!saved) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return { ok: true, lesson: toLessonPreviewRecord(saved as Record<string, unknown>) };
}

export function lessonPreviewUrlExposesDocument(url: string): boolean {
  return helpHubPreviewUrlExposesDocument(url);
}

export const lessonPreviewBaseHref = helpHubPreviewBaseHref;
export const htmlWithLessonPreviewBase = htmlWithHelpHubPreviewBase;
export {
  collectPreviewStylesheetHrefs,
  previewAssetAbsoluteUrl,
  previewAssetResolvesToSiteOrigin,
};
