/** Course metadata fields used for legacy course visibility. */
export type LegacyCoursePublicationFields = {
  status?: string;
  published?: boolean;
  /** When false, the course is hidden from the public catalog and legacy routes. Omitted = active. */
  active?: boolean;
};

/** Lesson metadata fields used for per-lesson visibility. */
export type LegacyLessonPublicationFields = {
  /** When false, hidden from public lesson lists/routes. Omitted = visible. */
  published?: boolean;
};

/**
 * True when a lesson should appear on public legacy course navigation and routes.
 * Missing `published` defaults to visible for backward compatibility.
 */
export function isLegacyLessonPublished(
  lesson: LegacyLessonPublicationFields,
): boolean {
  return lesson.published !== false;
}

/** True when a course is enabled for public listing (catalog + routes when also published). */
export function isLegacyCourseActive(
  course: LegacyCoursePublicationFields,
): boolean {
  return course.active !== false;
}

/**
 * True when a course should appear on public legacy course routes.
 * Hand-cleaned courses without status/published remain public for backward compatibility.
 */
export function isLegacyCoursePublic(
  course: LegacyCoursePublicationFields,
): boolean {
  if (!isLegacyCourseActive(course)) return false;
  if (course.status === "draft") return false;
  if (course.published === false) return false;
  if (course.status === "published") return true;
  if (course.published === true) return true;
  return true;
}

/** True when a course is explicitly marked draft/unpublished. */
export function isLegacyCourseDraft(
  course: LegacyCoursePublicationFields,
): boolean {
  return !readLegacyCoursePublished(course);
}

/** Whether lesson content is published (ignores catalog active flag). */
export function readLegacyCoursePublished(
  course: LegacyCoursePublicationFields,
): boolean {
  if (course.status === "draft") return false;
  if (course.published === false) return false;
  if (course.status === "published") return true;
  if (course.published === true) return true;
  return true;
}
