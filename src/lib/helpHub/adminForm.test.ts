import { describe, expect, it } from "vitest";
import {
  applyAdminFormToDocument,
  explanationForAdminForm,
  helpHubAdminEditorCanInit,
  slugFromQuestion,
  topImageFieldsForAdminForm,
  type HelpHubAdminFormValues,
} from "./adminForm";

const VIMEO_1027 = "502818680";

const form = (overrides: Partial<HelpHubAdminFormValues> = {}): HelpHubAdminFormValues => ({
  question: "I’m knitting over every other needle. How do I swatch?",
  bubbleAnswer: "Knit the swatch over every other needle too.",
  hook: "The swatch has to match the knitting.",
  aboutTitle: "What's this about",
  solutionText: "Match the needle arrangement.",
  tryThis: "Try this",
  trySteps: ["Cast on over every other needle"],
  tryNote: "",
  tryImage: "",
  tryImageAlt: "",
  tryImageCaption: "",
  mediaUrl: "",
  mediaAlt: "",
  mediaCaption: "",
  relatedToolLabel: "",
  relatedToolUrl: "",
  relatedLessons: [],
  relatedLibraryVideos: [],
  category: "getting-started",
  isNew: true,
  slug: "every-other-needle-swatch",
  status: "draft",
  ...overrides,
});

describe("explanationForAdminForm", () => {
  it("loads legacy bridge content into the single Explanation field", () => {
    expect(
      explanationForAdminForm({
        bridge: "Most knitters are taught to measure 4 inches.",
      }),
    ).toBe("Most knitters are taught to measure 4 inches.");
  });

  it("prefers solutionText when both exist", () => {
    expect(
      explanationForAdminForm({
        solutionText: "Use solution text.",
        bridge: "Legacy bridge.",
      }),
    ).toBe("Use solution text.");
  });
});

describe("applyAdminFormToDocument", () => {
  it("does not erase existing unedited media data", () => {
    const existing = {
      id: 1001,
      slug: "cut-and-sew-shaping",
      status: "published",
      question: "How do I shape a neckline without losing my lace or tuck pattern?",
      mediaType: "vimeo",
      mediaUrl: "1175910961",
      mediaAlt: "Sue demonstrating Cut 'n Sew",
      relatedLessons: ["use-stabilizer-for-clean-confident-cut-n-sew-edges"],
    };
    const next = applyAdminFormToDocument(
      existing,
      form({
        question: existing.question,
        slug: existing.slug,
        status: "published",
        category: "edges-finishing-assembly",
        relatedLessons: existing.relatedLessons,
      }),
    );
    expect(next.mediaType).toBe("vimeo");
    expect(next.mediaUrl).toBe("1175910961");
    expect(next.mediaAlt).toBe("Sue demonstrating Cut 'n Sew");
    expect(next.relatedLessons).toEqual(["use-stabilizer-for-clean-confident-cut-n-sew-edges"]);
  });

  it("stores a Learning Library selection as catalog id, not Vimeo ID 502818680", () => {
    const next = applyAdminFormToDocument(
      { status: "draft" },
      form({
        relatedLibraryVideos: [{ type: "library", contentId: 1027 }],
      }),
    );
    expect(next.relatedLibraryVideos).toEqual([{ type: "library", contentId: 1027 }]);
    expect(JSON.stringify(next)).not.toContain(VIMEO_1027);
  });

  it("keeps draft status instead of publishing", () => {
    const next = applyAdminFormToDocument({ status: "draft" }, form({ status: "draft" }));
    expect(next.status).toBe("draft");
  });

  it("stores Gauge & Swatching as the catalog key", () => {
    const next = applyAdminFormToDocument(
      { status: "draft" },
      form({ category: "gauge-swatching" }),
    );
    expect(next.category).toBe("gauge-swatching");
  });

  it("stores an optional top image on the existing hero-media fields", () => {
    const next = applyAdminFormToDocument(
      { status: "draft" },
      form({
        mediaUrl: "/images/help-hub/every-other-needle.jpg",
        mediaAlt: "Turquoise knitting worked on every other needle of a knitting machine",
      }),
    );
    expect(next.mediaType).toBe("image");
    expect(next.mediaUrl).toBe("/images/help-hub/every-other-needle.jpg");
    expect(next.mediaAlt).toBe(
      "Turquoise knitting worked on every other needle of a knitting machine",
    );
  });

  it("does not restore video or embed controls when saving a top image", () => {
    const next = applyAdminFormToDocument(
      { status: "draft" },
      form({ mediaUrl: "/images/help-hub/every-other-needle.jpg" }),
    );
    expect(next.mediaType).toBe("image");
    expect(next).not.toHaveProperty("videoId");
    expect(JSON.stringify(next)).not.toMatch(/youtube|player\.vimeo/i);
  });

  it("preserves existing vimeo hero media when the top image fields are blank", () => {
    const existing = {
      mediaType: "vimeo",
      mediaUrl: "1175910961",
      mediaAlt: "Sue demonstrating Cut 'n Sew",
    };
    const next = applyAdminFormToDocument(existing, form());
    expect(next.mediaType).toBe("vimeo");
    expect(next.mediaUrl).toBe("1175910961");
    expect(next.mediaAlt).toBe("Sue demonstrating Cut 'n Sew");
  });

  it("stores a related tool only when both label and internal URL are present", () => {
    const next = applyAdminFormToDocument(
      { status: "draft" },
      form({
        relatedToolLabel: "Calculate My Gauge",
        relatedToolUrl: "/tools/gauge-calculator",
        tryImage: "/images/tools/gauge-generator.png",
        tryImageAlt: "Gauge swatch marked to measure stitches across and rows vertically",
        tryImageCaption:
          "Measure the width and height between the markers, then enter those measurements in the Gauge Calculator.",
      }),
    );
    expect(next.relatedToolLabel).toBe("Calculate My Gauge");
    expect(next.relatedToolUrl).toBe("/tools/gauge-calculator");
    expect(next.tryImage).toBe("/images/tools/gauge-generator.png");
    expect(next.tryImageAlt).toBe(
      "Gauge swatch marked to measure stitches across and rows vertically",
    );
    expect(next.tryImageCaption).toBe(
      "Measure the width and height between the markers, then enter those measurements in the Gauge Calculator.",
    );
  });

  it("omits the related tool when either field is blank or the URL is not internal", () => {
    expect(
      applyAdminFormToDocument(
        { relatedToolLabel: "Calculate My Gauge", relatedToolUrl: "/tools/gauge-calculator" },
        form({ relatedToolLabel: "Calculate My Gauge" }),
      ),
    ).not.toHaveProperty("relatedToolLabel");
    expect(
      applyAdminFormToDocument(
        { status: "draft" },
        form({ relatedToolLabel: "Calculate My Gauge", relatedToolUrl: "https://example.com" }),
      ),
    ).not.toHaveProperty("relatedToolUrl");
  });
});

describe("helpHubAdminEditorCanInit", () => {
  it("does not require a JSON Preview element", () => {
    expect(helpHubAdminEditorCanInit({ form: {}, saveButton: {} })).toBe(true);
    expect(helpHubAdminEditorCanInit({ form: null, saveButton: {} })).toBe(false);
  });
});

describe("slugFromQuestion", () => {
  it("builds a URL name from the question for a new entry", () => {
    expect(slugFromQuestion("I’m knitting over every other needle. How do I swatch?")).toBe(
      "im-knitting-over-every-other-needle-how-do-i-swatch",
    );
  });
});

describe("topImageFieldsForAdminForm", () => {
  it("loads stored public images and hides existing video media from the image fields", () => {
    expect(
      topImageFieldsForAdminForm({
        mediaType: "image",
        mediaUrl: "/images/help-hub/every-other-needle.jpg",
        mediaAlt: "Turquoise knitting worked on every other needle of a knitting machine",
      }),
    ).toEqual({
      url: "/images/help-hub/every-other-needle.jpg",
      alt: "Turquoise knitting worked on every other needle of a knitting machine",
      caption: "",
    });
    expect(
      topImageFieldsForAdminForm({
        mediaType: "vimeo",
        mediaUrl: "1175910961",
        mediaAlt: "Sue demonstrating Cut 'n Sew",
      }),
    ).toEqual({ url: "", alt: "", caption: "" });
  });
});
