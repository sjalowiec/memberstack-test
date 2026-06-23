import { describe, expect, it } from "vitest";
import {
  getThreeVideosLayoutParts,
  isThreeVideosLayoutBlock,
  threeVideosCaptionRole,
  threeVideosLayoutSummary,
  THREE_VIDEOS_INTRO_ROLE,
  THREE_VIDEOS_OUTRO_ROLE,
  threeVideosVideoRole,
} from "./courseThreeVideosLayout";

describe("courseThreeVideosLayout", () => {
  const sampleBlock = {
    legacy: { editorLayout: "threeVideosWithText" },
    components: [
      {
        type: "richText",
        html: "<h3>Intro</h3>",
        layoutRole: THREE_VIDEOS_INTRO_ROLE,
        order: 1,
        legacyComponentId: 1,
      },
      {
        type: "video",
        title: "First",
        vimeoId: "111",
        layoutRole: threeVideosVideoRole(1),
        order: 2,
        legacyComponentId: 2,
      },
      {
        type: "richText",
        html: "<p>Cap 1</p>",
        layoutRole: threeVideosCaptionRole(1),
        order: 3,
        legacyComponentId: 3,
      },
      {
        type: "video",
        title: "Second",
        vimeoId: "222",
        layoutRole: threeVideosVideoRole(2),
        order: 4,
        legacyComponentId: 4,
      },
      {
        type: "richText",
        html: "<p>Cap 2</p>",
        layoutRole: threeVideosCaptionRole(2),
        order: 5,
        legacyComponentId: 5,
      },
      {
        type: "video",
        title: "Third",
        vimeoId: "333",
        layoutRole: threeVideosVideoRole(3),
        order: 6,
        legacyComponentId: 6,
      },
      {
        type: "richText",
        html: "<p>Cap 3</p>",
        layoutRole: threeVideosCaptionRole(3),
        order: 7,
        legacyComponentId: 7,
      },
      {
        type: "richText",
        html: "<p>Outro</p>",
        layoutRole: THREE_VIDEOS_OUTRO_ROLE,
        order: 8,
        legacyComponentId: 8,
      },
    ],
  };

  it("detects three-videos layout blocks", () => {
    expect(isThreeVideosLayoutBlock(sampleBlock)).toBe(true);
    expect(isThreeVideosLayoutBlock({ components: [{ type: "video" }] })).toBe(false);
  });

  it("parses intro, slots, and outro", () => {
    const parts = getThreeVideosLayoutParts(sampleBlock);
    expect(parts?.intro?.html).toContain("Intro");
    expect(parts?.slots[0]?.video.vimeoId).toBe("111");
    expect(parts?.slots[2]?.video.title).toBe("Third");
    expect(parts?.outro?.html).toContain("Outro");
  });

  it("summarizes block content", () => {
    const parts = getThreeVideosLayoutParts(sampleBlock);
    const summary = threeVideosLayoutSummary(parts!);
    expect(summary).toContain("Intro");
    expect(summary).toContain("First");
    expect(summary).toContain("+ text below");
  });
});
