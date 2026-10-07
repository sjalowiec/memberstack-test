import { beforeEach, describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  getCurrentPattern,
  getPatternData,
  replaceWorkingDraftFromSavedPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { rawSwatchToPerInch } from "./rawSwatchGauge";
import { extractSavedPatternGauge } from "./savedPatternGaugeDisplay";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { buildGeneratorPatternDataFromSources } from "./sleevelessPatternBuilderMerge";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { validateExpressPatternNeedles } from "./sleevelessExpressAvailableNeedles";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { stubLocalStorage } from "./test/stubLocalStorage";

/** Women's misses chart size 7 — matches `public/data/sizing_sweaters_misses.json`. */
const WOMENS_SIZE_7: ChartRow = {
  size: 7,
  bust_or_chest: 40,
  waist: 31,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const METRIC_RAW = { gaugeStitchRaw: "17", gaugeRowRaw: "25", gaugeRawUnit: "cm" as const };
const CORRECT_METRIC_SPI = (17 / 10) * 2.54;
const BAD_STORED_SPI = 17 * 2.54;

function womensDropShoulderRecord(
  yarnGauge: Record<string, unknown>,
): SleevelessPatternRecord {
  return {
    id: "pattern-metric-gauge",
    patternType: "sleeveless",
    status: "draft",
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    style: withDropShoulderConstructionAuthored(
      {
        recipientCategory: "misses",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
        neckline: "round",
        patternMode: "express",
      },
      "long",
    ),
    fit: {
      sizingChart: "misses",
      selectedSize: "7",
      easeChoice: "relaxed",
      fitChoice: "relaxed",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(WOMENS_SIZE_7, "relaxed", {
        bodyShape: "straight",
      }),
    },
    yarnGauge,
    measurements: {},
    machine: { availableNeedles: "150" },
    calculations: {},
    instructions: {},
    patternProject: { title: "Metric gauge", notes: "" },
  };
}

function generateFromStoredGauge(record: SleevelessPatternRecord) {
  const patternBuilderData = {
    style: record.style,
    fit: record.fit,
    yarnGauge: record.yarnGauge,
    yarnGaugeMachine: {
      gaugeStitchesPerInch: record.yarnGauge.stitchGauge,
      gaugeRowsPerInch: record.yarnGauge.rowGauge,
      gaugeStitchRaw: record.yarnGauge.gaugeStitchRaw,
      gaugeRowRaw: record.yarnGauge.gaugeRowRaw,
      gaugeRawUnit: record.yarnGauge.gaugeRawUnit,
      availableNeedles: "150",
    },
    machine: record.machine,
  };
  const gen = buildGeneratorPatternDataFromSources(record, patternBuilderData, record);
  return generateDropShoulderPattern(gen);
}

describe("saved metric swatch gauge", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("calculates 98 stitches for a new 17 sts / 25 rows per 10 cm pattern", () => {
    const converted = rawSwatchToPerInch("17", "25", "cm");
    expect(Number(converted.gaugeStitchesPerInch)).toBeCloseTo(CORRECT_METRIC_SPI, 5);

    const result = generateFromStoredGauge(
      womensDropShoulderRecord({
        ...METRIC_RAW,
        stitchGauge: converted.gaugeStitchesPerInch,
        rowGauge: converted.gaugeRowsPerInch,
        gaugeUnits: "per_inch",
      }),
    );

    expect(result.debug.finishedBustChest).toBe(45);
    expect(result.debug.stitchesPerInch).toBeCloseTo(CORRECT_METRIC_SPI, 5);
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
    expect(validateExpressPatternNeedles("150", result)).toEqual({
      ok: true,
      requiredNeedles: 98,
      availableNeedles: 150,
    });
  });

  it("regenerates a saved pattern that stored spi ≈ 43.18 from the raw 17 / 10 cm swatch", () => {
    const record = womensDropShoulderRecord({
      ...METRIC_RAW,
      stitchGauge: String(BAD_STORED_SPI),
      rowGauge: String(25 * 2.54),
      gaugeUnits: "per_inch",
    });

    const result = generateFromStoredGauge(record);

    expect(result.debug.stitchesPerInch).toBeCloseTo(CORRECT_METRIC_SPI, 5);
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
    expect(result.debug.bustBodyStitches).not.toBe(972);
    expect(validateExpressPatternNeedles("150", result).ok).toBe(true);
    expect(extractSavedPatternGauge(record.yarnGauge)?.stitchesPerInch).toBeCloseTo(
      CORRECT_METRIC_SPI,
      5,
    );
  });

  it("reopening the saved pattern keeps the 98-stitch calculation", () => {
    const record = womensDropShoulderRecord({
      ...METRIC_RAW,
      stitchGauge: String(BAD_STORED_SPI),
      rowGauge: String(25 * 2.54),
    });

    replaceWorkingDraftFromSavedPattern(record, { title: "Metric gauge", notes: "" });

    expect(Number(getCurrentPattern().yarnGauge.stitchGauge)).toBeCloseTo(CORRECT_METRIC_SPI, 5);
    expect(Number(getPatternData().yarnGaugeMachine.gaugeStitchesPerInch)).toBeCloseTo(
      CORRECT_METRIC_SPI,
      5,
    );
    expect(getCurrentPattern().yarnGauge.gaugeStitchRaw).toBe("17");
    expect(getCurrentPattern().yarnGauge.gaugeRawUnit).toBe("cm");

    const result = generateDropShoulderPattern(buildCustomBuildEffectivePatternInput());
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
  });

  it("editing and recalculating still uses the raw swatch when a stale per-inch value is present", () => {
    const record = womensDropShoulderRecord({
      ...METRIC_RAW,
      stitchGauge: String(BAD_STORED_SPI),
      rowGauge: String(25 * 2.54),
    });
    replaceWorkingDraftFromSavedPattern(record, { title: "Metric gauge", notes: "" });

    const edited = rawSwatchToPerInch("17", "25", "cm");
    savePatternData("yarnGauge", {
      stitchGauge: edited.gaugeStitchesPerInch,
      rowGauge: edited.gaugeRowsPerInch,
      gaugeStitchRaw: "17",
      gaugeRowRaw: "25",
      gaugeRawUnit: "cm",
    });
    savePatternData("yarnGaugeMachine", {
      gaugeStitchesPerInch: String(BAD_STORED_SPI),
      gaugeRowsPerInch: String(25 * 2.54),
      gaugeStitchRaw: "17",
      gaugeRowRaw: "25",
      gaugeRawUnit: "cm",
      availableNeedles: "150",
    });

    const result = generateDropShoulderPattern(buildCustomBuildEffectivePatternInput());
    expect(Number(result.debug.stitchesPerInch)).toBeCloseTo(CORRECT_METRIC_SPI, 5);
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
  });

  it("keeps imperial stitch counts when the raw swatch and stored per-inch gauge agree", () => {
    const imperialRaw = {
      gaugeStitchRaw: "28",
      gaugeRowRaw: "44",
      gaugeRawUnit: "in" as const,
      stitchGauge: "7",
      rowGauge: "11",
    };
    const withRaw = generateFromStoredGauge(womensDropShoulderRecord(imperialRaw));
    const storedOnly = generateFromStoredGauge(
      womensDropShoulderRecord({ stitchGauge: "7", rowGauge: "11" }),
    );

    expect(withRaw.debug.stitchesPerInch).toBe(7);
    expect(withRaw.debug.bustBodyStitches).toBe(storedOnly.debug.bustBodyStitches);
    expect(withRaw.debug.hemCastOnStitches).toBe(storedOnly.debug.hemCastOnStitches);
  });

  it("keeps a legacy derived gauge when the raw swatch triple is incomplete", () => {
    const legacy = generateFromStoredGauge(
      womensDropShoulderRecord({
        stitchGauge: String(BAD_STORED_SPI),
        rowGauge: String(25 * 2.54),
      }),
    );

    expect(legacy.debug.stitchesPerInch).toBeCloseTo(BAD_STORED_SPI, 5);
    expect(legacy.debug.bustBodyStitches).toBe(972);
    expect(legacy.debug.hemCastOnStitches).toBe(972);

    const rawWithoutUnit = generateFromStoredGauge(
      womensDropShoulderRecord({
        gaugeStitchRaw: "17",
        gaugeRowRaw: "25",
        stitchGauge: "5",
        rowGauge: "7",
      }),
    );
    expect(rawWithoutUnit.debug.stitchesPerInch).toBe(5);
    expect(rawWithoutUnit.debug.bustBodyStitches).not.toBe(98);
  });
});
