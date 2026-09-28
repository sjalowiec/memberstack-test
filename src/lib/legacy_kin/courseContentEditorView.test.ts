import { describe, expect, it } from "vitest";
import course87 from "../../data/legacy_kin/cleaned/course_87_brother_kh_kr_260_quick_start.poc.json";
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
import { videoJumpLinksOutlineSummary } from "./vimeoJumpLinksEditor";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";

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

  it("keeps several components inside one section", () => {
    const lesson: CourseLesson = {
      title: "Learn About the Machine",
      slug: "learn-about-the-machine",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Plain Knitting",
          slug: "plain-knitting",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>One</p>", legacyComponentId: 1, order: 1 },
          ],
        },
        {
          title: "The Proper Way to Knit",
          slug: "the-proper-way-to-knit",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>A</p>", legacyComponentId: 2, order: 1 },
            { type: "richText", html: "<p>B</p>", legacyComponentId: 3, order: 2 },
            { type: "richText", html: "<p>C</p>", legacyComponentId: 4, order: 3 },
          ],
        },
      ],
    };

    const items = flattenLessonContent(lesson);
    const groups = buildContentListGroups(lesson, items);
    expect(groups.map((group) => group.sectionNumber)).toEqual([1, 2]);
    expect(groups.map((group) => group.blockTitle)).toEqual([
      "Plain Knitting",
      "The Proper Way to Knit",
    ]);
    expect(groups[1]!.entries).toHaveLength(3);
    expect(groups[1]!.blockCount).toBe(3);
    expect(countLessonSectionsAndBlocks(lesson).sectionCount).toBe(2);
    expect(countLessonSectionsAndBlocks(lesson).blockCount).toBe(4);
  });

  it("shows a video and its jump links as one outline block", () => {
    const lesson: CourseLesson = {
      title: "Bind off",
      slug: "bind-off",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Binding Off",
          slug: "binding-off",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "video", vimeoId: "527303259", title: null, legacyComponentId: 6758, order: 1 },
            {
              type: "migrationPending",
              legacyType: "VimeoJumpLinks",
              legacyComponentId: 6759,
              order: 2,
              legacyFields: {
                LINKTIME_1: "00:00:10",
                LINKTITLE_1: "One",
                LINKTIME_2: "00:01:08",
                LINKTITLE_2: "Two",
                LINKTIME_3: "00:01:19",
                LINKTITLE_3: "Three",
                LINKTIME_4: "00:01:25",
                LINKTITLE_4: "Four",
              },
            },
          ],
        },
        {
          title: "Another video",
          slug: "another-video",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "video", vimeoId: "111", title: null, legacyComponentId: 7000, order: 3 },
          ],
        },
      ],
    };

    const items = flattenLessonContent(lesson);
    expect(items.map((item) => item.type)).toEqual(["video", "migrationPending", "video"]);

    const groups = buildContentListGroups(lesson, items);
    expect(groups[0]!.entries).toHaveLength(1);
    expect(groups[0]!.entries[0]!.item.legacyComponentId).toBe(6758);
    expect(groups[0]!.entries[0]!.jumpLinks).toHaveLength(1);
    expect(
      videoJumpLinksOutlineSummary(
        groups[0]!.entries[0]!.item.component,
        groups[0]!.entries[0]!.jumpLinks.map((jump) => jump.component),
      ),
    ).toBe("527303259 · 4 jump links");
    expect(groups[1]!.entries[0]!.jumpLinks).toEqual([]);
    expect(groups[0]!.entries[0]!.jumpLinksNote).toBeNull();
    expect(countLessonSectionsAndBlocks(lesson)).toEqual({ sectionCount: 2, blockCount: 2 });
  });

  it("keeps jump links with no chapters or no matching video as their own block", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Empty links",
          slug: "empty-links",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "video", vimeoId: "111", title: null, legacyComponentId: 1, order: 1 },
            {
              type: "migrationPending",
              legacyType: "VimeoJumpLinks",
              legacyComponentId: 2,
              order: 2,
              legacyFields: {},
            },
          ],
        },
        {
          title: "Before the video",
          slug: "before-the-video",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            {
              type: "migrationPending",
              legacyType: "VimeoJumpLinks",
              legacyComponentId: 3,
              order: 1,
              legacyFields: { LINKTIME_1: "00:00:04", LINKTITLE_1: "Later" },
            },
            { type: "video", vimeoId: "222", title: null, legacyComponentId: 4, order: 2 },
          ],
        },
      ],
    };

    const groups = buildContentListGroups(lesson, flattenLessonContent(lesson));
    expect(groups[0]!.entries.map((entry) => entry.item.legacyComponentId)).toEqual([1, 2]);
    expect(groups[0]!.entries[0]!.jumpLinks).toEqual([]);
    expect(groups[0]!.entries[1]!.jumpLinksNote).toBe("No links");
    expect(groups[1]!.entries.map((entry) => entry.item.legacyComponentId)).toEqual([3, 4]);
    expect(groups[1]!.entries[0]!.jumpLinksNote).toBe("No matching video");
    expect(groups[1]!.entries[1]!.jumpLinks).toEqual([]);
  });

  it("pairs Course 87 videos with the jump links that follow them", () => {
    const course = course87 as CoursePreviewData;
    const outline = (slug: string) => {
      const lesson = course.lessons.find((item) => item.slug === slug)!;
      return buildContentListGroups(lesson, flattenLessonContent(lesson)).flatMap((group) =>
        group.entries.map((entry) => ({
          section: group.blockTitle,
          id: entry.item.legacyComponentId,
          type: entry.item.type,
          jumps: entry.jumpLinks.map((jump) => jump.legacyComponentId),
          note: entry.jumpLinksNote,
        })),
      );
    };

    const casting = outline("casting-on");
    expect(casting.filter((entry) => entry.section === "Casting on Stitches").map((entry) => entry.type)).toEqual([
      "video",
    ]);
    expect(casting.find((entry) => entry.id === 6761)).toMatchObject({
      type: "video",
      jumps: [6762],
      note: null,
    });
    expect(casting.find((entry) => entry.id === 6762)).toBeUndefined();

    const binding = outline("bind-off");
    expect(binding).toEqual([
      {
        section: "Binding Off",
        id: 6758,
        type: "video",
        jumps: [6759],
        note: null,
      },
    ]);

    const ribber = outline("using-your-ribber");
    const english = ribber.filter((entry) => entry.section === "English Rib");
    expect(english.map((entry) => entry.id)).toEqual([6838, 6841]);
    expect(english[1]).toMatchObject({ type: "video", jumps: [6842], note: null });
    expect(ribber.filter((entry) => entry.note)).toEqual([]);
    expect(ribber.filter((entry) => entry.id === 6893)).toEqual([
      expect.objectContaining({ jumps: [], note: null }),
    ]);
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
