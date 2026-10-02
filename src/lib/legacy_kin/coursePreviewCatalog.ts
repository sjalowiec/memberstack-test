/**
 * Dev preview reads the same cleaned course files the editor saves.
 * Kept out of coursePreviewPoc.ts so the editor bundle does not import those
 * JSON files and reload in the middle of Save.
 */
import { readCourseContentFile } from "./courseContentAdmin";
import {
  COURSE_PREVIEW_BASE,
  DEFAULT_PREVIEW_COURSE_ID,
  SECTION_QUERY_PARAM,
  type CourseLesson,
  type CoursePreviewData,
} from "./coursePreviewPoc";

const DEV_PREVIEW_COURSE_IDS = [50, 51];

export function getPreviewCourseIds(): number[] {
  return DEV_PREVIEW_COURSE_IDS.filter((courseId) => getCoursePreviewData(courseId) != null);
}

export function getCoursePreviewData(courseId: number): CoursePreviewData | undefined {
  if (!DEV_PREVIEW_COURSE_IDS.includes(courseId)) return undefined;
  try {
    return readCourseContentFile(courseId);
  } catch {
    return undefined;
  }
}

export function parseCourseId(value: string | number | null | undefined): number {
  const parsed = Number.parseInt(String(value ?? DEFAULT_PREVIEW_COURSE_ID), 10);
  if (!Number.isFinite(parsed) || !getCoursePreviewData(parsed)) {
    return DEFAULT_PREVIEW_COURSE_ID;
  }
  return parsed;
}

export function getSortedLessons(courseId: number = DEFAULT_PREVIEW_COURSE_ID): CourseLesson[] {
  const data = getCoursePreviewData(parseCourseId(courseId));
  if (!data) return [];
  return [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function coursePreviewHref(courseId: number = DEFAULT_PREVIEW_COURSE_ID): string {
  return `${COURSE_PREVIEW_BASE}/${parseCourseId(courseId)}`;
}

export function lessonPreviewHref(courseId: number, slug: string): string {
  return `${coursePreviewHref(courseId)}/${slug}`;
}

export function getLessonBySlug(courseId: number, slug: string): CourseLesson | undefined {
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
    prev: index > 0 ? lessons[index - 1]! : null,
    next: index < lessons.length - 1 ? lessons[index + 1]! : null,
  };
}

export function lessonPreviewSectionHref(
  courseId: number,
  slug: string,
  oneBasedSection: number,
): string {
  return `${lessonPreviewHref(courseId, slug)}?${SECTION_QUERY_PARAM}=${oneBasedSection}`;
}
