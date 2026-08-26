import {
  kinCourseLessonNavLinks,
  type KinCourseNavLink,
} from "./hrefs";
import type { KinCourseDocument, KinCourseLesson, KinCourseSection } from "./types";

export function visibleSections(course: KinCourseDocument): KinCourseSection[] {
  return course.sections.filter((section) => !section.empty && section.lessons.length > 0);
}

export function flattenLessons(course: KinCourseDocument): KinCourseLesson[] {
  return visibleSections(course).flatMap((section) => section.lessons);
}

export function findLesson(
  course: KinCourseDocument,
  assignId: string | number,
): KinCourseLesson | undefined {
  const id = Number(assignId);
  return flattenLessons(course).find((lesson) => lesson.id === id);
}

export function firstLesson(course: KinCourseDocument): KinCourseLesson | null {
  return flattenLessons(course)[0] ?? null;
}

export function paddedSectionNumber(order: number): string {
  return String(order).padStart(2, "0");
}

export function courseHeading(course: KinCourseDocument): {
  title: string;
  subtitle: string | null;
} {
  const raw = course.title.trim();
  const separator = raw.indexOf(":");
  if (separator > 0) {
    return {
      title: raw.slice(0, separator).trim(),
      subtitle: raw.slice(separator + 1).trim() || null,
    };
  }
  return { title: raw, subtitle: null };
}

export type KinLessonContext = {
  lesson: KinCourseLesson;
  section: KinCourseSection;
  lessonNumber: number;
  lessonCount: number;
  previous: KinCourseLesson | null;
  next: KinCourseLesson | null;
  previousNav: KinCourseNavLink | null;
  nextNav: KinCourseNavLink;
};

export function getLessonContext(
  course: KinCourseDocument,
  assignId: string | number,
  preview: boolean,
): KinLessonContext | null {
  const lessons = flattenLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === Number(assignId));
  if (index < 0) return null;
  const current = lessons[index]!;
  const section = visibleSections(course).find((item) =>
    item.lessons.some((lesson) => lesson.id === current.id),
  );
  if (!section) return null;
  const lessonNumber = section.lessons.findIndex((lesson) => lesson.id === current.id) + 1;
  const previous = index > 0 ? lessons[index - 1]! : null;
  const next = index < lessons.length - 1 ? lessons[index + 1]! : null;
  const { previous: previousNav, next: nextNav } = kinCourseLessonNavLinks({
    courseId: course.id,
    preview,
    previous,
    next,
  });
  return {
    lesson: current,
    section,
    lessonNumber,
    lessonCount: section.lessons.length,
    previous,
    next,
    previousNav,
    nextNav,
  };
}

export function visibleLessonComponents(
  lesson: KinCourseLesson,
  hidden: Array<{ lessonId: number; type: string }> = [],
): KinCourseLesson["components"] {
  const hiddenTypes = new Set(
    hidden.filter((rule) => rule.lessonId === lesson.id).map((rule) => rule.type),
  );
  return [...lesson.components]
    .sort((a, b) => a.order - b.order)
    .filter((component) => !hiddenTypes.has(component.type));
}
