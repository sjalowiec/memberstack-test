import { describe, expect, it } from "vitest";
import { buildBodyShapeGuideSvgFragment } from "./sleevelessBodyShapeDiagramGuides";
import { resolveEffectiveSleevelessBodyShapeKind } from "./sleevelessAlineShaping";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const baseMeasurements = {
  finished_bust_chest: 20,
  finished_hip: 20,
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
    bodyShape?: string;
    hipOverride?: string;
    chestBustOverride?: string;
    chartFinishedHip?: number;
    chartFinishedBust?: number;
  } = {},
): Record<string, unknown> {
  const fit: Record<string, unknown> = {
    selectedMeasurements: {
      ...baseMeasurements,
      finished_hip: overrides.chartFinishedHip ?? baseMeasurements.finished_hip,
      finished_bust_chest:
        overrides.chartFinishedBust ?? baseMeasurements.finished_bust_chest,
    },
  };
  if (overrides.hipOverride !== undefined || overrides.chestBustOverride !== undefined) {
    fit.cbMeasurementOverrides = {
      ...(overrides.hipOverride !== undefined ? { hip: overrides.hipOverride } : {}),
      ...(overrides.chestBustOverride !== undefined
        ? { chestBust: overrides.chestBustOverride }
        : {}),
    };
  }
  return {
    fit,
    style: {
      bodyShape: overrides.bodyShape ?? "straight",
      patternMode: overrides.patternMode ?? "express",
      garmentStyle: "pullover",
      frontStyle: "closed",
      neckline: "round",
    },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("sleeveless diagram body shape vs applied shaping", () => {
  it("straight body (40/40 express): no A-line guide overlay on generator debug", () => {
    const input = patternData({
      chestBustOverride: "40",
      hipOverride: "40",
      chartFinishedBust: 40,
      chartFinishedHip: 40,
    });
    const r = generateSleevelessBackPattern(input);
    expect(resolveEffectiveSleevelessBodyShapeKind(input, 40, 40)).toBe("straight");
    expect(r.debug.diagramGuides?.showBodyShapeGuides).toBe(false);
    expect(r.debug.diagramGuides?.bodyShapeKind).toBe("straight");
    expect(buildBodyShapeGuideSvgFragment(r.debug.diagramGuides, "back")).toBe("");
    expect(buildBodyShapeGuideSvgFragment(r.debug.diagramGuides, "front")).toBe("");
  });

  it("custom-build straight with matching hip/bust: no guide overlay", () => {
    const input = patternData({
      bodyShape: "straight",
      patternMode: "custom-build",
      chestBustOverride: "40",
      hipOverride: "40",
      chartFinishedBust: 40,
      chartFinishedHip: 40,
    });
    const r = generateSleevelessBackPattern(input);
    expect(r.debug.diagramGuides?.showBodyShapeGuides).toBe(false);
    expect(buildBodyShapeGuideSvgFragment(r.debug.diagramGuides, "back")).toBe("");
    expect(r.debug.hemCastOnStitches).toBe(r.debug.bustBodyStitches);
  });

  it("A-line from measurements (38/44): guide overlay active on back layout", () => {
    const input = patternData({
      chestBustOverride: "38",
      hipOverride: "44",
      chartFinishedBust: 38,
      chartFinishedHip: 38,
    });
    const r = generateSleevelessBackPattern(input);
    expect(resolveEffectiveSleevelessBodyShapeKind(input, 38, 44)).toBe("aline");
    expect(r.debug.diagramGuides?.showBodyShapeGuides).toBe(true);
    const frag = buildBodyShapeGuideSvgFragment(r.debug.diagramGuides, "back");
    expect(frag).toContain('id="body-shape-guides"');
    expect(frag).toContain("stroke-dasharray");
  });
});
