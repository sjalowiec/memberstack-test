import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  isHatPatternPrintPage,
  isSockPatternPrintPage,
  resolvePatternPrintPersonalizationFields,
} from "../patternPrintPersonalizationFields";
import { writeSockActiveProjectId } from "./sockSavedProject";
import { writeActiveCustomPatternProjectId } from "../customPatternProjectActiveId";
import { saveCurrentPattern } from "../patternStorage";
import {
  getPatternProjectPrintFields,
  resolvePatternPrintDocumentTitle,
  sanitizePatternPrintFilenameTitle,
} from "../sleevelessPatternProjectMeta";
import { stubLocalStorage } from "../test/stubLocalStorage";
import { createEmptySockDraft, writeSockDraft } from "./sockDraft";
import { resolveSockPatternPrintFields } from "./sockPatternPrintTitle";

const socksPatternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
const socksPageScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
const printPersonalizationScript = readFileSync(
  resolve("src/scripts/patternPrintPersonalization.ts"),
  "utf8",
);
const printPersonalizationFields = readFileSync(
  resolve("src/lib/patterns/patternPrintPersonalizationFields.ts"),
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
const dropShoulderPatternScript = readFileSync(
  resolve("src/scripts/sleevelessPatternPageShared.ts"),
  "utf8",
);
const sockMath = readFileSync(resolve("src/lib/patterns/sock/sockMath.ts"), "utf8");
const sockInstructions = readFileSync(resolve("src/lib/patterns/sock/sockInstructions.ts"), "utf8");

const SOCKS_PAGE_TITLE = "Basic Socks Pattern | Knit it Now";

/** Titles that come from sleeveless/drop-shoulder working-draft metadata. */
const SWEATER_PRINT_TITLES = [
  "Women's Sleeveless",
  "Women's Drop Shoulder",
  "Women's Drop Shoulder 3",
  "Men's Drop Shoulder",
  "Cynthia's Drop Shoulder",
  "Sue's Sleeveless Vest",
] as const;

describe("socks pattern print title", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses the saved Socks pattern name, not a leftover Drop Shoulder title", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Women's Drop Shoulder 3",
        notes: "sweater leftover",
        titleCustomized: true,
      },
    });
    writeActiveCustomPatternProjectId("proj-ds-3", "Women's Drop Shoulder 3");
    expect(getPatternProjectPrintFields().title).toBe("Women's Drop Shoulder 3");

    const draft = createEmptySockDraft({
      patternProject: { title: "Blue Hiking Socks", notes: "", titleCustomized: true },
    });
    writeSockDraft(draft);
    writeSockActiveProjectId("proj-sock-1", "Blue Hiking Socks");

    const fields = resolveSockPatternPrintFields({ draft });
    expect(fields.title).toBe("Blue Hiking Socks");
    expect(fields.title).not.toBe("Women's Drop Shoulder 3");
    expect(
      resolvePatternPrintDocumentTitle(fields.title, SOCKS_PAGE_TITLE),
    ).toBe("Blue Hiking Socks");

    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        isSockPatternPage: true,
        sleevelessFields: getPatternProjectPrintFields(),
      }).title,
    ).toBe("Blue Hiking Socks");
  });

  it("never prints a sweater title for a generated Socks Pattern", () => {
    for (const sweaterTitle of SWEATER_PRINT_TITLES) {
      const fields = resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        isSockPatternPage: true,
        sleevelessFields: { title: sweaterTitle, notes: "sweater project notes" },
      });
      expect(fields.title).not.toBe(sweaterTitle);
      expect(fields.title.toLowerCase()).not.toContain("sleeveless");
      expect(fields.title.toLowerCase()).not.toContain("drop shoulder");
    }
  });

  it("preserves sleeveless and drop-shoulder print titles on sweater pages", () => {
    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        isSockPatternPage: false,
        sleevelessFields: { title: "Women's Drop Shoulder 3", notes: "navy yarn" },
      }),
    ).toEqual({ title: "Women's Drop Shoulder 3", notes: "navy yarn" });

    expect(
      resolvePatternPrintPersonalizationFields({
        isHatPatternPage: false,
        sleevelessFields: { title: "Cynthia's Drop Shoulder", notes: "" },
      }),
    ).toEqual({ title: "Cynthia's Drop Shoulder", notes: "" });
  });

  it("does not change Hat print-page detection", () => {
    expect(
      isHatPatternPrintPage({
        querySelector: (sel) => (sel === "[data-hat-pattern-page]" ? {} : null),
      }),
    ).toBe(true);
    expect(
      isSockPatternPrintPage({
        querySelector: (sel) => (sel === "[data-hat-pattern-page]" ? {} : null),
      }),
    ).toBe(false);
  });

  it("detects the finished Socks Pattern page, not sweater pattern pages", () => {
    expect(
      isSockPatternPrintPage({
        querySelector: (sel) => (sel === "[data-socks-pattern-page]" ? {} : null),
      }),
    ).toBe(true);
    expect(
      isSockPatternPrintPage({
        querySelector: () => null,
      }),
    ).toBe(false);

    expect(socksPatternPage).toContain("data-socks-pattern-page");
    expect(sleevelessPatternPage).not.toContain("data-socks-pattern-page");
    expect(dropShoulderPatternPage).not.toContain("data-socks-pattern-page");
  });

  it("wires the shared print component to resolve Socks title by pattern type", () => {
    expect(printPersonalizationScript).toContain("isSockPatternPrintPage");
    expect(printPersonalizationScript).toContain("isHatPatternPrintPage");
    expect(printPersonalizationScript).toContain("resolvePatternPrintPersonalizationFields");
    expect(printPersonalizationFields).toContain("resolveSockPatternPrintFields");
    expect(socksPageScript).toContain("triggerPatternPrint");
  });

  it("reuses the existing filename sanitizer for the Socks print title", () => {
    const fields = resolveSockPatternPrintFields({
      draft: createEmptySockDraft({
        patternProject: { title: "Blue Hiking Socks", notes: "", titleCustomized: true },
      }),
    });
    expect(sanitizePatternPrintFilenameTitle(fields.title)).toBe("Blue Hiking Socks");
    expect(resolvePatternPrintDocumentTitle(fields.title, SOCKS_PAGE_TITLE)).toBe(
      "Blue Hiking Socks",
    );
    expect(
      resolvePatternPrintDocumentTitle("Blue Hiking Socks: v2/final?", SOCKS_PAGE_TITLE),
    ).toBe("Blue Hiking Socks v2 final");
  });

  it("does not change Drop Shoulder print wiring or sock math/instructions", () => {
    expect(dropShoulderPatternPage).toContain("data-pattern-print-skip-modal");
    expect(dropShoulderPatternScript).toContain("triggerPatternPrint");
    expect(sockMath).not.toContain("resolveSockPatternPrintFields");
    expect(sockInstructions).not.toContain("resolveSockPatternPrintFields");
  });
});

describe("why Women's Drop Shoulder leaked into socks print", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("comes from sweater working-draft metadata, which sock print must ignore", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Women's Drop Shoulder 3",
        notes: "from the sweater I knitted last week",
        titleCustomized: true,
      },
    });

    expect(getPatternProjectPrintFields().title).toBe("Women's Drop Shoulder 3");

    const draft = createEmptySockDraft({
      patternProject: { title: "Blue Hiking Socks", notes: "", titleCustomized: true },
    });
    writeSockDraft(draft);

    const sockPrint = resolvePatternPrintPersonalizationFields({
      isHatPatternPage: false,
      isSockPatternPage: true,
      sleevelessFields: getPatternProjectPrintFields(),
    });
    expect(sockPrint.title).toBe("Blue Hiking Socks");
    expect(sockPrint.title).not.toBe("Women's Drop Shoulder 3");
    expect(sockPrint.notes).toBe("");
  });

  it("unsaved Socks still prints the family name, not a leftover sweater title", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Women's Drop Shoulder 3",
        notes: "",
        titleCustomized: true,
      },
    });
    writeActiveCustomPatternProjectId("proj-ds-3", "Women's Drop Shoulder 3");
    const draft = createEmptySockDraft({ sizeSel: "woman_med" });
    writeSockDraft(draft);

    expect(resolveSockPatternPrintFields({ draft }).title).toBe("Socks");
    expect(resolveSockPatternPrintFields({ draft }).title).not.toContain("Drop Shoulder");
  });
});
