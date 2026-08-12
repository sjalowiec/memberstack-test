import { describe, expect, it } from "vitest";
import {
  getTwoVideosLayoutParts,
  isTwoVideosLayoutBlock,
  TWO_VIDEOS_EDITOR_LAYOUT,
  twoVideosVideoRole,
} from "./courseTwoVideosLayout";

describe("courseTwoVideosLayout", () => {
  it("detects opt-in two-video blocks via editorLayout", () => {
    const block = {
      legacy: { editorLayout: TWO_VIDEOS_EDITOR_LAYOUT },
      components: [
        { type: "video", vimeoId: "1", order: 1, layoutRole: twoVideosVideoRole(1) },
        { type: "video", vimeoId: "2", order: 2, layoutRole: twoVideosVideoRole(2) },
      ],
    };
    expect(isTwoVideosLayoutBlock(block)).toBe(true);
    const parts = getTwoVideosLayoutParts(block);
    expect(parts?.slots[0]?.video.vimeoId).toBe("1");
    expect(parts?.slots[1]?.video.vimeoId).toBe("2");
  });

  it("does not treat plain two-video blocks as a layout", () => {
    expect(
      isTwoVideosLayoutBlock({
        components: [
          { type: "video", vimeoId: "1", order: 1 },
          { type: "video", vimeoId: "2", order: 2 },
        ],
      }),
    ).toBe(false);
  });
});
