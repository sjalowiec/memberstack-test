import { describe, expect, it } from "vitest";
import { formatExpressSizeBodyConfirmation, normalizeChartRowSize } from "./sleevelessExpressSizeChartClient";

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
