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
    expect(parseKinCourseId("86")).toBe(86);
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

  it("keeps Course 111 ActivePresenter components pending", () => {
    const poc = readCourseContentFile(COURSE_111_ID);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const pending = flattenLessons(course).flatMap((lesson) =>
      lesson.components.filter((component) => component.pending),
    );
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((component) => component.legacyType === "ActivePresenter")).toBe(true);
    expect(pending.some((component) => component.type === "vimeoJumpLinks")).toBe(false);
    expect(pending.some((component) => component.type === "hotspot")).toBe(false);
  });

  it("maps Course 86 VimeoJumpLinks and Hotspot onto native player components", () => {
    const poc = readCourseContentFile(86);
    const course = pocToKinCourse(poc, { includeDrafts: true });
    const unbox = findLesson(course, 4212);
    expect(unbox?.title).toMatch(/unbox/i);
    const jump = unbox?.components.find((component) => component.type === "vimeoJumpLinks");
    expect(jump?.pending).toBeUndefined();
    expect(jump?.vimeoId).toBe("526615684");
    expect(jump?.jumps?.some((item) => item.title === "The term Mid-Gauge?" && item.time === "00:00:12")).toBe(
      true,
    );

    const terms = findLesson(course, 4231);
    const hotspot = terms?.components.find((component) => component.type === "hotspot");
    expect(hotspot?.pending).toBeUndefined();
    expect(hotspot?.image).toBe("/challenge/images/v2/86/taitexma_main_spott1.jpg");
    expect(hotspot?.spots?.some((spot) => spot.text === "Yarn Mast Assembly" && spot.style?.includes("top:"))).toBe(
      true,
    );
    expect(hotspot?.spots).toHaveLength(8);
  });
});
