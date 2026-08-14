import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  isHatPatternPrintPage,
  resolvePatternPrintPersonalizationFields,
} from "../patternPrintPersonalizationFields";
import { writeActiveCustomPatternProjectId } from "../customPatternProjectActiveId";
import { saveCurrentPattern } from "../patternStorage";
import { getPatternProjectPrintFields } from "../sleevelessPatternProjectMeta";
import { stubLocalStorage } from "../test/stubLocalStorage";
import { createEmptyHatDraft, writeHatDraft } from "./hatDraft";
import {
  HAT_PATTERN_PRINT_TITLE,
  resolveHatPatternOnlineHeading,
  resolveHatPatternPrintFields,
} from "./hatPatternPrintTitle";

const patternPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const hatPageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
const printPersonalizationScript = readFileSync(
  resolve("src/scripts/patternPrintPersonalization.ts"),
  "utf8",
);
const sleevelessPatternPage = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPatternPage = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

/** Titles that come from sleeveless/drop-shoulder working-draft metadata. */
const SWEATER_PRINT_TITLES = [
  "Women's Sleeveless",
  "Men's Sleeveless",
  "Kids' Sleeveless",
  "Baby Sleeveless",
  "Sleeveless",
  "Women's Drop Shoulder",
  "Men's Drop Shoulder",
  "Drop Shoulder",
  "Sue's Sleeveless Vest",
  "Cynthia's Drop Shoulder",
] as const;

describe("hat pattern print title", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses the canonical Hat Pattern title for unsaved hats", () => {
    expect(HAT_PATTERN_PRINT_TITLE).toBe("Hat Pattern");
    expect(resolveHatPatternPrintFields()).toEqual({ title: "Hat Pattern", notes: "" });
  });

  it("never prints a sweater title for a generated Hat Pattern", () => {
    for (const sweaterTitle of SWEATER_PRINT_TITLES) {
      const fields = resolvePatternPrintPersonalizationFields({
        isHatPatternPage: true,
        sleevelessFields: { title: sweaterTitle, notes: "sweater project notes" },
      });
      expect(fields.title).toBe("Hat Pattern");
      expect(fields.title).not.toBe(sweaterTitle);
      expect(fields.notes).toBe("");
      expect(fields.title.toLowerCase()).not.toContain("sleeveless");
      expect(fields.title.toLowerCase()).not.toContain("drop shoulder");
      expect(fields.title.toLowerCase()).not.toContain("sweater");
    }
  });

  it("preserves sleeveless and drop-shoulder print titles on sweater pages", () => {
    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        sleevelessFields: { title: "Women's Sleeveless", notes: "vest notes" },
      }),
    ).toEqual({ title: "Women's Sleeveless", notes: "vest notes" });

    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        sleevelessFields: { title: "Cynthia's Drop Shoulder", notes: "" },
      }),
    ).toEqual({ title: "Cynthia's Drop Shoulder", notes: "" });
  });

  it("detects the finished Hat Pattern page, not sweater pattern pages", () => {
    expect(
      isHatPatternPrintPage({
        querySelector: (sel) => (sel === "[data-hat-pattern-page]" ? {} : null),
      }),
    ).toBe(true);
    expect(
      isHatPatternPrintPage({
        querySelector: () => null,
      }),
    ).toBe(false);

    expect(patternPage).toContain("data-hat-pattern-page");
    expect(sleevelessPatternPage).not.toContain("data-hat-pattern-page");
    expect(dropShoulderPatternPage).not.toContain("data-hat-pattern-page");
  });

  it("wires the shared print component to resolve title by pattern type", () => {
    expect(printPersonalizationScript).toContain("isHatPatternPrintPage");
    expect(printPersonalizationScript).toContain("resolvePatternPrintPersonalizationFields");
    expect(hatPageScript).toContain("resolveHatPatternPrintFields");
    expect(hatPageScript).toContain("applyPatternPrintPersonalizationToDom");
  });
});

describe("why Women's Sleeveless leaked into hat print", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("comes from sleeveless auto-title metadata, which hat print must ignore", () => {
    saveCurrentPattern({
      fit: { sizingChart: "misses", selectedSize: "4" },
      style: { garmentStyle: "pullover", neckline: "round" },
      patternProject: { title: "", notes: "" },
    });

    expect(getPatternProjectPrintFields().title).toBe("Women's Sleeveless");

    const hatPrint = resolvePatternPrintPersonalizationFields({
      isHatPatternPage: true,
      sleevelessFields: getPatternProjectPrintFields(),
    });
    expect(hatPrint.title).toBe("Hat Pattern");
    expect(hatPrint.title).not.toBe("Women's Sleeveless");
    expect(hatPrint.notes).toBe("");
  });

  it("also ignores a saved sleeveless project title sitting in shared storage", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Women's Sleeveless",
        notes: "from the vest I knitted last week",
        titleCustomized: true,
      },
    });

    expect(getPatternProjectPrintFields().title).toBe("Women's Sleeveless");

    const hatPrint = resolvePatternPrintPersonalizationFields({
      isHatPatternPage: true,
      sleevelessFields: getPatternProjectPrintFields(),
    });
    expect(hatPrint).toEqual({ title: "Hat Pattern", notes: "" });
  });
});

describe("saved vs unsaved hat print titles", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("prints the saved/custom Hat name, not Hat Pattern", () => {
    const draft = createEmptyHatDraft({
      patternProject: { title: "Sue's Hiking Hat", notes: "", titleCustomized: true },
    });
    writeHatDraft(draft);
    writeActiveCustomPatternProjectId("proj-hat-1", "Sue's Hiking Hat");

    expect(resolveHatPatternPrintFields({ draft, isSaved: true })).toEqual({
      title: "Sue's Hiking Hat",
      notes: "",
    });
    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: true,
        sleevelessFields: { title: "Women's Sleeveless", notes: "" },
      }),
    ).toEqual({ title: "Sue's Hiking Hat", notes: "" });
    expect(resolveHatPatternOnlineHeading("Adult woman 22\"", draft)).toBe("Sue's Hiking Hat");
  });

  it("still prints Hat Pattern for an unsaved temporary hat", () => {
    const draft = createEmptyHatDraft({ sizeSel: "adult_woman" });
    writeHatDraft(draft);

    expect(resolveHatPatternPrintFields({ draft, isSaved: false })).toEqual({
      title: "Hat Pattern",
      notes: "",
    });
    expect(resolveHatPatternOnlineHeading("Adult woman 22\"", draft)).toBe(
      "Hat Pattern · Adult woman 22\"",
    );
  });

  it("leaves sweater print titles unchanged when not on a hat page", () => {
    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        sleevelessFields: { title: "Mom's Pullover", notes: "navy yarn" },
      }),
    ).toEqual({ title: "Mom's Pullover", notes: "navy yarn" });
  });
});
