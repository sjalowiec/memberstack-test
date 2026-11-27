import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  isMittenPatternPrintPage,
  resolvePatternPrintPersonalizationFields,
} from "../patternPrintPersonalizationFields";
import { saveCurrentPattern } from "../patternStorage";
import { getPatternProjectPrintFields } from "../sleevelessPatternProjectMeta";
import { stubLocalStorage } from "../test/stubLocalStorage";
import { womanSmallExampleDraft, writeMittenDraft, type MittenDraft } from "./mittenDraft";
import {
  buildMittenPatternPrintBasicsHtml,
  resolveMittenPatternPrintFields,
} from "./mittenPatternPrint";

const patternPage = readFileSync(resolve("src/pages/patterns/mittens/pattern.astro"), "utf8");
const patternScript = readFileSync(resolve("src/scripts/mitten-pattern-page.ts"), "utf8");
const printScript = readFileSync(resolve("src/scripts/patternPrintPersonalization.ts"), "utf8");
const printFields = readFileSync(resolve("src/lib/patterns/patternPrintPersonalizationFields.ts"), "utf8");
const sockPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");

function namedDraft(thumbStyle: "slotted" | "gored"): MittenDraft {
  return {
    ...womanSmallExampleDraft(),
    thumbStyle,
    patternProject: {
      title: "Blue mittens",
      notes: "Knit the cuffs in 2x2 rib.",
      titleCustomized: true,
    },
  };
}

describe("mitten pattern print", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  it("uses the saved mitten name and ignores a leftover sweater title", () => {
    saveCurrentPattern({
      patternProject: {
        title: "Women's Drop Shoulder 3",
        notes: "sweater leftover",
        titleCustomized: true,
      },
    });
    expect(getPatternProjectPrintFields().title).toBe("Women's Drop Shoulder 3");

    const draft = namedDraft("slotted");
    writeMittenDraft(draft);
    const before = localStorage.getItem("kbm_mitten_draft");

    const fields = resolveMittenPatternPrintFields({ draft });
    expect(fields.title).toBe("Blue mittens");
    expect(fields.notes).toBe("Knit the cuffs in 2x2 rib.");
    expect(localStorage.getItem("kbm_mitten_draft")).toBe(before);

    const resolved = resolvePatternPrintPersonalizationFields({
      isHatPatternPage: false,
      isMittenPatternPage: true,
      sleevelessFields: getPatternProjectPrintFields(),
    });
    expect(resolved.title).toBe("Blue mittens");
    expect(resolved.notes).toBe("Knit the cuffs in 2x2 rib.");
    expect(resolved.title).not.toBe("Women's Drop Shoulder 3");
  });

  it("prints gauge only for both thumb styles", () => {
    for (const thumbStyle of ["slotted", "gored"] as const) {
      const html = buildMittenPatternPrintBasicsHtml(namedDraft(thumbStyle));
      expect(html).toContain("<dt>Gauge</dt>");
      expect(html).toContain("28 sts / 40 rows per 4&quot;");
      expect(html).not.toContain("Calculated");
      expect(html).not.toContain("Cuff stitches");
      expect(html).not.toContain("Slot stitches");
      expect(html).not.toContain("Thumb pickup");
      expect(html).not.toContain("Hand circumference");
    }
  });

  it("skips the shared name prompt and keeps the saved name on the mitten page", () => {
    expect(patternPage).toContain("data-pattern-print-skip-modal");
    expect(patternPage).toContain("data-mitten-pattern");
    expect(sockPage).toContain("data-pattern-print-skip-modal");
    expect(sockPage).not.toContain("data-mitten-pattern");
    expect(
      isMittenPatternPrintPage({
        querySelector: (sel) => (sel === "[data-mitten-pattern]" ? {} : null),
      }),
    ).toBe(true);
    expect(isMittenPatternPrintPage({ querySelector: () => null })).toBe(false);
    expect(printScript).toContain("isMittenPatternPrintPage");
    expect(printFields).toContain("resolveMittenPatternPrintFields");
    expect(patternScript).toContain("resolveMittenPatternPrintFields");
    expect(patternScript).toContain("buildMittenPatternPrintBasicsHtml");
    expect(patternScript).not.toContain("mittenCountSummary");
    expect(patternScript).toContain("triggerPatternPrint");
  });
});
