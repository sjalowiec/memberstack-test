import { describe, expect, it } from "vitest";
import {
  getTextVideoLayoutParts,
  getTextVideoPair,
  isTextVideoLayoutBlock,
  richTextHasVisibleContent,
  textVideoLayoutSummary,
  TEXT_VIDEO_BOTTOM_ROLE,
  TEXT_VIDEO_LEFT_ROLE,
  unwrapTextVideoColumnHtml,
} from "./courseTextVideoLayout";

describe("isTextVideoLayoutBlock", () => {
  it("matches richText and video only", () => {
    expect(
      isTextVideoLayoutBlock({
        components: [
          { type: "richText", html: "<p>Hi</p>", order: 1 },
          { type: "video", vimeoId: "123", order: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("matches richText, video, and optional bottom richText", () => {
    expect(
      isTextVideoLayoutBlock({
        components: [
          { type: "richText", html: "<p>Left</p>", order: 1, layoutRole: TEXT_VIDEO_LEFT_ROLE },
          { type: "video", vimeoId: "123", order: 2 },
          {
            type: "richText",
            html: "<p>Below</p>",
            order: 3,
            layoutRole: TEXT_VIDEO_BOTTOM_ROLE,
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects blocks with unrelated components", () => {
    expect(
      isTextVideoLayoutBlock({
        components: [
          { type: "richText", html: "<p>Hi</p>", order: 1 },
          { type: "video", vimeoId: "123", order: 2 },
          { type: "download", label: "PDF", order: 3 },
        ],
      }),
    ).toBe(false);
  });
});

describe("getTextVideoLayoutParts", () => {
  it("returns left text, video, and bottom text by role", () => {
    const parts = getTextVideoLayoutParts({
      components: [
        { type: "richText", html: "<p>Left</p>", order: 1, layoutRole: TEXT_VIDEO_LEFT_ROLE },
        { type: "video", vimeoId: "99", order: 2 },
        {
          type: "richText",
          html: "<p>Bottom</p>",
          order: 3,
          layoutRole: TEXT_VIDEO_BOTTOM_ROLE,
        },
      ],
    });
    expect(parts?.leftText.html).toBe("<p>Left</p>");
    expect(parts?.video.vimeoId).toBe("99");
    expect(parts?.bottomText?.html).toBe("<p>Bottom</p>");
  });

  it("infers left vs bottom from order when roles are missing", () => {
    const parts = getTextVideoLayoutParts({
      components: [
        { type: "video", vimeoId: "99", order: 2 },
        { type: "richText", html: "<p>Left</p>", order: 1 },
        { type: "richText", html: "<p>Bottom</p>", order: 3 },
      ],
    });
    expect(parts?.leftText.html).toBe("<p>Left</p>");
    expect(parts?.bottomText?.html).toBe("<p>Bottom</p>");
  });
});

describe("getTextVideoPair", () => {
  it("returns left column as richText", () => {
    const pair = getTextVideoPair({
      components: [
        { type: "video", vimeoId: "99", order: 2 },
        { type: "richText", html: "<p>Body</p>", order: 1 },
      ],
    });
    expect(pair?.richText.html).toBe("<p>Body</p>");
  });
});

describe("richTextHasVisibleContent", () => {
  it("detects empty html", () => {
    expect(richTextHasVisibleContent("<p></p>")).toBe(false);
    expect(richTextHasVisibleContent("<p>Hello</p>")).toBe(true);
  });
});

describe("unwrapTextVideoColumnHtml", () => {
  it("removes a lone lesson-media-row wrapper without video", () => {
    expect(
      unwrapTextVideoColumnHtml(
        '<div class="lesson-media-row">\n    <p>Intro</p>\n</div>',
      ),
    ).toBe("<p>Intro</p>");
  });

  it("removes nested lesson-text inside lesson-media-row", () => {
    expect(
      unwrapTextVideoColumnHtml(
        '<div class="lesson-media-row"><div class="lesson-text"><p>Body</p></div></div>',
      ),
    ).toBe("<p>Body</p>");
  });

  it("keeps embedded media rows that still include video", () => {
    const embedded =
      '<div class="lesson-media-row"><div class="lesson-text"><p>Left</p></div><div class="lesson-video"><iframe></iframe></div></div>';
    expect(unwrapTextVideoColumnHtml(embedded)).toBe(embedded);
  });
});

describe("textVideoLayoutSummary", () => {
  it("notes bottom text when present", () => {
    const parts = getTextVideoLayoutParts({
      components: [
        { type: "richText", html: "<p>Hello world</p>", order: 1 },
        { type: "video", title: "Setup", vimeoId: "123", order: 2 },
        { type: "richText", html: "<p>More</p>", order: 3, layoutRole: TEXT_VIDEO_BOTTOM_ROLE },
      ],
    });
    expect(parts).not.toBeNull();
    const summary = textVideoLayoutSummary(parts!);
    expect(summary).toContain("Hello world");
    expect(summary).toContain("Setup");
    expect(summary).toContain("text below");
  });
});
