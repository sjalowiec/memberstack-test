import { describe, expect, it } from "vitest";
import { pulloverArmholeEvents } from "./frontArmholeNecklineComposition";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { armholeBindOffDecreaseFromEachSide } from "./sleevelessBackJapaneseNotation";
import { resolveSleevelessDiagramBodyShapeKind } from "./sleevelessDiagramBodyShapeSrc";
import { resolveFrontVNeckNotationRcModel } from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontStsRowsDiagramModel,
  shouldBuildSleevelessFrontStsRowsDiagramModel,
} from "./sleevelessFrontStsRowsDiagramModel";
import { pulloverVNeckFrontShoulderPoints } from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

function amandaVNeckPattern(): Record<string, unknown> {
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

function shallowVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 3,
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

function vNeckBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 11,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function roundPulloverPattern(): Record<string, unknown> {
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

function cardiganVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "cardigan", neckline: "v-neck", frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function alineVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 46;
  return pattern;
}

function alineRoundPattern(): Record<string, unknown> {
  const pattern = roundPulloverPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  return pattern;
}

function shapedVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

describe("buildSleevelessFrontStsRowsDiagramModel", () => {
  it("builds a pullover V-neck straight-body Front model from the live result", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);

    expect(shouldBuildSleevelessFrontStsRowsDiagramModel(result, pattern)).toBe(true);
    expect(model).not.toBeNull();
    expect(model?.piece).toBe("front");
    expect(model?.garmentStyle).toBe("pullover");
    expect(model?.bodyShape).toBe("straight");
    expect(model?.neckline.style).toBe("v-neck");
    expect(resolveSleevelessDiagramBodyShapeKind(pattern)).toBe("straight");
  });

  it("copies garment widths from debug without recomputing stitch math", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const d = result.debug;

    expect(model?.widths.hemStitches).toBe(
      Math.round(d.hemCastOnStitches ?? d.backStitches),
    );
    expect(model?.widths.bustStitches).toBe(Math.round(d.bustBodyStitches ?? d.backStitches));
    expect(model?.widths.stitchesAfterArmhole).toBe(Math.round(d.stitchesAfterArmhole ?? 0));
    expect(model?.widths.necklineStitches).toBe(Math.round(d.necklineStitches ?? 0));
    expect(model?.widths.shoulderStitchesPerSide).toBe(shoulderStitchesPerSideForDiagram(d));
    expect(model?.widths.stitchesPerInch).toBe(d.stitchesPerInch);
    expect(model?.widths.hemStitches).toBe(model?.widths.bustStitches);
  });

  it("copies row measurements from debug", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const d = result.debug;

    expect(model?.rows.hemRows).toBe(Math.round(d.hemRows));
    expect(model?.rows.rowsFromCastOnToArmholeStart).toBe(Math.round(d.rowsFromCastOnToArmholeStart));
    expect(model?.rows.armholeRows).toBe(Math.round(d.armholeRows));
    expect(model?.rows.frontNeckDepthRows).toBe(Math.round(d.frontNeckDepthRows));
    expect(model?.rows.expectedGarmentRows).toBe(Math.round(d.expectedGarmentRows));
    expect(model?.rows.frontFinalRow).toBe(Math.round(d.frontFinalRow ?? d.expectedGarmentRows));
    expect(model?.rows.rowsPerInch).toBe(d.rowsPerInch);
    expect(model?.rows.sideSeamRowsAboveHem).toBe(
      Math.round(d.rowsFromCastOnToArmholeStart) - Math.round(d.hemRows),
    );
  });

  it("uses the same Front V-neck RC anchors as the live notation generator", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const rcModel = resolveFrontVNeckNotationRcModel(result);
    const overlap = result.debug.frontArmholeNecklineOverlap;

    expect(model?.armhole.startGarmentRc).toBe(rcModel.armholeBoGarmentRc);
    expect(model?.neckline.style).toBe("v-neck");
    expect(model?.neckline.startGarmentRc).toBe(
      overlap?.divideGarmentRc ?? result.debug.frontNecklineStartRC,
    );
    if (model?.neckline.style === "v-neck") {
      expect(model.neckline.divideGarmentRc).toBe(
        overlap?.divideGarmentRc ?? model.neckline.startGarmentRc,
      );
    }
    expect(model?.shoulder.startGarmentRc).toBeGreaterThanOrEqual(model?.armhole.lastGarmentRc ?? 0);
    expect(model?.neckline.depthRows).toBe(Math.round(result.debug.frontNeckDepthRows));
  });

  it("reuses existing armhole bind-off / decrease events", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const eachSide = Math.round(result.debug.armholeStitchesEachSide ?? 0);
    const split = armholeBindOffDecreaseFromEachSide(eachSide);
    const events = pulloverArmholeEvents({
      firstArmholeGarmentRc: model!.armhole.startGarmentRc,
      bindOffSts: split.bindOffSts,
      decreaseSts: split.decreaseSts,
    });

    expect(model?.armhole.stitchesEachSide).toBe(eachSide);
    expect(model?.armhole.bindOffStsEachSide).toBe(split.bindOffSts);
    expect(model?.armhole.decreaseStsEachSide).toBe(split.decreaseSts);
    expect(model?.armhole.events).toEqual(events);
    expect(model?.armhole.events.some((ev) => ev.kind === "bindOff")).toBe(true);
    expect(model?.armhole.events.some((ev) => ev.kind === "decrease")).toBe(true);
  });

  it("reuses the live front timeline for neck and shoulder points", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const timeline =
      result.frontNeckShoulderTimeline ?? result.frontNeckShoulderShapingChart.timeline ?? [];

    expect(model?.neckline.style).toBe("v-neck");
    if (model?.neckline.style === "v-neck") {
      expect(model.neckline.innerDecreasePoints).toEqual(
        collectInnerNeckDecreasePointsFromTimeline(timeline, "right"),
      );
    }
    expect(model?.shoulder.points).toEqual(pulloverVNeckFrontShoulderPoints(result));
    expect(model?.shoulder.stitchesPerSide).toBe(shoulderStitchesPerSideForDiagram(result.debug));
    expect((model?.shoulder.points.length ?? 0) > 0).toBe(true);
  });

  it("marks straight-body shaping with no side-shaping rows", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);

    expect(model?.bodyShaping.direction).toBe("straight");
    expect(model?.bodyShaping.rowNumbers).toEqual([]);
    expect(model?.bodyShaping.hemStitches).toBe(model?.bodyShaping.bustStitches);
    expect(model?.bodyShaping.startRc).toBe(0);
    expect(model?.bodyShaping.endRc).toBe(0);
  });

  it("records a V-neck that starts before the armhole", () => {
    const pattern = vNeckBeforeArmholePattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);

    expect(model).not.toBeNull();
    expect(model?.neckline.style).toBe("v-neck");
    if (model?.neckline.style === "v-neck") {
      expect(model.neckline.beginsBeforeArmhole).toBe(true);
    }
    expect(model?.neckline.startGarmentRc).toBeLessThan(model?.armhole.startGarmentRc ?? 0);
    expect(model?.armhole.overlapsNeckline).toBe(true);
  });

  it("builds a pullover round-neck straight-body Front model without V divide fields", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);

    expect(shouldBuildSleevelessFrontStsRowsDiagramModel(result, pattern)).toBe(true);
    expect(model).not.toBeNull();
    expect(model?.neckline.style).toBe("round");
    expect(model?.armhole.overlapsNeckline).toBe(false);
    if (model?.neckline.style === "round") {
      expect(model.neckline.centerBindOffStitches).toBeGreaterThan(0);
      expect(model.neckline.strategy === "deep-round" || model.neckline.strategy === "shallow-round").toBe(
        true,
      );
      expect("divideGarmentRc" in model.neckline).toBe(false);
      expect("beginsBeforeArmhole" in model.neckline).toBe(false);
    }
    expect(model?.neckline.startGarmentRc).toBe(result.debug.frontNecklineStartRC);
    expect(model?.neckline.depthRows).toBe(Math.round(result.debug.frontNeckDepthRows));
    expect(model?.widths.necklineStitches).toBe(Math.round(result.debug.necklineStitches ?? 0));
  });

  it("builds pullover A-line Front models from the live A-line stitch and row data", () => {
    for (const pattern of [alineVNeckPattern(), alineRoundPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
      const d = result.debug;

      expect(resolveSleevelessDiagramBodyShapeKind(pattern)).toBe("aline");
      expect(shouldBuildSleevelessFrontStsRowsDiagramModel(result, pattern)).toBe(true);
      expect(model).not.toBeNull();
      expect(model?.bodyShape).toBe("aline");
      expect(model?.widths.hemStitches).toBe(Math.round(d.hemCastOnStitches ?? d.backStitches));
      expect(model?.widths.bustStitches).toBe(Math.round(d.bustBodyStitches ?? d.backStitches));
      expect(model?.widths.hemStitches).toBeGreaterThan(model?.widths.bustStitches ?? 0);
      expect(model?.bodyShaping.direction).toBe("inward");
      expect(model?.bodyShaping.startRc).toBe(
        d.alineBodyShapingRowNumbers && d.alineBodyShapingRowNumbers.length > 0
          ? Math.floor(d.alineBodyShapingRowNumbers[0]!)
          : model?.bodyShaping.startRc,
      );
      expect(model?.bodyShaping.endRc).toBe(
        d.alineBodyShapingRowNumbers && d.alineBodyShapingRowNumbers.length > 0
          ? Math.floor(d.alineBodyShapingRowNumbers[d.alineBodyShapingRowNumbers.length - 1]!)
          : model?.bodyShaping.endRc,
      );
      expect(model?.bodyShaping.startRc).toBeGreaterThanOrEqual(0);
      expect(model?.bodyShaping.endRc).toBeGreaterThan(model?.bodyShaping.startRc ?? 0);
      expect(model?.bodyShaping.endRc).toBeLessThanOrEqual(model?.armhole.startGarmentRc ?? 0);
    }
  });

  it("returns null for cardigan and shaped bodies", () => {
    const cases = [cardiganVNeckPattern(), shapedVNeckPattern()];
    for (const pattern of cases) {
      const result = generateSleevelessBackPattern(pattern);
      expect(shouldBuildSleevelessFrontStsRowsDiagramModel(result, pattern)).toBe(false);
      expect(buildSleevelessFrontStsRowsDiagramModel(result, pattern)).toBeNull();
    }
    expect(resolveSleevelessDiagramBodyShapeKind(alineVNeckPattern())).toBe("aline");
    expect(resolveSleevelessDiagramBodyShapeKind(shapedVNeckPattern())).toBe("shaped");
  });

  it("returns null when live front chart rows are missing", () => {
    const pattern = amandaVNeckPattern();
    const result = generateSleevelessBackPattern(pattern);
    const withoutLive = { ...result, frontNeckShoulderChartUsesLiveRows: false };

    expect(shouldBuildSleevelessFrontStsRowsDiagramModel(withoutLive, pattern)).toBe(false);
    expect(buildSleevelessFrontStsRowsDiagramModel(withoutLive, pattern)).toBeNull();
  });
});
