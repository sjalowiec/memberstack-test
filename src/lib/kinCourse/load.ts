import { isAllowedCourseId, readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { isLegacyCoursePublic } from "../legacy_kin/legacyCoursePublication";
import { pocToKinCourse } from "./pocToKinCourse";
import { flattenLessons } from "./player";
import { buildKinCourseLanding, readKinCoursePresentation } from "./presentation";
import { readKinCourseGlossary } from "./htmlPresent";
import type { KinCourseDocument, KinCourseLanding, KinCoursePresentation } from "./types";
import type { KinCourseGlossaryEntry } from "./htmlPresent";

export type KinCourseBundle = {
  course: KinCourseDocument;
  landing: KinCourseLanding;
  presentation: KinCoursePresentation;
  glossary: KinCourseGlossaryEntry[];
};

export async function loadKinCourseBundle(
  courseId: number,
  options: { includeDrafts?: boolean } = {},
): Promise<KinCourseBundle | null> {
  if (!Number.isFinite(courseId) || courseId <= 0 || !isAllowedCourseId(courseId)) {
    return null;
  }

  let poc;
  try {
    poc = readCourseContentFile(courseId);
  } catch {
    return null;
  }

  const includeDrafts = options.includeDrafts === true;
  if (!includeDrafts && !isLegacyCoursePublic(poc.course)) {
    return null;
  }

  const course = pocToKinCourse(poc, { includeDrafts });
  if (flattenLessons(course).length === 0) return null;

  return {
    course,
    landing: buildKinCourseLanding(course),
    presentation: readKinCoursePresentation(course.id),
    glossary: readKinCourseGlossary(course.id),
  };
}
