import { describe, expect, it } from "vitest";
import {
  computeFitDerivedMeasurementOverrides,
  FIT_DERIVED_OVERRIDE_KEYS,
} from "./sleevelessEditFitRecalc";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

/** Kids row with a 21" chest — the reproduction scenario from the bug report. */
const KIDS_ROW: ChartRow = {
  size: "8",
  bust_or_chest: 21,
  waist: 20,
  hip: 21,
  garment_back_length: 16,
  armhole_depth: 6,
  shoulder_width: 3.25,
  neck_opening: 5,
  front_neck_depth: 2.5,
  back_neck_depth: 1,
};

describe("computeFitDerivedMeasurementOverrides", () => {
  it("uses Close ease (+1\") for a 21\" chest → 22\" finished bust/hip (straight)", () => {
    const out = computeFitDerivedMeasurementOverrides(KIDS_ROW, "close", {
      bodyShape: "straight",
    });
    expect(out.chestBust).toBe("22");
    expect(out.hip).toBe("22");
  });

  it("recalculates Close → Standard: 22\" finished bust/hip becomes 24\"", () => {
    const close = computeFitDerivedMeasurementOverrides(KIDS_ROW, "close", {
      bodyShape: "straight",
    });
    const standard = computeFitDerivedMeasurementOverrides(KIDS_ROW, "standard", {
      bodyShape: "straight",
      existingOverrides: close,
    });
    // Standard ease is +3" → 21 + 3 = 24, replacing the stale Close value.
    expect(standard.chestBust).toBe("24");
    expect(standard.hip).toBe("24");
  });

  it("preserves non-ease overrides (shoulder, armhole, length) when fit changes", () => {
    const existing = {
      chestBust: "22",
      hip: "22",
      armholeDepth: "7",
      shoulderWidth: "3.25",
      finishedLength: "16",
    };
    const out = computeFitDerivedMeasurementOverrides(KIDS_ROW, "relaxed", {
      bodyShape: "straight",
      existingOverrides: existing,
    });
    // Relaxed ease is +5" → 21 + 5 = 26.
    expect(out.chestBust).toBe("26");
    expect(out.hip).toBe("26");
    // Untouched, non-ease-derived fields stay exactly as the user left them.
    expect(out.armholeDepth).toBe("7");
    expect(out.shoulderWidth).toBe("3.25");
    expect(out.finishedLength).toBe("16");
  });

  it("only ever rewrites the ease-derived keys", () => {
    expect([...FIT_DERIVED_OVERRIDE_KEYS]).toEqual(["chestBust", "hip"]);
  });

  it("A-line keeps the larger eased hip while straight keeps hip equal to bust", () => {
    const alineRow: ChartRow = { ...KIDS_ROW, hip: 25 };
    const straight = computeFitDerivedMeasurementOverrides(alineRow, "standard", {
      bodyShape: "straight",
    });
    const aline = computeFitDerivedMeasurementOverrides(alineRow, "standard", {
      bodyShape: "aline",
    });
    // Straight: hip follows finished bust (24). A-line: hip = max(24, 25 + 3) = 28.
    expect(straight.hip).toBe("24");
    expect(aline.hip).toBe("28");
  });
});
