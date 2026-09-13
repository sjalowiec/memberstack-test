import {
  isAllowedCourseId,
  loadCourseContentDocument,
  readCourseContentFile,
} from "../legacy_kin/courseContentAdmin";
import type { CourseContentWriteOptions } from "../legacy_kin/courseContentPersist";
import { isLegacyCoursePublic } from "../legacy_kin/legacyCoursePublication";
import { pocToKinCourse } from "./pocToKinCourse";
import { flattenLessons } from "./player";
import { buildKinCourseLanding, readKinCoursePresentation } from "./presentation";
import { readKinCourseGlossary } from "./htmlPresent";
import type { KinCourseDocument, KinCourseLanding, KinCoursePresentation } from "./types";
import type { KinCourseGlossaryEntry } from "./htmlPresent";
import type { CoursePreviewData } from "../legacy_kin/coursePreviewPoc";

export type KinCourseBundle = {
  course: KinCourseDocument;
  landing: KinCourseLanding;
  presentation: KinCoursePresentation;
  glossary: KinCourseGlossaryEntry[];
};

/**
 * On deployed DEV, Watson lesson saves live in a blob overlay. That overlay can
 * still be draft after the git file is published. Public player routes should
 * keep serving the bundled published course instead of 404ing.
 */
async function loadPlayerCourseDocument(
  courseId: number,
  options: CourseContentWriteOptions & { includeDrafts?: boolean },
): Promise<CoursePreviewData> {
  const poc = await loadCourseContentDocument(courseId, options);
  if (options.includeDrafts === true || isLegacyCoursePublic(poc.course)) {
    return poc;
  }
  try {
    const bundled = readCourseContentFile(courseId);
    if (isLegacyCoursePublic(bundled.course)) return bundled;
  } catch {
    // Keep the unpublished overlay/document; the caller 404s.
  }
  return poc;
}

export async function loadKinCourseBundle(
  courseId: number,
  options: CourseContentWriteOptions & { includeDrafts?: boolean } = {},
): Promise<KinCourseBundle | null> {
  if (!Number.isFinite(courseId) || courseId <= 0 || !isAllowedCourseId(courseId)) {
    return null;
  }

  let poc;
  try {
    poc = await loadPlayerCourseDocument(courseId, options);
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
