import { describe, expect, it } from "vitest";
import {
  appendStandaloneComponentBlock,
  createRichTextComponent,
  moveSectionAtIndex,
} from "./courseContentEditorBlocks";
import {
  blockTitleForEditing,
  buildContentListGroups,
  countLessonSectionsAndBlocks,
  formatLessonSidebarMeta,
  formatSectionBlockCount,
  resolveExpandedSectionSlug,
  sectionGroupMetaLabel,
  sectionNavLabel,
  sectionTitleForBlock,
} from "./courseContentEditorView";
import { flattenLessonContent } from "./courseLessonContentItems";
import type { CourseLesson } from "./coursePreviewPoc";

function cloneLesson(lesson: CourseLesson): CourseLesson {
  return JSON.parse(JSON.stringify(lesson)) as CourseLesson;
}

describe("courseContentEditorView", () => {
  it("loads an existing multi-section lesson with correct counts", () => {
    const lesson: CourseLesson = {
      title: "Cast On Methods",
      slug: "cast-on",
      displayOrder: 4,
      legacy: { itemId: 4, lessonOrder: 4 },
      blocks: [
        {
          title: "Intro",
          slug: "intro",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>Hello</p>", legacyComponentId: 1, order: 1 },
            { type: "video", vimeoId: "123", title: null, legacyComponentId: 2, order: 2 },
          ],
        },
        {
          title: "Wrap",
          slug: "wrap",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>Wrap</p>", legacyComponentId: 3, order: 1 },
          ],
        },
      ],
    };

    expect(countLessonSectionsAndBlocks(lesson)).toEqual({
      sectionCount: 2,
      blockCount: 2,
    });
    expect(formatLessonSidebarMeta(2, 2)).toBe("2 sections \u00b7 2 blocks");

    const items = flattenLessonContent(lesson);
    const groups = buildContentListGroups(lesson, items);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.blockTitle).toBe("Intro");
    expect(groups[0]!.blockCount).toBe(1);
    expect(groups[1]!.blockCount).toBe(1);
    expect(sectionGroupMetaLabel(groups[0]!)).toBe("Combined layout");
  });

  it("resolves expanded section for outline navigation", () => {
    const groups = [
      { blockSlug: "intro", blockTitle: "Intro", sectionNumber: 1, totalSections: 2, canSplit: false, isLayout: false, blockCount: 1, entries: [] },
      { blockSlug: "wrap", blockTitle: "Wrap", sectionNumber: 2, totalSections: 2, canSplit: false, isLayout: false, blockCount: 1, entries: [] },
    ];

    expect(
      resolveExpandedSectionSlug(groups, {
        currentExpanded: null,
        selectedBlockSectionSlug: null,
      }),
    ).toBe("intro");

    expect(
      resolveExpandedSectionSlug(groups, {
        currentExpanded: "intro",
        selectedBlockSectionSlug: "wrap",
      }),
    ).toBe("intro");

    expect(
      resolveExpandedSectionSlug(groups, {
        currentExpanded: null,
        selectedBlockSectionSlug: "wrap",
      }),
    ).toBe("wrap");

    expect(
      resolveExpandedSectionSlug(groups, {
        currentExpanded: "missing",
        selectedBlockSectionSlug: null,
      }),
    ).toBe("intro");
  });

  it("formats section outline labels", () => {
    expect(formatSectionBlockCount(0)).toBe("No blocks");
    expect(formatSectionBlockCount(1)).toBe("1 block");
    expect(formatSectionBlockCount(3)).toBe("3 blocks");
    expect(sectionNavLabel("")).toBe("Untitled section");
    expect(sectionNavLabel("Cast On")).toBe("Cast On");
  });

  it("keeps empty sections visible in the outline", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Empty section",
          slug: "empty-section",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [],
        },
        {
          title: "With text",
          slug: "with-text",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>Hi</p>", legacyComponentId: 1, order: 1 },
          ],
        },
      ],
    };

    const items = flattenLessonContent(lesson);
    const groups = buildContentListGroups(lesson, items);
    expect(countLessonSectionsAndBlocks(lesson)).toEqual({
      sectionCount: 2,
      blockCount: 1,
    });
    expect(groups).toHaveLength(2);
    expect(groups[0]!.blockTitle).toBe("Empty section");
    expect(groups[0]!.blockCount).toBe(0);
    expect(sectionGroupMetaLabel(groups[0]!)).toBe("No blocks");
  });

  it("displays section titles for editing", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "  My Section  ",
          slug: "my-section",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p></p>", legacyComponentId: 1, order: 1 },
          ],
        },
      ],
    };

    expect(blockTitleForEditing("  My Section  ")).toBe("My Section");
    expect(sectionTitleForBlock(lesson, "my-section")).toBe("My Section");
  });

  it("supports adding a section and block without data loss", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const component = createRichTextComponent([lesson]);
    appendStandaloneComponentBlock(lesson, component, 1_000);
    expect(countLessonSectionsAndBlocks(lesson)).toEqual({
      sectionCount: 1,
      blockCount: 1,
    });

    const second = createRichTextComponent([lesson]);
    appendStandaloneComponentBlock(lesson, second, 1_001);
    expect(countLessonSectionsAndBlocks(lesson)).toEqual({
      sectionCount: 2,
      blockCount: 2,
    });

    const cloned = cloneLesson(lesson);
    expect(flattenLessonContent(cloned)).toHaveLength(2);
  });

  it("moves sections and preserves block content", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "First",
          slug: "first",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>A</p>", legacyComponentId: 1, order: 1 },
          ],
        },
        {
          title: "Second",
          slug: "second",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>B</p>", legacyComponentId: 2, order: 1 },
          ],
        },
      ],
    };

    expect(moveSectionAtIndex(lesson, 0, 1)).toBe(true);
    const items = flattenLessonContent(lesson);
    const groups = buildContentListGroups(lesson, items);
    expect(groups[0]!.blockTitle).toBe("Second");
    expect(groups[1]!.blockTitle).toBe("First");
    expect(countLessonSectionsAndBlocks(lesson).blockCount).toBe(2);
  });

  it("round-trips lesson JSON structure after title edits", () => {
    const lesson: CourseLesson = {
      title: "Original Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Section A",
          slug: "section-a",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>Keep me</p>", legacyComponentId: 1, order: 1 },
          ],
        },
      ],
    };

    lesson.title = "Renamed Lesson";
    lesson.blocks[0]!.title = "Renamed Section";

    const saved = JSON.parse(JSON.stringify(lesson)) as CourseLesson;
    expect(saved.title).toBe("Renamed Lesson");
    expect(saved.blocks[0]!.title).toBe("Renamed Section");
    expect(saved.blocks[0]!.components[0]!.html).toBe("<p>Keep me</p>");
  });
});
