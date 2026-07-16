import { beforeEach, describe, expect, it } from "vitest";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { saveCurrentPattern } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  buildDefaultSleevelessPatternTitle,
  formatPatternProjectNotesPreview,
  getPatternProjectMeta,
  getSleevelessPatternOnlineHeading,
  getSleevelessPatternOnlineNotesText,
  resetPatternProjectMetaForNewDraft,
  resolvePatternPrintDocumentTitle,
  resolvePatternProjectSaveName,
  resolvePatternProjectSaveNameFromState,
  sanitizePatternPrintFilenameTitle,
  SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
} from "./sleevelessPatternProjectMeta";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
  getExpressEditingProjectLabel,
} from "./sleevelessExpressResume";

describe("buildDefaultSleevelessPatternTitle", () => {
  it("uses only audience + family (no neckline/size/garment details)", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "women",
        neckline: "round",
        garmentStyle: "pullover",
        selectedSize: "4",
      }),
    ).toBe("Women's Sleeveless");
  });

  it("builds men's sleeveless regardless of neckline/garment", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "men",
        neckline: "v-neck",
        garmentStyle: "cardigan",
        selectedSize: "M",
      }),
    ).toBe("Men's Sleeveless");
  });

  it("maps kids who key to Kids'", () => {
    expect(buildDefaultSleevelessPatternTitle({ who: "kids" })).toBe("Kids' Sleeveless");
  });

  it("maps baby who key to Baby (no possessive)", () => {
    expect(buildDefaultSleevelessPatternTitle({ who: "baby" })).toBe("Baby Sleeveless");
  });

  it("uses chart audience when who is empty", () => {
    expect(buildDefaultSleevelessPatternTitle({ chartAudience: "men" })).toBe("Men's Sleeveless");
    expect(buildDefaultSleevelessPatternTitle({ chartAudience: "misses" })).toBe(
      "Women's Sleeveless",
    );
  });

  it("uses the provided pattern family (e.g. Drop Shoulder)", () => {
    expect(
      buildDefaultSleevelessPatternTitle({ who: "women" }, "Drop Shoulder"),
    ).toBe("Women's Drop Shoulder");
    expect(
      buildDefaultSleevelessPatternTitle({ chartAudience: "kids" }, "Drop Shoulder"),
    ).toBe("Kids' Drop Shoulder");
  });

  it("falls back to family only when audience is unknown", () => {
    expect(buildDefaultSleevelessPatternTitle({})).toBe("Sleeveless");
    expect(buildDefaultSleevelessPatternTitle({}, "Drop Shoulder")).toBe("Drop Shoulder");
  });
});

describe("online pattern project display", () => {
  it("uses saved title when present", () => {
    expect(
      getSleevelessPatternOnlineHeading({ title: "Sue's Special pattern", notes: "" }),
    ).toBe("Sue's Special pattern");
  });

  it("falls back when title is empty", () => {
    expect(getSleevelessPatternOnlineHeading({ title: "", notes: "" })).toBe(
      SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
    );
    expect(getSleevelessPatternOnlineHeading({ title: "   ", notes: "note" })).toBe(
      SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
    );
  });

  it("returns notes text only when non-empty", () => {
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "" })).toBeNull();
    expect(getSleevelessPatternOnlineNotesText({ title: "T", notes: "   " })).toBeNull();
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "Use cotton yarn" })).toBe(
      "Use cotton yarn",
    );
  });

  it("preserves internal line breaks for display", () => {
    expect(getSleevelessPatternOnlineNotesText({ title: "", notes: "Line one\nLine two" })).toBe(
      "Line one\nLine two",
    );
  });
});

describe("resetPatternProjectMetaForNewDraft", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("clears a previously loaded saved project title and notes on the working draft", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Aubrey's Green Vest",
        notes: "Use cotton yarn",
        titleCustomized: true,
      },
    });

    resetPatternProjectMetaForNewDraft();

    expect(getPatternProjectMeta()).toEqual({ title: "", notes: "" });
    expect(getExpressEditingProjectLabel()).toBe(EXPRESS_EDITING_FALLBACK_LABEL);
  });
});

describe("resolvePatternProjectSaveName", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses linked saved project name before auto-generated title", () => {
    writeActiveCustomPatternProjectId("proj-1", "Saved Drop Shoulder Name");
    saveCurrentPattern({ patternProject: { title: "", notes: "" } });
    expect(resolvePatternProjectSaveNameFromState()).toBe("Saved Drop Shoulder Name");
  });

  it("uses auto-generated title (audience + family only) when draft and linked name are empty", () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "", notes: "" },
    });
    expect(resolvePatternProjectSaveNameFromState()).toBe("Women's Sleeveless");
  });

  it("prefers a non-empty edit drawer title over state fallbacks", () => {
    writeActiveCustomPatternProjectId("proj-1", "Saved Name");
    const root = {
      querySelector(sel: string) {
        if (sel === "#sl-edit-title") return { value: "Typed title" } as HTMLInputElement;
        return null;
      },
    } as unknown as ParentNode;
    expect(resolvePatternProjectSaveName(root)).toBe("Typed title");
  });
});

describe("formatPatternProjectNotesPreview", () => {
  it("collapses newlines and extra spaces to one line", () => {
    expect(formatPatternProjectNotesPreview("  yarn A\n\nyarn B  ")).toBe("yarn A yarn B");
  });

  it("normalizes Windows line endings", () => {
    expect(formatPatternProjectNotesPreview("a\r\nb")).toBe("a b");
  });
});

describe("sanitizePatternPrintFilenameTitle", () => {
  it("preserves readable custom names including apostrophes", () => {
    expect(sanitizePatternPrintFilenameTitle("Sue's Summer Vest")).toBe("Sue's Summer Vest");
  });

  it("replaces OS-illegal filename characters with spaces while keeping the rest", () => {
    expect(sanitizePatternPrintFilenameTitle('My Vest: "V2"/final?')).toBe("My Vest V2 final");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizePatternPrintFilenameTitle("  Soft   Cardigan  ")).toBe("Soft Cardigan");
  });

  it("returns empty for blank or punctuation-only names", () => {
    expect(sanitizePatternPrintFilenameTitle("   ")).toBe("");
    expect(sanitizePatternPrintFilenameTitle('<>:"/\\|?*')).toBe("");
  });
});

describe("resolvePatternPrintDocumentTitle", () => {
  const sleevelessPageTitle = "Sleeveless Sweater Pattern | Knit it Now";
  const dropShoulderPageTitle = "Drop Shoulder Sweater Pattern | Knit it Now";

  it("uses a custom pattern name for the PDF filename suggestion", () => {
    expect(resolvePatternPrintDocumentTitle("Aubrey's Green Vest", sleevelessPageTitle)).toBe(
      "Aubrey's Green Vest",
    );
    expect(resolvePatternPrintDocumentTitle("My Drop Shoulder", dropShoulderPageTitle)).toBe(
      "My Drop Shoulder",
    );
  });

  it("falls back to the page/default pattern title when no custom name exists", () => {
    expect(resolvePatternPrintDocumentTitle("", sleevelessPageTitle)).toBe(sleevelessPageTitle);
    expect(resolvePatternPrintDocumentTitle("   ", dropShoulderPageTitle)).toBe(
      dropShoulderPageTitle,
    );
  });

  it("uses the auto-generated default pattern name when present", () => {
    expect(resolvePatternPrintDocumentTitle("Women's Sleeveless", sleevelessPageTitle)).toBe(
      "Women's Sleeveless",
    );
    expect(resolvePatternPrintDocumentTitle("Men's Drop Shoulder", dropShoulderPageTitle)).toBe(
      "Men's Drop Shoulder",
    );
  });
});
