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
  resolvePatternProjectSaveName,
  resolvePatternProjectSaveNameFromState,
  SLEEVELESS_PATTERN_ONLINE_HEADING_FALLBACK,
} from "./sleevelessPatternProjectMeta";
import {
  EXPRESS_EDITING_FALLBACK_LABEL,
  getExpressEditingProjectLabel,
} from "./sleevelessExpressResume";

describe("buildDefaultSleevelessPatternTitle", () => {
  it("builds women's round pullover with size", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "women",
        neckline: "round",
        garmentStyle: "pullover",
        selectedSize: "4",
      }),
    ).toBe("Sleeveless Pullover - Women's Size 4 Round Neck");
  });

  it("builds men's v-neck cardigan with size", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "men",
        neckline: "v-neck",
        garmentStyle: "cardigan",
        selectedSize: "M",
      }),
    ).toBe("Sleeveless Cardigan - Men's Size M V-Neck");
  });

  it("builds child's round pullover from kids who key", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "kids",
        neckline: "round",
        garmentStyle: "pullover",
        selectedSize: "8",
      }),
    ).toBe("Sleeveless Pullover - Child's Size 8 Round Neck");
  });

  it("uses chart audience when who is empty", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        chartAudience: "men",
        neckline: "v-neck",
        garmentStyle: "cardigan",
        selectedSize: "L",
      }),
    ).toBe("Sleeveless Cardigan - Men's Size L V-Neck");
  });

  it("omits size segment when selectedSize is missing", () => {
    expect(
      buildDefaultSleevelessPatternTitle({
        who: "women",
        neckline: "round",
        garmentStyle: "pullover",
      }),
    ).toBe("Sleeveless Pullover - Women's Round Neck");
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

  it("uses auto-generated title when draft and linked name are empty", () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "", notes: "" },
    });
    expect(resolvePatternProjectSaveNameFromState()).toContain("Sleeveless Pullover");
    expect(resolvePatternProjectSaveNameFromState()).toContain("Women's Size 4");
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
