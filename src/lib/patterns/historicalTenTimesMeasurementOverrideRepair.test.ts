import { beforeEach, describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import { loadProjectIntoWorkingDraft } from "./customPatternProjectClient";
import type { CustomPatternProject } from "./customPatternProjectTypes";
import {
  getCurrentPattern,
  replaceWorkingDraftFromSavedPattern,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { rawSwatchToPerInch } from "./rawSwatchGauge";
import { buildGeneratorPatternDataFromSources } from "./sleevelessPatternBuilderMerge";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { validateExpressPatternNeedles } from "./sleevelessExpressAvailableNeedles";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { diagramOverrideDefaultsFromChartRow } from "./customBuildMeasurementOverrideReconcile";
import { buildDropShoulderReviewMergedInches } from "./dropShoulderReviewDiagramRefresh";
import { loadMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import {
  centimetersToCanonicalInches,
  formatCanonicalInchesFromCm,
  formatMeasurementDisplayFromInches,
  parseMeasurementInputToInches,
} from "./patternMeasurementDisplayUnit";
import {
  isHistoricalTenTimesMeasurementOverride,
  repairHistoricalTenTimesMeasurementOverrides,
  repairSavedPatternMeasurementOverrides,
} from "./historicalTenTimesMeasurementOverrideRepair";
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
const CORRECT_METRIC = rawSwatchToPerInch("17", "25", "cm");
/** 191 cm is 19.1 cm with the decimal removed — the historical neck corruption. */
const CORRUPT_NECK_INCHES = formatCanonicalInchesFromCm(centimetersToCanonicalInches(191));

function womensDropShoulderRecord(
  fitExtras: Record<string, unknown> = {},
  yarnGauge: Record<string, unknown> = {
    ...METRIC_RAW,
    stitchGauge: CORRECT_METRIC.gaugeStitchesPerInch,
    rowGauge: CORRECT_METRIC.gaugeRowsPerInch,
    gaugeUnits: "per_inch",
  },
): SleevelessPatternRecord {
  return {
    id: "pattern-ten-x-overrides",
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
      ...fitExtras,
    },
    yarnGauge,
    measurements: {},
    machine: { availableNeedles: "150" },
    calculations: {},
    instructions: {},
    patternProject: { title: "Women's Drop Shoulder", notes: "" },
  };
}

function projectFor(record: SleevelessPatternRecord): CustomPatternProject {
  return {
    id: record.id,
    name: "Women's Drop Shoulder",
    family: "sleeveless",
    source: "express",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: 1,
    pattern: record,
    customOverrides: {},
  };
}

const corruptOverrides = {
  chestBust: "450",
  hip: "450",
  finishedNeckOpeningWidth: CORRUPT_NECK_INCHES,
  finishedLength: "24.5",
  neckDepth: "5",
  hemDepth: "2",
};

function generateFromRecord(record: SleevelessPatternRecord) {
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
  return { gen, result: generateDropShoulderPattern(gen) };
}

describe("historical 10× measurement overrides", () => {
  beforeEach(() => {
    stubLocalStorage();
  });

  it("normalizes a saved Women's size 7 relaxed straight pattern before cast-on and the needle check", () => {
    const record = womensDropShoulderRecord({ cbMeasurementOverrides: corruptOverrides });

    loadProjectIntoWorkingDraft(projectFor(record));

    const stored = getCurrentPattern().fit.cbMeasurementOverrides as Record<string, string>;
    expect(stored.chestBust).toBe("45");
    expect(stored.hip).toBe("45");
    expect(stored.finishedNeckOpeningWidth).toBe("7.5");
    expect(stored.finishedLength).toBe("24.5");
    expect(stored.neckDepth).toBe("5");
    expect(stored.hemDepth).toBe("2");
    expect(formatMeasurementDisplayFromInches(45, "cm")).toBe("114.3");
    expect(formatMeasurementDisplayFromInches(7.5, "cm")).toBe("19.1");

    const { result } = generateFromRecord(getCurrentPattern());
    expect(result.debug.finishedBustChest).toBe(45);
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
    expect(validateExpressPatternNeedles("150", result)).toEqual({
      ok: true,
      requiredNeedles: 98,
      availableNeedles: 150,
    });
  });

  it("repairs the Edit diagram source before the fields are shown, so Save reads 114.3 cm rather than 1143 cm", () => {
    const record = womensDropShoulderRecord({ cbMeasurementOverrides: corruptOverrides });
    replaceWorkingDraftFromSavedPattern(record, { title: "Women's Drop Shoulder", notes: "" });
    expect(
      (getCurrentPattern().fit.cbMeasurementOverrides as Record<string, string>).chestBust,
    ).toBe("450");

    const merged = buildDropShoulderReviewMergedInches({
      row: WOMENS_SIZE_7,
      selectedSize: "7",
      fitPreference: "relaxed",
      audience: "misses",
      bodyShape: "straight",
    });

    expect(merged.chestBust).toBe("45");
    expect(merged.hip).toBe("45");
    expect(merged.finishedNeckOpeningWidth).toBe("7.5");
    expect(formatMeasurementDisplayFromInches(Number(merged.chestBust), "cm")).toBe("114.3");
    expect(formatMeasurementDisplayFromInches(Number(merged.finishedNeckOpeningWidth), "cm")).toBe(
      "19.1",
    );
    expect(loadMeasurementOverrides().chestBust).toBe("45");

    const savedFromCorrectedDisplay = parseMeasurementInputToInches("114.3", "cm");
    expect(savedFromCorrectedDisplay).toBeCloseTo(45, 1);
    expect(formatMeasurementDisplayFromInches(savedFromCorrectedDisplay, "cm")).toBe("114.3");
  });

  it("repairs overrides inside pattern generation even when the working draft was not reloaded", () => {
    const record = womensDropShoulderRecord({ cbMeasurementOverrides: corruptOverrides });
    const { gen, result } = generateFromRecord(record);
    const overrides = (gen.fit as Record<string, unknown>).cbMeasurementOverrides as Record<
      string,
      string
    >;
    expect(overrides.chestBust).toBe("45");
    expect(overrides.hip).toBe("45");
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
    expect(validateExpressPatternNeedles("150", result).ok).toBe(true);
  });

  it("leaves a newly created metric pattern on the current centimeter conversion", () => {
    expect(centimetersToCanonicalInches(114.3)).toBeCloseTo(45, 4);
    expect(formatCanonicalInchesFromCm(centimetersToCanonicalInches(114.3))).toBe("45");
    expect(centimetersToCanonicalInches(19.1)).toBeCloseTo(7.5197, 3);

    const fresh = womensDropShoulderRecord({
      cbMeasurementOverrides: {
        chestBust: "45",
        hip: "45",
        finishedNeckOpeningWidth: "7.5",
        finishedLength: "24.5",
      },
    });
    const repaired = repairSavedPatternMeasurementOverrides(fresh);
    expect(repaired).toBe(fresh);
    const { result } = generateFromRecord(fresh);
    expect(result.debug.finishedBustChest).toBe(45);
    expect(result.debug.bustBodyStitches).toBe(98);
    expect(result.debug.hemCastOnStitches).toBe(98);
  });

  it("keeps a legitimate custom override that is not about 10× the chart default", () => {
    expect(isHistoricalTenTimesMeasurementOverride(52, 45)).toBe(false);
    expect(isHistoricalTenTimesMeasurementOverride(90, 45)).toBe(false);
    expect(isHistoricalTenTimesMeasurementOverride(75.1969, 7.5)).toBe(true);
    expect(isHistoricalTenTimesMeasurementOverride(450, 45)).toBe(true);

    const record = womensDropShoulderRecord({
      cbMeasurementOverrides: { chestBust: "52", hip: "52", finishedNeckOpeningWidth: "8" },
    });
    const repaired = repairSavedPatternMeasurementOverrides(record);
    expect(repaired).toBe(record);
    const { gen, result } = generateFromRecord(record);
    const overrides = (gen.fit as Record<string, unknown>).cbMeasurementOverrides as Record<
      string,
      string
    >;
    expect(overrides.chestBust).toBe("52");
    expect(overrides.hip).toBe("52");
    expect(overrides.finishedNeckOpeningWidth).toBe("8");
    expect(result.debug.finishedBustChest).toBe(52);
    expect(result.debug.bustBodyStitches).not.toBe(98);
  });

  it("leaves imperial patterns and patterns without overrides unchanged", () => {
    const imperial = womensDropShoulderRecord(
      { cbMeasurementOverrides: { chestBust: "45", hip: "46", finishedLength: "24.5" } },
      {
        gaugeStitchRaw: "28",
        gaugeRowRaw: "44",
        gaugeRawUnit: "in",
        stitchGauge: "7",
        rowGauge: "11",
      },
    );
    expect(repairSavedPatternMeasurementOverrides(imperial)).toBe(imperial);
    const imperialResult = generateFromRecord(imperial).result;
    const imperialBaseline = generateFromRecord(
      womensDropShoulderRecord({}, {
        gaugeStitchRaw: "28",
        gaugeRowRaw: "44",
        gaugeRawUnit: "in",
        stitchGauge: "7",
        rowGauge: "11",
      }),
    ).result;
    expect(imperialResult.debug.finishedBustChest).toBe(45);
    expect(imperialResult.debug.bustBodyStitches).toBe(imperialBaseline.debug.bustBodyStitches);

    const withoutOverrides = womensDropShoulderRecord();
    expect(repairSavedPatternMeasurementOverrides(withoutOverrides)).toBe(withoutOverrides);
    const plain = generateFromRecord(withoutOverrides).result;
    expect(plain.debug.finishedBustChest).toBe(45);
    expect(plain.debug.bustBodyStitches).toBe(98);
    expect(plain.debug.hemCastOnStitches).toBe(98);
  });

  it("repairs sleeve and other diagram fields only when they match the 10× signature", () => {
    const defaults = diagramOverrideDefaultsFromChartRow(WOMENS_SIZE_7, "relaxed", "misses", {
      bodyShape: "straight",
      dropShoulder: true,
    });
    const repaired = repairHistoricalTenTimesMeasurementOverrides(
      {
        upperArm: String(Number(defaults.upperArm) * 10),
        sleeveLength: String(Number(defaults.sleeveLength) * 10),
        wrist: "9",
        neckDepth: "50",
        finishedLength: "30",
        hemDepth: formatCanonicalInchesFromCm(centimetersToCanonicalInches(51)),
        shoulderWidth: String(Number(defaults.shoulderWidth) * 10),
        chestBust: "50",
      },
      {
        audience: "misses",
        selectedSize: "7",
        fitPreference: "relaxed",
        bodyShape: "straight",
        dropShoulder: true,
        chartRow: WOMENS_SIZE_7,
      },
    );

    expect(repaired.upperArm).toBe(defaults.upperArm);
    expect(repaired.sleeveLength).toBe(defaults.sleeveLength);
    expect(repaired.wrist).toBe("9");
    expect(repaired.neckDepth).toBe(defaults.neckDepth);
    expect(repaired.finishedLength).toBe("30");
    expect(repaired.hemDepth).toBe(defaults.hemDepth);
    expect(repaired.shoulderWidth).toBe(defaults.shoulderWidth);
    expect(repaired.chestBust).toBe("50");
  });
});
