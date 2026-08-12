/**
 * Browser-safe Course 111 admin model (no Node fs / server I/O).
 */
import {
  appendStandaloneComponentBlock,
  createRichTextComponent,
  moveSectionAtIndex,
  nextLegacyComponentId,
} from "./courseContentEditorBlocks";
import type {
  CourseBlock,
  CourseComponent,
  CourseLesson,
  CoursePreviewData,
  DownloadComponent,
  ImageComponent,
  RichTextComponent,
  VideoComponent,
} from "./coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "./coursePreviewPoc";
import {
  isLegacyCourseDraft,
  type LegacyCoursePublicationFields,
} from "./legacyCoursePublication";

export const COURSE_111_ID = 111;

export const COURSE_111_POC_FILENAME =
  "course_111_mastering_the_silver_reed_sk840_a_comprehensive_course.poc.json";

export const COURSE_111_EDITABLE_TYPES = [
  "richText",
  "video",
  "image",
  "download",
] as const;

export type Course111EditableType = (typeof COURSE_111_EDITABLE_TYPES)[number];

export type Course111PublicationSnapshot = {
  status?: string;
  published?: boolean;
  active?: boolean;
  contentStatus?: string;
  legacyChallengeId: number;
};

export type Course111LessonSummary = {
  index: number;
  title: string;
  slug: string;
  displayOrder: number;
  blockCount: number;
  published: boolean;
  statusLabel: string;
};

export type Course111ComponentPatch = {
  html?: string;
  vimeoId?: string;
  title?: string | null;
  src?: string;
  alt?: string;
  caption?: string | null;
  label?: string;
  filename?: string;
  showInline?: boolean;
};

export function isCourse111EditableType(
  type: string,
): type is Course111EditableType {
  return (COURSE_111_EDITABLE_TYPES as readonly string[]).includes(type);
}

export function cloneCourse111Data(data: CoursePreviewData): CoursePreviewData {
  return structuredClone(data);
}

export function readCourse111Publication(
  course: CoursePreviewData["course"],
): Course111PublicationSnapshot {
  return {
    status: course.status,
    published: course.published,
    active: course.active,
    contentStatus: course.contentStatus,
    legacyChallengeId: course.legacyChallengeId,
  };
}

/** Ensure save paths never flip Course 111 out of draft/unpublished by accident. */
export function preserveCourse111Publication(
  data: CoursePreviewData,
  snapshot: Course111PublicationSnapshot,
): void {
  if (snapshot.status !== undefined) data.course.status = snapshot.status;
  else delete data.course.status;

  if (snapshot.published !== undefined) data.course.published = snapshot.published;
  else delete data.course.published;

  if (snapshot.active !== undefined) data.course.active = snapshot.active;
  else delete data.course.active;

  if (snapshot.contentStatus !== undefined) {
    data.course.contentStatus = snapshot.contentStatus as
      | "in_progress"
      | "cleaned";
  } else {
    delete data.course.contentStatus;
  }

  data.course.legacyChallengeId = snapshot.legacyChallengeId;
}

export function listCourse111LessonSummaries(
  data: CoursePreviewData,
): Course111LessonSummary[] {
  return [...data.lessons]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((lesson, index) => {
      const published = lesson.published !== false;
      return {
        index,
        title: lesson.title,
        slug: lesson.slug,
        displayOrder: lesson.displayOrder,
        blockCount: Array.isArray(lesson.blocks) ? lesson.blocks.length : 0,
        published,
        statusLabel: published ? "Visible" : "Unpublished",
      };
    });
}

export function filterCourse111Lessons(
  lessons: Course111LessonSummary[],
  query: string,
): Course111LessonSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return lessons;
  return lessons.filter((lesson) => {
    const haystack =
      `${lesson.index + 1} ${lesson.title} ${lesson.slug} ${lesson.statusLabel}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function findCourse111Lesson(
  data: CoursePreviewData,
  lessonSlug: string,
): CourseLesson | undefined {
  return data.lessons.find((lesson) => lesson.slug === lessonSlug);
}

/** Learner-facing draft preview URL (no server imports). */
export function course111LessonPreviewHref(
  data: CoursePreviewData,
  lessonSlug: string,
): string | null {
  const courseSlug = data.course.slug?.trim();
  const normalizedLessonSlug = lessonSlug.trim();
  if (!courseSlug || !normalizedLessonSlug) return null;
  return `/courses/legacy/${encodeURIComponent(courseSlug)}/${encodeURIComponent(normalizedLessonSlug)}?preview=true`;
}

/**
 * Resolve the learner preview URL for a specific selected lesson.
 * Returns null when the lesson is missing from the course.
 */
export function resolveCourse111SelectedLessonPreview(
  data: CoursePreviewData,
  selectedLessonSlug: string,
): { lessonSlug: string; previewHref: string } | null {
  const lesson = findCourse111Lesson(data, selectedLessonSlug);
  if (!lesson) return null;
  const previewHref = course111LessonPreviewHref(data, lesson.slug);
  if (!previewHref) return null;
  return { lessonSlug: lesson.slug, previewHref };
}

/**
 * Save & Preview plan: always save the selected lesson first, then open its
 * real learner-facing preview URL. Testable without DOM.
 */
export async function runCourse111SaveAndPreview(options: {
  data: CoursePreviewData;
  selectedLessonSlug: string;
  saveLesson: (lessonSlug: string) => Promise<void>;
  openPreview: (href: string) => void;
}): Promise<{ lessonSlug: string; previewHref: string }> {
  const resolved = resolveCourse111SelectedLessonPreview(
    options.data,
    options.selectedLessonSlug,
  );
  if (!resolved) {
    throw new Error("Select a lesson before Save & Preview.");
  }

  await options.saveLesson(resolved.lessonSlug);
  options.openPreview(resolved.previewHref);
  return resolved;
}

export function course111IsDraft(data: CoursePreviewData): boolean {
  return isLegacyCourseDraft(data.course as LegacyCoursePublicationFields);
}

export function createCourse111Component(
  type: Course111EditableType,
  lessons: CourseLesson[],
): CourseComponent {
  const legacyComponentId = nextLegacyComponentId(
    lessons as unknown as Record<string, unknown>[],
  );

  switch (type) {
    case "richText":
      return createRichTextComponent(
        lessons as unknown as Record<string, unknown>[],
      ) as RichTextComponent;
    case "video":
      return {
        type: "video",
        vimeoId: "",
        title: null,
        legacyComponentId,
        order: 1,
      } satisfies VideoComponent;
    case "image":
      return {
        type: "image",
        src: "",
        alt: "",
        caption: null,
        legacyComponentId,
        order: 1,
      } satisfies ImageComponent;
    case "download":
      return {
        type: "download",
        label: "Download",
        filename: "",
        legacyComponentId,
        order: 1,
      } satisfies DownloadComponent;
  }
}

export function addCourse111Block(
  lesson: CourseLesson,
  type: Course111EditableType,
  allLessons: CourseLesson[],
  timestamp = Date.now(),
): CourseBlock {
  const component = createCourse111Component(type, allLessons);
  const block = appendStandaloneComponentBlock(
    lesson as unknown as Record<string, unknown>,
    component as unknown as Record<string, unknown>,
    timestamp,
  ) as unknown as CourseBlock;

  block.title =
    type === "richText"
      ? "Text"
      : type === "video"
        ? "Video"
        : type === "image"
          ? "Image"
          : "Download";
  block.legacy = {
    ...block.legacy,
    blockType:
      type === "video" ? "Video" : type === "download" ? "Download" : "HTML",
  };
  return block;
}

export function moveCourse111Block(
  lesson: CourseLesson,
  blockIndex: number,
  delta: -1 | 1,
): boolean {
  return moveSectionAtIndex(
    lesson as unknown as Record<string, unknown>,
    blockIndex,
    delta,
  );
}

export function deleteCourse111Block(
  lesson: CourseLesson,
  blockSlug: string,
): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return false;
  if (!summarizeCourse111Block(block).canDelete) return false;

  const index = lesson.blocks.findIndex((entry) => entry.slug === blockSlug);
  if (index === -1) return false;
  lesson.blocks.splice(index, 1);
  const ordered = sortedBlocks(lesson);
  ordered.forEach((entry, orderIndex) => {
    entry.order = orderIndex + 1;
  });
  lesson.blocks = ordered;
  return true;
}

export function updateCourse111LessonTitle(
  lesson: CourseLesson,
  title: string,
): void {
  lesson.title = title.trim() || lesson.title;
}

/**
 * Patch only known editable fields on a matching component.
 * Unknown component keys and non-matching components are left untouched.
 */
export function patchCourse111Component(
  lesson: CourseLesson,
  blockSlug: string,
  legacyComponentId: number,
  patch: Course111ComponentPatch,
): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block) return false;

  const component = block.components.find(
    (entry) => entry.legacyComponentId === legacyComponentId,
  );
  if (!component || !isCourse111EditableType(component.type)) return false;

  if (component.type === "richText") {
    if ("html" in patch && typeof patch.html === "string") {
      component.html = patch.html;
    }
    return true;
  }

  if (component.type === "video") {
    if ("vimeoId" in patch && typeof patch.vimeoId === "string") {
      component.vimeoId = patch.vimeoId.trim();
    }
    if ("title" in patch) {
      component.title =
        patch.title == null || String(patch.title).trim() === ""
          ? null
          : String(patch.title).trim();
    }
    return true;
  }

  if (component.type === "image") {
    if ("src" in patch && typeof patch.src === "string") {
      component.src = patch.src.trim();
    }
    if ("alt" in patch && typeof patch.alt === "string") {
      component.alt = patch.alt;
    }
    if ("caption" in patch) {
      component.caption =
        patch.caption == null || String(patch.caption).trim() === ""
          ? null
          : String(patch.caption);
    }
    return true;
  }

  if (component.type === "download") {
    if ("label" in patch && typeof patch.label === "string") {
      component.label = patch.label.trim() || component.label;
    }
    if ("filename" in patch && typeof patch.filename === "string") {
      component.filename = patch.filename.trim();
    }
    if ("showInline" in patch && typeof patch.showInline === "boolean") {
      component.showInline = patch.showInline;
    }
    return true;
  }

  return false;
}

export function summarizeCourse111Block(block: CourseBlock): {
  title: string;
  slug: string;
  types: string[];
  editable: boolean;
  preservedOnly: boolean;
  /** False when the block includes unsupported/preserved components. */
  canDelete: boolean;
  canMove: boolean;
} {
  const types = sortedComponents(block).map((component) => component.type);
  const editable =
    types.length > 0 && types.every((type) => isCourse111EditableType(type));
  const preservedOnly =
    types.length > 0 && types.every((type) => !isCourse111EditableType(type));
  const hasPreservedComponent = types.some(
    (type) => !isCourse111EditableType(type),
  );
  return {
    title: block.title?.trim() || block.slug,
    slug: block.slug,
    types,
    editable,
    preservedOnly,
    canDelete: !hasPreservedComponent,
    canMove: true,
  };
}
