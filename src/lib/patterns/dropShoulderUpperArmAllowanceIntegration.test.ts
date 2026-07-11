import { describe, expect, it } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  dropShoulderSleeveDefaultsFromChartRow,
  reconcileDropShoulderSleeveOverridesForSizeChange,
  resolveDropShoulderSleeveInches,
  resolveDropShoulderSleeveOverrideStrings,
} from "./dropShoulderSleeveMeasurementOverrides";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { DropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";

/** Misses size 7 — matches `public/data/sizing_sweaters_misses.json` (body upper_arm 12). */
const MISSES_7: ChartRow = {
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

/** Men's Med (body upper_arm 13). */
const MENS_MED: ChartRow = {
  size: "Med",
  bust_or_chest: 36,
  garment_back_length: 26,
  armhole_depth: 9,
  shoulder_width: 16.5,
  neck_opening: 6.5,
  front_neck_depth: 4.25,
  back_neck_depth: 1,
  upper_arm: 13,
  wrist: 6.5,
  sleeve_length: 18.25,
};

const NONE_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: false,
  sleeveLength: false,
  cuffCircumference: false,
};

const UPPER_ARM_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: true,
  sleeveLength: false,
  cuffCircumference: false,
};

function upperArmForFit(chartRow: ChartRow, chartAudience: string, fit: string): string | undefined {
  return resolveDropShoulderSleeveOverrideStrings({
    overrides: {},
    chartRow,
    fitPreference: fit,
    chartAudience,
    userEdited: NONE_EDITED,
  }).upperArm;
}

describe("New Drop Shoulder pattern — finished upper arm per fit", () => {
  it("Misses gives a distinct upper-arm value for Close, Standard, and Oversized", () => {
    const close = upperArmForFit(MISSES_7, "misses", "close");
    const standard = upperArmForFit(MISSES_7, "misses", "standard");
    const oversized = upperArmForFit(MISSES_7, "misses", "relaxed");

    // body 12 + {7.1, 8.7, 10.2} ? 19.0 / 20.75 / 22.25.
    expect(close).toBe("19");
    expect(standard).toBe("20.75");
    expect(oversized).toBe("22.25");
    expect(new Set([close, standard, oversized]).size).toBe(3);
  });

  it("Men gives a distinct upper-arm value for Close, Standard, and Oversized", () => {
    const close = upperArmForFit(MENS_MED, "men", "close");
    const standard = upperArmForFit(MENS_MED, "men", "standard");
    const oversized = upperArmForFit(MENS_MED, "men", "relaxed");

    // body 13 + {3.9, 5.5, 7.1} ? 17.0 / 18.5 / 20.0.
    expect(close).toBe("17");
    expect(standard).toBe("18.5");
    expect(oversized).toBe("20");
    expect(new Set([close, standard, oversized]).size).toBe(3);
  });
});

describe("Changing fit recalculates a system-default upper arm", () => {
  it("a stale (non-user-edited) override is refreshed to the new fit's finished value", () => {
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "19" }, // previous Close value persisted
      chartRow: MISSES_7,
      fitPreference: "standard",
      chartAudience: "misses",
      userEdited: NONE_EDITED,
    });
    expect(resolved.upperArm).toBe("20.75");
  });
});

describe("Manual upper-arm override is protected across fit changes", () => {
  it("keeps the user's value when the fit changes", () => {
    for (const fit of ["close", "standard", "relaxed"]) {
      const resolved = resolveDropShoulderSleeveOverrideStrings({
        overrides: { upperArm: "15" },
        chartRow: MISSES_7,
        fitPreference: fit,
        chartAudience: "misses",
        userEdited: UPPER_ARM_EDITED,
      });
      expect(resolved.upperArm).toBe("15");
    }
  });
});

describe("Editing a saved pattern — size/fit reconcile", () => {
  it("refreshes a system-default upper arm to the finished value", () => {
    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "9.75", wrist: "5.25", sleeveLength: "16.25" },
      MISSES_7,
      "standard",
      NONE_EDITED,
      { chartAudience: "misses" },
    );
    expect(next.upperArm).toBe("20.75");
  });

  it("preserves a user-edited upper arm", () => {
    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      { upperArm: "15", wrist: "5.25", sleeveLength: "16.25" },
      MISSES_7,
      "standard",
      UPPER_ARM_EDITED,
      { chartAudience: "misses" },
    );
    expect(next.upperArm).toBe("15");
  });
});

describe("Sleeveless / no-audience behavior is unchanged", () => {
  it("computeDefaultMeasurementsFromChartRow still returns the raw body upper arm (no allowance)", () => {
    // Shared with Sleeveless — must never add the Drop Shoulder allowance.
    expect(computeDefaultMeasurementsFromChartRow(MISSES_7, "standard").upper_arm).toBe(12);
    expect(computeDefaultMeasurementsFromChartRow(MENS_MED, "close").upper_arm).toBe(13);
  });

  it("dropShoulderSleeveDefaultsFromChartRow without an audience keeps the body value", () => {
    expect(dropShoulderSleeveDefaultsFromChartRow(MISSES_7, "standard").upperArm).toBe("12");
  });
});

describe("Pattern generation consumes the finished upper arm", () => {
  const F = resolveDropShoulderSleeveInches({
    overrides: {},
    chartRow: MISSES_7,
    fitPreference: "standard",
    chartAudience: "misses",
  }).upperArmIn;

  function missesGeneratorPatternData(): Record<string, unknown> {
    const selectedMeasurements = {
      ...computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", { bodyShape: "straight" }),
      upper_arm: F, // finished (allowance-added) value the resolver produces in production
    };
    return {
      fit: {
        sizingChart: "misses",
        selectedSize: 7,
        easeChoice: "standard",
        selectedMeasurements,
      },
      style: {
        construction: "drop-shoulder",
        constructionAuthored: "drop-shoulder",
        recipientCategory: "misses",
        neckline: "round",
        bodyShape: "straight",
        frontStyle: "closed",
        garmentStyle: "pullover",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
  }

  it("resolver produces the finished value (body 12 + standard 8.7 = 20.75)", () => {
    expect(F).toBe(20.75);
  });

  it("sleeve-top stitches use the finished upper arm (20.75 × 5 = 104 sts)", () => {
    const result = generateDropShoulderPattern(missesGeneratorPatternData());
    expect(result.debug.dropShoulderUpperArmInches).toBe(20.75);
    expect(result.debug.dropShoulderSleeveTopStitches).toBe(104);
  });

  it("armhole depth uses finished upper arm ÷ 2", () => {
    const result = generateDropShoulderPattern(missesGeneratorPatternData());
    expect(result.debug.armholeDepth).toBe(computeDropShoulderArmholeDepthInches(20.75));
    expect(result.debug.armholeDepth).toBe(10.375);
  });

  it("sleeve-top width equals the total front+back armhole opening (2 × armhole depth)", () => {
    const result = generateDropShoulderPattern(missesGeneratorPatternData());
    const upperArm = result.debug.dropShoulderUpperArmInches!;
    const armholeDepth = result.debug.armholeDepth!;
    expect(upperArm).toBe(2 * armholeDepth);
  });
});
