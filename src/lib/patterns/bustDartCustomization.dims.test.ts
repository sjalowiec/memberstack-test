/**
 * Custom width/depth for bust darts — shared math, presets, persistence, pattern constructions.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  CUP_DART_BY_SIZE,
  computeDartShaping,
  computeDartShapingFromPerInch,
  displayDartLengthFromInches,
  getCupDartPresetInches,
  isCustomDartDimensions,
  resolveDartDimensionsInches,
  roundToTwoDecimals,
  type DartCupSize,
} from "../tools/dartFormulaMath";
import {
  calculateBustDart,
  emptyBustDartSavedConfig,
  normalizeBustDartSavedConfig,
  readBustDartConfigFromPatternData,
  type BustDartInput,
} from "./legoBlocks/bustDart";
import {
  BUST_DART_STYLE_KEY,
  buildEnabledBustDartSavedConfig,
  previewBustDartForPattern,
  writeBustDartConfigToWorkingDraft,
  type BustDartPatternContext,
} from "./bustDartPatternCustomization";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  renderBustDartCustomizationPrintHtml,
  renderBustDartCustomizationScreenHtml,
  OPTIONAL_BUST_DART_TIP_ID,
} from "./bustDartFrontSlotHtml";
import { stubLocalStorage } from "./test/stubLocalStorage";

vi.mock("./patternStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./patternStorage")>();
  return {
    ...actual,
    getCurrentPattern: () => ({ id: "test", style: {}, fit: {}, yarnGaugeMachine: {} }),
    getPatternData: () => ({}),
    saveCurrentPattern: vi.fn(),
    savePatternData: vi.fn(),
  };
});

function baseInput(over: Partial<BustDartInput> = {}): BustDartInput {
  return {
    enabled: true,
    cupSize: "C",
    sizeGroup: "misses",
    stitchesPerInch: 5,
    rowsPerInch: 7,
    frontConstruction: "pullover",
    frontStitchCount: 100,
    armholeOpeningGarmentRc: 140,
    hemRows: 22,
    bodyToArmholeRows: 118,
    ...over,
  };
}

function womenPattern(extraStyle: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    },
    style: {
      recipientCategory: "misses",
      neckline: "round",
      frontStyle: "closed",
      garmentStyle: "pullover",
      ...extraStyle,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
      gaugeRawUnit: "in",
    },
  };
}

function frontText(rows: readonly { kind: string; paragraphs?: string[]; instructionParagraphs?: string[] }[]): string {
  return rows
    .flatMap((r) => {
      if (r.kind === "bustDartCustomization") return r.instructionParagraphs ?? [];
      if (r.kind === "block") return r.paragraphs ?? [];
      return [];
    })
    .join("\n");
}

describe("bust dart custom width/depth", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("every cup choice loads its established default width and depth", () => {
    for (const cup of Object.keys(CUP_DART_BY_SIZE) as DartCupSize[]) {
      const preset = getCupDartPresetInches(cup);
      expect(preset).toEqual({
        dartWidthInches: CUP_DART_BY_SIZE[cup].dartWidth,
        dartDepthInches: CUP_DART_BY_SIZE[cup].dartDepth,
      });
      const resolved = resolveDartDimensionsInches({ cupKey: cup });
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) return;
      expect(resolved.dartWidthInches).toBe(preset.dartWidthInches);
      expect(resolved.dartDepthInches).toBe(preset.dartDepthInches);
      expect(resolved.customized).toBe(false);
      expect(displayDartLengthFromInches(preset.dartWidthInches, "in")).toBe(preset.dartWidthInches);
    }
  });

  it("unchanged preset values reproduce current results", () => {
    const preset = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    const explicit = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
      dartWidthInches: 3.25,
      dartDepthInches: 1,
    });
    expect(preset.ok && explicit.ok).toBe(true);
    if (!preset.ok || !explicit.ok) return;
    expect(explicit.totalHeldStitches).toBe(preset.totalHeldStitches);
    expect(explicit.totalDepthRows).toBe(preset.totalDepthRows);
    expect(explicit.shapingPasses).toBe(preset.shapingPasses);
    expect(explicit.customized).toBe(false);

    const sweater = calculateBustDart(baseInput());
    expect(sweater.active).toBe(true);
    expect(sweater.shaping?.totalHeldStitches).toBe(16);
    expect(sweater.shaping?.totalDepthRows).toBe(7);
  });

  it("custom width only changes held stitches", () => {
    const base = computeDartShapingFromPerInch({
      cupKey: "C",
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    const custom = computeDartShapingFromPerInch({
      cupKey: "C",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      dartWidthInches: 4,
      dartDepthInches: 1,
    });
    expect(base.ok && custom.ok).toBe(true);
    if (!base.ok || !custom.ok) return;
    expect(custom.customized).toBe(true);
    expect(custom.totalHeldStitches).toBe(20);
    expect(custom.totalDepthRows).toBe(base.totalDepthRows);
    expect(isCustomDartDimensions("C", 4, 1)).toBe(true);
  });

  it("custom depth only changes depth rows / passes", () => {
    const custom = computeDartShapingFromPerInch({
      cupKey: "C",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      dartWidthInches: 3.25,
      dartDepthInches: 2,
    });
    expect(custom.ok).toBe(true);
    if (!custom.ok) return;
    expect(custom.customized).toBe(true);
    expect(custom.totalHeldStitches).toBe(16);
    expect(custom.totalDepthRows).toBe(14);
  });

  it("both values customized drive shaping", () => {
    const r = calculateBustDart(
      baseInput({ dartWidthInches: 2.5, dartDepthInches: 1.5 }),
    );
    expect(r.active).toBe(true);
    expect(r.shaping?.customized).toBe(true);
    expect(r.shaping?.dartWidthInches).toBe(2.5);
    expect(r.shaping?.dartDepthInches).toBe(1.5);
    expect(r.shaping?.customized).toBe(true);
    expect(r.config.cupSize).toBe("C");
    expect(r.instructionParagraphs.join("\n")).not.toMatch(/Cup C · Customized/);
    expect(r.config.dartWidthInches).toBe(2.5);
    expect(r.config.dartDepthInches).toBe(1.5);
  });

  it("changing cup size reloads that preset (resolve without overrides)", () => {
    const b = resolveDartDimensionsInches({ cupKey: "B" });
    const d = resolveDartDimensionsInches({ cupKey: "D" });
    expect(b.ok && d.ok).toBe(true);
    if (!b.ok || !d.ok) return;
    expect(b.dartWidthInches).toBe(3);
    expect(b.dartDepthInches).toBe(0.5);
    expect(d.dartWidthInches).toBe(3.5);
    expect(d.dartDepthInches).toBe(1.5);
  });

  it("preview uses edited display-unit values", () => {
    const ctx: BustDartPatternContext = {
      eligible: true,
      sizeGroup: "misses",
      unit: "in",
      frontConstruction: "pullover",
      stitchesPerInch: 5,
      rowsPerInch: 7,
      stitchGaugeDisplay: 20,
      rowGaugeDisplay: 28,
      frontStitchCount: 100,
      armholeOpeningGarmentRc: 140,
      hemRows: 22,
      bodyToArmholeRows: 118,
      config: emptyBustDartSavedConfig(),
      summary: {
        constructionLabel: "Sleeveless",
        garmentLabel: "Pullover",
        summaryLine: "Sleeveless Pullover • Women's 40",
        gaugeLabel: "",
        placementLabel: "",
        frontStitchesLabel: "",
      },
    };
    const preview = previewBustDartForPattern(ctx, {
      cupSize: "C",
      dartWidth: 4,
      dartDepth: 1,
    });
    expect(preview.active).toBe(true);
    expect(preview.shaping?.totalHeldStitches).toBe(20);
    expect(preview.shaping?.customized).toBe(true);
  });

  it("Add to Pattern saves edited values; remove clears them", () => {
    const stored = writeBustDartConfigToWorkingDraft(
      buildEnabledBustDartSavedConfig({
        cupSize: "C",
        dartWidthInches: 3.75,
        dartDepthInches: 1.1,
      }),
    );
    expect(stored).toEqual({
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.75,
      dartDepthInches: 1.1,
    });
    expect(writeBustDartConfigToWorkingDraft(emptyBustDartSavedConfig())).toEqual(
      emptyBustDartSavedConfig(),
    );
  });

  it("Update restores edited values from saved config (not cup defaults alone)", () => {
    const saved = normalizeBustDartSavedConfig({
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.75,
      dartDepthInches: 1.1,
    });
    const r = calculateBustDart(
      baseInput({
        cupSize: saved.cupSize,
        dartWidthInches: saved.dartWidthInches,
        dartDepthInches: saved.dartDepthInches,
      }),
    );
    expect(r.active).toBe(true);
    expect(r.shaping?.dartWidthInches).toBe(3.75);
    expect(r.shaping?.dartDepthInches).toBe(1.1);
    // Cup C defaults would be 3.25 / 1
    expect(r.shaping?.customized).toBe(true);
  });

  it("save and reopen retains exact custom values", () => {
    const pattern = womenPattern({
      [BUST_DART_STYLE_KEY]: {
        enabled: true,
        cupSize: "C",
        dartWidthInches: 3.75,
        dartDepthInches: 1.1,
      },
    });
    expect(readBustDartConfigFromPatternData(pattern)).toEqual({
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.75,
      dartDepthInches: 1.1,
    });
    const gen = generateSleevelessBackPattern(pattern);
    const slot = gen.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind === "bustDartCustomization" && slot.active).toBe(true);
    if (slot?.kind === "bustDartCustomization") {
      expect(slot.dartWidthInches).toBe(3.75);
      expect(slot.dartDepthInches).toBe(1.1);
      expect(slot.customized).toBe(true);
      expect(slot.instructionParagraphs.join("\n")).not.toMatch(/Customized/);
    }
  });

  it("legacy cup-only saved configuration uses preset defaults", () => {
    const legacy = normalizeBustDartSavedConfig({ enabled: true, cupSize: "C" });
    expect(legacy).toEqual({
      enabled: true,
      cupSize: "C",
      dartWidthInches: null,
      dartDepthInches: null,
    });
    const r = calculateBustDart(
      baseInput({
        cupSize: legacy.cupSize,
        dartWidthInches: legacy.dartWidthInches,
        dartDepthInches: legacy.dartDepthInches,
      }),
    );
    expect(r.active).toBe(true);
    expect(r.shaping?.dartWidthInches).toBe(3.25);
    expect(r.shaping?.dartDepthInches).toBe(1);
    expect(r.shaping?.customized).toBe(false);
    expect(r.shaping?.totalHeldStitches).toBe(16);
  });

  it("inches and centimeters produce physically equivalent results for custom dims", () => {
    const inch = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
      dartWidth: 3.5,
      dartDepth: 1.25,
    });
    const spi = 5;
    const rpi = 7;
    const cm = computeDartShaping({
      cupKey: "C",
      stitchGauge: spi * (10 / 2.54),
      rowGauge: rpi * (10 / 2.54),
      unit: "cm",
      dartWidth: roundToTwoDecimals(3.5 * 2.54),
      dartDepth: roundToTwoDecimals(1.25 * 2.54),
    });
    expect(inch.ok && cm.ok).toBe(true);
    if (!inch.ok || !cm.ok) return;
    expect(cm.totalHeldStitches).toBe(inch.totalHeldStitches);
    expect(cm.totalDepthRows).toBe(inch.totalDepthRows);
    expect(cm.shapingPasses).toBe(inch.shapingPasses);
  });

  it("custom values that do not fit are rejected with a clear error", () => {
    const tooWide = calculateBustDart(
      baseInput({ dartWidthInches: 30, dartDepthInches: 1 }),
    );
    expect(tooWide.active).toBe(false);
    expect(tooWide.errors[0]).toMatch(/enough stitches|too narrow|smaller dart/i);

    const zeroDepth = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
      dartWidth: 3,
      dartDepth: 0,
    });
    expect(zeroDepth.ok).toBe(false);
    if (zeroDepth.ok) return;
    expect(zeroDepth.error).toMatch(/greater than 0|Select a cup/i);
  });

  it("Sleeveless and Drop Shoulder pullover + cardigan use customized calculations", () => {
    const custom = {
      enabled: true,
      cupSize: "C",
      dartWidthInches: 3.75,
      dartDepthInches: 1.1,
    };
    const sleevelessPullover = generateSleevelessBackPattern(
      womenPattern({ [BUST_DART_STYLE_KEY]: custom }),
    );
    const sleevelessCardigan = generateSleevelessBackPattern(
      womenPattern({
        frontStyle: "open",
        garmentStyle: "cardigan",
        [BUST_DART_STYLE_KEY]: custom,
      }),
    );
    const dropPullover = generateDropShoulderPattern(
      womenPattern({
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        [BUST_DART_STYLE_KEY]: custom,
      }),
    );
    const dropCardigan = generateDropShoulderPattern(
      womenPattern({
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        frontStyle: "open",
        garmentStyle: "cardigan",
        [BUST_DART_STYLE_KEY]: custom,
      }),
    );

    for (const gen of [sleevelessPullover, sleevelessCardigan, dropPullover, dropCardigan]) {
      const text = frontText(gen.frontDisplayRows);
      const slot = gen.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
      expect(slot?.kind === "bustDartCustomization" && slot.customized).toBe(true);
      expect(text).toMatch(/Stop the row counter/);
      expect(text).not.toMatch(/Work the short-row bust darts/);
      expect(text).not.toMatch(/back or sleeves/i);
      expect(frontText(gen.displayRows)).not.toMatch(/bust dart/i);
    }
    expect(
      dropPullover.sleeveDisplayRows
        .flatMap((r) => (r.kind === "block" ? r.paragraphs ?? [] : []))
        .join("\n"),
    ).not.toMatch(/bust dart/i);
  });

  it("active custom instructions print; inactive prompt excluded; no duplicate continue-to-armhole", () => {
    const gen = generateSleevelessBackPattern(
      womenPattern({
        [BUST_DART_STYLE_KEY]: {
          enabled: true,
          cupSize: "C",
          dartWidthInches: 3.75,
          dartDepthInches: 1.1,
        },
      }),
    );
    const slot = gen.frontDisplayRows.find((r) => r.kind === "bustDartCustomization");
    expect(slot?.kind).toBe("bustDartCustomization");
    if (slot?.kind !== "bustDartCustomization") return;

    const printHtml = renderBustDartCustomizationPrintHtml(slot);
    expect(printHtml).toMatch(/Customized/);
    expect(printHtml).toMatch(/Cup C/);
    expect(printHtml).toMatch(/Stop the row counter/);
    expect(printHtml).not.toMatch(/Work the short-row bust darts/);
    expect(printHtml).not.toMatch(/Update Bust Dart|Remove Bust Dart/);

    const inactive = renderBustDartCustomizationScreenHtml({
      ...slot,
      active: false,
      instructionParagraphs: [],
      customized: false,
    });
    expect(inactive).toContain(OPTIONAL_BUST_DART_TIP_ID);
    expect(renderBustDartCustomizationPrintHtml({ ...slot, active: false, instructionParagraphs: [] })).toBe(
      "",
    );

    const front = frontText(gen.frontDisplayRows);
    expect(front).not.toMatch(/Continue knitting across all stitches to RC/i);
    const continueToArmhole = front.split("\n").filter((l) => /to RC \d+/i.test(l) && /even/i.test(l));
    expect(continueToArmhole.length).toBeGreaterThanOrEqual(1);
  });

  it("inactive hideable tip id remains unchanged", () => {
    expect(OPTIONAL_BUST_DART_TIP_ID).toBe("optional-bust-dart-front");
    const html = renderBustDartCustomizationScreenHtml({
      kind: "bustDartCustomization",
      active: false,
      cupSize: null,
      dartStartGarmentRc: 133,
      armholeOpeningGarmentRc: 140,
      placementOffsetRows: 7,
      rowsFromHemToDartStart: 111,
      rowsFromDartToArmhole: 7,
      instructionParagraphs: [],
      errors: [],
    });
    expect(html).toContain(`data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}"`);
    expect(html).toContain("Add Bust Dart");
  });
});
