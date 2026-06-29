import { describe, expect, it } from "vitest";
import {
  appendComponentToBlock,
  appendStandaloneComponentBlock,
  createRichTextComponent,
  movePlainContentComponent,
  moveSectionAtIndex,
  moveSectionByOffset,
  nextLegacyComponentId,
  splitBlockIntoStandaloneSections,
} from "./courseContentEditorBlocks";
import { flattenLessonContent } from "./courseLessonContentItems";
import { getTextVideoLayoutParts } from "./courseTextVideoLayout";
import type { CourseLesson } from "./coursePreviewPoc";

function cloneLesson(lesson: CourseLesson): CourseLesson {
  return JSON.parse(JSON.stringify(lesson)) as CourseLesson;
}

function createTextVideoBlock(lessons: CourseLesson[], timestamp: number): CourseLesson {
  const leftId = nextLegacyComponentId(lessons);
  return {
    title: "Text + Video",
    slug: `text-video-${timestamp}`,
    order: 1,
    legacy: { assignId: 1, blockType: "HTML", editorLayout: "textVideo" },
    components: [
      {
        type: "richText",
        html: "<p>Left</p>",
        legacyComponentId: leftId,
        order: 1,
        layoutRole: "textVideoLeft",
      },
      {
        type: "video",
        vimeoId: "",
        title: null,
        legacyComponentId: leftId + 1,
        order: 2,
      },
    ],
  };
}

describe("courseContentEditorBlocks", () => {
  it("assigns unique legacyComponentIds when adding five Text blocks", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const allLessons = [lesson];
    for (let i = 0; i < 5; i += 1) {
      const component = createRichTextComponent(allLessons);
      appendStandaloneComponentBlock(lesson, component, 1_000 + i);
    }

    const items = flattenLessonContent(lesson);
    expect(items).toHaveLength(5);

    const ids = items.map((item) => item.legacyComponentId);
    expect(new Set(ids).size).toBe(5);

    const slugs = items.map((item) => item.blockSlug);
    expect(new Set(slugs).size).toBe(5);
  });

  it("keeps Text + Video and Text as two independent blocks", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const textVideo = createTextVideoBlock([lesson], 2_000);
    lesson.blocks = [textVideo];

    const textComponent = createRichTextComponent([lesson]);
    appendStandaloneComponentBlock(lesson, textComponent, 2_001);

    const items = flattenLessonContent(lesson);
    expect(items).toHaveLength(2);
    expect(items[0]!.type).toBe("textVideoLayout");
    expect(items[1]!.type).toBe("richText");

    const parts = getTextVideoLayoutParts(textVideo);
    expect(parts).not.toBeNull();
    expect(textVideo.components).toHaveLength(2);
    expect(items[0]!.legacyComponentId).toBe(Number(parts!.leftText.legacyComponentId));
    expect(items[1]!.legacyComponentId).not.toBe(items[0]!.legacyComponentId);
    expect(items[1]!.blockSlug).not.toBe(items[0]!.blockSlug);
  });

  it("deleting one standalone Text block leaves the others intact", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const allLessons = [lesson];
    for (let i = 0; i < 3; i += 1) {
      appendStandaloneComponentBlock(lesson, createRichTextComponent(allLessons), 3_000 + i);
    }

    const middleSlug = String(sortedMiddleBlock(lesson).slug);
    lesson.blocks = (lesson.blocks ?? []).filter((block) => block.slug !== middleSlug);

    const items = flattenLessonContent(lesson);
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.blockSlug === middleSlug)).toBe(false);
  });

  it("does not append a Text component into an existing Text + Video block", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [createTextVideoBlock([], 4_000)],
    };

    const before = cloneLesson(lesson);
    appendStandaloneComponentBlock(lesson, createRichTextComponent([lesson]), 4_001);

    expect(lesson.blocks).toHaveLength(2);
    expect(getTextVideoLayoutParts(lesson.blocks[0]!)).not.toBeNull();
    expect(before.blocks[0]!.components).toHaveLength(2);
    expect(lesson.blocks[0]!.components).toHaveLength(2);
  });

  it("keeps separate section titles when moving standalone blocks", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const downloadBlock = appendStandaloneComponentBlock(
      lesson,
      {
        type: "download",
        label: "Worksheets",
        filename: "file.pdf",
        legacyComponentId: nextLegacyComponentId([lesson]),
        order: 1,
      },
      5_000,
    );
    downloadBlock.title = "Closed Cast On";

    const textBlock = appendStandaloneComponentBlock(
      lesson,
      { ...createRichTextComponent([lesson]), html: "<p>Text</p>" },
      5_001,
    );
    textBlock.title = "Intro Text";

    const items = flattenLessonContent(lesson);
    const movedRef = movePlainContentComponent(
      lesson,
      items[1]!,
      items[0]!,
      false,
    );

    expect(movedRef).not.toBeNull();
    expect(lesson.blocks).toHaveLength(2);
    expect(lesson.blocks[0]!.title).toBe("Intro Text");
    expect(lesson.blocks[1]!.title).toBe("Closed Cast On");
    expect(lesson.blocks[0]!.slug).not.toBe(lesson.blocks[1]!.slug);
  });

  it("does not merge standalone blocks when moving one past another", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    appendStandaloneComponentBlock(
      lesson,
      {
        type: "video",
        vimeoId: "1",
        title: "Video 1",
        legacyComponentId: nextLegacyComponentId([lesson]),
        order: 1,
      },
      6_000,
    );
    appendStandaloneComponentBlock(
      lesson,
      {
        type: "video",
        vimeoId: "2",
        title: "Video 2",
        legacyComponentId: nextLegacyComponentId([lesson]),
        order: 1,
      },
      6_001,
    );

    let items = flattenLessonContent(lesson);
    movePlainContentComponent(lesson, items[1]!, items[0]!, false);

    items = flattenLessonContent(lesson);
    expect(items).toHaveLength(2);
    expect(items[0]!.blockSlug).not.toBe(items[1]!.blockSlug);
    expect(lesson.blocks[0]!.components).toHaveLength(1);
    expect(lesson.blocks[1]!.components).toHaveLength(1);
  });

  it("splits a multi-piece section and fixes duplicate component ids", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Closed Cast On",
          slug: "closed-cast-on",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            {
              type: "richText",
              html: "<p>Intro</p>",
              legacyComponentId: 100,
              order: 1,
            },
            {
              type: "video",
              vimeoId: "1",
              title: "Video 1",
              legacyComponentId: 200,
              order: 2,
            },
            {
              type: "video",
              vimeoId: "2",
              title: "Video 2",
              legacyComponentId: 200,
              order: 3,
            },
          ],
        },
      ],
    };

    expect(splitBlockIntoStandaloneSections(lesson, "closed-cast-on", [lesson])).toBe(true);
    expect(lesson.blocks).toHaveLength(3);
    expect(flattenLessonContent(lesson)).toHaveLength(3);

    const videoIds = lesson.blocks
      .filter((block) => block.components[0]?.type === "video")
      .map((block) => block.components[0]!.legacyComponentId);
    expect(new Set(videoIds).size).toBe(2);
  });

  it("appends a different component type to an existing section without creating a new block", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Closed Cast On",
          slug: "closed-cast-on",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            {
              type: "richText",
              html: "<p>Intro</p>",
              legacyComponentId: 100,
              order: 1,
            },
          ],
        },
      ],
    };

    expect(
      appendComponentToBlock(lesson, "closed-cast-on", {
        type: "download",
        label: "Handout",
        filename: "handout.pdf",
        legacyComponentId: nextLegacyComponentId([lesson]),
        order: 1,
      }),
    ).toBe(true);

    expect(lesson.blocks).toHaveLength(1);
    expect(lesson.blocks[0]!.components).toHaveLength(2);
    expect(lesson.blocks[0]!.components[1]!.type).toBe("download");
    expect(flattenLessonContent(lesson)).toHaveLength(2);
  });

  it("moveSectionByOffset moves an entire block with all its pieces", () => {
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
            { type: "richText", html: "<p>B1</p>", legacyComponentId: 2, order: 1 },
            { type: "video", vimeoId: "123", title: null, legacyComponentId: 3, order: 2 },
          ],
        },
        {
          title: "Third",
          slug: "third",
          order: 3,
          legacy: { assignId: 3, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>C</p>", legacyComponentId: 4, order: 1 },
          ],
        },
      ],
    };

    expect(moveSectionByOffset(lesson, "third", -1)).toBe(true);

    const titles = [...lesson.blocks]
      .sort((a, b) => a.order - b.order)
      .map((block) => block.title);
    expect(titles).toEqual(["First", "Third", "Second"]);

    expect(moveSectionByOffset(lesson, "third", -1)).toBe(true);
    const titlesAfter = [...lesson.blocks]
      .sort((a, b) => a.order - b.order)
      .map((block) => block.title);
    expect(titlesAfter).toEqual(["Third", "First", "Second"]);
    expect(lesson.blocks.find((b) => b.slug === "second")!.components).toHaveLength(2);
  });

  it("moveSectionByOffset changes display order when blocks array is out of sync", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Third",
          slug: "third",
          order: 3,
          legacy: { assignId: 3, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>C</p>", legacyComponentId: 3, order: 1 },
          ],
        },
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

    const before = flattenLessonContent(lesson).map((item) => item.blockSlug);
    expect(before).toEqual(["first", "second", "third"]);

    expect(moveSectionByOffset(lesson, "second", -1)).toBe(true);

    const after = flattenLessonContent(lesson).map((item) => item.blockSlug);
    expect(after).toEqual(["second", "first", "third"]);
    expect(lesson.blocks.map((block) => block.slug)).toEqual(["second", "first", "third"]);
  });

  it("moveSectionAtIndex moves cast-on-methods section 4 up by display index", () => {
    const lesson: CourseLesson = {
      title: "Cast On Methods",
      slug: "cast-on-methods",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [
        {
          title: "Open Cast on",
          slug: "open-cast-on",
          order: 1,
          legacy: { assignId: 1, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>A</p>", legacyComponentId: 1, order: 1 },
          ],
        },
        {
          title: "Closed Cast On",
          slug: "closed-cast-on",
          order: 2,
          legacy: { assignId: 2, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>B</p>", legacyComponentId: 2, order: 1 },
          ],
        },
        {
          title: "Content",
          slug: "content-1782494509282",
          order: 3,
          legacy: { assignId: 3, blockType: "HTML" },
          components: [
            { type: "richText", html: "<p>C</p>", legacyComponentId: 3, order: 1 },
          ],
        },
        {
          title: "Troubleshooting Cast on Problems",
          slug: "troubleshooting-cast-on-problems",
          order: 4,
          legacy: { assignId: 4, blockType: "Video" },
          components: [
            { type: "richText", html: "<p>D</p>", legacyComponentId: 4, order: 1 },
            { type: "video", vimeoId: "123", title: null, legacyComponentId: 5, order: 2 },
          ],
        },
      ],
    };

    expect(moveSectionAtIndex(lesson, 3, -1)).toBe(true);
    expect(flattenLessonContent(lesson).map((item) => item.blockSlug)).toEqual([
      "open-cast-on",
      "closed-cast-on",
      "troubleshooting-cast-on-problems",
      "content-1782494509282",
    ]);
  });
});

function sortedMiddleBlock(lesson: CourseLesson) {
  const blocks = [...lesson.blocks].sort((a, b) => a.order - b.order);
  return blocks[1]!;
}
