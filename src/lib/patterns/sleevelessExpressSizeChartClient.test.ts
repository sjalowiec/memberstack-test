import { describe, expect, it } from "vitest";
import {
  buildExpressStandardBodyMeasurementsSummaryFromRow,
  formatExpressSizeBodyConfirmation,
  formatBodyMeasurementDisplay,
  normalizeChartRowSize,
} from "./sleevelessExpressSizeChartClient";

describe("formatExpressSizeBodyConfirmation", () => {
  it("returns empty when no size is chosen", () => {
    expect(formatExpressSizeBodyConfirmation({ who: "women" })).toBe("");
  });

  it("uses Selected prefix when chart row is not loaded yet", () => {
    expect(formatExpressSizeBodyConfirmation({ who: "women", selectedSize: "4" })).toBe(
      "Selected: Size 4",
    );
  });
});

describe("normalizeChartRowSize", () => {
  it("stringifies numeric sizes", () => {
    expect(normalizeChartRowSize({ size: 8 } as { size: number })).toBe("8");
  });
});

describe("formatBodyMeasurementDisplay", () => {
  it("formats bust/chest inches consistently with the size table", () => {
    expect(formatBodyMeasurementDisplay({ bust_or_chest: 37 }, "bust_or_chest", "in")).toBe('37"');
  });
});

describe("buildExpressStandardBodyMeasurementsSummaryFromRow", () => {
  it("includes the four standard body measurement labels", () => {
    const summary = buildExpressStandardBodyMeasurementsSummaryFromRow(
      "8",
      { bust_or_chest: 37, waist: 29, hip: 39, upper_arm: 12.25 },
      "in",
    );
    expect(summary.measurements.map((m) => m.label)).toEqual([
      "Bust/Chest",
      "Waist",
      "Hip",
      "Upper Arm",
    ]);
  });
});
