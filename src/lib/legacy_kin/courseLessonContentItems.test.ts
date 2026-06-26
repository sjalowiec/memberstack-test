import { describe, expect, it } from "vitest";
import course2 from "../../data/legacy_kin/cleaned/course_2_not_enough_needles.poc.json";
import course50 from "../../data/legacy_kin/cleaned/course_50_lk150_quick.poc.json";
import type { CourseLesson } from "./coursePreviewPoc";
import {
  contentItemDisplayTitle,
  findLessonContentItemBySlug,
  flattenLessonContent,
  getLessonContentItemsWithSlugs,
  getLessonContentNavEntries,
} from "./courseLessonContentItems";
import { validateLessonForPublicRenderer } from "./courseLessonPublicRenderer";

function findLesson(course: { lessons: CourseLesson[] }, slug: string): CourseLesson {
  const lesson = course.lessons.find((item) => item.slug === slug);
  if (!lesson) throw new Error(`Lesson not found: ${slug}`);
  return lesson;
}

describe("courseLessonContentItems", () => {
  it("assigns stable public slugs for LK-150 lesson 2 sections", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const slugs = getLessonContentItemsWithSlugs(lesson).map((item) => item.itemSlug);

    expect(findLessonContentItemBySlug(lesson, "yarn-and-tension")).toBeDefined();
    expect(findLessonContentItemBySlug(lesson, "needle-positions")).toBeDefined();
    expect(findLessonContentItemBySlug(lesson, "carriage-settings")).toBeDefined();
    expect(slugs).toContain("yarn-and-tension");
    expect(slugs).toContain("needle-positions");
    expect(slugs).toContain("carriage-settings");
  });

  it("sidebar nav includes one link per flattened item", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const nav = getLessonContentNavEntries(lesson);
    const items = flattenLessonContent(lesson);

    expect(nav.length).toBe(items.length);
    expect(nav.every((entry) => entry.itemSlug.length > 0)).toBe(true);
    expect(nav.map((entry) => entry.title)).toContain("Yarn and Tension");
    expect(nav.map((entry) => entry.title)).toContain("Needle Positions");
  });

  it("disambiguates multiple items in the same block", () => {
    const lesson = findLesson(course50, "yarn-and-a-bit-more-tech");
    const coneItems = getLessonContentItemsWithSlugs(lesson).filter(
      (item) => item.blockSlug === "do-you-need-yarn-on-cones",
    );

    expect(coneItems.length).toBeGreaterThan(1);
    expect(new Set(coneItems.map((item) => item.itemSlug)).size).toBe(coneItems.length);
  });

  it("Course 2 Decorative Seams resolves hairpin-lace-seam item slug", () => {
    const lesson = findLesson(course2, "decorative-seams");
    const result = validateLessonForPublicRenderer(lesson);

    expect(result.rendererPassed).toBe(true);
    expect(findLessonContentItemBySlug(lesson, "hairpin-lace-seam")).toBeDefined();
    expect(
      contentItemDisplayTitle(lesson, findLessonContentItemBySlug(lesson, "hairpin-lace-seam")!),
    ).toBe("Hairpin Lace Seam");
  });
});
