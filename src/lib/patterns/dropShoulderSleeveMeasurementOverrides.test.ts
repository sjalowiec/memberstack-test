import { describe, expect, it } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker,
  dropShoulderSleeveDefaultsFromChartRow,
  mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues,
  reconcileDropShoulderSleeveOverridesAfterChartSync,
  reconcileDropShoulderSleeveOverridesForSizeChange,
} from "./dropShoulderSleeveMeasurementOverrides";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const size1Row: ChartRow = {
  size: 1,
  bust_or_chest: 32,
  upper_arm: 9.75,
  wrist: 5.5,
  sleeve_length: 16,
};

const size7Row: ChartRow = {
  size: 7,
  label: 'Size 7 (Bust 40″)',
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

describe("dropShoulderSleeveDefaultsFromChartRow", () => {
  it("maps upper_arm, sleeve_length, and wrist from Size 7 chart row without audience (raw body)", () => {
    const defaults = dropShoulderSleeveDefaultsFromChartRow(size7Row, "standard");
    expect(defaults.upperArm).toBe("12");
    expect(defaults.sleeveLength).toBe("17");
    expect(defaults.wrist).toBe("6");
  });

  it("applies sleeve ease when chartAudience is supplied", () => {
    const defaults = dropShoulderSleeveDefaultsFromChartRow(size7Row, "standard", {
      chartAudience: "misses",
    });
    expect(defaults.upperArm).toBe("14");
    expect(defaults.sleeveLength).toBe("17");
    expect(defaults.wrist).toBe("6.75");
  });
});

describe("reconcileDropShoulderSleeveOverridesForSizeChange", () => {
  it("refreshes chart-seeded Size 1 sleeve overrides when switching to Size 7", () => {
    const overrides = {
      upperArm: "9.75",
      wrist: "5.5",
      sleeveLength: "16",
      chestBust: "43",
    };

    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      overrides,
      size7Row,
      "standard",
      { upperArm: false, sleeveLength: false, cuffCircumference: false },
      { chartAudience: "misses" },
    );

    expect(next.upperArm).toBe("14");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6.75");
    expect(next.chestBust).toBe("43");
  });

  it("computes armhole depth as eased upper arm ÷ 2 after Size 7 hydration", () => {
    const defaults = dropShoulderSleeveDefaultsFromChartRow(size7Row, "standard", {
      chartAudience: "misses",
    });
    const upperArm = parseFloat(defaults.upperArm!);
    expect(computeDropShoulderArmholeDepthInches(upperArm)).toBe(7);
  });

  it("preserves a user-edited upper arm via explicit flag", () => {
    const overrides = {
      upperArm: "13",
      wrist: "6",
      sleeveLength: "17",
    };

    const next = reconcileDropShoulderSleeveOverridesForSizeChange(
      overrides,
      size7Row,
      "standard",
      { upperArm: true, sleeveLength: false, cuffCircumference: false },
      { chartAudience: "misses" },
    );

    expect(next.upperArm).toBe("13");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6.75");
  });
});

describe("reconcileDropShoulderSleeveOverridesAfterChartSync (legacy)", () => {
  it("still refreshes when previous selectedMeasurements match stale overrides", () => {
    const previous = {
      upper_arm: 9.75,
      wrist: 5.5,
      sleeve_length: 16,
    };
    const overrides = {
      upperArm: "9.75",
      wrist: "5.5",
      sleeveLength: "16",
    };

    const next = reconcileDropShoulderSleeveOverridesAfterChartSync(
      size7Row,
      "standard",
      overrides,
      previous,
      { chartAudience: "misses" },
    );

    expect(next.upperArm).toBe("14");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6.75");
  });
});

describe("Drop Shoulder edit-page picker persist guards", () => {
  it("keeps stored full sleeve/wrist values when the incoming chip matches the picker default", () => {
    const stored = { upperArm: "12", wrist: "6", sleeveLength: "17" };
    const next = mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues({
      incoming: { upperArm: "12", wrist: "12", sleeveLength: "5.5" },
      stored,
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: false },
    });
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6");
    expect(next.upperArm).toBe("12");
  });

  it("keeps a typed sleeve/wrist fine-tune that differs from the picker default", () => {
    const stored = { upperArm: "12", wrist: "6", sleeveLength: "17" };
    const next = mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues({
      incoming: { upperArm: "12", wrist: "8", sleeveLength: "8" },
      stored,
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: false },
    });
    expect(next.sleeveLength).toBe("8");
    expect(next.wrist).toBe("8");
  });

  it("marks sleeve/cuff as differing only when the displayed chip is not the picker default", () => {
    const stored = { upperArm: "12", wrist: "6", sleeveLength: "17" };
    expect(
      dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker({
        displayedSleeveLengthInches: "5.5",
        displayedWristInches: "12",
        storedOverrides: stored,
        sleeveLengthChoice: "short",
      }),
    ).toEqual({ sleeveLength: false, cuffCircumference: false });
    expect(
      dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker({
        displayedSleeveLengthInches: "8",
        displayedWristInches: "8",
        storedOverrides: stored,
        sleeveLengthChoice: "short",
      }),
    ).toEqual({ sleeveLength: true, cuffCircumference: true });
  });
});
