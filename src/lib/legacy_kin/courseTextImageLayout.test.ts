import { describe, expect, it } from "vitest";
import {
  getImagePosition,
  getLayoutHeader,
  getTextImageLayoutParts,
  imageCaptionHasContent,
  isTextImageLayoutBlock,
  layoutHeaderHasContent,
  TEXT_IMAGE_IMAGE_ROLE,
  TEXT_IMAGE_TEXT_ROLE,
  textImageLayoutSummary,
} from "./courseTextImageLayout";
import { sectionDisplayTitle, sectionTitleForDisplay, sectionTitleForNav } from "./coursePreviewPoc";

describe("isTextImageLayoutBlock", () => {
  it("matches richText and image only", () => {
    expect(
      isTextImageLayoutBlock({
        components: [
          { type: "richText", html: "<p>Hi</p>", order: 1 },
          { type: "image", src: "/img.png", alt: "Alt", order: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("matches when editorLayout is textImage", () => {
    expect(
      isTextImageLayoutBlock({
        legacy: { editorLayout: "textImage" },
        components: [
          { type: "richText", html: "<p>Hi</p>", order: 1 },
          { type: "image", src: "/img.png", alt: "Alt", order: 2 },
        ],
      }),
    ).toBe(true);
  });

  it("rejects blocks with unrelated components", () => {
    expect(
      isTextImageLayoutBlock({
        components: [
          { type: "richText", html: "<p>Hi</p>", order: 1 },
          { type: "video", vimeoId: "123", order: 2 },
        ],
      }),
    ).toBe(false);
  });
});

describe("getTextImageLayoutParts", () => {
  it("returns text and image by role", () => {
    const parts = getTextImageLayoutParts({
      components: [
        {
          type: "richText",
          html: "<p>Body</p>",
          order: 1,
          layoutRole: TEXT_IMAGE_TEXT_ROLE,
        },
        {
          type: "image",
          src: "/img.png",
          alt: "Dial",
          order: 2,
          layoutRole: TEXT_IMAGE_IMAGE_ROLE,
        },
      ],
    });
    expect(parts?.text.html).toBe("<p>Body</p>");
    expect(parts?.image.src).toBe("/img.png");
  });
});

describe("getImagePosition", () => {
  it("defaults to right", () => {
    expect(getImagePosition({})).toBe("right");
  });

  it("reads layoutOptions.imagePosition", () => {
    expect(getImagePosition({ layoutOptions: { imagePosition: "left" } })).toBe("left");
  });
});

describe("getLayoutHeader", () => {
  it("reads layoutOptions.header when present", () => {
    expect(getLayoutHeader({ layoutOptions: { header: "Yarn and Tension" } })).toBe(
      "Yarn and Tension",
    );
  });

  it("returns null for blank header", () => {
    expect(getLayoutHeader({ layoutOptions: { header: "   " } })).toBeNull();
  });
});

describe("layoutHeaderHasContent", () => {
  it("detects empty headers", () => {
    expect(layoutHeaderHasContent("")).toBe(false);
    expect(layoutHeaderHasContent("Heading")).toBe(true);
  });
});

describe("sectionDisplayTitle", () => {
  it("prefers layoutOptions.header for text image blocks", () => {
    expect(
      sectionDisplayTitle({
        title: "Text + Image",
        slug: "text-image-1",
        order: 1,
        legacy: { assignId: 3467, blockType: "HTML", editorLayout: "textImage" },
        layoutOptions: { header: "Needle Positions" },
        components: [
          { type: "richText", html: "<p>Body</p>", legacyComponentId: 1, order: 1 },
          {
            type: "image",
            src: "/img.png",
            alt: "Alt",
            legacyComponentId: 2,
            order: 2,
          },
        ],
      }),
    ).toBe("Needle Positions");
  });

  it("keeps internal assign ids for dev grouping only", () => {
    expect(
      sectionDisplayTitle({
        title: "",
        slug: "block-a",
        order: 1,
        legacy: { assignId: 3463, blockType: "HTML" },
        components: [],
      }),
    ).toBe("(untitled assign 3463)");
  });
});

describe("sectionTitleForDisplay", () => {
  it("hides internal placeholders and duplicates of the lesson title", () => {
    expect(sectionTitleForDisplay("(untitled assign 3463)", "What's Next?")).toBeNull();
    expect(sectionTitleForDisplay("", "What's Next?")).toBeNull();
    expect(sectionTitleForDisplay("What's Next?", "What's Next?")).toBeNull();
  });

  it("shows real section titles", () => {
    expect(sectionTitleForDisplay("Binding Off", "Cast on Options")).toBe("Binding Off");
  });
});

describe("sectionTitleForNav", () => {
  it("uses Untitled Section for internal placeholders", () => {
    expect(sectionTitleForNav("(untitled assign 3463)", "What's Next?")).toBe(
      "Untitled Section",
    );
  });
});

describe("textImageLayoutSummary", () => {
  it("includes image position and caption note", () => {
    const parts = getTextImageLayoutParts({
      components: [
        { type: "richText", html: "<p>Hello world</p>", order: 1 },
        {
          type: "image",
          src: "/challenge/images/dial.png",
          alt: "Stitch dial",
          caption: "Dial close-up",
          order: 2,
        },
      ],
    });
    expect(parts).not.toBeNull();
    const summary = textImageLayoutSummary(parts!, "left", "Section title");
    expect(summary).toContain("Section title");
    expect(summary).toContain("Hello world");
    expect(summary).toContain("Stitch dial");
    expect(summary).toContain("image left");
    expect(summary).toContain("caption");
  });

  it("includes link note when image link URL is set", () => {
    const parts = getTextImageLayoutParts({
      legacy: { editorLayout: "textImage" },
      components: [
        { type: "richText", html: "<p>Text</p>", order: 1, layoutRole: TEXT_IMAGE_TEXT_ROLE },
        {
          type: "image",
          src: "/blanket_builder.jpg",
          alt: "Blanket Builder",
          linkUrl: "/patterns/diy-blanket",
          order: 2,
          layoutRole: TEXT_IMAGE_IMAGE_ROLE,
        },
      ],
    });
    expect(parts).not.toBeNull();
    expect(textImageLayoutSummary(parts!)).toContain("link");
  });
});

describe("imageCaptionHasContent", () => {
  it("detects empty captions", () => {
    expect(imageCaptionHasContent("")).toBe(false);
    expect(imageCaptionHasContent("  ")).toBe(false);
    expect(imageCaptionHasContent("Caption")).toBe(true);
  });
});
