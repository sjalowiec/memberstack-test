import { describe, expect, it } from "vitest";
import {
  applyAdminFormToDocument,
  explanationForAdminForm,
  helpHubAdminEditorCanInit,
  helpHubChooserPlacement,
  helpHubEditorEntryChoices,
  helpHubSaveActionLabel,
  helpHubSplitEntryChooserEnabled,
  noteForAdminForm,
  slugFromQuestion,
  statusForHelpHubSave,
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
  relatedToolEyebrow: "",
  relatedToolTitle: "",
  relatedToolNote: "",
  relatedToolLabel: "",
  relatedToolUrl: "",
  publicVideoUrl: "",
  publicVideoTitle: "",
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

  it("loads a repeatedly escaped image as HTML the editor can save again", () => {
    const encoded =
      "&amp;amp;amp;amp;lt;img src=&amp;amp;amp;quot;/images/thank-you.jpg&amp;amp;amp;quot;&amp;amp;amp;amp;gt;";
    const loaded = explanationForAdminForm({ solutionText: encoded });
    expect(loaded).toBe('<img src="/images/thank-you.jpg">');
    const saved = applyAdminFormToDocument(
      { id: 1, solutionText: encoded },
      form({ solutionText: loaded }),
    );
    expect(saved.solutionText).toBe(loaded);
    const again = applyAdminFormToDocument(saved, form({ solutionText: String(saved.solutionText) }));
    expect(again.solutionText).toBe(loaded);
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

  it("stores a public resource CTA and leaves a blank note off the document", () => {
    const next = applyAdminFormToDocument(
      { relatedToolNote: "Old note", relatedLessons: [12] },
      form({
        relatedLessons: [],
        relatedToolEyebrow: "Helpful Resource",
        relatedToolTitle: "Knitting Machine Repair Contacts and Services",
        relatedToolNote: "   ",
        relatedToolLabel: "Find Repair Help",
        relatedToolUrl: "https://knititnow.com/reference/repairs",
      }),
    );
    expect(next.relatedLessons).toEqual([]);
    expect(next.relatedToolEyebrow).toBe("Helpful Resource");
    expect(next.relatedToolTitle).toBe("Knitting Machine Repair Contacts and Services");
    expect(next).not.toHaveProperty("relatedToolNote");
    expect(next.relatedToolLabel).toBe("Find Repair Help");
    expect(next.relatedToolUrl).toBe("https://knititnow.com/reference/repairs");
  });

  it("stores an optional public video without changing related lessons", () => {
    const existing = {
      status: "published",
      relatedLessons: [5002],
      relatedLibraryVideos: [{ type: "library", contentId: 1027 }],
    };
    const next = applyAdminFormToDocument(
      existing,
      form({
        relatedLessons: [5002],
        relatedLibraryVideos: [{ type: "library", contentId: 1027 }],
        publicVideoUrl: "https://vimeo.com/527759119",
        publicVideoTitle: "Yarn for Knitting Machines",
      }),
    );
    expect(next.publicVideoUrl).toBe("https://vimeo.com/527759119");
    expect(next.publicVideoTitle).toBe("Yarn for Knitting Machines");
    expect(next.relatedLessons).toEqual([5002]);
    expect(next.relatedLibraryVideos).toEqual([{ type: "library", contentId: 1027 }]);
  });

  it("removes a main image from this entry without touching a stored video", () => {
    const cleared = applyAdminFormToDocument(
      {
        mediaType: "image",
        mediaUrl: "/images/help-hub/every-other-needle.jpg",
        mediaAlt: "Swatch",
        mediaCaption: "Caption",
      },
      form({ mediaUrl: "", mediaAlt: "", mediaCaption: "" }),
    );
    expect(cleared).not.toHaveProperty("mediaUrl");
    expect(cleared).not.toHaveProperty("mediaAlt");
    expect(cleared).not.toHaveProperty("mediaCaption");

    const video = applyAdminFormToDocument(
      { mediaType: "vimeo", mediaUrl: "1175910961", mediaAlt: "Sue demonstrating Cut 'n Sew" },
      form({ mediaUrl: "" }),
    );
    expect(video.mediaType).toBe("vimeo");
    expect(video.mediaUrl).toBe("1175910961");
  });

  it("moves a legacy quick-action note into the important note field once", () => {
    expect(noteForAdminForm({ tryThis: { quickActionNote: "Watch the yarn tension." } })).toBe(
      "Watch the yarn tension.",
    );
    const next = applyAdminFormToDocument(
      { tryThis: { quickActionTitle: "Try this", quickActionNote: "Watch the yarn tension." } },
      form({ tryNote: "Watch the yarn tension." }),
    );
    expect(next.tryNote).toBe("Watch the yarn tension.");
    expect(next.tryThis).toEqual({ quickActionTitle: "Try this" });
  });

  it("keeps a published entry published unless status is changed, and does not publish a draft from Save draft", () => {
    expect(
      statusForHelpHubSave({
        intent: "keep",
        selectedStatus: "published",
        storedStatus: "published",
      }),
    ).toBe("published");
    expect(
      statusForHelpHubSave({
        intent: "keep",
        selectedStatus: "published",
        storedStatus: "draft",
      }),
    ).toBe("draft");
    expect(
      statusForHelpHubSave({
        intent: "keep",
        selectedStatus: "draft",
        storedStatus: "published",
      }),
    ).toBe("draft");
    expect(
      statusForHelpHubSave({ intent: "publish", selectedStatus: "draft", storedStatus: "draft" }),
    ).toBe("published");
    expect(
      helpHubSaveActionLabel({
        intent: "keep",
        selectedStatus: "published",
        storedStatus: "published",
      }),
    ).toBe("Update");
    expect(
      helpHubSaveActionLabel({
        intent: "keep",
        selectedStatus: "draft",
        storedStatus: "draft",
      }),
    ).toBe("Save draft");
  });

  it("removes a public video when both fields are cleared", () => {
    const next = applyAdminFormToDocument(
      {
        publicVideoUrl: "527759119",
        publicVideoTitle: "Yarn for Knitting Machines",
        relatedLessons: [5002],
      },
      form({ relatedLessons: [5002], publicVideoUrl: "  ", publicVideoTitle: "" }),
    );
    expect(next).not.toHaveProperty("publicVideoUrl");
    expect(next).not.toHaveProperty("publicVideoTitle");
    expect(next.relatedLessons).toEqual([5002]);
  });
});

describe("helpHubAdminEditorCanInit", () => {
  it("does not require a JSON Preview element", () => {
    expect(helpHubAdminEditorCanInit({ form: {}, saveButton: {} })).toBe(true);
    expect(helpHubAdminEditorCanInit({ form: null, saveButton: {} })).toBe(false);
  });
});

describe("helpHubEditorEntryChoices", () => {
  it("keeps published and draft entries, and puts an unknown status with drafts", () => {
    const groups = helpHubEditorEntryChoices([
      { slug: "published-one", question: "Why does the edge curl?", status: "published" },
      { slug: "draft-one", question: "How long should my sweater be?", status: "draft" },
      { slug: "review-one", title: "Needs a look", status: "review" },
      { slug: "", question: "Missing address", status: "draft" },
      { slug: "mystery", question: "Not labeled", status: "archived" },
    ]);
    expect(groups.published.map((entry) => entry.slug)).toEqual(["published-one"]);
    expect(groups.draft.map((entry) => entry.slug)).toEqual(["draft-one", "mystery"]);
    expect(groups.review.map((entry) => entry.label)).toEqual(["Needs a look"]);
  });
});

describe("helpHub split entry chooser", () => {
  it("stays off the production site", () => {
    expect(helpHubSplitEntryChooserEnabled("localhost")).toBe(true);
    expect(helpHubSplitEntryChooserEnabled("dev")).toBe(true);
    expect(helpHubSplitEntryChooserEnabled("production")).toBe(false);
  });

  it("puts drafts and needs-review entries in the draft box, and published entries in the published box", () => {
    expect(helpHubChooserPlacement("draft")).toEqual({
      box: "draft",
      key: "draft",
      statusLabel: "Draft",
      action: "Open",
    });
    expect(helpHubChooserPlacement("review")).toEqual({
      box: "draft",
      key: "review",
      statusLabel: "Needs review",
      action: "Open",
    });
    expect(helpHubChooserPlacement("published")).toEqual({
      box: "published",
      key: "published",
      statusLabel: "Published",
      action: "Edit",
    });
    expect(helpHubChooserPlacement("archived").box).toBe("draft");
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
