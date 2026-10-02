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

/**
 * Draft preview adds ?preview=true to same-course lesson links stored without it.
 * Other courses and non-preview renders keep the stored href.
 */
export function appendSameCoursePreviewQuery(
  html: string,
  courseId: number,
  preview: boolean,
): string {
  if (!preview || !html) return html;
  return html.replace(
    /(<a\b[^>]*?\shref=)(["'])(\/courses\/(\d+)\/lesson\/\d+[^"']*)\2/gi,
    (match, prefix: string, quote: string, path: string, id: string) => {
      if (Number(id) !== Number(courseId)) return match;
      return `${prefix}${quote}${withPreviewQuery(path, true)}${quote}`;
    },
  );
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
