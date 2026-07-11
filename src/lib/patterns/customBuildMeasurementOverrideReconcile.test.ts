import { describe, expect, it, beforeEach, vi } from "vitest";
import { computeDropShoulderArmholeDepthInches } from "./dropShoulderArmholeDepth";
import {
  writeSavedSizingIdentityBaseline,
} from "./savedCustomPatternSessionIdentity";
import {
  diagramOverrideDefaultsFromChartRow,
  reconcileCustomBuildDiagramOverridesAfterSizingChange,
  reconcileCustomBuildOverridesForSizingIdentityChange,
  readOverrideSeedSizingIdentity,
  writeOverrideSeedSizingIdentity,
} from "./customBuildMeasurementOverrideReconcile";
import { markDropShoulderSleeveFieldUserEdited } from "./dropShoulderUserEditedSleeveFields";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

vi.mock("./sleevelessExpressSizeChartClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sleevelessExpressSizeChartClient")>();
  const rows: Record<string, ChartRow> = {
    "1": {
      size: 1,
      bust_or_chest: 32,
      upper_arm: 9.75,
      wrist: 5.5,
      sleeve_length: 16,
      garment_back_length: 22,
      neck_opening: 6.5,
      front_neck_depth: 4,
    },
    "8": {
      size: 8,
      bust_or_chest: 42,
      upper_arm: 12.5,
      wrist: 6.25,
      sleeve_length: 17,
      garment_back_length: 25,
      neck_opening: 7.5,
      front_neck_depth: 5,
    },
  };
  return {
    ...actual,
    findExpressChartRow: (_audience: string, sizeStr: string) => rows[sizeStr] ?? null,
  };
});

const size1Row: ChartRow = {
  size: 1,
  bust_or_chest: 32,
  upper_arm: 9.75,
  wrist: 5.5,
  sleeve_length: 16,
  garment_back_length: 22,
  neck_opening: 6.5,
  front_neck_depth: 4,
};

const size8Row: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  upper_arm: 12.5,
  wrist: 6.25,
  sleeve_length: 17,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
};

describe("diagramOverrideDefaultsFromChartRow", () => {
  it("includes drop-shoulder sleeve fields when dropShoulder is true", () => {
    const defaults = diagramOverrideDefaultsFromChartRow(size8Row, "standard", "misses", {
      dropShoulder: true,
    });
    // Finished Drop Shoulder upper arm = body 12.5 + Adult woman standard allowance 8.7 → 21.25.
    expect(defaults.upperArm).toBe("21.25");
    expect(defaults.sleeveLength).toBe("17");
    expect(defaults.wrist).toBe("6.25");
    expect(defaults.cuffDepth).toBe("2");
  });

  it("omits drop-shoulder sleeve fields for sleeveless reconcile", () => {
    const defaults = diagramOverrideDefaultsFromChartRow(size8Row, "standard", "misses", {
      dropShoulder: false,
    });
    expect(defaults.upperArm).toBeUndefined();
    expect(defaults.sleeveLength).toBeUndefined();
    expect(defaults.chestBust).toBe("45");
  });
});

describe("reconcileCustomBuildDiagramOverridesAfterSizingChange", () => {
  it("refreshes chart-seeded body and sleeve overrides from Size 1 to Size 8", () => {
    const overrides = {
      chestBust: "35",
      finishedLength: "22",
      upperArm: "9.75",
      sleeveLength: "16",
      wrist: "5.5",
    };

    const next = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: size1Row,
      previousFit: "standard",
      currentRow: size8Row,
      currentFit: "standard",
      overrides,
      audience: "misses",
      dropShoulder: true,
    });

    expect(next.chestBust).toBe("45");
    expect(next.finishedLength).toBe("25");
    // body 12.5 + Adult woman standard allowance 8.7 → finished 21.25.
    expect(next.upperArm).toBe("21.25");
    expect(next.sleeveLength).toBe("17");
    expect(next.wrist).toBe("6.25");
    expect(computeDropShoulderArmholeDepthInches(parseFloat(next.upperArm!))).toBe(10.625);
  });

  it("preserves a deliberate user-edited upper arm when switching sizes", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    markDropShoulderSleeveFieldUserEdited("upperArm");

    const overrides = {
      upperArm: "13",
      sleeveLength: "16",
      wrist: "5.5",
    };

    const next = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: size1Row,
      previousFit: "standard",
      currentRow: size8Row,
      currentFit: "standard",
      overrides,
      audience: "misses",
      dropShoulder: true,
    });

    expect(next.upperArm).toBe("13");
    expect(next.sleeveLength).toBe("17");
  });

  it("does not add sleeve fields when dropShoulder is false (sleeveless)", () => {
    const overrides = {
      chestBust: "35",
      finishedLength: "22",
      upperArm: "9.75",
    };

    const next = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: size1Row,
      previousFit: "standard",
      currentRow: size8Row,
      currentFit: "standard",
      overrides,
      audience: "misses",
      dropShoulder: false,
    });

    expect(next.chestBust).toBe("45");
    expect(next.finishedLength).toBe("25");
    expect(next.upperArm).toBe("9.75");
  });
});

describe("reconcileCustomBuildOverridesForSizingIdentityChange", () => {
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
  });

  it("uses override seed sizing identity when fit.selectedMeasurements already reflects the new size", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      values: { who: "women", selectedSize: "8", fit: "standard" },
      cbMeasurementOverridesSizingIdentity: { chartAudience: "misses", selectedSize: "1" },
      cbMeasurementOverrides: {
        upperArm: "9.75",
        sleeveLength: "16",
        chestBust: "35",
        finishedLength: "22",
      },
    });

    const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
      currentIdentity: { chartAudience: "misses", selectedSize: "8" },
      currentRow: size8Row,
      fitPreference: "standard",
      overrides: {
        upperArm: "9.75",
        sleeveLength: "16",
        chestBust: "35",
        finishedLength: "22",
      },
      dropShoulder: true,
    });

    expect(reconciled.upperArm).toBe("21.25");
    expect(reconciled.sleeveLength).toBe("17");
    expect(reconciled.chestBust).toBe("45");
    expect(reconciled.finishedLength).toBe("25");
  });

  it("falls back to saved sizing baseline when override seed is missing", () => {
    writeSavedSizingIdentityBaseline({ chartAudience: "misses", selectedSize: "1" });
    const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
      currentIdentity: { chartAudience: "misses", selectedSize: "8" },
      currentRow: size8Row,
      fitPreference: "standard",
      overrides: { upperArm: "9.75", chestBust: "35" },
      dropShoulder: true,
    });
    expect(reconciled.upperArm).toBe("21.25");
    expect(reconciled.chestBust).toBe("45");
  });

  it("preserves user-edited upper arm during drop-shoulder sizing reconcile when flag is set", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "1" });
    markDropShoulderSleeveFieldUserEdited("upperArm");
    const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
      currentIdentity: { chartAudience: "misses", selectedSize: "8" },
      currentRow: size8Row,
      fitPreference: "standard",
      overrides: {
        upperArm: "13",
        sleeveLength: "16",
        wrist: "5.5",
      },
      dropShoulder: true,
    });
    expect(reconciled.upperArm).toBe("13");
    expect(reconciled.sleeveLength).toBe("17");
    expect(reconciled.wrist).toBe("6.25");
  });

  it("returns overrides unchanged when sizing identity is unchanged", () => {
    writeOverrideSeedSizingIdentity({ chartAudience: "misses", selectedSize: "8" });
    const overrides = { upperArm: "12.5", chestBust: "45" };
    const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
      currentIdentity: { chartAudience: "misses", selectedSize: "8" },
      currentRow: size8Row,
      fitPreference: "standard",
      overrides,
      dropShoulder: true,
    });
    expect(reconciled).toEqual(overrides);
  });

  it("readOverrideSeedSizingIdentity reads persisted seed from express storage", () => {
    store[SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY] = JSON.stringify({
      cbMeasurementOverridesSizingIdentity: { chartAudience: "misses", selectedSize: "1" },
    });
    expect(readOverrideSeedSizingIdentity()).toEqual({
      chartAudience: "misses",
      selectedSize: "1",
    });
  });
});

describe("edit flow: Size 1 review then largest size", () => {
  it("merged display values match largest-size chart defaults after reconcile", () => {
    const size1Defaults = diagramOverrideDefaultsFromChartRow(size1Row, "standard", "misses", {
      dropShoulder: true,
    });
    const persistedFromFirstReview = { ...size1Defaults };

    const afterEdit = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: size1Row,
      previousFit: "standard",
      currentRow: size8Row,
      currentFit: "standard",
      overrides: persistedFromFirstReview,
      audience: "misses",
      dropShoulder: true,
    });

    const largestDefaults = diagramOverrideDefaultsFromChartRow(size8Row, "standard", "misses", {
      dropShoulder: true,
    });

    expect(afterEdit.upperArm).toBe(largestDefaults.upperArm);
    expect(afterEdit.sleeveLength).toBe(largestDefaults.sleeveLength);
    expect(afterEdit.chestBust).toBe(largestDefaults.chestBust);
    expect(afterEdit.finishedLength).toBe(largestDefaults.finishedLength);
  });
});
