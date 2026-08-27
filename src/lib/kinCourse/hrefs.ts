/** Same-origin KIN player routes. Reusable for every converted legacy course id. */

export function kinCourseHomeHref(courseId: number, preview = false): string {
  return withPreviewQuery(`/courses/${courseId}`, preview);
}

export function kinCourseContentsHref(courseId: number, preview = false): string {
  return withPreviewQuery(`/courses/${courseId}/contents`, preview);
}

export function kinCourseCompleteHref(courseId: number, preview = false): string {
  return withPreviewQuery(`/courses/${courseId}/complete`, preview);
}

export function kinCourseLessonHref(
  courseId: number,
  assignId: string | number,
  preview = false,
): string {
  return withPreviewQuery(`/courses/${courseId}/lesson/${assignId}`, preview);
}

export function withPreviewQuery(path: string, preview: boolean): string {
  if (!preview) return path;
  if (/[?&]preview=true(?:&|$)/.test(path)) return path;
  return path.includes("?") ? `${path}&preview=true` : `${path}?preview=true`;
}

export function parseKinCourseId(value: string | undefined | null): number | null {
  const trimmed = String(value ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number.parseInt(trimmed, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseAssignId(value: string | undefined | null): number | null {
  return parseKinCourseId(value);
}

export type KinCourseNavLink = {
  href: string;
  label: string;
};

export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function lessonPlainTitle(lesson: { title: string }): string {
  return stripHtml(lesson.title);
}

export function kinCourseLessonNavLinks(options: {
  courseId: number;
  preview: boolean;
  previous: { id: string | number; title: string } | null;
  next: { id: string | number; title: string } | null;
}): { previous: KinCourseNavLink | null; next: KinCourseNavLink } {
  const { courseId, preview, previous, next } = options;
  return {
    previous: previous
      ? {
          href: kinCourseLessonHref(courseId, previous.id, preview),
          label: `← ${stripHtml(previous.title)}`,
        }
      : null,
    next: next
      ? {
          href: kinCourseLessonHref(courseId, next.id, preview),
          label: `${stripHtml(next.title)} →`,
        }
      : {
          href: kinCourseCompleteHref(courseId, preview),
          label: "Finish Course →",
        },
  };
}
