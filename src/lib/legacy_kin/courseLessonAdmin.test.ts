import { describe, expect, it } from "vitest";
import type { CoursePreviewData } from "./coursePreviewPoc";
import {
  createNewLesson,
  renumberLessonOrders,
  sortedCourseLessons,
  validateLessonList,
} from "./courseLessonAdmin";

function sampleCourse(): CoursePreviewData {
  return {
    course: {
      legacyChallengeId: 99,
      title: "Test",
      slug: "test",
      legacy: { sourceExport: "test.json" },
    },
    lessons: [
      {
        title: "First",
        slug: "first",
        displayOrder: 10,
        legacy: { itemId: 1, lessonOrder: 10 },
        blocks: [
          {
            title: "Block",
            slug: "block-a",
            order: 1,
            legacy: { assignId: 100, blockType: "HTML" },
            components: [
              {
                type: "richText",
                html: "<p>One</p>",
                legacyComponentId: 1000,
                order: 1,
              },
            ],
          },
        ],
      },
      {
        title: "Second",
        slug: "second",
        displayOrder: 20,
        legacy: { itemId: 2, lessonOrder: 20 },
        blocks: [],
      },
    ],
  };
}

describe("sortedCourseLessons", () => {
  it("sorts by displayOrder", () => {
    const sorted = sortedCourseLessons(sampleCourse());
    expect(sorted.map((lesson) => lesson.slug)).toEqual(["first", "second"]);
  });
});

describe("renumberLessonOrders", () => {
  it("assigns sequential displayOrder and lessonOrder values", () => {
    const lessons = renumberLessonOrders(sampleCourse().lessons);
    expect(lessons.map((lesson) => lesson.displayOrder)).toEqual([1, 2]);
    expect(lessons.map((lesson) => lesson.legacy.lessonOrder)).toEqual([1, 2]);
    expect(lessons[0]?.legacy.itemId).toBe(1);
  });
});

describe("validateLessonList", () => {
  it("rejects empty lesson lists", () => {
    expect(validateLessonList([])).toMatch(/at least one lesson/i);
  });

  it("accepts valid lessons", () => {
    expect(validateLessonList(sampleCourse().lessons)).toBeNull();
  });

  it("rejects duplicate slugs", () => {
    const lessons = sampleCourse().lessons;
    const duplicate = { ...lessons[1]!, slug: "first" };
    expect(validateLessonList([lessons[0]!, duplicate])).toMatch(/Duplicate lesson slug/);
  });
});

describe("createNewLesson", () => {
  it("creates an empty lesson with generated ids", () => {
    const lesson = createNewLesson(sampleCourse().lessons);
    expect(lesson.title).toBe("New Lesson");
    expect(lesson.blocks).toEqual([]);
    expect(lesson.displayOrder).toBe(3);
    expect(lesson.legacy.itemId).toBe(3);
    expect(lesson.slug).toMatch(/^lesson-\d+$/);
  });
});
