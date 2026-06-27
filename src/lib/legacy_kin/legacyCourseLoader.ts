import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";
import {
  isLegacyCoursePublic,
  type LegacyCoursePublicationFields,
} from "./legacyCoursePublication";
import { isCoursePreviewProductionBlocked } from "./coursePreviewProductionAccess";
import type { DetectSiteEnvironmentOptions } from "../env/siteEnvironment";

export const LEGACY_COURSE_BASE = "/courses/legacy";

export const CLEANED_COURSE_DIR = join(
  process.cwd(),
  "src",
  "data",
  "legacy_kin",
  "cleaned",
);

export type LegacyCourseSummary = {
  slug: string;
  title: string;
  legacyChallengeId: number;
  lessonCount: number;
  sourceFile: string;
  description?: string;
  status?: string;
  published?: boolean;
  isDraft: boolean;
};

export type LegacyCourseRecord = CoursePreviewData & {
  sourceFile: string;
};

export type LegacyCourseLoadOptions = {
  /** When true, include draft/unpublished courses (admin preview). */
  includeDrafts?: boolean;
};

function cleanedPocFilenames(): string[] {
  if (!existsSync(CLEANED_COURSE_DIR)) return [];
  return readdirSync(CLEANED_COURSE_DIR)
    .filter((name) => name.endsWith(".poc.json"))
    .sort();
}

function readCourseFile(filename: string): LegacyCourseRecord | null {
  const path = join(CLEANED_COURSE_DIR, filename);
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as CoursePreviewData;
    if (!data?.course?.slug) return null;
    return { ...data, sourceFile: filename };
  } catch {
    return null;
  }
}

function loadAllCourseRecords(): LegacyCourseRecord[] {
  return cleanedPocFilenames()
    .map((filename) => readCourseFile(filename))
    .filter((record): record is LegacyCourseRecord => record !== null);
}

function recordIsVisible(
  record: LegacyCourseRecord,
  options: LegacyCourseLoadOptions = {},
): boolean {
  if (options.includeDrafts) return true;
  return isLegacyCoursePublic(record.course as LegacyCoursePublicationFields);
}

function toSummary(record: LegacyCourseRecord): LegacyCourseSummary {
  const course = record.course as LegacyCoursePublicationFields & {
    slug: string;
    title: string;
    legacyChallengeId: number;
    description?: string;
  };
  return {
    slug: course.slug,
    title: course.title,
    legacyChallengeId: course.legacyChallengeId,
    lessonCount: record.lessons.length,
    sourceFile: record.sourceFile,
    description:
      "description" in course && typeof course.description === "string"
        ? course.description
        : undefined,
    status: course.status,
    published: course.published,
    isDraft: !isLegacyCoursePublic(course),
  };
}

export function getSortedLessonsForCourse(
  course: CoursePreviewData,
): CourseLesson[] {
  return [...course.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getLegacyCourses(
  options: LegacyCourseLoadOptions = {},
): LegacyCourseSummary[] {
  return loadAllCourseRecords()
    .filter((record) => recordIsVisible(record, options))
    .map(toSummary)
    .sort((a, b) => a.legacyChallengeId - b.legacyChallengeId);
}

export function getLegacyCourseBySlug(
  slug: string,
  options: LegacyCourseLoadOptions = {},
): LegacyCourseRecord | undefined {
  const record = getLegacyCourseRecordBySlug(slug);
  if (!record || !recordIsVisible(record, options)) return undefined;
  return record;
}

/** Load course JSON by slug without publication/active filtering (course landing pages). */
export function getLegacyCourseRecordBySlug(slug: string): LegacyCourseRecord | undefined {
  const normalized = slug.trim();
  if (!normalized) return undefined;
  return loadAllCourseRecords().find((item) => item.course.slug === normalized);
}

export function getLegacyLessonBySlug(
  courseSlug: string,
  lessonRef: string,
  options: LegacyCourseLoadOptions = {},
): CourseLesson | undefined {
  const course = getLegacyCourseBySlug(courseSlug, options);
  if (!course) return undefined;

  const lessons = getSortedLessonsForCourse(course);
  const ref = lessonRef.trim();
  if (!ref) return undefined;

  const bySlug = lessons.find((lesson) => lesson.slug === ref);
  if (bySlug) return bySlug;

  if (/^\d+$/.test(ref)) {
    const numeric = Number.parseInt(ref, 10);
    const byDisplayOrder = lessons.find(
      (lesson) => lesson.displayOrder === numeric,
    );
    if (byDisplayOrder) return byDisplayOrder;

    const zeroBasedIndex = numeric;
    if (zeroBasedIndex >= 0 && zeroBasedIndex < lessons.length) {
      return lessons[zeroBasedIndex];
    }
  }

  return undefined;
}

export function legacyCourseHref(courseSlug: string): string {
  return `${LEGACY_COURSE_BASE}/${encodeURIComponent(courseSlug)}`;
}

export function legacyLessonHref(
  courseSlug: string,
  lessonSlug: string,
): string {
  return `${legacyCourseHref(courseSlug)}/${encodeURIComponent(lessonSlug)}`;
}

export function legacyLessonItemHref(
  courseSlug: string,
  lessonSlug: string,
  itemSlug: string,
): string {
  return `${legacyLessonHref(courseSlug, lessonSlug)}/${encodeURIComponent(itemSlug)}`;
}

export type LegacyCoursePreviewHrefOptions = {
  /** When true, append ?preview=true so draft courses load on staging/dev. */
  includeDraftPreview?: boolean;
  /** Open a specific lesson section/item instead of the lesson overview. */
  itemSlug?: string | null;
};

/**
 * Customer-facing preview URL for the course content admin Preview button.
 * Returns null when courseSlug is empty.
 */
export function legacyCoursePreviewHref(
  courseSlug: string,
  lessonSlug?: string | null,
  options: LegacyCoursePreviewHrefOptions = {},
): string | null {
  const normalizedCourseSlug = courseSlug.trim();
  if (!normalizedCourseSlug) return null;

  const normalizedLessonSlug = lessonSlug?.trim();
  const normalizedItemSlug = options.itemSlug?.trim();

  let path: string;
  if (normalizedLessonSlug && normalizedItemSlug) {
    path = legacyLessonItemHref(
      normalizedCourseSlug,
      normalizedLessonSlug,
      normalizedItemSlug,
    );
  } else if (normalizedLessonSlug) {
    path = legacyLessonHref(normalizedCourseSlug, normalizedLessonSlug);
  } else {
    path = legacyCourseHref(normalizedCourseSlug);
  }

  if (options.includeDraftPreview) {
    return `${path}?preview=true`;
  }
  return path;
}

export function getLegacyLessonNeighbors(
  courseSlug: string,
  lessonSlug: string,
  options: LegacyCourseLoadOptions = {},
): {
  index: number;
  prev: CourseLesson | null;
  next: CourseLesson | null;
} {
  const course = getLegacyCourseBySlug(courseSlug, options);
  if (!course) {
    return { index: -1, prev: null, next: null };
  }

  const lessons = getSortedLessonsForCourse(course);
  const index = lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  if (index < 0) {
    return { index: -1, prev: null, next: null };
  }

  return {
    index,
    prev: index > 0 ? lessons[index - 1] : null,
    next: index < lessons.length - 1 ? lessons[index + 1] : null,
  };
}

/** Allow draft preview on staging/dev when `?preview=true`. */
export function legacyCourseLoadOptionsFromPreviewRequest(
  previewParam: string | null | undefined,
  hostname: string | null | undefined,
  env: DetectSiteEnvironmentOptions = {},
): LegacyCourseLoadOptions {
  if (previewParam !== "true") return {};
  if (isCoursePreviewProductionBlocked(hostname, env)) return {};
  return { includeDrafts: true };
}
