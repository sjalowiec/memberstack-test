import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcileCustomBuildDiagramOverridesAfterSizingChange } from "./customBuildMeasurementOverrideReconcile";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import {
  repairHistoricalTenTimesMeasurementOverrides,
  repairSavedPatternMeasurementOverrides,
} from "./historicalTenTimesMeasurementOverrideRepair";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { validateSidewaysCardiganBuilder } from "./sidewaysCardiganBuilderValidation";
import { defaultSidewaysCardiganStyleMeasurements } from "./sidewaysCardiganStyleMeasurements";

type PlusRow = ChartRow & { size: string; neck_to_waist: number };
type MenRow = ChartRow & { size: string };

const plusChart = JSON.parse(
  readFileSync(resolve("public/data/sizing_sweaters_plus.json"), "utf8"),
) as PlusRow[];
const menChart = JSON.parse(
  readFileSync(resolve("public/data/sizing_sweaters_men.json"), "utf8"),
) as MenRow[];

const PLUS_GARMENT_LENGTHS: Record<string, number> = {
  X: 25,
  "1x": 25.5,
  "2x": 26,
  "3x": 26.5,
  "4x": 27,
  "5x": 27.5,
  "6x": 28,
};

const PLUS_NECK_TO_WAIST: Record<string, number> = {
  X: 16.75,
  "1x": 17,
  "2x": 17.25,
  "3x": 17.5,
  "4x": 17.75,
  "5x": 17.75,
  "6x": 18.25,
};

const MEN_HIPS: Record<string, number> = {
  Sm: 36.5,
  Med: 38.5,
  Lg: 41,
  XL: 43,
  "1X": 45,
  "2X": 48,
  "3X": 50,
  "4X": 52.5,
  "5X": 54.5,
};

const MEN_CHEST_AND_WAIST: Record<string, { chest: number; waist: number }> = {
  Sm: { chest: 34, waist: 28 },
  Med: { chest: 36, waist: 30 },
  Lg: { chest: 38, waist: 32 },
  XL: { chest: 40, waist: 34 },
  "1X": { chest: 42, waist: 36 },
  "2X": { chest: 44, waist: 39 },
  "3X": { chest: 46, waist: 42 },
  "4X": { chest: 48, waist: 44 },
  "5X": { chest: 50, waist: 46 },
};

function plusRow(size: string): PlusRow {
  const row = plusChart.find((entry) => entry.size === size);
  if (!row) throw new Error(`missing plus size ${size}`);
  return row;
}

function menRow(size: string): MenRow {
  const row = menChart.find((entry) => entry.size === size);
  if (!row) throw new Error(`missing men's size ${size}`);
  return row;
}

describe("approved sizing chart corrections", () => {
  it("sets plus finished lengths and keeps neck-to-waist", () => {
    expect(plusChart.map((row) => row.size)).toEqual(Object.keys(PLUS_GARMENT_LENGTHS));
    for (const [size, length] of Object.entries(PLUS_GARMENT_LENGTHS)) {
      const row = plusRow(size);
      expect(row.garment_back_length).toBe(length);
      expect(row.neck_to_waist).toBe(PLUS_NECK_TO_WAIST[size]);
      expect(Number(row.garment_back_length)).toBeGreaterThan(Number(row.neck_to_waist));
    }
  });

  it("sets men's hips to full circumferences and leaves chest and waist", () => {
    expect(menChart.map((row) => row.size)).toEqual(Object.keys(MEN_HIPS));
    for (const [size, hip] of Object.entries(MEN_HIPS)) {
      const row = menRow(size);
      const body = MEN_CHEST_AND_WAIST[size];
      expect(row.hip).toBe(hip);
      expect(row.bust_or_chest).toBe(body.chest);
      expect(row.waist).toBe(body.waist);
      expect(Number(row.hip)).toBeGreaterThan(Number(row.bust_or_chest));
    }
  });

  it("seeds new sleeveless, drop-shoulder, and sideways defaults from the corrected charts", () => {
    for (const [size, length] of Object.entries(PLUS_GARMENT_LENGTHS)) {
      const row = plusRow(size);
      const seeded = computeDefaultMeasurementsFromChartRow(row, "standard", {
        bodyShape: "straight",
      });
      expect(seeded.back_neck_to_hem).toBe(length);
      const sideways = defaultSidewaysCardiganStyleMeasurements({
        row,
        chartAudience: "plus",
        fitPreference: "standard",
        sleeveLengthChoice: "long",
      });
      expect(sideways.finishedLength).toBe(String(length));
    }

    const menSmall = computeDefaultMeasurementsFromChartRow(menRow("Sm"), "standard", {
      bodyShape: "aline",
    });
    expect(menSmall.finished_hip).toBe(39.5);
    const menSmallStraight = computeDefaultMeasurementsFromChartRow(menRow("Sm"), "standard", {
      bodyShape: "straight",
    });
    expect(menSmallStraight.finished_hip).toBe(menSmallStraight.finished_bust_chest);
  });

  it("keeps a saved plus length when the chart default is now longer", () => {
    const savedExpress = resolveEffectiveFinishedLengthInches({
      style: { patternMode: "express", recipientCategory: "plus" },
      fit: {
        selectedSize: "1x",
        selectedMeasurements: { back_neck_to_hem: 17 },
      },
    });
    expect(savedExpress).toBe(17);

    const savedCustom = resolveEffectiveFinishedLengthInches({
      style: { patternMode: "custom-build", recipientCategory: "plus" },
      fit: {
        selectedSize: "1x",
        selectedMeasurements: { back_neck_to_hem: 25.5 },
        cbMeasurementOverrides: { finishedLength: "17" },
      },
    });
    expect(savedCustom).toBe(17);
  });

  it("keeps an old plus length when the knitter changes size after the chart correction", () => {
    const kept = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: plusRow("1x"),
      previousFit: "standard",
      currentRow: plusRow("2x"),
      currentFit: "standard",
      overrides: { finishedLength: "17", hip: "45" },
      audience: "plus",
      bodyShape: "straight",
    });
    expect(kept.finishedLength).toBe("17");

    const reseeded = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: plusRow("1x"),
      previousFit: "standard",
      currentRow: plusRow("2x"),
      currentFit: "standard",
      overrides: { finishedLength: "25.5" },
      audience: "plus",
      bodyShape: "straight",
    });
    expect(reseeded.finishedLength).toBe("26");
  });

  it("repairs a 10× copy of the new default and leaves saved plus lengths alone", () => {
    const context = {
      audience: "plus",
      selectedSize: "1x",
      fitPreference: "standard",
      bodyShape: "straight",
    };
    expect(
      repairHistoricalTenTimesMeasurementOverrides({ finishedLength: "17" }, context),
    ).toEqual({ finishedLength: "17" });
    expect(
      repairHistoricalTenTimesMeasurementOverrides({ finishedLength: "170" }, context),
    ).toEqual({ finishedLength: "170" });
    expect(
      repairHistoricalTenTimesMeasurementOverrides({ finishedLength: "255" }, context).finishedLength,
    ).toBe("25.5");

    const saved = repairSavedPatternMeasurementOverrides({
      style: { recipientCategory: "plus", bodyShape: "straight" },
      fit: {
        selectedSize: "1x",
        selectedMeasurements: { back_neck_to_hem: 17 },
        cbMeasurementOverrides: { finishedLength: "17", hip: "45" },
      },
    });
    expect(saved.fit.cbMeasurementOverrides).toEqual({ finishedLength: "17", hip: "45" });
    expect(saved.fit.selectedMeasurements).toEqual({ back_neck_to_hem: 17 });
  });

  it("still blocks a sideways plus body that is longer than the needle bed", () => {
    const row = plusRow("6x");
    const style = defaultSidewaysCardiganStyleMeasurements({
      row,
      chartAudience: "plus",
      fitPreference: "standard",
      sleeveLengthChoice: "long",
    });
    const blocked = validateSidewaysCardiganBuilder({
      chartAudience: "plus",
      selectedSize: "6x",
      fit: "standard",
      garmentStyle: "pullover",
      finishedLengthInches: style.finishedLength,
      vNeckDepthInches: style.vNeckDepth,
      neckOpeningWidthInches: style.neckOpeningWidth,
      finishedUpperArmInches: style.finishedUpperArm,
      sleeveLengthInches: style.sleeveLength,
      wristInches: style.wrist,
      finishedBustInches: 66,
      stitchesPerInch: 8,
      rowsPerInch: 11,
      availableNeedles: 200,
    });
    expect(blocked?.code).toBe("needles-exceeded");
    expect(blocked?.message).toMatch(/224 needles/);
    expect(blocked?.message).toMatch(/shorter length/);

    const savedShortLength = validateSidewaysCardiganBuilder({
      chartAudience: "plus",
      selectedSize: "6x",
      fit: "standard",
      garmentStyle: "pullover",
      finishedLengthInches: 18.25,
      vNeckDepthInches: style.vNeckDepth,
      neckOpeningWidthInches: style.neckOpeningWidth,
      finishedUpperArmInches: style.finishedUpperArm,
      sleeveLengthInches: style.sleeveLength,
      wristInches: style.wrist,
      finishedBustInches: 66,
      stitchesPerInch: 8,
      rowsPerInch: 11,
      availableNeedles: 200,
    });
    expect(savedShortLength).toBeNull();
  });
});
