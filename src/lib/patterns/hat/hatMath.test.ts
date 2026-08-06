import { describe, it, expect } from "vitest";
import {
  applyHatCrownCastOnAdjustment,
  buildFourWedgeCrownSetup,
  buildHatCrownPlan,
  calculateHatPattern,
  hatGaugeToPerInch,
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
    expect(calc.crownHeightInches).toBe(0);
    expect(calc.crownRowCount).toBe(0);
    // gathered bodyLength = 11; bodyHeight = 11 − 2 = 9; 9 × 1.75 = 15.75 → 16 even
    expect(calc.bodyHeightInches).toBe(9);
    expect(calc.bodyRows).toBe(16);
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

  it("chart hatLength wins over fit preset when resolving total length", () => {
    const inches = resolveTotalHatLengthInches({
      fit: "beanie", // preset 7"
      hatSizeValue: "adult_woman",
      displayUnit: "inches",
      sizingRows: [{ size: "adult_woman", hatLength: 11 }],
    });
    expect(inches).toBe(11);
  });

  it("fit preset used when size is custom", () => {
    const inches = resolveTotalHatLengthInches({
      fit: "relaxed",
      hatSizeValue: "custom",
      displayUnit: "inches",
      sizingRows: [],
    });
    expect(inches).toBe(9);
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

  it("buildHatCrownPlan gathered keeps full length as body", () => {
    const plan = buildHatCrownPlan({
      crown: "gathered",
      finishedHatLength: 10,
      suggestedCrownDepth: 2,
      castOnStitches: 100,
      rowGaugePerInch: 2,
    });
    expect(plan.crownDepth).toBe(0);
    expect(plan.bodyLength).toBe(10);
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
        showTips: false,
      },
      storage,
    );
    expect(draft.patternType).toBe("hat");
    expect(draft.patternSystem).toBe("hat");
    expect(readHatDraft(storage)?.customCircumference).toBe("50");
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
