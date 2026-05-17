import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";

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
  chestBustOverride?: string;
  chartFinishedBust?: number;
  finishedLengthOverride?: string;
  armholeDepthOverride?: string;
} = {}): Record<string, unknown> {
  const chartBust = overrides.chartFinishedBust ?? 40;
  const fit: Record<string, unknown> = {
    selectedMeasurements: { ...baseMeasurements, finished_bust_chest: chartBust },
  };
  const cb: Record<string, string> = {};
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

describe("resolveEffectiveFinishedBustInches", () => {
  it("uses chart finished_bust_chest for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveFinishedBustInches(
        patternData({ patternMode: "express", chestBustOverride: "44" }),
      ),
    ).toBe(40);
  });

  it("uses chart value for custom-build when no override", () => {
    expect(resolveEffectiveFinishedBustInches(patternData({ patternMode: "custom-build" }))).toBe(
      40,
    );
  });

  it("uses override for custom-build when chestBust is valid", () => {
    expect(
      resolveEffectiveFinishedBustInches(
        patternData({ patternMode: "custom-build", chestBustOverride: "44" }),
      ),
    ).toBe(44);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveFinishedBustInches(
        patternData({ patternMode: "custom-build", chestBustOverride: "bad" }),
      ),
    ).toBe(40);
  });
});

describe("generateSleevelessBackPattern custom-build finished bust override", () => {
  it("wider override increases cast-on and armhole stitches removed (length/armhole rows unchanged)", () => {
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", chestBustOverride: "44" }),
    );

    expect(baseline.debug.finishedBustChest).toBe(40);
    expect(wider.debug.finishedBustChest).toBe(44);
    expect(wider.debug.backStitches).toBeGreaterThan(baseline.debug.backStitches!);
    expect(wider.debug.armholeStitchesTotal).toBeGreaterThan(baseline.debug.armholeStitchesTotal!);
    expect(wider.debug.expectedGarmentRows).toBe(baseline.debug.expectedGarmentRows);
    expect(wider.debug.armholeRows).toBe(baseline.debug.armholeRows);
    // +4" at 5 spi → +20 full-width stitches → +10 back cast-on
    expect(wider.debug.backStitches! - baseline.debug.backStitches!).toBe(10);
  });

  it("armhole depth and finished length overrides still work alongside bust override", () => {
    const result = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        chestBustOverride: "44",
        finishedLengthOverride: "26",
        armholeDepthOverride: "10",
      }),
    );
    expect(result.debug.finishedBustChest).toBe(44);
    expect(result.debug.backNeckToHem).toBe(26);
    expect(result.debug.armholeDepth).toBe(10);
  });

  it("Express output unchanged when chestBust override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", chestBustOverride: "44" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram BUST_WIDTH and BUST_STS reflect wider finished bust", () => {
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", chestBustOverride: "44" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(wider, "in", {
      patternData: patternData({ patternMode: "custom-build", chestBustOverride: "44" }),
      measurementPiece: "back",
    });
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build" }),
      measurementPiece: "back",
    });

    expect(repl.BUST_WIDTH).toBe("22");
    expect(baselineRepl.BUST_WIDTH).toBe("20");
    expect(Number(repl.BUST_STS)).toBeGreaterThan(Number(baselineRepl.BUST_STS));
  });
});
