import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  dropShoulderSleeveDefaultsFromChartRow,
  reconcileDropShoulderSleeveOverridesForSizeChange,
  resolveDropShoulderSleeveInches,
  resolveDropShoulderSleeveOverrideStrings,
} from "./dropShoulderSleeveMeasurementOverrides";
import {
  clearDropShoulderUserEditedSleeveFields,
  markDropShoulderSleeveFieldUserEdited,
  readDropShoulderUserEditedSleeveFields,
} from "./dropShoulderUserEditedSleeveFields";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const size1Row: ChartRow = {
  size: 1,
  bust_or_chest: 32,
  upper_arm: 9.75,
  wrist: 5.25,
  sleeve_length: 16.25,
};

const size7Row: ChartRow = {
  size: 7,
  label: "Size 7 (Bust 40″)",
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

describe("dropShoulderUserEditedSleeveFields + sleeve reconcile", () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    clearDropShoulderUserEditedSleeveFields();
  });

  it("New Drop Shoulder Size 1 → review sleeve values from Size 1 chart", () => {
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: {},
      chartRow: size1Row,
      fitPreference: "standard",
    });
    expect(resolved.upperArm).toBe("9.75");
    expect(resolved.sleeveLength).toBe("16.25");
    expect(resolved.wrist).toBe("5.25");
  });

  it("Size 1 → Size 7 refreshes all chart-owned sleeve fields when none are user-edited", () => {
    const staleOverrides = {
      upperArm: "9.75",
      wrist: "5.25",
      sleeveLength: "16.25",
      chestBust: "43",
    };

    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      staleOverrides,
      size7Row,
      "standard",
      readDropShoulderUserEditedSleeveFields(),
    );

    expect(next.upperArm).toBe("12");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6");
    expect(next.chestBust).toBe("43");
  });

  it("preserves user-edited upper arm when size changes; other sleeve fields refresh from chart", () => {
    markDropShoulderSleeveFieldUserEdited("upperArm");
    const overrides = {
      upperArm: "13",
      wrist: "5.25",
      sleeveLength: "16.25",
    };

    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      overrides,
      size7Row,
      "standard",
      readDropShoulderUserEditedSleeveFields(),
    );

    expect(next.upperArm).toBe("13");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6");
  });

  it("starting a new pattern clears user-edited sleeve flags", () => {
    markDropShoulderSleeveFieldUserEdited("upperArm");
    markDropShoulderSleeveFieldUserEdited("sleeveLength");
    clearDropShoulderUserEditedSleeveFields();
    expect(readDropShoulderUserEditedSleeveFields()).toEqual({
      upperArm: false,
      sleeveLength: false,
      cuffCircumference: false,
    });
  });

  it("armhole depth is upper arm ÷ 2 from resolved sleeve values", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: {},
      chartRow: size7Row,
      fitPreference: "standard",
    });
    expect(resolved.upperArmIn).toBe(12);
    expect(computeDropShoulderArmholeDepthInches(resolved.upperArmIn)).toBe(6);
  });

  it("review and generator resolve sleeve inches from the same helper", () => {
    const overrides = { upperArm: "9.75", wrist: "5.25", sleeveLength: "16.25" };
    const review = resolveDropShoulderSleeveInches({
      overrides,
      chartRow: size7Row,
      fitPreference: "standard",
    });
    const generator = resolveDropShoulderSleeveInches({
      overrides,
      chartRow: size7Row,
      fitPreference: "standard",
      selectedMeasurements: {
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
    });
    expect(review).toEqual(generator);
    expect(review.upperArmIn).toBe(12);
    expect(review.sleeveLengthIn).toBe(17);
    expect(review.wristIn).toBe(6);
  });

  it("user-edited numeric sleeve length skips picker scaling", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { sleeveLength: "8" },
      chartRow: size7Row,
      fitPreference: "standard",
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: true, cuffCircumference: false },
    });
    expect(resolved.sleeveLengthIn).toBe(8);
  });

  it("scales sleeve length by the picker choice when not user-edited (long/3-4/elbow/short)", () => {
    const base = {
      overrides: {},
      chartRow: size7Row,
      fitPreference: "standard",
    } as const;
    // Size 7 full sleeve_length = 17″.
    expect(resolveDropShoulderSleeveInches({ ...base }).sleeveLengthIn).toBe(17);
    expect(
      resolveDropShoulderSleeveInches({ ...base, sleeveLengthChoice: "long" }).sleeveLengthIn,
    ).toBe(17);
    expect(
      resolveDropShoulderSleeveInches({ ...base, sleeveLengthChoice: "three-quarter" })
        .sleeveLengthIn,
    ).toBe(12.75);
    expect(
      resolveDropShoulderSleeveInches({ ...base, sleeveLengthChoice: "elbow" }).sleeveLengthIn,
    ).toBe(8.5);
    expect(
      resolveDropShoulderSleeveInches({ ...base, sleeveLengthChoice: "short" }).sleeveLengthIn,
    ).toBe(5.5); // 17 × 0.33 = 5.61 → rounded to nearest ¼″
    // Unknown/absent choice falls back to full length.
    expect(
      resolveDropShoulderSleeveInches({ ...base, sleeveLengthChoice: "bogus" }).sleeveLengthIn,
    ).toBe(17);
  });

  it("does not treat stale overrides as user-edited without explicit flags", () => {
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      cbMeasurementOverrides: {
        upperArm: "9.75",
        wrist: "5.25",
        sleeveLength: "16.25",
      },
    });
    expect(readDropShoulderUserEditedSleeveFields().upperArm).toBe(false);
    const defaults = dropShoulderSleeveDefaultsFromChartRow(size7Row, "standard");
    const resolved = resolveDropShoulderSleeveOverrideStrings({
      overrides: { upperArm: "9.75", wrist: "5.25", sleeveLength: "16.25" },
      chartRow: size7Row,
      fitPreference: "standard",
    });
    expect(resolved).toEqual(defaults);
  });
});
