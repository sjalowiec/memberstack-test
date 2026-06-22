import { describe, expect, it } from "vitest";
import {
  applyComponentRemovals,
  applyRichTextUpdates,
  findEmptyBlockSlugs,
  removeEmptyBlocksFromLesson,
  saveLessonUpdate,
  validateLessonInput,
} from "./courseContentAdmin";
import type { CoursePreviewData } from "./coursePreviewPoc";

function sampleCourse(): CoursePreviewData {
  return {
    course: {
      legacyChallengeId: 50,
      title: "Test course",
      slug: "test-course",
      legacy: { sourceExport: "test.json" },
    },
    lessons: [
      {
        title: "Lesson one",
        slug: "lesson-one",
        displayOrder: 1,
        legacy: { itemId: 1, lessonOrder: 1 },
        blocks: [
          {
            title: "Intro text",
            slug: "intro-text",
            order: 1,
            legacy: { assignId: 100, blockType: "HTML" },
            components: [
              {
                type: "richText",
                html: "<p>Hello</p>",
                legacyComponentId: 1,
                order: 1,
              },
            ],
          },
          {
            title: "Duplicate video",
            slug: "duplicate-video",
            order: 2,
            legacy: { assignId: 101, blockType: "Video" },
            components: [
              {
                type: "video",
                vimeoId: "347816973",
                title: "Watch this",
                legacyComponentId: 2,
                order: 1,
              },
            ],
          },
          {
            title: "Mixed block",
            slug: "mixed-block",
            order: 3,
            legacy: { assignId: 102, blockType: "HTML" },
            components: [
              {
                type: "video",
                vimeoId: "240407950",
                title: null,
                legacyComponentId: 3,
                order: 1,
              },
              {
                type: "richText",
                html: "<p>After video</p>",
                legacyComponentId: 4,
                order: 2,
              },
            ],
          },
          {
            title: "Shared legacy id",
            slug: "shared-legacy-id",
            order: 4,
            legacy: { assignId: 103, blockType: "HTML" },
            components: [
              {
                type: "richText",
                html: "<p>Embedded video copy</p>",
                legacyComponentId: 5160,
                order: 1,
              },
              {
                type: "video",
                vimeoId: "347816973",
                title: null,
                legacySource: "embedded-html",
                legacyComponentId: 5160,
                order: 1,
              },
            ],
          },
        ],
      },
      {
        title: "Lesson two",
        slug: "lesson-two",
        displayOrder: 2,
        legacy: { itemId: 2, lessonOrder: 2 },
        blocks: [
          {
            title: "Other lesson block",
            slug: "other-block",
            order: 1,
            legacy: { assignId: 200, blockType: "HTML" },
            components: [
              {
                type: "richText",
                html: "<p>Other lesson</p>",
                legacyComponentId: 99,
                order: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("applyComponentRemovals", () => {
  it("removes a standalone video block when it is the only component", () => {
    const data = sampleCourse();
    const result = applyComponentRemovals(data, [
      {
        lessonSlug: "lesson-one",
        blockSlug: "duplicate-video",
        legacyComponentId: 2,
        type: "video",
      },
    ]);

    expect(result.applied).toBe(1);
    expect(result.missing).toEqual([]);
    expect(data.lessons[0]!.blocks).toHaveLength(3);
    expect(data.lessons[0]!.blocks.some((block) => block.slug === "duplicate-video")).toBe(
      false,
    );
  });

  it("does not remove richText when video shares the same legacyComponentId", () => {
    const data = sampleCourse();
    const result = applyComponentRemovals(data, [
      {
        lessonSlug: "lesson-one",
        blockSlug: "shared-legacy-id",
        legacyComponentId: 5160,
        type: "video",
      },
    ]);

    expect(result.applied).toBe(1);
    const block = data.lessons[0]!.blocks.find((item) => item.slug === "shared-legacy-id");
    expect(block?.components).toHaveLength(1);
    expect(block?.components[0]?.type).toBe("richText");
  });
});

describe("applyRichTextUpdates", () => {
  it("updates richText HTML independently of removals", () => {
    const data = sampleCourse();
    const result = applyRichTextUpdates(data, [
      {
        lessonSlug: "lesson-one",
        blockSlug: "intro-text",
        legacyComponentId: 1,
        html: "<p>Updated</p>",
      },
    ]);

    expect(result.applied).toBe(1);
    const richText = data.lessons[0]!.blocks[0]!.components[0];
    expect(richText.type).toBe("richText");
    if (richText.type === "richText") {
      expect(richText.html).toBe("<p>Updated</p>");
    }
  });
});

describe("validateLessonInput", () => {
  it("accepts a valid lesson object", () => {
    const lesson = sampleCourse().lessons[0]!;
    const result = validateLessonInput(lesson);
    expect(result).not.toHaveProperty("error");
  });

  it("rejects invalid lesson JSON", () => {
    const result = validateLessonInput({ title: "Missing fields" });
    expect(result).toEqual({ error: "Lesson requires a non-empty slug string." });
  });
});

describe("removeEmptyBlocksFromLesson", () => {
  it("removes blocks with no components", () => {
    const lesson = sampleCourse().lessons[0]!;
    lesson.blocks.push({
      title: "Empty",
      slug: "empty-block",
      order: 99,
      legacy: { assignId: 999, blockType: "HTML" },
      components: [],
    });

    const result = removeEmptyBlocksFromLesson(lesson);
    expect(result.removedBlockSlugs).toEqual(["empty-block"]);
    expect(result.lesson.blocks.some((block) => block.slug === "empty-block")).toBe(false);
  });
});

describe("findEmptyBlockSlugs", () => {
  it("lists empty block slugs without mutating", () => {
    const lesson = sampleCourse().lessons[0]!;
    lesson.blocks.push({
      title: "Empty",
      slug: "empty-block",
      order: 99,
      legacy: { assignId: 999, blockType: "HTML" },
      components: [],
    });

    expect(findEmptyBlockSlugs(lesson)).toEqual(["empty-block"]);
    expect(lesson.blocks).toHaveLength(5);
  });
});

describe("saveLessonUpdate", () => {
  it("rejects invalid lesson JSON before writing", () => {
    expect(() =>
      saveLessonUpdate(50, "lesson-one", { title: "Broken lesson" }),
    ).toThrow("Lesson requires a non-empty slug string.");
  });
});
