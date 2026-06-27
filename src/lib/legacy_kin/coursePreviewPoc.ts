import course50Poc from "../../data/legacy_kin/cleaned/course_50_lk150_quick.poc.json";
import course51Poc from "../../data/legacy_kin/cleaned/course_51_lk150_fun.poc.json";
import { getLayoutHeader, isTextImageLayoutBlock } from "./courseTextImageLayout";

export const COURSE_PREVIEW_BASE = "/dev/course-preview";
export const COURSE_QUERY_PARAM = "course";
export const DEFAULT_PREVIEW_COURSE_ID = 50;
export {
  LEGACY_ASSET_ORIGIN,
  LEGACY_DOWNLOAD_BASE,
  downloadUrl,
  legacyAssetUrl,
  rewriteLegacyHtml,
} from "./legacyCourseAssetUrls";

export type RichTextComponent = {
  type: "richText";
  html: string;
  legacyComponentId: number;
  order: number;
  layoutRole?: string;
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

export type ImageGallerySlide = {
  src: string;
  caption?: string | null;
  linkUrl?: string;
};

export type ImageGalleryComponent = {
  type: "imageGallery";
  slides: ImageGallerySlide[];
  legacyComponentId: number;
  order: number;
};

export type ImageCarouselSlide = {
  src: string;
  alt?: string | null;
  caption?: string | null;
  linkUrl?: string;
};

export type ImageCarouselComponent = {
  type: "imageCarousel";
  title?: string | null;
  slides: ImageCarouselSlide[];
  legacyComponentId: number;
  order: number;
};

export type ImageComponent = {
  type: "image";
  src: string;
  alt?: string;
  caption?: string | null;
  linkUrl?: string;
  legacyComponentId: number;
  order: number;
  layoutRole?: string;
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

export type EmbeddedToolComponent = {
  type: "embeddedTool";
  toolKey: string;
  legacyComponentId: number;
  order: number;
};

export type CourseComponent =
  | RichTextComponent
  | VideoComponent
  | DownloadComponent
  | ImageGalleryComponent
  | ImageCarouselComponent
  | ImageComponent
  | ExerciseAccordionComponent
  | EmbeddedToolComponent
  | MigrationPendingComponent;

export type CourseBlock = {
  title: string;
  slug: string;
  order: number;
  legacy: { assignId: number; blockType: string; editorLayout?: string };
  layoutOptions?: { imagePosition?: "left" | "right"; header?: string | null };
  components: CourseComponent[];
};

export type CourseLesson = {
  title: string;
  slug: string;
  displayOrder: number;
  legacy: { itemId: number; lessonOrder: number };
  blocks: CourseBlock[];
};

export type CourseContentStatus = "in_progress" | "cleaned";

export type CoursePreviewData = {
  course: {
    legacyChallengeId: number;
    title: string;
    slug: string;
    /** Editorial workflow: migrated content still being cleaned vs hand-cleaned ready. */
    contentStatus?: CourseContentStatus;
    /** `published` or omitted = public when no explicit publish flags. `draft` hides from public routes. */
    status?: string;
    published?: boolean;
    /** Short catalog blurb for course overview pages. */
    description?: string;
    /** Root-relative or absolute path to the course catalog card image. */
    thumbnail?: string;
    /** When false, hidden from the public /courses catalog and legacy routes. Omitted = active. */
    active?: boolean;
    legacy: { sourceExport: string; sourceCsv?: string; migratedAt?: string };
  };
  lessons: CourseLesson[];
  manifest?: {
    videoCount?: number;
    videos?: unknown[];
    downloadCount?: number;
    downloads?: unknown[];
  };
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
  if (isTextImageLayoutBlock(block)) {
    const header = getLayoutHeader(block);
    if (header) return header;
  }

  const trimmed = block.title?.trim();
  return trimmed || `(untitled assign ${block.legacy.assignId})`;
}

export const INTERNAL_SECTION_PLACEHOLDER_RE = /^\(untitled assign \d+\)$/i;

export function isInternalSectionPlaceholderTitle(title: string): boolean {
  return INTERNAL_SECTION_PLACEHOLDER_RE.test(title.trim());
}

/**
 * Public-facing section heading. Returns null when the title is an internal
 * placeholder, empty, or duplicates the lesson title (avoids redundant h1).
 */
export function sectionTitleForDisplay(
  sectionTitle: string,
  lessonTitle?: string,
): string | null {
  let trimmed = sectionTitle.trim();
  if (isInternalSectionPlaceholderTitle(trimmed)) {
    trimmed = "";
  }
  if (!trimmed) {
    return null;
  }
  const lesson = lessonTitle?.trim() ?? "";
  if (lesson && sectionTitlesMatch(trimmed, lesson)) {
    return null;
  }
  return trimmed;
}

/** Friendly label for section sub-nav when the raw title is internal or empty. */
export function sectionTitleForNav(
  sectionTitle: string,
  lessonTitle?: string,
): string {
  const display = sectionTitleForDisplay(sectionTitle, lessonTitle);
  if (display) return display;
  return "Untitled Section";
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
