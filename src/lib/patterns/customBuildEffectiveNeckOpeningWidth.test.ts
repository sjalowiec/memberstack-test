import { describe, expect, it } from "vitest";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
} from "./sleevelessPatternOutput";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";

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
    neckOpeningWidthOverride?: string;
    chartNeckOpening?: number;
    chartNeckWidth?: number;
    neckline?: string;
    chestBustOverride?: string;
    finishedLengthOverride?: string;
    armholeDepthOverride?: string;
    shoulderWidthOverride?: string;
  } = {},
): Record<string, unknown> {
  const chartNeck = overrides.chartNeckOpening ?? 3;
  const sm: Record<string, unknown> = {
    ...baseMeasurements,
    neck_opening: chartNeck,
  };
  if (overrides.chartNeckWidth !== undefined) {
    sm.neck_width = overrides.chartNeckWidth;
  }
  const fit: Record<string, unknown> = { selectedMeasurements: sm };
  const cb: Record<string, string> = {};
  if (overrides.neckOpeningWidthOverride !== undefined) {
    cb.finishedNeckOpeningWidth = overrides.neckOpeningWidthOverride;
  }
  if (overrides.chestBustOverride !== undefined) cb.chestBust = overrides.chestBustOverride;
  if (overrides.finishedLengthOverride !== undefined) cb.finishedLength = overrides.finishedLengthOverride;
  if (overrides.armholeDepthOverride !== undefined) cb.armholeDepth = overrides.armholeDepthOverride;
  if (overrides.shoulderWidthOverride !== undefined) cb.shoulderWidth = overrides.shoulderWidthOverride;
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

describe("resolveEffectiveNeckOpeningWidthInches", () => {
  it("uses chart neck_opening for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveNeckOpeningWidthInches(
        patternData({ patternMode: "express", neckOpeningWidthOverride: "5" }),
      ),
    ).toBe(3);
  });

  it("prefers chart neck_width over neck_opening when both present", () => {
    expect(
      resolveEffectiveNeckOpeningWidthInches(
        patternData({ patternMode: "custom-build", chartNeckWidth: 8, chartNeckOpening: 3 }),
      ),
    ).toBe(8);
  });

  it("uses override for custom-build when finishedNeckOpeningWidth is valid", () => {
    expect(
      resolveEffectiveNeckOpeningWidthInches(
        patternData({ patternMode: "custom-build", neckOpeningWidthOverride: "5" }),
      ),
    ).toBe(5);
  });

  it("falls back to chart when override is invalid", () => {
    expect(
      resolveEffectiveNeckOpeningWidthInches(
        patternData({ patternMode: "custom-build", neckOpeningWidthOverride: "bad" }),
      ),
    ).toBe(3);
  });
});

describe("generateSleevelessBackPattern custom-build neck opening width override", () => {
  it("wider override increases neckline stitches and center bind-off (round neck)", () => {
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "round" }),
    );
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "round", neckOpeningWidthOverride: "5" }),
    );

    expect(baseline.debug.necklineWidthInches).toBe(3);
    expect(wider.debug.necklineWidthInches).toBe(5);
    expect(wider.debug.necklineStitches).toBeGreaterThan(baseline.debug.necklineStitches!);
    expect(wider.debug.centerNeckBindOffStitches).toBeGreaterThan(
      baseline.debug.centerNeckBindOffStitches!,
    );
    expect(wider.debug.shoulderStitches).toBeLessThan(baseline.debug.shoulderStitches!);
    expect(wider.debug.backStitches).toBe(baseline.debug.backStitches);
  });

  it("v-neck custom-build responds to wider neck opening override", () => {
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "v-neck" }),
    );
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckline: "v-neck", neckOpeningWidthOverride: "5" }),
    );

    expect(wider.debug.necklineStitches).toBeGreaterThan(baseline.debug.necklineStitches!);
    expect(centerBindOffStitchesFromNeckShoulderChart(wider.frontNeckShoulderShapingChart)).toBe(0);
    expect(wider.debug.necklineWidthInches).toBe(5);
  });

  it("other measurement overrides still work alongside neck opening override", () => {
    const result = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        neckOpeningWidthOverride: "5",
        chestBustOverride: "44",
        finishedLengthOverride: "26",
        armholeDepthOverride: "10",
        shoulderWidthOverride: "5.5",
      }),
    );
    expect(result.debug.necklineWidthInches).toBe(5);
    expect(result.debug.finishedBustChest).toBe(44);
    expect(result.debug.backNeckToHem).toBe(26);
    expect(result.debug.armholeDepth).toBe(10);
    expect(result.debug.shoulderWidthInches).toBe(5.5);
  });

  it("Express output unchanged when finishedNeckOpeningWidth override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", neckOpeningWidthOverride: "5" }),
    );
    const expressBaseline = generateSleevelessBackPattern(patternData({ patternMode: "express" }));
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram NECK_WIDTH and NECK_STS reflect wider neck opening", () => {
    const wider = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", neckOpeningWidthOverride: "5" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(wider, "in", {
      patternData: patternData({ patternMode: "custom-build", neckOpeningWidthOverride: "5" }),
      measurementPiece: "back",
    });
    const baseline = generateSleevelessBackPattern(patternData({ patternMode: "custom-build" }));
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build" }),
      measurementPiece: "back",
    });

    expect(repl.NECK_WIDTH).toBe("5");
    expect(baselineRepl.NECK_WIDTH).toBe("3");
    expect(Number(repl.NECK_STS)).toBeGreaterThan(Number(baselineRepl.NECK_STS));
  });
});
