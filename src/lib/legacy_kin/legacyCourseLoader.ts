import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";

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
};

export type LegacyCourseRecord = CoursePreviewData & {
  sourceFile: string;
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

export function getSortedLessonsForCourse(
  course: CoursePreviewData,
): CourseLesson[] {
  return [...course.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getLegacyCourses(): LegacyCourseSummary[] {
  return loadAllCourseRecords()
    .map((record) => ({
      slug: record.course.slug,
      title: record.course.title,
      legacyChallengeId: record.course.legacyChallengeId,
      lessonCount: record.lessons.length,
      sourceFile: record.sourceFile,
      description:
        "description" in record.course &&
        typeof record.course.description === "string"
          ? record.course.description
          : undefined,
    }))
    .sort((a, b) => a.legacyChallengeId - b.legacyChallengeId);
}

export function getLegacyCourseBySlug(
  slug: string,
): LegacyCourseRecord | undefined {
  const normalized = slug.trim();
  if (!normalized) return undefined;
  return loadAllCourseRecords().find(
    (record) => record.course.slug === normalized,
  );
}

export function getLegacyLessonBySlug(
  courseSlug: string,
  lessonRef: string,
): CourseLesson | undefined {
  const course = getLegacyCourseBySlug(courseSlug);
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

export function getLegacyLessonNeighbors(
  courseSlug: string,
  lessonSlug: string,
): {
  index: number;
  prev: CourseLesson | null;
  next: CourseLesson | null;
} {
  const course = getLegacyCourseBySlug(courseSlug);
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
