import { describe, expect, it } from "vitest";
import {
  applyAdminFormToDocument,
  explanationForAdminForm,
  helpHubAdminEditorCanInit,
  slugFromQuestion,
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
