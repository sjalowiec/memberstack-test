import { describe, expect, it } from "vitest";
import { createEmptyHatDraft } from "./hatDraft";
import { calculateHatPattern } from "./hatMath";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import {
  HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
  HAT_PATTERN_MISSING_DRAFT_MESSAGE,
  buildHatPatternCalcFromDraft,
  buildHatPatternSummaryDlHtml,
  isHatDraftReadyForPattern,
  type HatSizingPatternRow,
} from "./hatPatternFromDraft";
import hatSizingRows from "../../../data/sizing_hats.json";

const sizingRows = buildHatSizingBuilderRows(
  Array.isArray(hatSizingRows) ? hatSizingRows : [],
) as HatSizingPatternRow[];

function completeDraft(
  overrides: Partial<ReturnType<typeof createEmptyHatDraft>> = {},
) {
  return createEmptyHatDraft({
    unit: "inches",
    sizeSel: "adult_woman",
    brimType: "single",
    brimLength: "2",
    crownShaping: "gathered",
    fit: "watchcap",
    gaugeSlots: {
      inches: { stitch: "5", row: "7" },
      cm: { stitch: "", row: "" },
    },
    ...overrides,
  });
}

describe("hatPatternFromDraft", () => {
  it("rejects missing draft", () => {
    const result = buildHatPatternCalcFromDraft(null, sizingRows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("missing");
      expect(result.message).toBe(HAT_PATTERN_MISSING_DRAFT_MESSAGE);
    }
  });

  it("rejects incomplete draft", () => {
    const draft = createEmptyHatDraft({ sizeSel: "adult_woman" });
    expect(isHatDraftReadyForPattern(draft, sizingRows)).toBe(false);
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("incomplete");
      expect(result.message).toBe(HAT_PATTERN_INCOMPLETE_DRAFT_MESSAGE);
    }
  });

  it("matches calculateHatPattern for gathered + single brim", () => {
    const draft = completeDraft();
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = sizingRows.find((s) => s.size === "adult_woman");
    expect(row).toBeTruthy();
    const direct = calculateHatPattern({
      finishedHatCircInches: row!.finishedSizeInches,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: Number(row!.hatLength) || 8.5,
      brimDepthInches: 2,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: Number(row!.suggestedCrownDepth) || 0,
      fit: "watchcap",
    });
    expect(result.calc.castOnSts).toBe(direct.castOnSts);
    expect(result.calc.brimRows).toBe(direct.brimRows);
    expect(result.calc.bodyRows).toBe(direct.bodyRows);
    expect(result.calc.crown).toBe("gathered");
    expect(result.summary.crownLabel).toBe("Gathered");
    expect(result.summary.brimLabel).toContain("Single Layer");
  });

  it("maps Four-Gore UI crown to wedge-4-decrease", () => {
    const draft = completeDraft({ crownShaping: "wedge-4" });
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.crown).toBe("wedge-4-decrease");
    expect(result.summary.crownLabel).toBe("Four-Gore");
  });

  it("maps spiral / Swirl Top", () => {
    const draft = completeDraft({ crownShaping: "spiral" });
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.crown).toBe("spiral");
    expect(result.summary.crownLabel).toBe("Swirl Top");
  });

  it("supports folded hem and custom length in cm", () => {
    const draft = completeDraft({
      unit: "cm",
      brimType: "folded",
      brimLength: "5",
      fit: "custom",
      customHatLength: "22",
      sizeSel: "custom",
      customCircumference: "52",
      gaugeSlots: {
        inches: { stitch: "", row: "" },
        cm: { stitch: "20", row: "28" },
      },
      crownShaping: "gathered",
    });
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.unit).toBe("cm");
    expect(result.calc.brimType).toBe("folded");
    expect(result.summary.brimLabel).toContain("Folded Hem");
    expect(result.summary.lengthLabel).toContain("Custom");

    const direct = calculateHatPattern({
      finishedHatCircInches: 52 / 2.54,
      stitchGaugeDisplay: 20,
      rowGaugeDisplay: 28,
      displayUnit: "cm",
      totalHatLengthInches: 22 / 2.54,
      brimDepthInches: 5 / 2.54,
      brimType: "folded",
      crown: "gathered",
      suggestedCrownDepthInches: 0,
      fit: "custom",
    });
    expect(result.calc.castOnSts).toBe(direct.castOnSts);
    expect(result.calc.brimRows).toBe(direct.brimRows);
    expect(result.calc.bodyRows).toBe(direct.bodyRows);
  });

  it("covers each standard length preset", () => {
    for (const fit of ["beanie", "watchcap", "slouchy", "relaxed"] as const) {
      const result = buildHatPatternCalcFromDraft(completeDraft({ fit }), sizingRows);
      expect(result.ok, fit).toBe(true);
      if (!result.ok) continue;
      expect(result.calc.hatHeight).toBeGreaterThan(0);
    }
  });

  it("covers small and large chart sizes", () => {
    for (const sizeSel of ["xs_preemie", "adult_man"] as const) {
      const result = buildHatPatternCalcFromDraft(completeDraft({ sizeSel }), sizingRows);
      expect(result.ok, sizeSel).toBe(true);
      if (!result.ok) continue;
      expect(result.calc.castOnSts).toBeGreaterThan(0);
    }
  });

  it("builds summary DL html", () => {
    const html = buildHatPatternSummaryDlHtml({
      sizeLabel: 'Adult Woman — 20.5" finished',
      lengthLabel: 'Classic · 8.5"',
      brimLabel: 'Single Layer · 2"',
      crownLabel: "Gathered",
      gaugeLabel: '5 sts / 7 rows per 4"',
      castOnLabel: "26 stitches",
    });
    expect(html).toContain("print-summary-dl");
    expect(html).toContain("Adult Woman");
    expect(html).toContain("Gathered");
  });
});
