import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
  resolveEffectiveArmholeDepthInches,
} from "./customBuildEffectiveArmholeDepth";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function patternData(overrides: {
  patternMode?: string;
  armholeDepthOverride?: string;
  chartArmholeDepth?: number;
} = {}): Record<string, unknown> {
  const chartDepth = overrides.chartArmholeDepth ?? 8;
  const fit: Record<string, unknown> = {
    selectedMeasurements: { ...baseMeasurements, armhole_depth: chartDepth },
  };
  if (overrides.armholeDepthOverride !== undefined) {
    fit.cbMeasurementOverrides = { armholeDepth: overrides.armholeDepthOverride };
  }
  const style: Record<string, unknown> = {};
  if (overrides.patternMode) style.patternMode = overrides.patternMode;
  return {
    fit,
    style,
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("resolveEffectiveArmholeDepthInches", () => {
  it("uses chart armhole_depth for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveArmholeDepthInches(
        patternData({ patternMode: "express", armholeDepthOverride: "10" }),
      ),
    ).toBe(8);
  });

  it("uses chart value for custom-build when no override", () => {
    expect(resolveEffectiveArmholeDepthInches(patternData({ patternMode: "custom-build" }))).toBe(8);
  });

  it("uses override for custom-build when armholeDepth is valid", () => {
    expect(
      resolveEffectiveArmholeDepthInches(
        patternData({ patternMode: "custom-build", armholeDepthOverride: "10" }),
      ),
    ).toBe(10);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveArmholeDepthInches(
        patternData({ patternMode: "custom-build", armholeDepthOverride: "bad" }),
      ),
    ).toBe(8);
  });

  it("positiveMeasurementInches rejects non-positive values", () => {
    expect(positiveMeasurementInches("0")).toBeUndefined();
    expect(positiveMeasurementInches("8.25")).toBe(8.25);
  });

  it("isCustomBuildPatternMode detects custom-build only", () => {
    expect(isCustomBuildPatternMode(patternData({ patternMode: "custom-build" }))).toBe(true);
    expect(isCustomBuildPatternMode(patternData({ patternMode: "express" }))).toBe(false);
  });
});

describe("generateSleevelessBackPattern custom-build armhole depth override", () => {
  it("deeper override reduces body rows and increases armhole rows (same garment length)", () => {
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", armholeDepthOverride: "10" }),
    );

    expect(baseline.debug.armholeDepth).toBe(8);
    expect(deeper.debug.armholeDepth).toBe(10);
    expect(deeper.debug.armholeRows).toBeGreaterThan(baseline.debug.armholeRows!);
    expect(deeper.debug.bodyRows).toBeLessThan(baseline.debug.bodyRows!);
    expect(deeper.debug.expectedGarmentRows).toBe(baseline.debug.expectedGarmentRows);
    // +2" at 7 rpi → 14 fewer body rows, 14 more armhole rows
    expect(deeper.debug.armholeRows! - baseline.debug.armholeRows!).toBe(14);
    expect(baseline.debug.bodyRows! - deeper.debug.bodyRows!).toBe(14);
  });

  it("Express output unchanged when override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", armholeDepthOverride: "10" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });
});
