import { describe, it, expect } from "vitest";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildHatCrownPlan,
  calculateHatPattern,
  formatHatRolledBrimDefaultLength,
  gatheredCrownRemainingStitches,
  hatCrownEndingRow,
  hatCrownStartRow,
  hatGaugeToPerInch,
  HAT_FIT_LENGTH_STYLE_MULTIPLIERS,
  HAT_NAMED_FIT_STYLES,
  nextBrimLengthAfterBrimTypeChange,
  resolveNamedFitLengthInches,
  resolveTotalHatLengthInches,
  roundFinishedHatSizeFromHead,
  roundToEvenPreferUp,
  snapCastOnToNearestMultipleOf6,
} from "./hatMath";
import {
  buildHatDraftFromLegacyKeys,
  coerceHatDraft,
  ensureHatDraftMigrated,
  HAT_DRAFT_STORAGE_KEY,
  LEGACY_HAT_GAUGE_SLOTS_KEY,
  LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY,
  LEGACY_HAT_SHOW_TIPS_KEY,
  LEGACY_HAT_SIZE_STORAGE_KEY,
  LEGACY_HAT_UNIT_KEY,
  readHatDraft,
  syncHatDraftFromBuilderFields,
} from "./hatDraft";
import { buildHatPatternHtml, wrapHatPatternSection } from "./hatInstructions";
import {
  applyHatDiagramTokens,
  buildHatDiagramTokens,
  resolveHatDiagramTemplateName,
} from "./hatDiagram";
import {
  convertLength,
  formatLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";

/** Memory storage for draft migration tests. */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    raw: map,
  };
}

describe("hatMath golden parity (adult woman / 5×7 per 4\")", () => {
  const finishedCirc = roundFinishedHatSizeFromHead(22.5); // Adult Woman head
  const stitchGaugeDisplay = 5;
  const rowGaugeDisplay = 7;
  const displayUnit = "inches" as const;
  const totalHatLengthInches = 11; // chart hatLength
  const brimDepthInches = 2;
  const suggestedCrownDepthInches = 2;

  it("computes finished circumference from head with 10% ease to nearest 0.5\"", () => {
    expect(finishedCirc).toBe(20.5);
  });

  it("gathered / single brim golden outputs", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: finishedCirc,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit,
      totalHatLengthInches,
      brimDepthInches,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches,
      fit: "watchcap",
    });
    // 20.5 * (5/4) = 25.625 → round even-up → 26
    expect(calc.castOnSts).toBe(26);
    expect(applyHatCrownCastOnAdjustment(calc.castOnSts, "gathered")).toBe(26);
    expect(calc.brimRows).toBe(4); // 2" * 1.75 = 3.5 → 4
    // Suggested crown depth is reserved after the every-other transfer.
    expect(calc.crownHeightInches).toBe(2);
    expect(calc.crownRowCount).toBe(4); // 2" × 1.75 = 3.5 → 4 even
    // bodyLength = 11 − 2 = 9; bodyHeight = 9 − 2 = 7; 7 × 1.75 = 12.25 → 12 even
    expect(calc.bodyHeightInches).toBe(7);
    expect(calc.bodyRows).toBe(12);
    // Crown rows are included exactly once in the finished row total.
    expect(calc.brimRows + calc.bodyRows + calc.crownRowCount).toBe(20);
  });

  it("folded brim doubles row budget", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: finishedCirc,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit,
      totalHatLengthInches,
      brimDepthInches,
      brimType: "folded",
      crown: "gathered",
      suggestedCrownDepthInches,
      fit: "watchcap",
    });
    // 2 * 2 * 1.75 = 7 → 8 even-up? round(7)=7 odd → 8
    expect(calc.brimRows).toBe(8);
  });

  it("rolled brim uses single-layer row math and keeps brim in finished length", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: finishedCirc,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit,
      totalHatLengthInches,
      brimDepthInches: 1,
      brimType: "rolled",
      crown: "gathered",
      suggestedCrownDepthInches,
      fit: "watchcap",
    });
    expect(calc.brimType).toBe("rolled");
    // 1" × 1.75 = 1.75 → round 2 (even)
    expect(calc.brimRows).toBe(2);
    // Visible rolled height is included in total length; body subtracts brim + crown once.
    expect(calc.hatHeight).toBe(totalHatLengthInches);
    expect(calc.crownHeightInches).toBe(2);
    expect(calc.bodyHeightInches).toBe(totalHatLengthInches - 1 - 2);
    expect(calc.brimRows).not.toBe(
      calculateHatPattern({
        finishedHatCircInches: finishedCirc,
        stitchGaugeDisplay,
        rowGaugeDisplay,
        displayUnit,
        totalHatLengthInches,
        brimDepthInches: 1,
        brimType: "folded",
        crown: "gathered",
        suggestedCrownDepthInches,
        fit: "watchcap",
      }).brimRows,
    );
  });

  it("formats rolled brim default height for imperial and metric", () => {
    expect(formatHatRolledBrimDefaultLength("inches")).toBe("1");
    expect(formatHatRolledBrimDefaultLength("cm")).toBe("2.5");
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "single",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBe("1");
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "",
        nextBrimType: "rolled",
        unit: "cm",
      }),
    ).toBe("2.5");
    // Already on rolled — do not overwrite a user-edited height.
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "rolled",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBeNull();
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "rolled",
        nextBrimType: "single",
        unit: "inches",
      }),
    ).toBeNull();
  });

  it("4-wedge decrease adjusts cast-on up to multiple of 4 and builds wedge setup", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: finishedCirc,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit,
      totalHatLengthInches,
      brimDepthInches,
      brimType: "single",
      crown: "wedge-4-decrease",
      suggestedCrownDepthInches,
      fit: "watchcap",
    });
    expect(calc.castOnSts).toBe(26);
    expect(applyHatCrownCastOnAdjustment(26, "wedge-4-decrease")).toBe(28);
    const setup = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: "wedge-4-decrease",
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    expect(setup?.adjustedCastOnStitches).toBe(28);
    expect(setup?.wedgeStitchCount).toBe(7);
    expect(setup?.wedgeNeedleRanges).toHaveLength(4);
    expect(setup?.castOnAdjustedFromBase).toBe(true);
  });

  it("spiral snaps cast-on to multiple of 6 and derives crown rows from schedule", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: finishedCirc,
      stitchGaugeDisplay,
      rowGaugeDisplay,
      displayUnit,
      totalHatLengthInches,
      brimDepthInches,
      brimType: "single",
      crown: "spiral",
      suggestedCrownDepthInches,
      fit: "watchcap",
    });
    expect(snapCastOnToNearestMultipleOf6(26)).toBe(24);
    expect(applyHatCrownCastOnAdjustment(26, "spiral")).toBe(24);
    expect(calc.crownPlan.spiral).not.toBeNull();
    expect(calc.crownRowCount).toBe(calc.crownPlan.crownRows);
    expect(calc.crownRowCount).toBeGreaterThan(0);
  });

  it("named fit style scales from the size chart Standard length", () => {
    const inches = resolveTotalHatLengthInches({
      fit: "beanie",
      hatSizeValue: "adult_woman",
      displayUnit: "inches",
      sizingRows: [{ size: "adult_woman", hatLength: 11 }],
    });
    expect(inches).toBe(9.1);
  });

  it("chart hatLength is used only when fit is empty", () => {
    const inches = resolveTotalHatLengthInches({
      fit: "",
      hatSizeValue: "adult_woman",
      displayUnit: "inches",
      sizingRows: [{ size: "adult_woman", hatLength: 11 }],
    });
    expect(inches).toBe(11);
  });

  it("named fit uses Adult Woman fallback Standard when size is custom", () => {
    const inches = resolveTotalHatLengthInches({
      fit: "relaxed",
      hatSizeValue: "custom",
      displayUnit: "inches",
      sizingRows: [],
    });
    expect(inches).toBe(11.6);
  });
});

describe("proportional named length styles", () => {
  const sizingRows = [
    { size: "preemie", hatLength: 5 },
    { size: "child", hatLength: 8.5 },
    { size: "adult_woman", hatLength: 11 },
    { size: "adult_man", hatLength: 11.5 },
  ];

  it("keeps multipliers in one named configuration", () => {
    expect(HAT_FIT_LENGTH_STYLE_MULTIPLIERS.watchcap).toBe(1);
    expect(HAT_FIT_LENGTH_STYLE_MULTIPLIERS.beanie).toBeCloseTo(7 / 8.5, 10);
    expect(HAT_FIT_LENGTH_STYLE_MULTIPLIERS.relaxed).toBeCloseTo(9 / 8.5, 10);
    expect(HAT_FIT_LENGTH_STYLE_MULTIPLIERS.slouchy).toBeCloseTo(10 / 8.5, 10);
    expect(HAT_NAMED_FIT_STYLES).toEqual(["beanie", "watchcap", "slouchy", "relaxed"]);
  });

  it("Standard equals the selected chart’s standard finished length", () => {
    expect(resolveNamedFitLengthInches("watchcap", "preemie", sizingRows)).toBe(5);
    expect(resolveNamedFitLengthInches("watchcap", "adult_woman", sizingRows)).toBe(11);
  });

  it("every named style produces different appropriate lengths for Preemie and Adult", () => {
    for (const fit of HAT_NAMED_FIT_STYLES) {
      const preemie = resolveNamedFitLengthInches(fit, "preemie", sizingRows)!;
      const adult = resolveNamedFitLengthInches(fit, "adult_woman", sizingRows)!;
      expect(adult, fit).toBeGreaterThan(preemie);
    }
    expect(resolveNamedFitLengthInches("beanie", "preemie", sizingRows)).toBe(4.1);
    expect(resolveNamedFitLengthInches("beanie", "adult_woman", sizingRows)).toBe(9.1);
    expect(resolveNamedFitLengthInches("slouchy", "preemie", sizingRows)).toBe(5.9);
    expect(resolveNamedFitLengthInches("slouchy", "adult_woman", sizingRows)).toBe(12.9);
  });

  it("Beanie is shorter than Standard; Relaxed and Slouchy are longer in order", () => {
    for (const size of ["preemie", "child", "adult_woman", "adult_man"] as const) {
      const beanie = resolveNamedFitLengthInches("beanie", size, sizingRows)!;
      const standard = resolveNamedFitLengthInches("watchcap", size, sizingRows)!;
      const relaxed = resolveNamedFitLengthInches("relaxed", size, sizingRows)!;
      const slouchy = resolveNamedFitLengthInches("slouchy", size, sizingRows)!;
      expect(beanie).toBeLessThan(standard);
      expect(relaxed).toBeGreaterThan(standard);
      expect(slouchy).toBeGreaterThan(relaxed);
    }
  });

  it("Child chart recovers the former adult fixed inches (Classic was 8.5\")", () => {
    expect(resolveNamedFitLengthInches("beanie", "child", sizingRows)).toBe(7);
    expect(resolveNamedFitLengthInches("watchcap", "child", sizingRows)).toBe(8.5);
    expect(resolveNamedFitLengthInches("relaxed", "child", sizingRows)).toBe(9);
    expect(resolveNamedFitLengthInches("slouchy", "child", sizingRows)).toBe(10);
  });

  it("inches and centimeters represent the same physical length", () => {
    const inches = resolveNamedFitLengthInches("slouchy", "adult_woman", sizingRows);
    expect(inches).toBe(12.9);
    const cmDisplay = Math.round(12.9 * 2.54 * 10) / 10;
    const backToInches = resolveTotalHatLengthInches({
      fit: "custom",
      hatSizeValue: "adult_woman",
      customLengthDisplay: cmDisplay,
      displayUnit: "cm",
      sizingRows,
      convertCmToInches: (cm) => cm / 2.54,
    });
    expect(backToInches).toBeCloseTo(12.9, 1);
  });
});

describe("hatMath helpers", () => {
  it("roundToEvenPreferUp bumps odds", () => {
    expect(roundToEvenPreferUp(5.2)).toBe(6);
    expect(roundToEvenPreferUp(4.2)).toBe(4);
  });

  it("hatGaugeToPerInch matches inches and cm conventions", () => {
    expect(hatGaugeToPerInch(5, "inches")).toBe(1.25);
    expect(hatGaugeToPerInch(5, "cm")).toBeCloseTo(5 / (10 / 2.54), 6);
  });

  it("buildHatCrownPlan gathered reserves suggested crown depth after the body", () => {
    const plan = buildHatCrownPlan({
      crown: "gathered",
      finishedHatLength: 10,
      suggestedCrownDepth: 2,
      castOnStitches: 100,
      rowGaugePerInch: 2,
    });
    expect(plan.crownDepth).toBe(2);
    expect(plan.bodyLength).toBe(8);
    expect(plan.crownRows).toBe(4);
  });

  it("gatheredCrownRemainingStitches is half of an even cast-on", () => {
    expect(gatheredCrownRemainingStitches(86)).toBe(43);
    expect(gatheredCrownRemainingStitches(26)).toBe(13);
    // Defensive odd path — never imply a half stitch.
    expect(gatheredCrownRemainingStitches(87)).toBe(43);
    expect(applyHatCrownCastOnAdjustment(87, "gathered")).toBe(88);
  });

  it("gathered crown RC sequence places crown rows after the transfer", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 86,
      stitchGaugeDisplay: 4,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 11,
      brimDepthInches: 2,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: 2,
      fit: "watchcap",
    });
    expect(calc.castOnSts).toBe(86);
    const patternCastOn = applyHatCrownCastOnAdjustment(calc.castOnSts, "gathered");
    expect(patternCastOn).toBe(86);
    expect(gatheredCrownRemainingStitches(patternCastOn)).toBe(43);
    const crownStart = hatCrownStartRow(calc);
    const ending = hatCrownEndingRow(calc);
    expect(crownStart).toBe(calc.brimRows + calc.bodyRows);
    expect(ending).toBe(crownStart + calc.crownRowCount);
    expect(calc.crownRowCount).toBeGreaterThan(0);
    // Body does not include crown rows; crown appears once in the total.
    expect(calc.bodyRows).toBe(
      roundToEvenPreferUp(calc.bodyHeightInches * calc.rowGaugePerInch),
    );
    expect(calc.brimRows + calc.bodyRows + calc.crownRowCount).toBe(ending);
  });
});

describe("hatDraft migration", () => {
  it("migrates legacy fragmented keys into kbm_hat_draft", () => {
    const storage = memoryStorage({
      [LEGACY_HAT_SIZE_STORAGE_KEY]: JSON.stringify({ sel: "adult_woman", circ: "" }),
      [LEGACY_HAT_PATTERN_INPUTS_STORAGE_KEY]: JSON.stringify({
        brimType: "folded",
        brimLength: "2",
        crownShaping: "wedge-4",
        fit: "relaxed",
        customHatLength: "",
      }),
      [LEGACY_HAT_GAUGE_SLOTS_KEY]: JSON.stringify({
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      }),
      [LEGACY_HAT_UNIT_KEY]: "inches",
      [LEGACY_HAT_SHOW_TIPS_KEY]: "true",
    });

    const draft = ensureHatDraftMigrated(storage);
    expect(draft).not.toBeNull();
    expect(draft!.patternType).toBe("hat");
    expect(draft!.patternSystem).toBe("hat");
    expect(draft!.sizeSel).toBe("adult_woman");
    expect(draft!.brimType).toBe("folded");
    expect(draft!.crownShaping).toBe("wedge-4-decrease");
    expect(draft!.fit).toBe("relaxed");
    expect(draft!.gaugeSlots.inches.stitch).toBe("5");
    expect(draft!.showTips).toBe(true);
    expect(draft!.migratedFromLegacy).toBe(true);
    expect(storage.getItem(HAT_DRAFT_STORAGE_KEY)).toBeTruthy();
    // Prefer existing draft on second call
    expect(ensureHatDraftMigrated(storage)?.sizeSel).toBe("adult_woman");
  });

  it("syncHatDraftFromBuilderFields writes patternType hat", () => {
    const storage = memoryStorage();
    const draft = syncHatDraftFromBuilderFields(
      {
        unit: "cm",
        sizeSel: "custom",
        customCircumference: "50",
        brimType: "single",
        brimLength: "5",
        crownShaping: "spiral",
        fit: "custom",
        customHatLength: "22",
        gaugeSlots: {
          inches: { stitch: "", row: "" },
          cm: { stitch: "20", row: "28" },
        },
        availableNeedles: "200",
        showTips: false,
      },
      storage,
    );
    expect(draft.patternType).toBe("hat");
    expect(draft.patternSystem).toBe("hat");
    expect(draft.availableNeedles).toBe("200");
    expect(readHatDraft(storage)?.customCircumference).toBe("50");
  });

  it("coerceHatDraft defaults missing availableNeedles for older drafts", () => {
    const legacy = coerceHatDraft({
      patternType: "hat",
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
    });
    expect(legacy).not.toBeNull();
    expect(legacy?.availableNeedles).toBe("");
  });

  it("coerceHatDraft rejects non-hat patternType", () => {
    expect(coerceHatDraft({ patternType: "sleeveless" })).toBeNull();
  });

  it("buildHatDraftFromLegacyKeys returns null when empty", () => {
    expect(buildHatDraftFromLegacyKeys(memoryStorage())).toBeNull();
  });
});

describe("hatInstructions + hatDiagram", () => {
  const formatters = {
    convertLength: convertLength as (v: number, from: string, to: string) => number,
    formatLength: formatLength as (v: number, unit: string) => string,
    formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
  };

  it("wrapHatPatternSection emits collapsible markup", () => {
    const html = wrapHatPatternSection("cast-on", "<h4>Cast-On</h4>", "<p>x</p>");
    expect(html).toContain('data-section-id="cast-on"');
    expect(html).toContain("hat-pattern-section__collapse");
  });

  it("buildHatPatternHtml includes cast-on and finishing for gathered", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 11,
      brimDepthInches: 2,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: 2,
      fit: "watchcap",
    });
    const remaining = gatheredCrownRemainingStitches(calc.castOnSts);
    const crownStart = hatCrownStartRow(calc);
    const ending = hatCrownEndingRow(calc);
    const html = buildHatPatternHtml({
      calc,
      currentUnit: "inches",
      scrapOffPatternTooltip: "Scrap Off",
      tipsIntroHtml: "",
      showTips: false,
      formatters,
    });
    expect(html).toContain("Cast on");
    expect(html).toContain("26 stitches");
    expect(html).toContain("Finishing");
    expect(html).toContain("gather the top");
    expect(html).toContain(
      `Transfer every other stitch to its neighboring needle, leaving the emptied needles out of work. ${remaining} stitches remain.`,
    );
    expect(html).toContain(`Knit ${calc.crownRowCount} rows. RC is now ${ending}.`);
    expect(html).toContain(`gather the remaining ${remaining} stitches`);
    expect(html).not.toContain("After knitting the full hat length");
    expect(html).toContain(`Begin crown shaping at RC ${crownStart}.`);
    expect(html).toContain(`Work ${calc.bodyRows} rows in pattern after the brim.`);
    expect(calc.bodyRows + calc.crownRowCount).toBe(ending - calc.brimRows);
  });

  it("resolveHatDiagramTemplateName maps spiral to gathered", () => {
    expect(resolveHatDiagramTemplateName("spiral")).toBe("hat-gathered");
    expect(resolveHatDiagramTemplateName("wedge-4-decrease")).toBe("hat-4-wedge");
    expect(resolveHatDiagramTemplateName("gathered")).toBe("hat-gathered");
  });

  it("buildHatDiagramTokens fills cast-on and row labels", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 11,
      brimDepthInches: 2,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: 2,
      fit: "watchcap",
    });
    const tokens = buildHatDiagramTokens(calc, "inches", formatters);
    expect(tokens["{{CAST_ON_STS}}"]).toBe("26 sts");
    expect(tokens["{{BRIM_ROWS}}"]).toMatch(/rows/);
    const applied = applyHatDiagramTokens("W={{WIDTH}} C={{CAST_ON_STS}}", tokens);
    expect(applied).toContain("26 sts");
  });
});
