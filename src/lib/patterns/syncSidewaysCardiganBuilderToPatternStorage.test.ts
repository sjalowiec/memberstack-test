import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrentPattern } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import { SIDEWAYS_CARDIGAN_CONSTRUCTION } from "./sidewaysCardiganConstructionIdentity";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";

const plusRow: SidewaysCardiganWomenChartRow = {
  size: "X",
  bust_or_chest: 39,
  garment_back_length: 16.75,
  neck_opening: 7,
  front_neck_depth: 5,
  upper_arm: 13,
  chartAudience: "plus",
};

describe("syncSidewaysCardiganBuilderToPatternStorage", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("stores plus chart audience and authored sideways construction for Size X", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      {
        selectedSize: "X",
        chartAudience: "plus",
        fit: "standard",
        vNeckDepthInches: "8",
        gaugeStitchRaw: "20",
        gaugeRowRaw: "28",
        availableNeedles: "200",
        unit: "in",
      },
      plusRow,
    );
    const pattern = getCurrentPattern();
    expect(pattern.style.construction).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(pattern.style.constructionAuthored).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(pattern.style.garmentStyle).toBe("cardigan");
    expect(pattern.style.neckline).toBe("v");
    expect(pattern.style.recipientCategory).toBe("plus");
    expect(pattern.fit.sizingChart).toBe("plus");
    expect(pattern.fit.selectedSize).toBe("X");
    expect(pattern.fit.cbMeasurementOverrides).toMatchObject({ neckDepth: "8" });
  });
});
