/** Course metadata fields used for legacy course visibility. */
export type LegacyCoursePublicationFields = {
  status?: string;
  published?: boolean;
};

/**
 * True when a course should appear on public legacy course routes.
 * Hand-cleaned courses without status/published remain public for backward compatibility.
 */
export function isLegacyCoursePublic(
  course: LegacyCoursePublicationFields,
): boolean {
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
  return !isLegacyCoursePublic(course);
}
