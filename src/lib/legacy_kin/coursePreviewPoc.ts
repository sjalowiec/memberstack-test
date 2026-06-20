import course50Poc from "../../data/legacy_kin/cleaned/course_50_lk150_quick.poc.json";
import course51Poc from "../../data/legacy_kin/cleaned/course_51_lk150_fun.poc.json";

export const COURSE_PREVIEW_BASE = "/dev/course-preview";
export const COURSE_QUERY_PARAM = "course";
export const DEFAULT_PREVIEW_COURSE_ID = 50;
export const LEGACY_ASSET_ORIGIN = "https://www.knititnow.com";
export const LEGACY_DOWNLOAD_BASE = `${LEGACY_ASSET_ORIGIN}/KIN_Images/Challenges`;

export type RichTextComponent = {
  type: "richText";
  html: string;
  legacyComponentId: number;
  order: number;
};

export type VideoComponent = {
  type: "video";
  vimeoId: string;
  title?: string | null;
  legacyComponentId: number;
  order: number;
  legacySource?: string;
  legacySlot?: number;
};

export type DownloadComponent = {
  type: "download";
  label: string;
  filename: string;
  showInline?: boolean;
  legacyComponentId: number;
  order: number;
};

export type ImageGalleryComponent = {
  type: "imageGallery";
  slides: { src: string; caption?: string | null }[];
  legacyComponentId: number;
  order: number;
};

export type ExerciseAccordionComponent = {
  type: "exerciseAccordion";
  sections: { title: string; bodyHtml: string; iconSrc?: string }[];
  legacyComponentId: number;
  order: number;
};

export type MigrationPendingComponent = {
  type: "migrationPending";
  legacyType: string;
  notes: string[];
  legacyFields?: Record<string, string>;
  legacyComponentId: number;
  order: number;
};

export type CourseComponent =
  | RichTextComponent
  | VideoComponent
  | DownloadComponent
  | ImageGalleryComponent
  | ExerciseAccordionComponent
  | MigrationPendingComponent;

export type CourseBlock = {
  title: string;
  slug: string;
  order: number;
  legacy: { assignId: number; blockType: string };
  components: CourseComponent[];
};

export type CourseLesson = {
  title: string;
  slug: string;
  displayOrder: number;
  legacy: { itemId: number; lessonOrder: number };
  blocks: CourseBlock[];
};

export type CoursePreviewData = {
  course: {
    legacyChallengeId: number;
    title: string;
    slug: string;
    legacy: { sourceExport: string };
  };
  lessons: CourseLesson[];
};

const previewCourses: Record<number, CoursePreviewData> = {
  50: course50Poc as CoursePreviewData,
  51: course51Poc as CoursePreviewData,
};

/** Legacy default export — course 50 only. */
export const coursePreviewData = previewCourses[DEFAULT_PREVIEW_COURSE_ID];
export const coursePreviewCourse = coursePreviewData.course;

export function getPreviewCourseIds(): number[] {
  return Object.keys(previewCourses)
    .map(Number)
    .sort((a, b) => a - b);
}

export function getCoursePreviewData(
  courseId: number,
): CoursePreviewData | undefined {
  return previewCourses[courseId];
}

export function parseCourseId(
  value: string | number | null | undefined,
): number {
  const parsed = Number.parseInt(String(value ?? DEFAULT_PREVIEW_COURSE_ID), 10);
  if (Number.isNaN(parsed) || !previewCourses[parsed]) {
    return DEFAULT_PREVIEW_COURSE_ID;
  }
  return parsed;
}

export function getSortedLessons(
  courseId: number = DEFAULT_PREVIEW_COURSE_ID,
): CourseLesson[] {
  const data = getCoursePreviewData(parseCourseId(courseId));
  if (!data) return [];
  return [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function coursePreviewHref(
  courseId: number = DEFAULT_PREVIEW_COURSE_ID,
): string {
  return `${COURSE_PREVIEW_BASE}/${parseCourseId(courseId)}`;
}

export function lessonPreviewHref(
  courseId: number,
  slug: string,
): string {
  return `${coursePreviewHref(courseId)}/${slug}`;
}

export function getLessonBySlug(
  courseId: number,
  slug: string,
): CourseLesson | undefined {
  return getSortedLessons(courseId).find((lesson) => lesson.slug === slug);
}

export function getLessonNeighbors(
  courseId: number,
  slug: string,
): {
  index: number;
  prev: CourseLesson | null;
  next: CourseLesson | null;
} {
  const lessons = getSortedLessons(courseId);
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  if (index < 0) {
    return { index: -1, prev: null, next: null };
  }
  return {
    index,
    prev: index > 0 ? lessons[index - 1] : null,
    next: index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

export function legacyAssetUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${LEGACY_ASSET_ORIGIN}${trimmed}`;
  return `${LEGACY_ASSET_ORIGIN}/${trimmed.replace(/^\//, "")}`;
}

export function downloadUrl(filename: string): string {
  return `${LEGACY_DOWNLOAD_BASE}/${filename.replace(/^\//, "")}`;
}

export function rewriteLegacyHtml(html: string): string {
  return html
    .replace(/src="(\/[^"]+)"/g, (_, path: string) => `src="${LEGACY_ASSET_ORIGIN}${path}"`)
    .replace(/src='(\/[^']+)'/g, (_, path: string) => `src='${LEGACY_ASSET_ORIGIN}${path}'`)
    .replace(/href="(\/[^"]+\.pdf)"/gi, (_, path: string) => `href="${LEGACY_ASSET_ORIGIN}${path}"`);
}

export function sortedBlocks(lesson: CourseLesson): CourseBlock[] {
  return [...lesson.blocks].sort((a, b) => a.order - b.order);
}

export function sortedComponents(block: CourseBlock): CourseComponent[] {
  return [...block.components].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    const slotA = "legacySlot" in a ? (a.legacySlot ?? 0) : 0;
    const slotB = "legacySlot" in b ? (b.legacySlot ?? 0) : 0;
    if (slotA !== slotB) return slotA - slotB;
    return a.type.localeCompare(b.type);
  });
}

export const SECTION_QUERY_PARAM = "section";

export type CourseBlockSection = {
  title: string;
  blocks: CourseBlock[];
};

export function normalizeSectionTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sectionTitlesMatch(a: string, b: string): boolean {
  return normalizeSectionTitle(a) === normalizeSectionTitle(b);
}

export function sectionDisplayTitle(block: CourseBlock): string {
  const trimmed = block.title?.trim();
  return trimmed || `(untitled assign ${block.legacy.assignId})`;
}

export function isSectionAuxiliaryBlock(block: CourseBlock): boolean {
  const components = sortedComponents(block);
  if (components.length === 0) return true;
  if (components.length === 1) {
    const component = components[0];
    if (component.type === "download") return true;
    if (component.type === "migrationPending") return true;
    if (component.type === "richText" && !component.html?.trim()) return true;
  }
  return false;
}

/** Group blocks by legacy section/bookmark title for dev preview auditing. */
export function groupBlocksBySection(blocks: CourseBlock[]): CourseBlockSection[] {
  const groups: CourseBlockSection[] = [];
  let current: CourseBlockSection | null = null;
  let lastContentBlockTitle: string | null = null;

  for (const block of blocks) {
    const title = sectionDisplayTitle(block);

    let startNew = current === null;

    if (!startNew && !sectionTitlesMatch(title, current!.title)) {
      if (
        isSectionAuxiliaryBlock(block) &&
        lastContentBlockTitle !== null &&
        sectionTitlesMatch(title, lastContentBlockTitle)
      ) {
        startNew = false;
      } else {
        startNew = true;
      }
    }

    if (startNew) {
      current = { title, blocks: [] };
      groups.push(current);
    }

    current!.blocks.push(block);

    if (!isSectionAuxiliaryBlock(block)) {
      lastContentBlockTitle = title;
    }
  }

  return groups;
}

/** Stable in-page anchor for a grouped legacy section (dev preview only). */
export function sectionAnchorId(
  lessonSlug: string,
  section: CourseBlockSection,
): string {
  const first = section.blocks[0];
  if (!first) {
    return `${lessonSlug}-section-empty`;
  }
  return `${lessonSlug}-section-${first.order}-${first.legacy.assignId}`;
}

/** Parse a 1-based ?section=N query value into a zero-based section index. */
export function parseSectionQueryIndex(
  value: string | null | undefined,
  sectionCount: number,
): number {
  if (sectionCount <= 0) return 0;
  const parsed = Number.parseInt(value ?? "1", 10);
  if (Number.isNaN(parsed)) return 0;
  return Math.min(Math.max(parsed, 1), sectionCount) - 1;
}

/** Format a zero-based section index as a 1-based query value. */
export function formatSectionQueryIndex(zeroBasedIndex: number): string {
  return String(zeroBasedIndex + 1);
}

export function lessonPreviewSectionHref(
  courseId: number,
  slug: string,
  oneBasedSection: number,
): string {
  return `${lessonPreviewHref(courseId, slug)}?${SECTION_QUERY_PARAM}=${oneBasedSection}`;
}
