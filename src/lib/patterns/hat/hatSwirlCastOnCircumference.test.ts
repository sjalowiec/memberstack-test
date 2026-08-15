import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { createEmptyHatDraft } from "./hatDraft";
import {
  applyHatCrownCastOnAdjustment,
  calculateHatPattern,
  hatCrownCastOnWasAdjusted,
  hatCrownEndingRow,
  hatCrownStartRow,
  hatKnittedFinishedCircumferenceInches,
  hatProductionCastOnStitches,
} from "./hatMath";
import { buildHatDiagramTokens } from "./hatDiagram";
import { buildHatPatternHtml } from "./hatInstructions";
import { buildHatPatternDiagramSvg } from "./hatPatternDiagramSvg";
import {
  buildHatPatternCalcFromDraft,
  type HatSizingPatternRow,
} from "./hatPatternFromDraft";
import {
  buildHatYarnDimensionsDetail,
  buildHatYarnEstimationSnapshot,
  hatYarnFabricAreaSquareInches,
} from "./hatYarnEstimation";
import hatSizingRows from "../../../data/sizing_hats.json";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

function babyBeanieSwirl16x24() {
  return calculateHatPattern({
    finishedHatCircInches: 16,
    stitchGaugeDisplay: 16,
    rowGaugeDisplay: 24,
    displayUnit: "inches",
    totalHatLengthInches: 6.2,
    brimDepthInches: 1,
    brimType: "single",
    crown: "spiral",
    suggestedCrownDepthInches: 1,
    fit: "beanie",
  });
}

function patternHtml(calc: ReturnType<typeof calculateHatPattern>) {
  return buildHatPatternHtml({
    calc,
    currentUnit: "inches",
    scrapOffPatternTooltip: "Scrap Off",
    tipsIntroHtml: "",
    showTips: false,
    formatters,
  });
}

describe("Swirl production cast-on matches knitted circumference", () => {
  it("Baby / 16×24 / Beanie / 1\" Single / Swirl uses 66 sts and 16.5\" everywhere user-facing", () => {
    const calc = babyBeanieSwirl16x24();
    expect(calc.targetWidth).toBe(16);
    expect(calc.castOnSts).toBe(64);
    expect(hatProductionCastOnStitches(calc)).toBe(66);
    expect(applyHatCrownCastOnAdjustment(64, "spiral")).toBe(66);
    expect(hatCrownCastOnWasAdjusted(calc)).toBe(true);
    expect(hatKnittedFinishedCircumferenceInches(calc)).toBeCloseTo(16.5, 10);
    expect(calc.stGaugePerInch).toBe(4);

    expect(calc.brimRows).toBe(6);
    expect(calc.bodyRows).toBe(16);
    expect(calc.crownRowCount).toBe(16);
    expect(hatCrownStartRow(calc)).toBe(22);
    expect(hatCrownEndingRow(calc)).toBe(38);
    expect(calc.crownPlan.spiral?.decreasePoints).toBe(6);
    expect(calc.crownPlan.spiral?.gradual).toBe(7);
    expect(calc.crownPlan.spiral?.rapid).toBe(3);

    const html = patternHtml(calc);
    expect(html).toContain("Cast on <strong>66 stitches</strong>");
    expect(html).not.toContain("Cast on <strong>64 stitches</strong>");
    expect(html).toContain("Finished hat circumference (body): 16.5 inches");
    expect(html).not.toContain("Finished hat circumference (body): 16.0 inches");
    expect(html).toContain(
      "The stitch count was adjusted slightly so the Swirl crown divides evenly into 6 sections.",
    );
    expect(html).toContain("Begin crown shaping at RC 22.");
    expect(html).toContain("Count 10 needles");
    expect(html).toContain("(60 stitches)");
    expect(html).toContain("Row 22:");
    expect(html).toContain("Row 37:");
    expect(html).toContain(
      "Plan 10 decrease rows across 16 crown rows: 7 decreases every other row, then 3 decreases every row.",
    );

    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expect(svg).toContain("66 sts");
    expect(svg).not.toContain("64 sts");
    expect(svg).toContain('16.5"');
    expect(svg).not.toContain('16.0"');
    expect(svg).toContain("16 rows");
    expect(svg).toContain('2.7"');

    const tokens = buildHatDiagramTokens(calc, "inches", formatters);
    expect(tokens["{{CAST_ON_STS}}"]).toBe("66 sts");
    expect(tokens["{{WIDTH}}"]).toBe('16.5"');

    const yarn = buildHatYarnEstimationSnapshot(calc);
    expect(yarn.finishedCircumferenceInches).toBeCloseTo(16.5, 10);
    expect(yarn.finishedCircumferenceInches).not.toBe(16);
    expect(buildHatYarnDimensionsDetail(calc).projectWidth).toBeCloseTo(16.5, 10);
    const heights =
      calc.brimRows / calc.rowGaugePerInch +
      calc.bodyRows / calc.rowGaugePerInch +
      (calc.crownRowCount / calc.rowGaugePerInch) * 0.5;
    expect(hatYarnFabricAreaSquareInches(calc)).toBeCloseTo(16.5 * heights, 10);
  });

  it("omits the Swirl adjustment note when stitch count is already divisible by 6", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 18,
      stitchGaugeDisplay: 16,
      rowGaugeDisplay: 24,
      displayUnit: "inches",
      totalHatLengthInches: 6.2,
      brimDepthInches: 1,
      brimType: "single",
      crown: "spiral",
      suggestedCrownDepthInches: 1,
      fit: "beanie",
    });
    expect(calc.castOnSts).toBe(72);
    expect(hatProductionCastOnStitches(calc)).toBe(72);
    expect(hatCrownCastOnWasAdjusted(calc)).toBe(false);
    expect(hatKnittedFinishedCircumferenceInches(calc)).toBe(18);
    const html = patternHtml(calc);
    expect(html).toContain("Cast on <strong>72 stitches</strong>");
    expect(html).not.toContain(
      "The stitch count was adjusted slightly so the Swirl crown divides evenly into 6 sections.",
    );
    expect(html).toContain("Finished hat circumference (body): 18.0 inches");
  });

  it("At a Glance uses the production Swirl cast-on", () => {
    const sizingRows = buildHatSizingBuilderRows(
      Array.isArray(hatSizingRows) ? hatSizingRows : [],
    ) as HatSizingPatternRow[];
    const draft = createEmptyHatDraft({
      unit: "inches",
      sizeSel: "baby_6-12",
      brimType: "single",
      brimLength: "1",
      crownShaping: "spiral",
      fit: "beanie",
      availableNeedles: "400",
      gaugeSlots: {
        inches: { stitch: "16", row: "24" },
        cm: { stitch: "", row: "" },
      },
    });
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.castOnSts).toBe(64);
    expect(result.summary.castOnLabel).toBe("66 stitches");
    expect(result.summary.sizeLabel).toContain("Baby (6–12 months)");
    expect(result.summary.sizeLabel).toContain('16.5" finished');
    expect(result.summary.sizeLabel).not.toContain('16" finished');
  });

  it("pairs production cast-on with displayed circumference for any crown adjustment", () => {
    const cases = [
      babyBeanieSwirl16x24(),
      calculateHatPattern({
        finishedHatCircInches: 20.5,
        stitchGaugeDisplay: 5,
        rowGaugeDisplay: 7,
        displayUnit: "inches",
        totalHatLengthInches: 11,
        brimDepthInches: 2,
        brimType: "single",
        crown: "wedge-4-decrease",
        suggestedCrownDepthInches: 2,
        fit: "watchcap",
      }),
      calculateHatPattern({
        finishedHatCircInches: 16,
        stitchGaugeDisplay: 16,
        rowGaugeDisplay: 24,
        displayUnit: "inches",
        totalHatLengthInches: 6.2,
        brimDepthInches: 1,
        brimType: "single",
        crown: "gathered",
        suggestedCrownDepthInches: 1,
        fit: "beanie",
      }),
    ];
    for (const calc of cases) {
      const production = hatProductionCastOnStitches(calc);
      const displayed = hatKnittedFinishedCircumferenceInches(calc);
      if (hatCrownCastOnWasAdjusted(calc)) {
        expect(displayed).toBeCloseTo(production / calc.stGaugePerInch, 10);
      } else {
        expect(displayed).toBe(calc.targetWidth);
      }
      const html = patternHtml(calc);
      expect(html).toContain(`Cast on <strong>${production} stitches</strong>`);
      expect(html).toContain(
        `Finished hat circumference (body): ${formatLength(displayed, "inches")} inches`,
      );
      const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
      expect(svg).toContain(`${production} sts`);
      expect(svg).toContain(formatLengthWithUnit(displayed, "inches"));
    }
  });
});
