import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";

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
  finishedLengthOverride?: string;
  chartFinishedLength?: number;
  armholeDepthOverride?: string;
} = {}): Record<string, unknown> {
  const chartLength = overrides.chartFinishedLength ?? 22;
  const fit: Record<string, unknown> = {
    selectedMeasurements: { ...baseMeasurements, back_neck_to_hem: chartLength },
  };
  const cb: Record<string, string> = {};
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

describe("resolveEffectiveFinishedLengthInches", () => {
  it("uses chart back_neck_to_hem for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveFinishedLengthInches(
        patternData({ patternMode: "express", finishedLengthOverride: "26" }),
      ),
    ).toBe(22);
  });

  it("uses chart value for custom-build when no override", () => {
    expect(resolveEffectiveFinishedLengthInches(patternData({ patternMode: "custom-build" }))).toBe(
      22,
    );
  });

  it("uses override for custom-build when finishedLength is valid", () => {
    expect(
      resolveEffectiveFinishedLengthInches(
        patternData({ patternMode: "custom-build", finishedLengthOverride: "26" }),
      ),
    ).toBe(26);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveFinishedLengthInches(
        patternData({ patternMode: "custom-build", finishedLengthOverride: "bad" }),
      ),
    ).toBe(22);
  });
});

describe("generateSleevelessBackPattern custom-build finished length override", () => {
  it("longer override increases total and body rows (armhole rows unchanged)", () => {
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const longer = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", finishedLengthOverride: "26" }),
    );

    expect(baseline.debug.backNeckToHem).toBe(22);
    expect(longer.debug.backNeckToHem).toBe(26);
    expect(longer.debug.expectedGarmentRows).toBeGreaterThan(baseline.debug.expectedGarmentRows!);
    expect(longer.debug.bodyRows).toBeGreaterThan(baseline.debug.bodyRows!);
    expect(longer.debug.armholeRows).toBe(baseline.debug.armholeRows);
    // +4" at 7 rpi → 28 more total/body rows
    expect(longer.debug.expectedGarmentRows! - baseline.debug.expectedGarmentRows!).toBe(28);
    expect(longer.debug.bodyRows! - baseline.debug.bodyRows!).toBe(28);
  });

  it("armhole depth override still works alongside finished length override", () => {
    const both = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        finishedLengthOverride: "26",
        armholeDepthOverride: "10",
      }),
    );
    expect(both.debug.backNeckToHem).toBe(26);
    expect(both.debug.armholeDepth).toBe(10);
  });

  it("Express output unchanged when finished length override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", finishedLengthOverride: "26" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram HEIGHT and SIDE_LENGTH reflect longer finished length", () => {
    const longer = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", finishedLengthOverride: "26" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(longer, "in", {
      patternData: patternData({ patternMode: "custom-build", finishedLengthOverride: "26" }),
      measurementPiece: "back",
    });
    expect(repl.HEIGHT).toBe("26");
    expect(Number(repl.SIDE_LENGTH_ROWS)).toBeGreaterThan(0);
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build" }),
      measurementPiece: "back",
    });
    expect(Number(repl.SIDE_LENGTH_ROWS)).toBeGreaterThan(Number(baselineRepl.SIDE_LENGTH_ROWS));
  });
});
