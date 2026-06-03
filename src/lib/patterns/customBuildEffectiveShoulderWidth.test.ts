import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveShoulderWidthInches } from "./customBuildEffectiveShoulderWidth";

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
  shoulderWidthOverride?: string;
  chartShoulderWidth?: number;
  chestBustOverride?: string;
  finishedLengthOverride?: string;
  armholeDepthOverride?: string;
} = {}): Record<string, unknown> {
  const chartShoulder = overrides.chartShoulderWidth ?? 4.25;
  const fit: Record<string, unknown> = {
    selectedMeasurements: { ...baseMeasurements, shoulder_width: chartShoulder },
  };
  const cb: Record<string, string> = {};
  if (overrides.shoulderWidthOverride !== undefined) {
    cb.shoulderWidth = overrides.shoulderWidthOverride;
  }
  if (overrides.chestBustOverride !== undefined) {
    cb.chestBust = overrides.chestBustOverride;
  }
  if (overrides.finishedLengthOverride !== undefined) {
    cb.finishedLength = overrides.finishedLengthOverride;
  }
  if (overrides.armholeDepthOverride !== undefined) {
    cb.armholeDepth = overrides.armholeDepthOverride;
  }
  if (Object.keys(cb).length > 0) {
    fit.cbMeasurementOverrides = cb;
  }
  const style: Record<string, unknown> = {};
  if (overrides.patternMode) style.patternMode = overrides.patternMode;
  return {
    fit,
    style,
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("resolveEffectiveShoulderWidthInches", () => {
  it("uses chart shoulder_width for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveShoulderWidthInches(
        patternData({ patternMode: "express", shoulderWidthOverride: "5.5" }),
      ),
    ).toBe(4.25);
  });

  it("uses chart value for custom-build when no override", () => {
    expect(resolveEffectiveShoulderWidthInches(patternData({ patternMode: "custom-build" }))).toBe(
      4.25,
    );
  });

  it("uses override for custom-build when shoulderWidth is valid", () => {
    expect(
      resolveEffectiveShoulderWidthInches(
        patternData({ patternMode: "custom-build", shoulderWidthOverride: "5.5" }),
      ),
    ).toBe(5.5);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveShoulderWidthInches(
        patternData({ patternMode: "custom-build", shoulderWidthOverride: "bad" }),
      ),
    ).toBe(4.25);
  });
});

describe("generateSleevelessBackPattern custom-build shoulder width override", () => {
  it("wider override increases shoulder stitches and reduces armhole stitches removed", () => {
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", shoulderWidthOverride: "5.5" }),
    );

    expect(baseline.debug.shoulderWidthInches).toBe(4.25);
    expect(wider.debug.shoulderWidthInches).toBe(5.5);
    expect(wider.debug.stitchesAfterArmhole).toBeGreaterThan(baseline.debug.stitchesAfterArmhole!);
    expect(wider.debug.armholeStitchesTotal).toBeLessThan(baseline.debug.armholeStitchesTotal!);
    expect(wider.debug.backStitches).toBe(baseline.debug.backStitches);
    expect(wider.debug.expectedGarmentRows).toBe(baseline.debug.expectedGarmentRows);
    expect(wider.debug.armholeRows).toBe(baseline.debug.armholeRows);
  });

  it("armhole depth, finished length, and bust overrides still work alongside shoulder override", () => {
    const result = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        shoulderWidthOverride: "5.5",
        chestBustOverride: "44",
        finishedLengthOverride: "26",
        armholeDepthOverride: "10",
      }),
    );
    expect(result.debug.shoulderWidthInches).toBe(5.5);
    expect(result.debug.finishedBustChest).toBe(44);
    expect(result.debug.backNeckToHem).toBe(26);
    expect(result.debug.armholeDepth).toBe(10);
  });

  it("Express output unchanged when shoulderWidth override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", shoulderWidthOverride: "5.5" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram SHOULDER_WIDTH and SHOULDER_STS reflect wider shoulder width", () => {
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", shoulderWidthOverride: "5.5" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(wider, "in", {
      patternData: patternData({ patternMode: "custom-build", shoulderWidthOverride: "5.5" }),
      measurementPiece: "back",
    });
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build" }),
      measurementPiece: "back",
    });

    // Cross-back width is re-derived from the post-armhole stitch count so sts and inches agree:
    // override 5.5in -> round(5.5*5)=28 sts -> 28/5 = 5.6in; chart 4.25in -> 22 sts -> 22/5 = 4.4in.
    expect(repl.SHOULDER_WIDTH).toBe("5.6");
    expect(baselineRepl.SHOULDER_WIDTH).toBe("4.4");
    expect(Number(repl.SHOULDER_STS)).toBeGreaterThan(Number(baselineRepl.SHOULDER_STS));
  });
});
