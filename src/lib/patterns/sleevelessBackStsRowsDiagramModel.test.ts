import { describe, expect, it } from "vitest";
import { pulloverArmholeEvents } from "./frontArmholeNecklineComposition";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import {
  buildSleevelessBackStsRowsDiagramModel,
  shouldBuildSleevelessBackStsRowsDiagramModel,
} from "./sleevelessBackStsRowsDiagramModel";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

function straightBackPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "pullover", neckline: "round", frontStyle: "closed", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function vNeckFrontStraightBackPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 6.86,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function alineBackPattern(): Record<string, unknown> {
  const pattern = straightBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  return pattern;
}

function shapedBackPattern(): Record<string, unknown> {
  const pattern = straightBackPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

describe("buildSleevelessBackStsRowsDiagramModel", () => {
  it("builds a straight-body Back model from the live result", () => {
    const pattern = straightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);

    expect(shouldBuildSleevelessBackStsRowsDiagramModel(result, pattern)).toBe(true);
    expect(model).not.toBeNull();
    expect(model?.piece).toBe("back");
    expect(model?.bodyShape).toBe("straight");
    expect(model?.neckline.style).toBe("round");
    expect(model?.bodyShaping.direction).toBe("straight");
  });

  it("uses Back neck depth and start RC, not Front neck values", () => {
    const pattern = vNeckFrontStraightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
    const d = result.debug;

    expect(model).not.toBeNull();
    expect(model?.rows.backNeckDepthRows).toBe(Math.round(d.backNeckDepthRows));
    expect(model?.neckline.depthRows).toBe(Math.round(d.backNeckDepthRows));
    expect(model?.neckline.depthRows).not.toBe(Math.round(d.frontNeckDepthRows));
    expect(model?.neckline.startGarmentRc).toBe(Math.floor(d.backNecklineStartRC));
    expect(model?.neckline.startGarmentRc).not.toBe(Math.floor(d.frontNecklineStartRC));
  });

  it("copies garment widths and rows from debug without recomputing stitch math", () => {
    const pattern = straightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
    const d = result.debug;

    expect(model?.widths.hemStitches).toBe(Math.round(d.hemCastOnStitches ?? d.backStitches));
    expect(model?.widths.bustStitches).toBe(Math.round(d.bustBodyStitches ?? d.backStitches));
    expect(model?.widths.stitchesAfterArmhole).toBe(Math.round(d.stitchesAfterArmhole ?? 0));
    expect(model?.widths.necklineStitches).toBe(Math.round(d.necklineStitches ?? 0));
    expect(model?.widths.shoulderStitchesPerSide).toBe(shoulderStitchesPerSideForDiagram(d));
    expect(model?.rows.hemRows).toBe(Math.round(d.hemRows));
    expect(model?.rows.rowsFromCastOnToArmholeStart).toBe(Math.round(d.rowsFromCastOnToArmholeStart));
    expect(model?.rows.armholeRows).toBe(Math.round(d.armholeRows));
    expect(model?.rows.expectedGarmentRows).toBe(Math.round(d.expectedGarmentRows));
  });

  it("reuses existing armhole bind-off / decrease events", () => {
    const pattern = straightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
    const eachSide = Math.round(result.debug.armholeStitchesEachSide ?? 0);
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide);
    const events = pulloverArmholeEvents({
      firstArmholeGarmentRc: model!.armhole.startGarmentRc,
      bindOffSts,
      decreaseSts,
    });

    expect(model?.armhole.bindOffStsEachSide).toBe(bindOffSts);
    expect(model?.armhole.decreaseStsEachSide).toBe(decreaseSts);
    expect(model?.armhole.events).toEqual(events);
  });

  it("returns null for A-line and shaped bodies", () => {
    for (const pattern of [alineBackPattern(), shapedBackPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      expect(shouldBuildSleevelessBackStsRowsDiagramModel(result, pattern)).toBe(false);
      expect(buildSleevelessBackStsRowsDiagramModel(result, pattern)).toBeNull();
    }
  });

  it("returns null when live back chart rows are missing", () => {
    const pattern = straightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const withoutLive = { ...result, neckShoulderChartUsesLiveRows: false };
    expect(shouldBuildSleevelessBackStsRowsDiagramModel(withoutLive, pattern)).toBe(false);
    expect(buildSleevelessBackStsRowsDiagramModel(withoutLive, pattern)).toBeNull();
  });
});
