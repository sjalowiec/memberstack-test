/**
 * Server-side Course 111 admin I/O (Node fs). Browser code must import
 * `course111AdminModel` instead of this module.
 */
import {
  getCourseContentPath,
  readCourseContentFile,
  saveLessonUpdate,
  writeCourseContentFile,
} from "./courseContentAdmin";
import {
  COURSE_111_ID,
  preserveCourse111Publication,
  type Course111PublicationSnapshot,
} from "./course111AdminModel";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";

export * from "./course111AdminModel";

export function loadCourse111(): CoursePreviewData {
  const data = readCourseContentFile(COURSE_111_ID);
  if (Number(data.course.legacyChallengeId) !== COURSE_111_ID) {
    throw new Error(
      `Expected Course ${COURSE_111_ID}, got ${data.course.legacyChallengeId}.`,
    );
  }
  return data;
}

export function getCourse111ContentPath(): string {
  return getCourseContentPath(COURSE_111_ID);
}

export function saveCourse111Lesson(
  lessonSlug: string,
  lesson: CourseLesson,
): { backupPath: string; lessonSlug: string } {
  const result = saveLessonUpdate(COURSE_111_ID, lessonSlug, lesson, {
    removeEmptyBlocks: false,
  });
  return {
    backupPath: result.backupPath,
    lessonSlug: result.lessonSlug,
  };
}

export function saveCourse111Document(
  data: CoursePreviewData,
  publication: Course111PublicationSnapshot,
): { backupPath: string } {
  if (Number(data.course.legacyChallengeId) !== COURSE_111_ID) {
    throw new Error("Refusing to save: course id is not 111.");
  }
  preserveCourse111Publication(data, publication);
  const backupPath = writeCourseContentFile(COURSE_111_ID, data);
  return { backupPath };
}
