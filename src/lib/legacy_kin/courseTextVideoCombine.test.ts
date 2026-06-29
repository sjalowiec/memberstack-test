import { describe, expect, it } from "vitest";
import { TEXT_VIDEO_LAYOUT_TYPE } from "./courseContentEditorTypes";
import {
  appendStandaloneComponentBlock,
  createRichTextComponent,
  nextLegacyComponentId,
} from "./courseContentEditorBlocks";
import { flattenLessonContent } from "./courseLessonContentItems";
import {
  combineTextVideoWithNextPlainText,
  getNextPlainTextItem,
} from "./courseTextVideoCombine";
import {
  getTextVideoLayoutParts,
  isTextVideoLayoutBlock,
  richTextHasVisibleContent,
} from "./courseTextVideoLayout";
import type { CourseLesson } from "./coursePreviewPoc";

function createTextVideoBlock(lessons: CourseLesson[], timestamp: number) {
  const leftId = nextLegacyComponentId(lessons);
  return {
    title: "Text + Video",
    slug: `text-video-${timestamp}`,
    order: 1,
    legacy: { assignId: 1, blockType: "HTML", editorLayout: "textVideo" },
    components: [
      {
        type: "richText",
        html: "<p>Left column</p>",
        legacyComponentId: leftId,
        order: 1,
        layoutRole: "textVideoLeft",
      },
      {
        type: "video",
        vimeoId: "123",
        title: "Demo",
        legacyComponentId: leftId + 1,
        order: 2,
      },
    ],
  };
}

function textVideoRef(block: { slug?: string; components: { legacyComponentId: number }[] }) {
  return {
    blockSlug: String(block.slug),
    legacyComponentId: Number(block.components[0]!.legacyComponentId),
    type: TEXT_VIDEO_LAYOUT_TYPE,
  };
}

describe("courseTextVideoCombine", () => {
  it("detects the next plain Text item when it is in a separate block after Text + Video", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const textVideo = createTextVideoBlock([lesson], 5_000);
    lesson.blocks = [textVideo];
    appendStandaloneComponentBlock(
      lesson,
      { ...createRichTextComponent([lesson]), html: "<p>Below the columns</p>" },
      5_001,
    );

    const ref = textVideoRef(textVideo);
    const next = getNextPlainTextItem(lesson, ref);

    expect(next).not.toBeNull();
    expect(next!.type).toBe("richText");
    expect(next!.blockSlug).not.toBe(ref.blockSlug);
    expect(String(next!.component.html)).toContain("Below the columns");
  });

  it("does not offer combine when the next item is not plain Text", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [createTextVideoBlock([], 6_000)],
    };

    const videoId = nextLegacyComponentId([lesson]);
    lesson.blocks.push({
      title: "Video",
      slug: "content-6001",
      order: 2,
      legacy: { assignId: 2, blockType: "HTML" },
      components: [
        {
          type: "video",
          vimeoId: "999",
          title: null,
          legacyComponentId: videoId,
          order: 1,
        },
      ],
    });

    const ref = textVideoRef(lesson.blocks[0]!);
    expect(getNextPlainTextItem(lesson, ref)).toBeNull();
  });

  it("merges the next Text item into bottom text and removes its block", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const textVideo = createTextVideoBlock([lesson], 7_000);
    lesson.blocks = [textVideo];
    appendStandaloneComponentBlock(
      lesson,
      { ...createRichTextComponent([lesson]), html: "<p>Combined copy</p>" },
      7_001,
    );

    const ref = textVideoRef(textVideo);
    const bottomId = nextLegacyComponentId([lesson]);
    const { combined } = combineTextVideoWithNextPlainText(lesson, ref, bottomId);

    expect(combined).toBe(true);
    expect(flattenLessonContent(lesson)).toHaveLength(1);
    expect(isTextVideoLayoutBlock(lesson.blocks[0]!)).toBe(true);

    const parts = getTextVideoLayoutParts(lesson.blocks[0]!);
    expect(parts?.bottomText).not.toBeNull();
    expect(String(parts!.bottomText!.html)).toContain("Combined copy");
    expect(richTextHasVisibleContent(String(parts!.bottomText!.html ?? ""))).toBe(true);
  });

  it("appends to existing bottom text when combining", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const textVideo = createTextVideoBlock([lesson], 8_000);
    textVideo.components.push({
      type: "richText",
      html: "<p>Existing bottom</p>",
      legacyComponentId: nextLegacyComponentId([lesson]),
      order: 3,
      layoutRole: "textVideoBottom",
    });
    lesson.blocks = [textVideo];

    appendStandaloneComponentBlock(
      lesson,
      { ...createRichTextComponent([lesson]), html: "<p>More text</p>" },
      8_001,
    );

    const ref = textVideoRef(textVideo);
    const { combined } = combineTextVideoWithNextPlainText(lesson, ref, 99_999);

    expect(combined).toBe(true);
    const parts = getTextVideoLayoutParts(lesson.blocks[0]!);
    expect(String(parts!.bottomText!.html)).toContain("Existing bottom");
    expect(String(parts!.bottomText!.html)).toContain("More text");
    expect(flattenLessonContent(lesson)).toHaveLength(1);
  });

  it("cannot combine when Text was incorrectly embedded inside the Text + Video block", () => {
    const lesson: CourseLesson = {
      title: "Lesson",
      slug: "lesson",
      displayOrder: 1,
      legacy: { itemId: 1, lessonOrder: 1 },
      blocks: [],
    };

    const textVideo = createTextVideoBlock([lesson], 9_000);
    textVideo.components.push({
      type: "richText",
      html: "<p>Embedded text</p>",
      legacyComponentId: nextLegacyComponentId([lesson]),
      order: 3,
    });
    lesson.blocks = [textVideo];

    const ref = textVideoRef(textVideo);
    expect(getNextPlainTextItem(lesson, ref)).toBeNull();
    expect(
      combineTextVideoWithNextPlainText(lesson, ref, nextLegacyComponentId([lesson])).combined,
    ).toBe(false);
  });
});
