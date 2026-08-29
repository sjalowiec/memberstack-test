import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const baseMeasurements = {
  finished_bust_chest: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function patternData(
  overrides: {
    patternMode?: string;
    neckDepthOverride?: string;
    chartFrontNeckDepth?: number;
    chartBackNeckDepth?: number;
    omitBackNeckDepth?: boolean;
    neckline?: string;
    neckOpeningWidthOverride?: string;
    armholeDepthOverride?: string;
    shoulderWidthOverride?: string;
    finishedLengthOverride?: string;
    chestBustOverride?: string;
  } = {},
): Record<string, unknown> {
  const chartFront = overrides.chartFrontNeckDepth ?? 3;
  const sm: Record<string, unknown> = {
    ...baseMeasurements,
    front_neck_depth: chartFront,
  };
  if (overrides.omitBackNeckDepth) {
    delete sm.back_neck_depth;
  } else if (overrides.chartBackNeckDepth !== undefined) {
    sm.back_neck_depth = overrides.chartBackNeckDepth;
  }
  const fit: Record<string, unknown> = { selectedMeasurements: sm };
  const cb: Record<string, string> = {};
  if (overrides.neckDepthOverride !== undefined) cb.neckDepth = overrides.neckDepthOverride;
  if (overrides.neckOpeningWidthOverride !== undefined) {
    cb.finishedNeckOpeningWidth = overrides.neckOpeningWidthOverride;
  }
  if (overrides.armholeDepthOverride !== undefined) cb.armholeDepth = overrides.armholeDepthOverride;
  if (overrides.shoulderWidthOverride !== undefined) cb.shoulderWidth = overrides.shoulderWidthOverride;
  if (overrides.finishedLengthOverride !== undefined) cb.finishedLength = overrides.finishedLengthOverride;
  if (overrides.chestBustOverride !== undefined) cb.chestBust = overrides.chestBustOverride;
  if (Object.keys(cb).length > 0) fit.cbMeasurementOverrides = cb;
  const style: Record<string, unknown> = {};
  if (overrides.patternMode) style.patternMode = overrides.patternMode;
  if (overrides.neckline) style.neckline = overrides.neckline;
  return {
    fit,
    style,
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("resolveEffectiveFrontNeckDepthInches", () => {
  it("uses chart front_neck_depth for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveFrontNeckDepthInches(
        patternData({ patternMode: "express", neckDepthOverride: "6" }),
      ),
    ).toBe(3);
  });

  it("uses chart value for custom-build when no override", () => {
    expect(resolveEffectiveFrontNeckDepthInches(patternData({ patternMode: "custom-build" }))).toBe(3);
  });

  it("uses override for custom-build when neckDepth is valid", () => {
    expect(
      resolveEffectiveFrontNeckDepthInches(
        patternData({ patternMode: "custom-build", neckDepthOverride: "6" }),
      ),
    ).toBe(6);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveFrontNeckDepthInches(
        patternData({ patternMode: "custom-build", neckDepthOverride: "bad" }),
      ),
    ).toBe(3);
  });
});

describe("resolveEffectiveBackNeckDepthInches", () => {
  it("always uses chart back_neck_depth (no neckDepth override)", () => {
    expect(
      resolveEffectiveBackNeckDepthInches(
        patternData({ patternMode: "custom-build", neckDepthOverride: "6" }),
      ),
    ).toBe(1);
  });

  it("leaves missing chart back_neck_depth undefined", () => {
    expect(resolveEffectiveBackNeckDepthInches(patternData({ omitBackNeckDepth: true }))).toBeUndefined();
  });

  it("preserves chart values at or below 1 inch and caps values above 1 inch", () => {
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 0.5 }))).toBe(0.5);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 0.75 }))).toBe(0.75);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 1 }))).toBe(1);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 1.5 }))).toBe(1);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 1.75 }))).toBe(1);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 2 }))).toBe(1);
    expect(resolveEffectiveBackNeckDepthInches(patternData({ chartBackNeckDepth: 2.5 }))).toBe(1);
  });

  it("does not change front neck depth when back chart is above 1 inch", () => {
    const pd = patternData({ chartBackNeckDepth: 1.75, chartFrontNeckDepth: 6 });
    expect(resolveEffectiveBackNeckDepthInches(pd)).toBe(1);
    expect(resolveEffectiveFrontNeckDepthInches(pd)).toBe(6);
  });

  it("front neckDepth override still does not alter back neck depth", () => {
    const pd = patternData({
      patternMode: "custom-build",
      neckDepthOverride: "6",
      chartBackNeckDepth: 1.75,
    });
    expect(resolveEffectiveFrontNeckDepthInches(pd)).toBe(6);
    expect(resolveEffectiveBackNeckDepthInches(pd)).toBe(1);
  });
});

describe("generateSleevelessBackPattern custom-build neck depth override", () => {
  it("deeper front override increases front neck rows and shifts front neckline start earlier", () => {
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckDepthOverride: "6" }),
    );

    expect(baseline.debug.frontNeckDepth).toBe(3);
    expect(deeper.debug.frontNeckDepth).toBe(6);
    expect(deeper.debug.frontNeckDepthRows).toBeGreaterThan(baseline.debug.frontNeckDepthRows);
    expect(deeper.debug.frontNecklineStartRC).toBeLessThan(baseline.debug.frontNecklineStartRC);
    expect(deeper.debug.backNeckDepthRows).toBe(baseline.debug.backNeckDepthRows);
  });

  it("round-neck custom-build responds to deeper neck depth override", () => {
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "round" }),
    );
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "round", neckDepthOverride: "6" }),
    );

    expect(deeper.debug.frontNeckTimelineDepthRows).toBeGreaterThan(
      baseline.debug.frontNeckTimelineDepthRows,
    );
    expect(deeper.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(
      baseline.frontNeckShoulderShapingChart.rows.length,
    );
  });

  it("v-neck custom-build responds to deeper neck depth override", () => {
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "v-neck" }),
    );
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "v-neck", neckDepthOverride: "6" }),
    );

    expect(deeper.debug.frontNeckDepthRows).toBeGreaterThan(baseline.debug.frontNeckDepthRows);
    expect(deeper.debug.frontNecklineStartRC).toBeLessThan(baseline.debug.frontNecklineStartRC);
    expect(deeper.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(
      baseline.frontNeckShoulderShapingChart.rows.length,
    );
  });

  it("other measurement overrides still work alongside neck depth override", () => {
    const result = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        neckDepthOverride: "6",
        neckOpeningWidthOverride: "5",
        chestBustOverride: "44",
        finishedLengthOverride: "26",
        armholeDepthOverride: "10",
        shoulderWidthOverride: "5.5",
      }),
    );
    expect(result.debug.frontNeckDepth).toBe(6);
    expect(result.debug.necklineWidthInches).toBe(5);
    expect(result.debug.finishedBustChest).toBe(44);
    expect(result.debug.backNeckToHem).toBe(26);
    expect(result.debug.armholeDepth).toBe(10);
    expect(result.debug.shoulderWidthInches).toBe(5.5);
  });

  it("Express output unchanged when neckDepth override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", neckDepthOverride: "6" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram NECK_DEPTH and NECK_DEPTH_ROWS reflect deeper front neck on front piece", () => {
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckDepthOverride: "6" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(deeper, "in", {
      patternData: patternData({ patternMode: "custom-build", neckDepthOverride: "6" }),
      measurementPiece: "front",
    });
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build" }),
      measurementPiece: "front",
    });

    expect(repl.NECK_DEPTH).toBe("6");
    expect(baselineRepl.NECK_DEPTH).toBe("3");
    expect(Number(repl.NECK_DEPTH_ROWS)).toBeGreaterThan(Number(baselineRepl.NECK_DEPTH_ROWS));
  });
});
