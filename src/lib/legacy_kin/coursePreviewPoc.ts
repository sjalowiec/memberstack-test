import coursePoc from "../../data/legacy_kin/cleaned/course_50_lk150_quick.poc.json";

export const COURSE_PREVIEW_BASE = "/dev/course-preview";
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

export const coursePreviewData = coursePoc as CoursePreviewData;
export const coursePreviewCourse = coursePreviewData.course;

export function getSortedLessons(): CourseLesson[] {
  return [...coursePreviewData.lessons].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );
}

export function lessonPreviewHref(slug: string): string {
  return `${COURSE_PREVIEW_BASE}/${slug}`;
}

export function getLessonBySlug(slug: string): CourseLesson | undefined {
  return getSortedLessons().find((lesson) => lesson.slug === slug);
}

export function getLessonNeighbors(slug: string): {
  index: number;
  prev: CourseLesson | null;
  next: CourseLesson | null;
} {
  const lessons = getSortedLessons();
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
