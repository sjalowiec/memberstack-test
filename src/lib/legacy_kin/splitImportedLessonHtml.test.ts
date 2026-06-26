import { describe, expect, it } from "vitest";
import type { CourseBlock } from "./coursePreviewPoc";
import {
  classifyHtmlSegment,
  countSplitBoundaries,
  isSplittableRichTextBlock,
  splitHtmlIntoSegments,
  splitCourseBlock,
  verifyHtmlPreservation,
} from "./splitImportedLessonHtml";
import { createIdAllocator } from "./courseContentSplitIds";

const SAMPLE_WALL_HTML = `<div>\r\n\r\n\r\nIf you have never tried Sew-as-you-go, please take time to try the technique.<br><h3>Swatch steps</h3>\r\n<b>Swatch 1:</b><br>\r\nKnit a small swatch or use the edge of a previously knit swatch for this sample.<br>\r\n<b>Swatch 2:</b><br>\r\n<ul>\r\n<li>Cast on a new swatch</li>\r\n<li>Continue picking up stitches from Swatch 1 as you knit Swatch 2</li>\r\n</ul><br>\r\n<b>TIP:</B><br>\r\nPlacing yarn markers at regular intervals can be helpful.<br>\r\n<img class=\"img-thumbnail\" src=\"/challenge/images/v2/2/not_enough_needles/sew_You_go2.png\">\r\n`;

function sampleBlock(html: string): CourseBlock {
  return {
    title: "You HAVE to try this!",
    slug: "you-have-to-try-this",
    order: 2,
    legacy: { assignId: 260, blockType: "HTML" },
    components: [
      {
        type: "richText",
        html,
        legacyComponentId: 790,
        order: 1,
      },
      {
        type: "migrationPending",
        legacyType: "ImageUpload",
        notes: ["Unmapped legacy component type: ImageUpload"],
        legacyComponentId: 791,
        order: 2,
      },
    ],
  };
}

describe("splitImportedLessonHtml", () => {
  it("detects multiple split boundaries in imported wall-of-text HTML", () => {
    expect(countSplitBoundaries(SAMPLE_WALL_HTML)).toBeGreaterThanOrEqual(1);
    const segments = splitHtmlIntoSegments(SAMPLE_WALL_HTML);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(verifyHtmlPreservation(SAMPLE_WALL_HTML, segments.map((segment) => segment.html))).toBe(
      true,
    );
  });

  it("classifies standalone image segments as image blocks", () => {
    const classified = classifyHtmlSegment(
      '<img class="img-thumbnail" src="/challenge/images/v2/2/example.png">',
    );
    expect(classified.detectedTypes).toContain("image");
    expect(classified.components.some((component) => component.type === "image")).toBe(true);
  });

  it("keeps inline images inside richText segments", () => {
    const classified = classifyHtmlSegment(
      '<p>Caption text</p><img class="img-thumbnail" src="/challenge/images/v2/2/example.png">',
    );
    expect(classified.detectedTypes).toContain("richText");
    expect(classified.components.some((component) => component.type === "image")).toBe(false);
  });

  it("classifies vimeo iframe segments as video blocks", () => {
    const classified = classifyHtmlSegment(
      "<p>Watch this</p><div class='embed-video-container'>\n<iframe src='https://player.vimeo.com/video/151856919' frameborder='0'></iframe>\n</div>",
    );
    expect(classified.detectedTypes).toContain("video");
    expect(classified.components.some((component) => component.type === "video")).toBe(true);
  });

  it("classifies pdf links as download blocks", () => {
    const classified = classifyHtmlSegment(
      '<p>Print this</p><a href="/downloads/pattern_hack_exercise2.pdf" class="kbm-btn kbm-btn-primary">Download PDF</a>',
    );
    expect(classified.detectedTypes).toContain("download");
    expect(classified.components.some((component) => component.type === "download")).toBe(true);
  });

  it("splits a monolithic richText block into multiple blocks and keeps trailing components", () => {
    const block = sampleBlock(SAMPLE_WALL_HTML);
    expect(isSplittableRichTextBlock(block)).toBe(true);

    const nextLegacyComponentId = createIdAllocator(900);
    const nextAssignId = createIdAllocator(300);
    const result = splitCourseBlock(block, { nextLegacyComponentId, nextAssignId });

    expect(result.skipped).toBe(false);
    expect(result.newBlockCount).toBeGreaterThanOrEqual(2);
    expect(result.blocks.at(-1)?.components.some((component) => component.type === "migrationPending")).toBe(
      true,
    );
    const lastBlock = result.blocks.at(-1)!;
    expect(lastBlock.components.some((component) => component.type === "richText")).toBe(true);
    expect(lastBlock.components.some((component) => component.type === "image")).toBe(false);
    expect(result.blocks.every((item) => item.legacy.contentSplitCleanup)).toBe(true);
  });

  it("does not re-split blocks already marked as cleaned", () => {
    const block = sampleBlock(SAMPLE_WALL_HTML);
    block.legacy = { ...block.legacy, contentSplitCleanup: true };
    const result = splitCourseBlock(block, {
      nextLegacyComponentId: createIdAllocator(900),
      nextAssignId: createIdAllocator(300),
    });
    expect(result.skipped).toBe(true);
    expect(result.newBlockCount).toBe(1);
  });
});
