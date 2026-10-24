import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifiedHomeStudyPlaybackCourse } from "../../config/homeStudyCourseMap";
import { getCourseAccessBySlug } from "../coursesCatalogAccess";
import { readCourseContentFile } from "../legacy_kin/courseContentAdmin";
import { publishedAvailablePlayerHref } from "../legacy_kin/publishedCoursePlayerHref";
import { courseCheckoutPriceId } from "./coursePurchase";
import { kinCourseLessonHref } from "./hrefs";
import { loadKinCourseBundle } from "./load";
import { findLesson, flattenLessons, getLessonContext } from "./player";

const COURSE_ID = 66;

const LESSON_TITLES = [
  "Get Started",
  "Casting On",
  "Swatching on the Double Bed",
  "Binding Off",
  "Practice Makes Progress",
  "Troubleshooting Tips",
  "Knitting in the Round",
  "Full Needle Rib",
  "Practice Makes Progress",
  "Flat Ribs",
  "Shaping in Ribbing",
  "Tuck Rib",
  "Bands, Belts and Straps",
];

describe("Course 66 Ribber Basic Bootcamp review", () => {
  it("restores the export lesson order and opens the current player", async () => {
    const poc = readCourseContentFile(COURSE_ID);
    expect(poc.course.legacyChallengeId).toBe(66);
    expect(poc.course.title).toBe("Ribber Basic Bootcamp");
    expect(poc.course.slug).toBe("ribber-basic-bootcamp");
    expect(poc.course.status).toBe("published");
    expect(poc.course.published).toBe(true);
    expect(poc.course.contentStatus).toBe("cleaned");
    expect(poc.course.legacy.contentRevision).toBe(1);
    expect(poc.lessons.map((lesson) => lesson.title)).toEqual(LESSON_TITLES);

    expect(getCourseAccessBySlug("ribber-basic-bootcamp")).toBe("member");
    expect(courseCheckoutPriceId("ribber-basic-bootcamp")).toBeNull();
    expect(courseCheckoutPriceId("66")).toBeNull();
    expect(publishedAvailablePlayerHref("ribber-basic-bootcamp")).toBe("/courses/66");
    expect(verifiedHomeStudyPlaybackCourse(26)).toBeNull();
    expect(verifiedHomeStudyPlaybackCourse(66)).toBeNull();

    const bundle = await loadKinCourseBundle(COURSE_ID);
    expect(bundle?.course.id).toBe(66);
    expect(bundle?.course.title).toBe("Ribber Basic Bootcamp");
    const lessons = flattenLessons(bundle!.course);
    expect(lessons.map((lesson) => lesson.id)).toEqual([
      3908, 3835, 3911, 3926, 3907, 3909, 3910, 3912, 3913, 3914, 3916, 3917, 3918,
      3919, 3920, 4321, 3921, 3922, 3923, 3924, 3925,
    ]);
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);

    const bindingOff = findLesson(bundle!.course, 3913);
    expect(bindingOff?.title).toBe("More Bind Off Options");
    expect(
      bindingOff?.components.filter((component) => component.type === "vimeo").map((component) => component.vimeoId),
    ).toEqual(["258782290", "151859282", "151858966"]);

    const context = getLessonContext(bundle!.course, 3908, false);
    expect(context?.nextNav.href).toBe(kinCourseLessonHref(66, 3835));
    expect(lessons.some((lesson) => lesson.components.some((component) => component.type === "vimeo"))).toBe(
      true,
    );
    expect(
      lessons.some((lesson) =>
        lesson.components.some((component) => component.filename === "/downloads/ribber_basics_bootcamp.pdf"),
      ),
    ).toBe(true);
  });

  it("serves recovered images and both downloads from public files", () => {
    const poc = readCourseContentFile(COURSE_ID);
    const text = JSON.stringify(poc);
    expect(text).toContain("/images/course-content/66/expert_beginner.gif");
    expect(text).toContain("/images/course-content/66/flat_rib_challenges.jpg");
    expect(text).not.toContain("/challenge/");
    expect(text).toContain("/downloads/ribber_basics_bootcamp.pdf");
    expect(text).toContain("/downloads/flat_rib_challenges.pdf");
    for (const path of [
      "public/images/course-content/66/expert_beginner.gif",
      "public/images/course-content/66/flat_rib_challenges.jpg",
      "public/images/courses/ribber.webp",
      "public/downloads/ribber_basics_bootcamp.pdf",
      "public/downloads/flat_rib_challenges.pdf",
    ]) {
      expect(existsSync(join(process.cwd(), path))).toBe(true);
    }
  });
});
