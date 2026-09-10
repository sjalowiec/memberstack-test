import { describe, expect, it } from "vitest";
import { FIT_EASE_INCHES_BY_CHOICE } from "./fitEaseInches";
import {
  defaultSidewaysCardiganStyleMeasurements,
  finishedBustInchesFromChartRow,
  reseedSidewaysCardiganStyleMeasurements,
} from "./sidewaysCardiganStyleMeasurements";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";

const size8: SidewaysCardiganWomenChartRow = {
  size: 8,
  bust_or_chest: 42,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  upper_arm: 12.5,
  wrist: 6.5,
  sleeve_length: 17,
  chartAudience: "misses",
};

const size4: SidewaysCardiganWomenChartRow = {
  ...size8,
  size: 4,
  bust_or_chest: 36,
  garment_back_length: 22,
  neck_opening: 7,
  front_neck_depth: 4.5,
  upper_arm: 11,
  wrist: 6,
  sleeve_length: 16.5,
};

describe("sideways cardigan style measurements", () => {
  it("refreshes chart measurements when the size changes", () => {
    const fromSize8 = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
    });
    const afterSize4 = reseedSidewaysCardiganStyleMeasurements({
      previous: fromSize8,
      userEdited: {},
      row: size4,
      chartAudience: "misses",
      fitPreference: "standard",
    });
    expect(fromSize8.finishedLength).toBe("25");
    expect(afterSize4.finishedLength).toBe("22");
    expect(afterSize4.vNeckDepth).toBe("4.5");
    expect(afterSize4.neckOpeningWidth).toBe("7");
  });

  it("scales sleeve length and wrist from the shared Drop Shoulder picker choices", () => {
    const long = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
      sleeveLengthChoice: "long",
    });
    const threeQuarter = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
      sleeveLengthChoice: "three-quarter",
    });
    const elbow = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
      sleeveLengthChoice: "elbow",
    });
    const short = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
      sleeveLengthChoice: "short",
    });
    expect(Number(long.sleeveLength)).toBe(17);
    expect(Number(threeQuarter.sleeveLength)).toBe(12.75);
    expect(Number(elbow.sleeveLength)).toBe(8.5);
    expect(Number(short.sleeveLength)).toBe(5.5);
  });

  it("keeps a user-edited measurement when the size changes", () => {
    const fromSize8 = defaultSidewaysCardiganStyleMeasurements({
      row: size8,
      chartAudience: "misses",
      fitPreference: "standard",
    });
    const afterSize4 = reseedSidewaysCardiganStyleMeasurements({
      previous: { ...fromSize8, vNeckDepth: "9" },
      userEdited: { vNeckDepth: true },
      row: size4,
      chartAudience: "misses",
      fitPreference: "standard",
    });
    expect(afterSize4.vNeckDepth).toBe("9");
    expect(afterSize4.finishedLength).toBe("22");
  });

  it("increases finished bust when ease changes from close to relaxed", () => {
    const close = finishedBustInchesFromChartRow(size8, "close");
    const standard = finishedBustInchesFromChartRow(size8, "standard");
    const relaxed = finishedBustInchesFromChartRow(size8, "relaxed");
    expect(close).toBe(42 + FIT_EASE_INCHES_BY_CHOICE.close);
    expect(standard).toBe(42 + FIT_EASE_INCHES_BY_CHOICE.standard);
    expect(relaxed).toBe(42 + FIT_EASE_INCHES_BY_CHOICE.relaxed);
    expect(relaxed).toBeGreaterThan(standard!);
    expect(standard).toBeGreaterThan(close!);
  });
});
