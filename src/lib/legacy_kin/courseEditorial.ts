/**
 * Draft and published course revisions.
 *
 * A draft save never changes the published revision. Publish copies only the
 * revision that was previewed. A bundled course file is not a newer revision
 * and must not replace either record.
 */
import { createHash } from "node:crypto";

import type { CoursePreviewData } from "./coursePreviewPoc";
import { isLegacyCoursePublic } from "./legacyCoursePublication";

export const DOUBLE_POINTED_KERCHIEF_SLUG = "knit-a-double-pointed-kerchief-scarf";

export type CourseRevision = {
  revisionId: string;
  savedAt: string;
  document: CoursePreviewData;
};

export type PublishedCourseRevision = CourseRevision & {
  /** Draft revision id that was previewed and then published. */
  sourceRevisionId: string;
};

export type CourseEditorialState = {
  draft: CourseRevision | null;
  published: PublishedCourseRevision | null;
  previewedRevisionId: string | null;
};

export function emptyCourseEditorialState(): CourseEditorialState {
  return {
    draft: null,
    published: null,
    previewedRevisionId: null,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function courseRevisionId(document: CoursePreviewData): string {
  return createHash("sha256").update(stableStringify(document)).digest("hex");
}

export function courseLessonsMatch(left: CoursePreviewData, right: CoursePreviewData): boolean {
  return stableStringify(left.lessons) === stableStringify(right.lessons);
}

export function courseHasKerchiefLesson(document: CoursePreviewData): boolean {
  const serialized = stableStringify(document).toLowerCase();
  return (
    serialized.includes(DOUBLE_POINTED_KERCHIEF_SLUG) ||
    serialized.includes("double pointed kerchief") ||
    serialized.includes("double-pointed kerchief")
  );
}

function cloneDocument(document: CoursePreviewData): CoursePreviewData {
  return structuredClone(document);
}

export function asPrivateDraft(document: CoursePreviewData): CoursePreviewData {
  const next = cloneDocument(document);
  next.course.status = "draft";
  next.course.published = false;
  next.course.active = false;
  return next;
}

/** Student-facing copy of a previewed draft. Lesson content stays identical. */
export function asPublishedSnapshot(document: CoursePreviewData): CoursePreviewData {
  const next = cloneDocument(document);
  next.course.status = "published";
  next.course.published = true;
  next.course.active = true;
  return next;
}

export function createPrivateCourseDocument(input: {
  id: number;
  title: string;
  slug: string;
}): CoursePreviewData {
  const title = input.title.trim();
  const slug = input.slug.trim();
  if (!title) throw new Error("A course title is required.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("The course slug must use lowercase letters, numbers, and hyphens.");
  }
  return {
    course: {
      legacyChallengeId: input.id,
      title,
      slug,
      status: "draft",
      published: false,
      active: false,
      contentStatus: "in_progress",
      legacy: {
        sourceExport: "course-content-editor",
        contentRevision: 1,
      },
    },
    lessons: [],
  };
}

export function saveCourseDraft(
  state: CourseEditorialState,
  document: CoursePreviewData,
  savedAt: string,
): CourseEditorialState {
  const stored = cloneDocument(document);
  const revisionId = courseRevisionId(stored);
  const unchanged = state.draft?.revisionId === revisionId;
  return {
    draft: {
      revisionId,
      savedAt: unchanged ? state.draft!.savedAt : savedAt,
      document: stored,
    },
    published: state.published ? structuredClone(state.published) : null,
    previewedRevisionId: unchanged ? state.previewedRevisionId : null,
  };
}

export function markCourseDraftPreviewed(
  state: CourseEditorialState,
  revisionId: string,
): CourseEditorialState {
  if (!state.draft) throw new Error("Save a draft before preview.");
  if (state.draft.revisionId !== revisionId) {
    throw new Error("Save this draft again before preview.");
  }
  return {
    draft: state.draft,
    published: state.published ? structuredClone(state.published) : null,
    previewedRevisionId: revisionId,
  };
}

export function publishPreviewedCourseDraft(
  state: CourseEditorialState,
  revisionId: string,
  savedAt: string,
): CourseEditorialState {
  if (!state.draft) throw new Error("Save a draft before publishing.");
  if (state.draft.revisionId !== revisionId || state.previewedRevisionId !== revisionId) {
    throw new Error("Preview this draft before publishing.");
  }
  const document = asPublishedSnapshot(state.draft.document);
  if (!courseLessonsMatch(document, state.draft.document)) {
    throw new Error("Publish refused: the student copy would not match the previewed draft.");
  }
  return {
    draft: state.draft,
    previewedRevisionId: revisionId,
    published: {
      revisionId: courseRevisionId(document),
      sourceRevisionId: revisionId,
      savedAt,
      document,
    },
  };
}

/** Students see the published revision. A private draft never replaces it. */
export function studentCourseDocument(
  state: CourseEditorialState | null,
  bundled: CoursePreviewData | null,
): CoursePreviewData | null {
  const published = state?.published?.document;
  if (published && isLegacyCoursePublic(published.course)) return published;
  return bundled;
}

export function editorCourseDocument(
  state: CourseEditorialState | null,
  fallback: CoursePreviewData | null,
): CoursePreviewData | null {
  if (state?.draft) return state.draft.document;
  return fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PreviewComponent = {
  type?: string;
  html?: string;
  src?: string;
  alt?: string;
  slides?: { src?: string | null; alt?: string | null; caption?: string | null }[];
  filename?: string;
  label?: string;
  vimeoId?: string;
  title?: string | null;
  sections?: { title?: string; bodyHtml?: string }[];
};

function renderComponent(component: PreviewComponent): string {
  if (component.type === "richText") return component.html ?? "";
  if (component.type === "image" && component.src) {
    return `<figure><img src="${escapeHtml(component.src)}" alt="${escapeHtml(component.alt ?? "")}"></figure>`;
  }
  if (
    (component.type === "imageGallery" || component.type === "imageCarousel") &&
    Array.isArray(component.slides)
  ) {
    return component.slides
      .filter((slide) => String(slide.src ?? "").trim())
      .map(
        (slide) =>
          `<figure><img src="${escapeHtml(String(slide.src))}" alt="${escapeHtml(slide.alt ?? slide.caption ?? "")}"></figure>`,
      )
      .join("");
  }
  if (component.type === "exerciseAccordion" && Array.isArray(component.sections)) {
    return component.sections
      .map(
        (section) =>
          `<section><h3>${escapeHtml(section.title ?? "")}</h3>${section.bodyHtml ?? ""}</section>`,
      )
      .join("");
  }
  if (component.type === "video" && component.vimeoId) {
    return `<p>Video ${escapeHtml(component.vimeoId)}</p>`;
  }
  if (component.type === "download" && component.filename) {
    return `<p><a href="${escapeHtml(component.filename)}">${escapeHtml(component.label || component.filename)}</a></p>`;
  }
  return "";
}

function lessonMediaSrcs(document: CoursePreviewData): string[] {
  const srcs: string[] = [];
  const lessons = [...document.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
  const first = lessons[0];
  if (!first) return srcs;
  for (const block of [...first.blocks].sort((a, b) => a.order - b.order)) {
    for (const component of block.components as PreviewComponent[]) {
      if (component.src) srcs.push(component.src);
      for (const slide of component.slides ?? []) {
        if (slide.src) srcs.push(slide.src);
      }
      const html = `${component.html ?? ""} ${(component.sections ?? []).map((section) => section.bodyHtml ?? "").join(" ")}`;
      for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
        const src = match[1]?.trim();
        if (src) srcs.push(src);
      }
    }
  }
  return srcs;
}

export function openingGifSrc(document: CoursePreviewData): string | null {
  return lessonMediaSrcs(document).find((src) => /\.gif($|\?)/i.test(src)) ?? null;
}

export function renderCourseDraftPreviewHtml(document: CoursePreviewData): string {
  const thumbnail = document.course.thumbnail?.trim() || "";
  const gif = openingGifSrc(document);
  const lessons = [...document.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
  const lessonHtml = lessons
    .map((lesson) => {
      const blocks = [...lesson.blocks].sort((a, b) => a.order - b.order);
      const body = blocks
        .map((block) => {
          const components = [...block.components].sort((a, b) => a.order - b.order);
          return `<section><h3>${escapeHtml(block.title)}</h3>${components
            .map((component) => renderComponent(component as PreviewComponent))
            .join("")}</section>`;
        })
        .join("");
      return `<article><h2>${escapeHtml(lesson.title)}</h2>${body}</article>`;
    })
    .join("");

  return [
    `<p class="course-draft-preview__banner">Draft preview. Students still see the published course until you publish this revision.</p>`,
    thumbnail
      ? `<img id="course-draft-thumbnail" src="${escapeHtml(thumbnail)}" alt="${escapeHtml(document.course.title)} thumbnail">`
      : "",
    gif
      ? `<img id="course-draft-opening-gif" src="${escapeHtml(gif)}" alt="Opening lesson">`
      : "",
    lessonHtml,
  ].join("");
}
