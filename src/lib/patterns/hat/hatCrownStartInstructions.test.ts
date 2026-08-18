import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { calculateHatPattern } from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

const CROWNS = ["gathered", "spiral", "wedge-4-decrease"] as const;

function calcFor(
  crown: string,
  overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {},
) {
  return calculateHatPattern({
    finishedHatCircInches: 20.5,
    stitchGaugeDisplay: 5,
    rowGaugeDisplay: 7,
    displayUnit: "inches",
    totalHatLengthInches: 8.5,
    brimDepthInches: 2,
    brimType: "single",
    crown,
    suggestedCrownDepthInches: 2.5,
    fit: "watchcap",
    ...overrides,
  });
}

function patternHtml(
  crown: string,
  currentUnit: "inches" | "cm" = "inches",
  overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {},
) {
  const calc = calcFor(crown, {
    displayUnit: currentUnit,
    ...overrides,
  });
  return {
    calc,
    html: buildHatPatternHtml({
      calc,
      currentUnit,
      scrapOffPatternTooltip: "Scrap Off",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    }),
  };
}

function crownStartSectionHtml(html: string): string {
  const match = html.match(
    /data-section-id="crown-timing"[\s\S]*?<\/section>/,
  );
  return match?.[0] ?? "";
}

describe("hat crown start uses continuous row-counter convention", () => {
  it.each(CROWNS)(
    "%s: begins crown shaping at calculated RC (brimRows + bodyRows)",
    (crown) => {
      const { calc, html } = patternHtml(crown);
      const crownStartRow = calc.brimRows + calc.bodyRows;
      const startSection = crownStartSectionHtml(html);
      expect(crownStartRow).toBeGreaterThan(0);
      expect(startSection).toContain(`Begin crown shaping at RC ${crownStartRow}.`);
      expect(startSection).toContain(`RC ${crownStartRow}`);
      // Cumulative RC is not an extra number of rows to knit in this section.
      expect(startSection).not.toContain(`Knit ${crownStartRow} rows.`);
      expect(startSection).not.toMatch(/Knit \d+ rows/);
      // Dynamic — not a hard-coded example value from the prompt.
      expect(html).not.toContain("Begin crown shaping at RC 90.");
      expect(html).not.toContain("Begin crown shaping at RC 72.");
    },
  );

  it.each(CROWNS)(
    "%s: row values stay dynamic when brim/body lengths change",
    (crown) => {
      const short = patternHtml(crown, "inches", {
        totalHatLengthInches: 7,
        brimDepthInches: 1.5,
        suggestedCrownDepthInches: 2,
      });
      const tall = patternHtml(crown, "inches", {
        totalHatLengthInches: 11,
        brimDepthInches: 2.5,
        suggestedCrownDepthInches: 3,
      });
      const shortRc = short.calc.brimRows + short.calc.bodyRows;
      const tallRc = tall.calc.brimRows + tall.calc.bodyRows;
      expect(shortRc).not.toBe(tallRc);
      expect(short.html).toContain(`Begin crown shaping at RC ${shortRc}.`);
      expect(tall.html).toContain(`Begin crown shaping at RC ${tallRc}.`);
      expect(short.html).not.toContain(`Begin crown shaping at RC ${tallRc}.`);
      expect(tall.html).not.toContain(`Begin crown shaping at RC ${shortRc}.`);
    },
  );

  it.each(CROWNS)(
    "%s: does not use measurement-based crown-start language (inches)",
    (crown) => {
      const { html } = patternHtml(crown, "inches");
      expect(html).not.toContain("when hat measures");
      expect(html).not.toContain("Calculated crown depth");
      expect(html).not.toContain("based on the sizing chart");
      expect(html).not.toContain("from the cast-on edge");
      expect(html).not.toContain("Crown depth &amp; start");
      expect(html).not.toContain("Crown depth & start");
    },
  );

  it.each(CROWNS)(
    "%s: metric patterns also use row counts, not cm measurements",
    (crown) => {
      const { calc, html } = patternHtml(crown, "cm", {
        displayUnit: "cm",
        // Same physical inputs; calc still in inches internally via draft path —
        // mirror typical cm display by converting length inputs.
        totalHatLengthInches: 8.5,
        brimDepthInches: 2,
        suggestedCrownDepthInches: 2.5,
      });
      const crownStartRow = calc.brimRows + calc.bodyRows;
      const startSection = crownStartSectionHtml(html);
      expect(startSection).toContain(`Begin crown shaping at RC ${crownStartRow}.`);
      expect(startSection).not.toContain(`Knit ${crownStartRow} rows.`);
      expect(startSection).not.toMatch(/Knit \d+ rows/);
      expect(html).not.toContain("when hat measures");
      expect(html).not.toContain("Calculated crown depth");
      expect(html).not.toContain("based on the sizing chart");
      // Crown-start section must not show a cm length cue for beginning shaping.
      expect(html).not.toMatch(/Begin crown shaping when hat measures [\d.]+ cm/);
    },
  );

  it("preserves continuous RC convention used by swirl crown Row labels", () => {
    const { calc, html } = patternHtml("spiral");
    const crownStartRow = calc.brimRows + calc.bodyRows;
    expect(html).toContain(`<strong class="pattern-row-label">Row ${crownStartRow}:</strong>`);
    expect(html).toContain(`Begin crown shaping at RC ${crownStartRow}.`);
  });

  it("does not introduce a reset-after-brim second convention", () => {
    const { calc, html } = patternHtml("wedge-4-decrease");
    expect(calc.brimRows).toBeGreaterThan(0);
    expect(html).not.toContain("Reset the row counter to 000");
    expect(html).not.toContain(`Knit ${calc.bodyRows} rows even.`);
    expect(html).toContain(
      `Begin crown shaping at RC ${calc.brimRows + calc.bodyRows}.`,
    );
  });

  it("gathered customer case: crown start is RC 70, not Knit 70 rows", () => {
    const { calc, html } = patternHtml("gathered", "inches", {
      finishedHatCircInches: 22,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 28,
      brimType: "folded",
      brimDepthInches: 3,
      suggestedCrownDepthInches: 10 / 7,
      totalHatLengthInches: 7 + 10 / 7,
      fit: "custom",
    });
    const startSection = crownStartSectionHtml(html);
    expect(calc.brimRows).toBe(42);
    expect(calc.bodyRows).toBe(28);
    expect(calc.crownRowCount).toBe(10);
    expect(calc.castOnSts).toBe(88);
    expect(html).toContain("Work 28 rows in pattern after the brim");
    expect(startSection).toContain("Begin crown shaping at RC 70.");
    expect(startSection).toContain("RC 70");
    expect(startSection).not.toContain("Knit 70 rows");
    expect(html).not.toContain("Knit 70 rows");
    expect(html).toContain("Knit 10 rows. RC is now 80.");
  });

  it("does not render a cumulative RC as Knit N rows in the generator", () => {
    const source = readFileSync(join(__dirname, "hatInstructions.ts"), "utf8");
    expect(source).not.toMatch(/Knit \$\{crownStartRow\} rows/);
    expect(source).toMatch(/Begin crown shaping at RC \$\{crownStartRow\}/);
  });
});
