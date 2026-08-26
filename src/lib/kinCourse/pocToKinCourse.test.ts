import { describe, expect, it } from "vitest";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { COURSE_111_ID } from "../legacy_kin/course111AdminModel";
import {
  kinCourseCompleteHref,
  kinCourseContentsHref,
  kinCourseHomeHref,
  kinCourseLessonHref,
  parseKinCourseId,
} from "./hrefs";
import { pocToKinCourse, findPocBlockByAssignId } from "./pocToKinCourse";
import { findLesson, flattenLessons } from "./player";

describe("kin course hrefs", () => {
  it("builds same-origin numeric player routes", () => {
    expect(kinCourseHomeHref(111, true)).toBe("/courses/111?preview=true");
    expect(kinCourseLessonHref(111, 6085, true)).toBe("/courses/111/lesson/6085?preview=true");
    expect(kinCourseContentsHref(64)).toBe("/courses/64/contents");
    expect(kinCourseCompleteHref(111, true)).toBe("/courses/111/complete?preview=true");
    expect(parseKinCourseId("111")).toBe(111);
    expect(parseKinCourseId("mastering-the-silver-reed-sk840")).toBeNull();
  });
});

describe("pocToKinCourse", () => {
  it("maps Course 111 POC blocks onto assignId lessons", () => {
    const poc = readCourseContentFile(COURSE_111_ID);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    expect(course.id).toBe(111);
    const lessons = flattenLessons(course);
    expect(lessons.length).toBeGreaterThan(10);
    const manuals = findPocBlockByAssignId(poc, 6085);
    expect(manuals).toMatchObject({ assignId: 6085 });
    expect(findLesson(course, 6085)?.title.toLowerCase()).toContain("manual");
    const htmlLesson = lessons.find((lesson) =>
      lesson.components.some((component) => component.type === "html" && component.html),
    );
    expect(htmlLesson).toBeTruthy();
  });
});
