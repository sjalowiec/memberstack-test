import { getLegacyCourses } from "../legacy_kin/legacyCourseLoader";

let courseNameByLegacyId: Map<number, string> | null = null;

function getCourseNameByLegacyIdMap(): Map<number, string> {
  if (!courseNameByLegacyId) {
    courseNameByLegacyId = new Map();
    for (const course of getLegacyCourses({ includeDrafts: true })) {
      courseNameByLegacyId.set(course.legacyChallengeId, course.title);
    }
  }
  return courseNameByLegacyId;
}

export function resolveLegacyCourseName(courseId: number): string | null {
  return getCourseNameByLegacyIdMap().get(courseId) ?? null;
}

/** Test helper - reset cached lookup between tests. */
export function resetLegacyCourseNameLookupCache(): void {
  courseNameByLegacyId = null;
}
