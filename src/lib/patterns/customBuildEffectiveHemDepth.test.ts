import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { calculateHemRowsFromInches, getDefaultHemLengthInches } from "./hemDefaults";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
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
    hemDepthOverride?: string;
    audience?: string;
    armholeDepthOverride?: string;
    finishedLengthOverride?: string;
    neckDepthOverride?: string;
    neckOpeningWidthOverride?: string;
    shoulderWidthOverride?: string;
    chestBustOverride?: string;
  } = {},
): Record<string, unknown> {
  const fit: Record<string, unknown> = { selectedMeasurements: { ...baseMeasurements } };
  if (overrides.audience) {
    fit.sizingChart = overrides.audience;
  }
  const cb: Record<string, string> = {};
  if (overrides.hemDepthOverride !== undefined) cb.hemDepth = overrides.hemDepthOverride;
  if (overrides.armholeDepthOverride !== undefined) cb.armholeDepth = overrides.armholeDepthOverride;
  if (overrides.finishedLengthOverride !== undefined) cb.finishedLength = overrides.finishedLengthOverride;
  if (overrides.neckDepthOverride !== undefined) cb.neckDepth = overrides.neckDepthOverride;
  if (overrides.neckOpeningWidthOverride !== undefined) {
    cb.finishedNeckOpeningWidth = overrides.neckOpeningWidthOverride;
  }
  if (overrides.shoulderWidthOverride !== undefined) cb.shoulderWidth = overrides.shoulderWidthOverride;
  if (overrides.chestBustOverride !== undefined) cb.chestBust = overrides.chestBustOverride;
  if (Object.keys(cb).length > 0) fit.cbMeasurementOverrides = cb;
  const style: Record<string, unknown> = {};
  if (overrides.patternMode) style.patternMode = overrides.patternMode;
  if (overrides.audience) style.recipientCategory = overrides.audience;
  return {
    fit,
    style,
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("resolveEffectiveHemDepthInches", () => {
  it("uses audience default for Express (ignores overrides)", () => {
    expect(
      resolveEffectiveHemDepthInches(
        patternData({ patternMode: "express", hemDepthOverride: "4" }),
        "misses",
      ),
    ).toBe(getDefaultHemLengthInches("misses"));
  });

  it("uses audience default for custom-build when no override", () => {
    expect(
      resolveEffectiveHemDepthInches(patternData({ patternMode: "custom-build" }), "misses"),
    ).toBe(2);
  });

  it("uses override for custom-build when hemDepth is valid", () => {
    expect(
      resolveEffectiveHemDepthInches(
        patternData({ patternMode: "custom-build", hemDepthOverride: "4" }),
        "misses",
      ),
    ).toBe(4);
  });

  it("falls back to audience default when override is invalid", () => {
    expect(
      resolveEffectiveHemDepthInches(
        patternData({ patternMode: "custom-build", hemDepthOverride: "bad" }),
        "baby",
      ),
    ).toBe(1);
  });
});

describe("generateSleevelessBackPattern custom-build hem depth override", () => {
  it("deeper hem override increases hem rows and reduces body rows (same garment length)", () => {
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", audience: "misses" }),
    );
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", audience: "misses", hemDepthOverride: "4" }),
    );

    expect(baseline.debug.hemRows).toBe(calculateHemRowsFromInches(7, 2));
    expect(deeper.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));
    expect(deeper.debug.hemRows).toBeGreaterThan(baseline.debug.hemRows);
    expect(deeper.debug.bodyRows).toBeLessThan(baseline.debug.bodyRows);
    expect(deeper.debug.expectedGarmentRows).toBe(baseline.debug.expectedGarmentRows);
    const hemDelta = deeper.debug.hemRows - baseline.debug.hemRows;
    expect(baseline.debug.bodyRows - deeper.debug.bodyRows).toBe(hemDelta);
  });

  it("other measurement overrides still work alongside hem depth override", () => {
    const result = generateSleevelessBackPattern(
      patternData({
        patternMode: "custom-build",
        audience: "misses",
        hemDepthOverride: "4",
        armholeDepthOverride: "10",
        finishedLengthOverride: "26",
        neckDepthOverride: "6",
        neckOpeningWidthOverride: "5",
        shoulderWidthOverride: "5.5",
        chestBustOverride: "44",
      }),
    );
    expect(result.debug.hemRows).toBe(calculateHemRowsFromInches(7, 4));
    expect(result.debug.armholeDepth).toBe(10);
    expect(result.debug.backNeckToHem).toBe(26);
    expect(result.debug.frontNeckDepth).toBe(6);
    expect(result.debug.necklineWidthInches).toBe(5);
    expect(result.debug.shoulderWidthInches).toBe(5.5);
    expect(result.debug.finishedBustChest).toBe(44);
  });

  it("Express output unchanged when hemDepth override present on data", () => {
    const express = generateSleevelessBackPattern(
      patternData({ patternMode: "express", audience: "misses", hemDepthOverride: "4" }),
    );
    const expressBaseline = generateSleevelessBackPattern(
      patternData({ patternMode: "express", audience: "misses" }),
    );
    expect(express.debug).toEqual(expressBaseline.debug);
  });

  it("diagram HEM_INCHES and HEM_ROWS reflect deeper custom-build hem", () => {
    const deeper = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", audience: "misses", hemDepthOverride: "4" }),
    );
    const repl = buildSleevelessGarmentDiagramReplacements(deeper, "in", {
      patternData: patternData({
        patternMode: "custom-build",
        audience: "misses",
        hemDepthOverride: "4",
      }),
      measurementPiece: "front",
    });
    const baseline = generateSleevelessBackPattern(
      patternData({ patternMode: "custom-build", audience: "misses" }),
    );
    const baselineRepl = buildSleevelessGarmentDiagramReplacements(baseline, "in", {
      patternData: patternData({ patternMode: "custom-build", audience: "misses" }),
      measurementPiece: "front",
    });

    expect(repl.HEM_INCHES).toBe("4");
    expect(baselineRepl.HEM_INCHES).toBe("2");
    expect(Number(repl.HEM_ROWS)).toBeGreaterThan(Number(baselineRepl.HEM_ROWS));
  });
});
