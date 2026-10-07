import { describe, expect, it } from "vitest";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import { formatDropShoulderSleeveShapingNotation } from "./dropShoulderSleeveShaping";
import { rowBasedShapingNotation } from "./shapingNotationCompress";
import {
  calculateSidewaysCardiganBody,
  sidewaysPulloverFirstArmholePlaceMarker,
  sidewaysPulloverFirstArmholeSideSeamFromCalc,
  sidewaysPulloverFirstArmholeSideSeamX,
} from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import { fmtNum } from "./dropShoulderPatternDiagramSvgShared";
import { buildSidewaysVNeckSlopeSequence } from "./sidewaysCardiganBodyInstructions";
import {
  buildSidewaysCardiganPatternDiagramFrame,
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
  sidewaysDiagramEdgeStitchCount,
  sidewaysKnitVisualY,
  sidewaysPatternDiagramCanvas,
} from "./sidewaysCardiganPatternDiagramSvg";
import { cardiganDimLayout } from "./sidewaysCardiganEditMeasurementDiagramSvg";
import {
  buildSidewaysCardiganShapingNotationDiagramSvg,
  sidewaysCardiganVNeckNotationLines,
} from "./sidewaysCardiganShapingNotationDiagramSvg";
import { calculateSidewaysCardiganSleeve } from "./sidewaysCardiganSleeveCalc";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "./sidewaysCardiganSleeveDiagramSvg";
import {
  buildSidewaysCardiganEditBodyMeasurementDiagramSvg,
  buildSidewaysCardiganEditSleeveMeasurementDiagramSvg,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";
import {
  buildShapingNotationDiagramPrintDocument,
  isPrintablePatternDiagramSvg,
} from "./sleevelessDiagramModal";
import {
  formatBindOffNotation,
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatHoldNotation,
} from "./sleevelessBackJapaneseNotation";

const SAMPLE: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

function mustBody(input: SidewaysCardiganBodyCalcInput = SAMPLE) {
  const result = calculateSidewaysCardiganBody(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.calc;
}

function modelFor(
  garmentStyle: "cardigan" | "pullover",
  input: SidewaysCardiganBodyCalcInput = SAMPLE,
  extras: {
    sleeveLengthInches?: number;
    wristInches?: number;
    sleeveDirection?: "cuff-up" | "top-down" | "sideways";
    includeSleeve?: boolean;
    displayUnit?: "in" | "cm";
  } = {},
) {
  const calc = mustBody(input);
  const sleeve =
    extras.includeSleeve === false
      ? null
      : extras.sleeveDirection === "sideways"
        ? null
        : calculateSidewaysCardiganSleeve({
            direction: extras.sleeveDirection === "top-down" ? "top-down" : "cuff-up",
            finishedUpperArmInches: input.finishedUpperArmInches,
            finishedWristInches: extras.wristInches ?? 8,
            sleeveLengthInches: extras.sleeveLengthInches ?? 18,
            stitchesPerInch: input.stitchesPerInch,
            rowsPerInch: input.rowsPerInch,
            cuffDepthInches: 2,
            armholeDepthInches: calc.armholeDepthInches,
          });
  return buildSidewaysCardiganPatternDiagramModel({
    garmentStyle,
    sleeveDirection: extras.sleeveDirection ?? "cuff-up",
    calc,
    input,
    sleeveCalc: sleeve && sleeve.ok ? sleeve.calc : null,
    sleeveLengthInches: extras.sleeveLengthInches ?? 18,
    wristInches: extras.wristInches ?? 8,
    displayUnit: extras.displayUnit,
  });
}

function placeMarkers(svg: string): { edge: string; sts: string; x: string; y: string }[] {
  return [...svg.matchAll(/data-role="place-marker"(?=[ >])([^>]*)>/g)].map((match) => {
    const attrs = match[1] ?? "";
    const read = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";
    return { edge: read("data-edge"), sts: read("data-stitches-from-neck"), x: read("data-x"), y: read("data-y") };
  });
}

describe("Sideways Stitches & Rows diagram", () => {
  it("feeds calculated Sideways stitch and row values into the diagram", () => {
    const model = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    expect(svg).toContain('data-sideways-pattern-diagram="sts-rows"');
    expect(svg).toContain(`data-cast-on-sts="${sidewaysDiagramEdgeStitchCount(model.calc)}"`);
    expect(svg).toContain(`data-bind-off-sts="${sidewaysDiagramEdgeStitchCount(model.calc)}"`);
    expect(svg).toContain(`data-starting-front-sts="${model.castOnStitches}"`);
    expect(svg).toContain(`data-length-sts="${model.calc.garmentLengthStitches}"`);
    expect(svg).toContain(`data-vneck-sts="${model.calc.vNeckDepthStitches}"`);
    expect(svg).toContain(`data-armhole-sts="${model.calc.armholeDepthStitches}"`);
    expect(svg).toContain(`data-front-rows="${model.calc.frontRows}"`);
    expect(svg).toContain(`data-back-rows="${model.calc.backRows}"`);
    expect(svg).toContain(`data-shoulder-rows="${model.calc.shoulders.firstFrontRows}"`);
    expect(svg).toContain(`data-back-neck-sts="${model.calc.backNeckDepthStitches}"`);
    expect(svg).toContain(`data-neck-opening-rows="${model.calc.backNeckOpeningRows}"`);
    expect(svg).toContain(`${model.calc.garmentLengthStitches} sts`);
    expect(svg).toContain(`${model.calc.frontRows} rows`);
    expect(svg).toContain(`${model.calc.backNeckOpeningRows} rows`);
    expect(svg).toContain(`CO ${sidewaysDiagramEdgeStitchCount(model.calc)} sts`);
    expect(svg).toContain(`BO ${sidewaysDiagramEdgeStitchCount(model.calc)} sts`);
  });

  it("updates diagram values when Summary/Edit measurement overrides change the calc input", () => {
    const base = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const deeper = modelFor(
      "cardigan",
      { ...SAMPLE, vNeckDepthInches: 10, garmentLengthInches: 24 },
      { includeSleeve: false },
    );
    const baseSvg = buildSidewaysCardiganPatternDiagramSvg(base);
    const deeperSvg = buildSidewaysCardiganPatternDiagramSvg(deeper);
    expect(deeper.calc.vNeckDepthStitches).not.toBe(base.calc.vNeckDepthStitches);
    expect(deeper.calc.garmentLengthStitches).not.toBe(base.calc.garmentLengthStitches);
    expect(baseSvg).toContain(`data-vneck-sts="${base.calc.vNeckDepthStitches}"`);
    expect(deeperSvg).toContain(`data-vneck-sts="${deeper.calc.vNeckDepthStitches}"`);
    expect(deeperSvg).not.toContain(`data-vneck-sts="${base.calc.vNeckDepthStitches}"`);
    expect(deeperSvg).toContain(`data-length-sts="${deeper.calc.garmentLengthStitches}"`);
  });

  it("renders Cardigan construction starting at center front without a sleeve outline", () => {
    const svg = buildSidewaysCardiganPatternDiagramSvg(
      modelFor("cardigan", SAMPLE, { includeSleeve: false }),
    );
    expect(svg).toContain('data-garment-style="cardigan"');
    expect(svg).toContain('data-sideways-start="center-front"');
    expect(svg).toContain('data-cardigan-structure="front-back-front"');
    expect(svg).toContain('data-role="center-front-start"');
    expect(svg).not.toContain('data-role="sleeve-outline"');
    expect(svg).not.toContain('data-role="underarm-start"');
  });

  it("marks the pullover first-armhole side seam on all three body diagrams from the instruction stitch count", () => {
    const model = modelFor("pullover", SAMPLE, { includeSleeve: false });
    const seam = sidewaysPulloverFirstArmholeSideSeamFromCalc(model.calc);
    expect(seam).not.toBeNull();
    if (!seam) return;
    const frame = buildSidewaysCardiganPatternDiagramFrame(model);
    const expectedX = fmtNum(
      sidewaysPulloverFirstArmholeSideSeamX(frame.hemX, frame.neckX, seam),
    );
    const edit = buildSidewaysCardiganEditBodyMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: model.measurements,
      placeMarker: sidewaysPulloverFirstArmholePlaceMarker(seam),
    });
    const sts = buildSidewaysCardiganPatternDiagramSvg(model);
    const shaping = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    for (const svg of [edit, sts, shaping]) {
      const markers = placeMarkers(svg);
      expect(markers.map((marker) => marker.edge).sort()).toEqual(["bind-off", "cast-on"]);
      expect(markers.every((marker) => marker.sts === String(seam.stitchesFromNeckEdge))).toBe(true);
      expect(markers.every((marker) => marker.x === expectedX)).toBe(true);
      expect(svg).not.toContain('data-role="side-seam-marker-span"');
      expect(svg).not.toContain("stroke-dasharray=\"3 3\"");
      expect(svg.match(/data-role="place-marker"[\s\S]*?fill="#c62828"/g)).toHaveLength(2);
      const markerLabels = [...svg.matchAll(/data-role="side-seam-marker-label"[^>]*>/g)];
      expect(markerLabels).toHaveLength(2);
      expect(markerLabels.every((label) => label[0].includes('fill="#1a1a1a"'))).toBe(true);
      expect(markerLabels.every((label) => !label[0].includes('fill="#c62828"'))).toBe(true);
    }
    const editMarkers = placeMarkers(edit);
    const castOn = editMarkers.find((marker) => marker.edge === "cast-on");
    const bindOff = editMarkers.find((marker) => marker.edge === "bind-off");
    expect(Number(castOn?.y)).toBeGreaterThan(Number(bindOff?.y));
    const cardigan = buildSidewaysCardiganPatternDiagramSvg(modelFor("cardigan", SAMPLE));
    const cardiganEdit = buildSidewaysCardiganEditBodyMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: model.measurements,
      placeMarker: sidewaysPulloverFirstArmholePlaceMarker(seam),
    });
    expect(placeMarkers(cardigan)).toEqual([]);
    expect(placeMarkers(cardiganEdit)).toEqual([]);
    expect(buildSidewaysCardiganShapingNotationDiagramSvg(modelFor("cardigan", SAMPLE))).not.toContain(
      'data-role="place-marker"',
    );
    const withoutMarker = buildSidewaysCardiganEditBodyMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: model.measurements,
    });
    expect(placeMarkers(withoutMarker)).toEqual([]);
    const deeper = modelFor("pullover", { ...SAMPLE, finishedUpperArmInches: 18 }, { includeSleeve: false });
    const deeperSeam = sidewaysPulloverFirstArmholeSideSeamFromCalc(deeper.calc);
    const deeperFrame = buildSidewaysCardiganPatternDiagramFrame(deeper);
    const deeperX = Number(
      placeMarkers(buildSidewaysCardiganPatternDiagramSvg(deeper))[0]?.x,
    );
    expect(deeperSeam && deeperSeam.stitchesFromNeckEdge).toBeGreaterThan(seam.stitchesFromNeckEdge);
    expect(deeperX).toBeLessThan(Number(expectedX));
    expect(deeperX).toBeCloseTo(
      sidewaysPulloverFirstArmholeSideSeamX(deeperFrame.hemX, deeperFrame.neckX, deeperSeam!),
      1,
    );
  });

  it("renders Pullover construction starting at the underarm without an attached sleeve", () => {
    const model = modelFor("pullover", SAMPLE, { sleeveLengthInches: 18, wristInches: 8 });
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    expect(svg).toContain('data-garment-style="pullover"');
    expect(svg).toContain('data-sideways-start="underarm"');
    expect(svg).toContain('data-cardigan-structure="underarm-graft"');
    expect(svg).not.toContain('data-role="sleeve-outline"');
    expect(svg).toContain('data-role="underarm-start"');
    expect(svg).toContain("Start at underarm");
    if (model.sleeveCalc) {
      expect(svg).toContain(`data-wrist-sts="${model.sleeveCalc.wristSts}"`);
      expect(svg).toContain(`data-top-sts="${model.sleeveCalc.topSts}"`);
    }
    expect(svg).not.toContain('data-role="sleeve-wrist-sts"');
    expect(svg).not.toContain('data-role="sleeve-top-sts"');
    expect(svg).not.toContain('data-role="sleeve-body-rows"');
    expect(svg).not.toContain('data-role="sleeve-cuff-rows"');
  });

  it("reflects sleeve direction and length on the pullover diagram", () => {
    const cuffUp = modelFor("pullover", SAMPLE, {
      sleeveDirection: "cuff-up",
      sleeveLengthInches: 16,
    });
    const topDown = modelFor("pullover", SAMPLE, {
      sleeveDirection: "top-down",
      sleeveLengthInches: 22,
    });
    const cuffSvg = buildSidewaysCardiganPatternDiagramSvg(cuffUp);
    const topSvg = buildSidewaysCardiganPatternDiagramSvg(topDown);
    expect(cuffSvg).toContain('data-sleeve-direction="cuff-up"');
    expect(topSvg).toContain('data-sleeve-direction="top-down"');
    if (cuffUp.sleeveCalc && topDown.sleeveCalc) {
      expect(topDown.sleeveCalc.finished.sleeveLengthInches).toBeGreaterThan(
        cuffUp.sleeveCalc.finished.sleeveLengthInches,
      );
      expect(topSvg).toContain(`data-sleeve-body-rows="${topDown.sleeveCalc.sleeveBodyRows}"`);
      expect(cuffSvg).toContain(`data-sleeve-body-rows="${cuffUp.sleeveCalc.sleeveBodyRows}"`);
      expect(cuffSvg).toContain(`data-cuff-rows="${cuffUp.sleeveCalc.cuffRows}"`);
      expect(cuffSvg).not.toContain('data-role="sleeve-cuff-rows"');
      expect(topSvg).not.toContain('data-role="sleeve-body-rows"');
    }
  });

  it("does not invent sleeve stitch counts when the sleeve direction is sideways", () => {
    const svg = buildSidewaysCardiganPatternDiagramSvg(
      modelFor("pullover", SAMPLE, { sleeveDirection: "sideways", sleeveLengthInches: 15 }),
    );
    expect(svg).toContain('data-sleeve-direction="sideways"');
    expect(svg).toContain('data-sleeve-calculated="false"');
    expect(svg).not.toContain("data-wrist-sts");
    expect(svg).not.toContain("data-top-sts");
    expect(svg).not.toContain('data-role="sleeve-wrist-sts"');
    expect(svg).not.toContain('data-role="sleeve-body-rows"');
  });

  it("keeps cuff-up sleeve counts on the cardigan data attributes without drawing a sleeve", () => {
    const model = modelFor("cardigan", SAMPLE, { sleeveDirection: "cuff-up", sleeveLengthInches: 17 });
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    expect(svg).not.toContain('data-role="sleeve-outline"');
    expect(model.sleeveCalc).not.toBeNull();
    expect(svg).toContain('data-sleeve-calculated="true"');
    expect(svg).toContain(`data-sleeve-direction="cuff-up"`);
    expect(svg).toContain(`data-wrist-sts="${model.sleeveCalc?.wristSts}"`);
  });
});

function roleTexts(svg: string, role: string): string[] {
  const re = new RegExp(`<text\\b[^>]*data-role="${role}"[^>]*>[\\s\\S]*?</text>`, "g");
  return [...svg.matchAll(re)].sort((a, b) => {
    const order = (tag: string) => Number(/data-stack-order="(\d+)"/.exec(tag)?.[1] ?? 0);
    return order(a[0]) - order(b[0]);
  }).map((match) => match[0]);
}

describe("row-based shaping notation", () => {
  it("refuses a row-based section that omits the row spans", () => {
    expect(() =>
      rowBasedShapingNotation({
        rowsBefore: Number.NaN,
        segments: [{ stitches: 1, intervalRows: 2, times: 4 }],
        rowsAfter: 0,
        totalRows: 8,
      }),
    ).toThrow(/rows before, after, and total/);
  });
});

describe("Sideways Shaping Notation diagram", () => {
  it("formats the body-instruction V-neck sequences, including the reversed decrease", () => {
    const model = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const slope = buildSidewaysVNeckSlopeSequence(
      model.calc.vNeckDepthStitches,
      model.calc.halfNeckRows,
    );
    expect(slope.ok).toBe(true);
    if (!slope.ok) throw new Error("expected a sideways V-neck slope");
    const lines = sidewaysCardiganVNeckNotationLines(model);
    expect(lines.increase[0]).not.toBe(lines.decrease[0]);
    expect(svg).toContain('data-sideways-pattern-diagram="shaping-notation"');
    expect(svg).toContain(formatCastOnNotation(sidewaysDiagramEdgeStitchCount(model.calc)));
    expect(svg).toContain(formatHoldNotation(model.calc.vNeckDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.armholeDepthStitches));
    expect(svg).toContain(formatCastOnNotation(model.calc.armholeDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.backNeckDepthStitches));
    expect(svg).toContain(formatCastOnNotation(model.calc.backNeckDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.garmentLengthStitches));
    expect(svg).toContain(`data-vneck-sts="${model.calc.vNeckDepthStitches}"`);
    const first = roleTexts(svg, "jp-vneck-first");
    const second = roleTexts(svg, "jp-vneck-second");
    expect(lines.increase[0]).toBe("2r");
    expect(lines.decrease.at(-1)).toMatch(/^\d+r$/);
    expect(lines.increase.join(" ")).not.toBe(lines.decrease.join(" "));
    for (const line of lines.increase) expect(first.join(" ")).toContain(line);
    for (const line of lines.decrease) expect(second.join(" ")).toContain(line);
    expect(svg).toContain('data-not-row-based-reason="Armhole slit is a stitch bind-off and cast-on, not a row interval."');
    expect(svg).toContain(`data-vneck-rows="${model.calc.halfNeckRows}"`);
    expect(svg.match(/data-role="jp-armhole-slit"/g)).toHaveLength(4);
  });

  it("keeps V-neck notation when the instruction slope is valid but the generic slope helper is not", () => {
    const shallow: SidewaysCardiganBodyCalcInput = {
      ...SAMPLE,
      vNeckDepthInches: 4,
      stitchesPerInch: 4,
      neckOpeningWidthInches: 8,
    };
    const model = modelFor("cardigan", shallow, { includeSleeve: false });
    const generic = calculateSlopeShaping(model.calc.vNeckDepthStitches, model.calc.halfNeckRows);
    const slope = buildSidewaysVNeckSlopeSequence(
      model.calc.vNeckDepthStitches,
      model.calc.halfNeckRows,
    );
    expect(generic.ok).toBe(false);
    expect(slope.ok).toBe(true);
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const lines = sidewaysCardiganVNeckNotationLines(model);
    expect(lines.increase.length).toBeGreaterThan(0);
    expect(svg).toContain(lines.increase[0]!);
    expect(svg).toContain(lines.decrease[0]!);
  });

  it("formats supplied instruction sequences instead of rebuilding the slope", () => {
    const base = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const model = buildSidewaysCardiganPatternDiagramModel({
      garmentStyle: "cardigan",
      sleeveDirection: base.sleeveDirection,
      calc: base.calc,
      input: SAMPLE,
      sleeveCalc: null,
      vNeckIncreaseSequence: [5, 1],
      vNeckDecreaseSequence: [1, 5],
    });
    const lines = sidewaysCardiganVNeckNotationLines(model);
    expect(lines.increase).toEqual(["2r", "+5s-2r-1x", "+1s-2r-1x", "22r"]);
    expect(lines.decrease).toEqual(["-1s-2r-1x", "-5s-2r-1x", "24r"]);
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const first = roleTexts(svg, "jp-vneck-first");
    expect(first[0]).toContain("2r");
    expect(first[1]).toContain("+5s-2r-1x");
    expect(first[2]).toContain("+1s-2r-1x");
  });

  it("omits V-neck notation when the instruction sequences are empty", () => {
    const base = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const model = buildSidewaysCardiganPatternDiagramModel({
      garmentStyle: "cardigan",
      calc: base.calc,
      input: SAMPLE,
      sleeveCalc: null,
      vNeckIncreaseSequence: [],
      vNeckDecreaseSequence: [],
    });
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    expect(svg).not.toContain('data-role="jp-vneck-first"');
    expect(svg).not.toContain('data-role="jp-vneck-second"');
  });

  it("updates shaping notation when measurement overrides change the V-neck calc", () => {
    const base = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const deeper = modelFor("cardigan", { ...SAMPLE, vNeckDepthInches: 10 }, { includeSleeve: false });
    const baseLines = sidewaysCardiganVNeckNotationLines(base);
    const deeperLines = sidewaysCardiganVNeckNotationLines(deeper);
    const baseSvg = buildSidewaysCardiganShapingNotationDiagramSvg(base);
    const deeperSvg = buildSidewaysCardiganShapingNotationDiagramSvg(deeper);
    expect(deeper.calc.vNeckDepthStitches).not.toBe(base.calc.vNeckDepthStitches);
    expect(baseSvg).toContain(formatCastOnNotation(sidewaysDiagramEdgeStitchCount(base.calc)));
    expect(deeperSvg).toContain(formatCastOnNotation(sidewaysDiagramEdgeStitchCount(deeper.calc)));
    expect(baseLines.increase.join("|")).not.toBe(deeperLines.increase.join("|"));
    expect(deeperSvg).toContain(deeperLines.increase[0]!);
  });

  it("uses decrease-then-increase V-neck notation for Pullover and increase-then-decrease for Cardigan", () => {
    const cardigan = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const pullover = modelFor("pullover", SAMPLE, { includeSleeve: false });
    const cardiganLines = sidewaysCardiganVNeckNotationLines(cardigan);
    const pulloverSvg = buildSidewaysCardiganShapingNotationDiagramSvg(pullover);
    const cardiganSvg = buildSidewaysCardiganShapingNotationDiagramSvg(cardigan);
    expect(cardiganSvg).toContain('data-role="jp-vneck-first"');
    expect(pulloverSvg).toContain('data-garment-style="pullover"');
    expect(cardiganSvg).toContain(cardiganLines.increase[0]!);
    expect(pulloverSvg).not.toContain('data-role="sleeve-outline"');
    expect(cardiganSvg).not.toContain('data-role="sleeve-outline"');
    expect(pulloverSvg.match(/data-role="jp-armhole-slit"/g)).toHaveLength(2);
    expect(pulloverSvg).toContain('data-side="knitted"');
  });

  it("includes the saved sleeve shaping plan and cuff rows on a pullover", () => {
    const cuffUp = modelFor("pullover", SAMPLE, { sleeveDirection: "cuff-up" });
    const topDown = modelFor("pullover", SAMPLE, { sleeveDirection: "top-down" });
    const cuffSvg = buildSidewaysCardiganShapingNotationDiagramSvg(cuffUp);
    const topSvg = buildSidewaysCardiganShapingNotationDiagramSvg(topDown);
    expect(cuffUp.sleeveCalc && !cuffUp.sleeveCalc.shapingPlan.noShaping).toBeTruthy();
    expect(topDown.sleeveCalc && !topDown.sleeveCalc.shapingPlan.noShaping).toBeTruthy();
    const cuffNotation = formatDropShoulderSleeveShapingNotation(cuffUp.sleeveCalc!.shapingPlan.steps);
    const topNotation = formatDropShoulderSleeveShapingNotation(topDown.sleeveCalc!.shapingPlan.steps);
    const cuffSign = cuffUp.sleeveCalc!.shapingPlan.shapingDirection === "decrease" ? "-" : "+";
    const topSign = topDown.sleeveCalc!.shapingPlan.shapingDirection === "decrease" ? "-" : "+";
    expect(cuffSvg).toContain(`${cuffSign}${cuffNotation}`);
    expect(topSvg).toContain(`${topSign}${topNotation}`);
    expect(cuffSvg).toMatch(/\d+r/);
    expect(topSvg).toMatch(/\d+r/);
    expect(cuffSign).not.toBe(topSign);
    expect(cuffSvg).toContain(formatBodyRowsNotation(cuffUp.sleeveCalc!.cuffRows));
    expect(cuffSvg).toContain('data-role="jp-cuff"');
    expect(cuffSvg).toContain('data-role="jp-sleeve"');
  });

  it("does not draw sleeve shaping on the cardigan body schematic", () => {
    const model = modelFor("cardigan", SAMPLE, { sleeveDirection: "top-down" });
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    expect(model.sleeveCalc).not.toBeNull();
    expect(svg).not.toContain('data-role="jp-sleeve"');
    expect(svg).not.toContain('data-role="sleeve-outline"');
    expect(svg).toContain('data-sleeve-calculated="true"');
    expect(svg).toContain('data-sleeve-direction="top-down"');
  });
});

function diagramElement(svg: string): Element {
  const attrs = new Map<string, string>();
  const open = svg.match(/^<svg\b[^>]*>/)?.[0] ?? "";
  for (const match of open.matchAll(/\s([\w:-]+)="([^"]*)"/g)) {
    attrs.set(match[1]!, match[2]!);
  }
  return {
    hasAttribute: (name: string) => attrs.has(name),
    getAttribute: (name: string) => attrs.get(name) ?? null,
  } as unknown as Element;
}

function printDocument(svg: string): string {
  const label = diagramElement(svg).getAttribute("aria-label") ?? "diagram";
  return buildShapingNotationDiagramPrintDocument(svg, label);
}

function viewBoxOf(svg: string): { x: number; y: number; width: number; height: number } {
  const parts = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number) ?? [];
  return { x: parts[0] ?? 0, y: parts[1] ?? 0, width: parts[2] ?? 0, height: parts[3] ?? 0 };
}

function bodyOutline(svg: string): string {
  return /data-role="body-outline"[^>]*\bd="([^"]+)"/.exec(svg)?.[1] ?? "";
}

describe("finished Pullover body diagrams omit the attached sleeve", () => {
  const shortSleeve = { sleeveLengthInches: 12, wristInches: 6, sleeveDirection: "cuff-up" as const };
  const longSleeve = { sleeveLengthInches: 28, wristInches: 12, sleeveDirection: "top-down" as const };

  it("draws the Stitches & Rows and Shaping Notation bodies without a sleeve", () => {
    const model = modelFor("pullover", SAMPLE, longSleeve);
    const sts = buildSidewaysCardiganPatternDiagramSvg(model);
    const shaping = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const frame = buildSidewaysCardiganPatternDiagramFrame(model);
    expect(sts).toContain('data-sideways-pattern-diagram="sts-rows"');
    expect(shaping).toContain('data-sideways-pattern-diagram="shaping-notation"');
    expect(sts).not.toContain('data-role="sleeve-outline"');
    expect(shaping).not.toContain('data-role="sleeve-outline"');
    expect(sts).toContain('data-role="body-outline"');
    expect(shaping).toContain('data-role="body-outline"');
    expect(frame.sleeve.farX).toBe(frame.neckX);
    expect(frame.sleeve.upperHalf).toBe(0);
    expect(frame.sleeve.wristHalf).toBe(0);
  });

  it("keeps sleeve length, wrist, upper arm, and direction from changing the body scale or viewBox", () => {
    const narrow = modelFor("pullover", SAMPLE, shortSleeve);
    const wide = modelFor("pullover", SAMPLE, longSleeve);
    const biggerArm = modelFor("pullover", { ...SAMPLE, finishedUpperArmInches: 22 }, longSleeve);
    const narrowSts = buildSidewaysCardiganPatternDiagramSvg(narrow);
    const wideSts = buildSidewaysCardiganPatternDiagramSvg(wide);
    const narrowShaping = buildSidewaysCardiganShapingNotationDiagramSvg(narrow);
    const wideShaping = buildSidewaysCardiganShapingNotationDiagramSvg(wide);
    const narrowFrame = buildSidewaysCardiganPatternDiagramFrame(narrow);
    const wideFrame = buildSidewaysCardiganPatternDiagramFrame(wide);
    const biggerArmFrame = buildSidewaysCardiganPatternDiagramFrame(biggerArm);
    expect(narrowFrame.bodyW).toBeCloseTo(wideFrame.bodyW, 4);
    expect(narrowFrame.bodyW).toBeCloseTo(biggerArmFrame.bodyW, 4);
    expect(narrowFrame.bottomY - narrowFrame.topY).toBeCloseTo(wideFrame.bottomY - wideFrame.topY, 4);
    expect(narrowFrame.bottomY - narrowFrame.topY).toBeCloseTo(
      biggerArmFrame.bottomY - biggerArmFrame.topY,
      4,
    );
    expect(biggerArmFrame.sleeve.farX).toBe(biggerArmFrame.neckX);
    expect(viewBoxOf(narrowSts)).toEqual(viewBoxOf(wideSts));
    expect(viewBoxOf(narrowShaping)).toEqual(viewBoxOf(wideShaping));
    expect(bodyOutline(narrowSts)).toBe(bodyOutline(wideSts));
    expect(bodyOutline(narrowShaping)).toBe(bodyOutline(wideShaping));
  });

  it("still draws the separate Pullover sleeve diagrams from the sleeve calc", () => {
    const short = modelFor("pullover", SAMPLE, shortSleeve);
    const long = modelFor("pullover", SAMPLE, longSleeve);
    expect(short.sleeveCalc).not.toBeNull();
    expect(long.sleeveCalc).not.toBeNull();
    const sleeveArgs = (model: ReturnType<typeof modelFor>) => ({
      calc: model.sleeveCalc!,
      stitchesPerInch: SAMPLE.stitchesPerInch,
      rowsPerInch: SAMPLE.rowsPerInch,
    });
    const shortSts = buildSidewaysCardiganSleeveStitchesRowsSvg(sleeveArgs(short)) ?? "";
    const longSts = buildSidewaysCardiganSleeveStitchesRowsSvg(sleeveArgs(long)) ?? "";
    const shortShaping = buildSidewaysCardiganSleeveShapingNotationSvg(sleeveArgs(short)) ?? "";
    const longShaping = buildSidewaysCardiganSleeveShapingNotationSvg(sleeveArgs(long)) ?? "";
    for (const svg of [shortSts, longSts, shortShaping, longShaping]) {
      expect(svg).toContain('class="ds-sleeve-diagram__body"');
      expect(svg).not.toContain('data-sideways-pattern-diagram=');
    }
    expect(longSts).not.toBe(shortSts);
    expect(longShaping).not.toBe(shortShaping);
    expect(long.sleeveCalc!.finished.sleeveLengthInches).toBeGreaterThan(
      short.sleeveCalc!.finished.sleeveLengthInches,
    );
  });

  it("leaves Cardigan body diagrams without a sleeve", () => {
    const cardigan = modelFor("cardigan", SAMPLE, { ...longSleeve, includeSleeve: false });
    const withSleeveData = modelFor("cardigan", SAMPLE, longSleeve);
    const sts = buildSidewaysCardiganPatternDiagramSvg(cardigan);
    const shaping = buildSidewaysCardiganShapingNotationDiagramSvg(cardigan);
    const stsWithSleeveData = buildSidewaysCardiganPatternDiagramSvg(withSleeveData);
    const shapingWithSleeveData = buildSidewaysCardiganShapingNotationDiagramSvg(withSleeveData);
    expect(sts).not.toContain('data-role="sleeve-outline"');
    expect(shaping).not.toContain('data-role="sleeve-outline"');
    expect(stsWithSleeveData).not.toContain('data-role="sleeve-outline"');
    expect(shapingWithSleeveData).not.toContain('data-role="sleeve-outline"');
    expect(bodyOutline(sts)).toBe(bodyOutline(stsWithSleeveData));
    expect(bodyOutline(shaping)).toBe(bodyOutline(shapingWithSleeveData));
    expect(viewBoxOf(sts)).toEqual(viewBoxOf(stsWithSleeveData));
    expect(viewBoxOf(shaping)).toEqual(viewBoxOf(shapingWithSleeveData));
    expect(sts).toContain('data-garment-style="cardigan"');
    expect(shaping).toContain('data-role="center-front-start"');
  });
});

describe("single-diagram print for Sideways body and sleeve", () => {
  it("prints only the clicked diagram for cardigan and pullover, both sleeve directions", () => {
    for (const style of ["cardigan", "pullover"] as const) {
      for (const direction of ["cuff-up", "top-down"] as const) {
        const model = modelFor(style, SAMPLE, { sleeveDirection: direction });
        const sleeve = model.sleeveCalc;
        expect(sleeve).not.toBeNull();
        const sleeveArgs = {
          calc: sleeve!,
          stitchesPerInch: SAMPLE.stitchesPerInch,
          rowsPerInch: SAMPLE.rowsPerInch,
        };
        const diagrams = {
          bodySts: buildSidewaysCardiganPatternDiagramSvg(model),
          bodyShaping: buildSidewaysCardiganShapingNotationDiagramSvg(model),
          sleeveSts: buildSidewaysCardiganSleeveStitchesRowsSvg(sleeveArgs) ?? "",
          sleeveShaping: buildSidewaysCardiganSleeveShapingNotationSvg(sleeveArgs) ?? "",
        };
        for (const svg of Object.values(diagrams)) {
          expect(isPrintablePatternDiagramSvg(diagramElement(svg))).toBe(true);
          const printed = printDocument(svg);
          expect(printed).toContain("print-diagram-root");
          expect(printed).toContain(diagramElement(svg).getAttribute("aria-label") ?? "");
          for (const other of Object.values(diagrams)) {
            if (other === svg) continue;
            const otherLabel = diagramElement(other).getAttribute("aria-label") ?? "";
            expect(printed).not.toContain(otherLabel);
          }
        }
      }
    }
  });

  it("does not treat summary measurement diagrams as printable pattern diagrams", () => {
    const measurements = {
      finishedBustInches: SAMPLE.finishedBustCircumferenceInches,
      finishedLengthInches: SAMPLE.garmentLengthInches,
      neckOpeningWidthInches: SAMPLE.neckOpeningWidthInches,
      vNeckDepthInches: SAMPLE.vNeckDepthInches,
      finishedUpperArmInches: SAMPLE.finishedUpperArmInches,
      sleeveLengthInches: 18,
      wristInches: 8,
    };
    for (const garmentStyle of ["cardigan", "pullover"] as const) {
      expect(
        isPrintablePatternDiagramSvg(
          diagramElement(
            buildSidewaysCardiganEditBodyMeasurementDiagramSvg({ garmentStyle, measurements }),
          ),
        ),
      ).toBe(false);
      expect(
        isPrintablePatternDiagramSvg(
          diagramElement(
            buildSidewaysCardiganEditSleeveMeasurementDiagramSvg({ garmentStyle, measurements }),
          ),
        ),
      ).toBe(false);
    }
  });

  it("parks neck and armhole counts outside the body and drops the duplicate length label", () => {
    const sizes: SidewaysCardiganBodyCalcInput[] = [
      {
        garmentLengthInches: 16,
        vNeckDepthInches: 5,
        finishedBustCircumferenceInches: 32,
        finishedUpperArmInches: 11,
        neckOpeningWidthInches: 5.5,
        backNeckDepthInches: 1,
        stitchesPerInch: 6,
        rowsPerInch: 8,
      },
      SAMPLE,
      {
        garmentLengthInches: 26,
        vNeckDepthInches: 9,
        finishedBustCircumferenceInches: 48,
        finishedUpperArmInches: 16,
        neckOpeningWidthInches: 8,
        backNeckDepthInches: 1.5,
        stitchesPerInch: 7,
        rowsPerInch: 10,
      },
    ];
    const attr = (source: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
    const lineBoxes = (svg: string) => {
      const boxes: Array<{ role: string; text: string; left: number; right: number; top: number; bottom: number; x: number }> = [];
      for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
        const attrs = match[1] ?? "";
        const inner = match[2] ?? "";
        const role = attr(attrs, "data-role");
        const anchor = attr(attrs, "text-anchor") || "start";
        const baseSize = Number(attr(attrs, "font-size")) || 16;
        const baseX = Number(attr(attrs, "x"));
        let y = Number(attr(attrs, "y"));
        const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
        const lines = tspans.length
          ? tspans.map((span) => {
              const spanAttrs = span[1] ?? "";
              y += Number(attr(spanAttrs, "dy")) || 0;
              return {
                text: (span[2] ?? "").replace(/<[^>]+>/g, "").trim(),
                x: Number(attr(spanAttrs, "x")) || baseX,
                y,
                size: Number(attr(spanAttrs, "font-size")) || baseSize,
              };
            })
          : [{ text: inner.replace(/<[^>]+>/g, "").trim(), x: baseX, y, size: baseSize }];
        for (const line of lines) {
          const width = line.text.length * line.size * 0.55;
          const left = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
          boxes.push({
            role,
            text: line.text,
            left,
            right: left + width,
            top: line.y - line.size * 0.85,
            bottom: line.y + line.size * 0.25,
            x: line.x,
          });
        }
      }
      return boxes;
    };

    for (const style of ["cardigan", "pullover"] as const) {
      for (const unit of ["in", "cm"] as const) {
        for (const input of sizes) {
          const model = modelFor(style, input, { includeSleeve: style === "pullover", displayUnit: unit });
          const svg = buildSidewaysCardiganPatternDiagramSvg(model);
          const frame = buildSidewaysCardiganPatternDiagramFrame(model);
          const box = sidewaysPatternDiagramCanvas(frame);
          const edge = sidewaysDiagramEdgeStitchCount(model.calc);
          expect(svg).not.toContain('data-role="length-sts"');
          expect(svg).not.toContain('data-role="dim-finished-back-length"');
          if (style === "cardigan") expect(svg).toContain('data-role="dim-finished-length"');
          else expect(svg).not.toContain('data-role="dim-finished-length"');
          expect(svg).toContain(`CO ${edge} sts`);
          expect(svg).toContain(`BO ${edge} sts`);
          expect(svg).toContain(unit === "cm" ? "cm" : "in");
          expect(svg).not.toContain(unit === "cm" ? "cm)" : "in)");
          expect(svg).toContain('data-role="armhole-sts-leader"');
          expect(svg).toContain('data-role="back-neck-sts-leader"');
          const labels = lineBoxes(svg);
          const armhole = labels.find((label) => label.role === "armhole-sts");
          const backNeck = labels.find((label) => label.role === "back-neck-sts");
          const bindOff = labels.find((label) => label.role === "bind-off-sts");
          const vNeck = labels.find((label) => label.role === "vneck-sts");
          expect(armhole).toBeDefined();
          expect(backNeck).toBeDefined();
          expect(bindOff && vNeck).toBeTruthy();
          const neckDepthLineY = Number(
            /data-role="dim-vneck-depth"[\s\S]*?<line\b[^>]*\sy1="([^"]+)"/.exec(svg)?.[1],
          );
          expect(neckDepthLineY).not.toBeNaN();
          expect(svg).toContain('data-role="vneck-sts-leader"');
          if (style === "cardigan") {
            expect(vNeck!.top).toBeGreaterThan(neckDepthLineY);
            expect(vNeck!.x).toBeGreaterThan(frame.vCutX);
            expect(vNeck!.x).toBeLessThan(frame.neckX);
            expect(armhole!.x).toBeGreaterThan(frame.neckX);
            expect(backNeck!.x).toBeLessThan(frame.neckX);
          } else {
            expect(vNeck!.x).toBeGreaterThan(frame.neckX);
            expect(armhole!.x).toBeGreaterThan(frame.neckX);
            expect(backNeck!.x).toBeLessThan(frame.neckX);
          }
          for (const label of labels) {
            expect(label.top).toBeGreaterThan(box.y);
            expect(label.left).toBeGreaterThanOrEqual(box.x - 1);
            expect(label.right).toBeLessThanOrEqual(box.x + box.width + 1);
          }
          for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
              const a = labels[i]!;
              const b = labels[j]!;
              const hits = a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
              expect(hits, `${style} ${unit} ${a.role} "${a.text}" overlaps ${b.role} "${b.text}"`).toBe(false);
            }
          }
        }
      }
    }
  });
});

describe("Sideways cardigan neck-opening label placement", () => {
  const sizes: SidewaysCardiganBodyCalcInput[] = [
    {
      garmentLengthInches: 16,
      vNeckDepthInches: 6,
      finishedBustCircumferenceInches: 30,
      finishedUpperArmInches: 11,
      neckOpeningWidthInches: 5.5,
      backNeckDepthInches: 1,
      stitchesPerInch: 5,
      rowsPerInch: 4,
    },
    SAMPLE,
    {
      garmentLengthInches: 26,
      vNeckDepthInches: 9,
      finishedBustCircumferenceInches: 48,
      finishedUpperArmInches: 16,
      neckOpeningWidthInches: 8,
      backNeckDepthInches: 1.5,
      stitchesPerInch: 7,
      rowsPerInch: 10,
    },
  ];

  function textBoxes(svg: string) {
    const attr = (source: string, name: string) => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
    const boxes: Array<{
      role: string;
      text: string;
      anchor: string;
      left: number;
      right: number;
      top: number;
      bottom: number;
      x: number;
    }> = [];
    for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const attrs = match[1] ?? "";
      const inner = match[2] ?? "";
      const role = attr(attrs, "data-role");
      const anchor = attr(attrs, "text-anchor") || "start";
      const baseSize = Number(attr(attrs, "font-size")) || 16;
      const baseX = Number(attr(attrs, "x"));
      let y = Number(attr(attrs, "y"));
      const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
      const lines = tspans.length
        ? tspans.map((span) => {
            const spanAttrs = span[1] ?? "";
            y += Number(attr(spanAttrs, "dy")) || 0;
            return {
              text: (span[2] ?? "").replace(/<[^>]+>/g, "").trim(),
              x: Number(attr(spanAttrs, "x")) || baseX,
              y,
              size: Number(attr(spanAttrs, "font-size")) || baseSize,
            };
          })
        : [{ text: inner.replace(/<[^>]+>/g, "").trim(), x: baseX, y, size: baseSize }];
      for (const line of lines) {
        const width = line.text.length * line.size * 0.55;
        const left = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
        boxes.push({
          role,
          text: line.text,
          anchor,
          left,
          right: left + width,
          top: line.y - line.size * 0.85,
          bottom: line.y + line.size * 0.25,
          x: line.x,
        });
      }
    }
    return boxes;
  }

  function viewBox(svg: string) {
    const parts = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number) ?? [];
    return { x: parts[0] ?? 0, y: parts[1] ?? 0, width: parts[2] ?? 0, height: parts[3] ?? 0 };
  }

  function neckLine(svg: string) {
    const group = /data-role="dim-neck-opening"[\s\S]*?<\/g>/.exec(svg)?.[0] ?? "";
    const line = /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(group);
    return {
      x1: Number(line?.[1]),
      y1: Number(line?.[2]),
      x2: Number(line?.[3]),
      y2: Number(line?.[4]),
    };
  }

  function overlaps(
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) {
    return a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
  }

  it("parks the cardigan neck-opening count to the right of the unchanged dimension line", () => {
    for (const input of sizes) {
      const model = modelFor("cardigan", input, { includeSleeve: false });
      const svg = buildSidewaysCardiganPatternDiagramSvg(model);
      const frame = buildSidewaysCardiganPatternDiagramFrame(model);
      const line = neckLine(svg);
      const neckY1 = sidewaysKnitVisualY(frame, frame.backNeckStartY);
      const neckY2 = sidewaysKnitVisualY(frame, frame.backNeckEndY);
      const boxes = textBoxes(svg);
      const neck = boxes.filter((box) => box.role === "neck-opening-rows");
      const back = boxes.filter((box) => box.role === "back-rows");
      const shoulder = boxes.filter((box) => box.role === "shoulder-rows");
      const box = viewBox(svg);
      expect(line.x1).toBeCloseTo(cardiganDimLayout(frame).neckDimX, 1);
      expect(line.x2).toBeCloseTo(line.x1, 1);
      expect(Math.min(line.y1, line.y2)).toBeCloseTo(Math.min(neckY1, neckY2), 1);
      expect(Math.max(line.y1, line.y2)).toBeCloseTo(Math.max(neckY1, neckY2), 1);
      expect(neck.map((label) => label.text)).toEqual([
        `${model.calc.backNeckOpeningRows} rows`,
        expect.stringMatching(/\d/),
      ]);
      expect(neck[0]?.text.endsWith("rows")).toBe(true);
      expect(neck[1]?.text).toMatch(/ (?:in|cm)$/);
      expect(neck[1]!.top).toBeGreaterThan(neck[0]!.top);
      for (const label of neck) {
        expect(label.anchor).toBe("start");
        expect(label.left).toBeGreaterThan(line.x1 + 4);
        expect(label.top).toBeGreaterThan(box.y);
        expect(label.bottom).toBeLessThan(box.y + box.height);
        expect(label.left).toBeGreaterThanOrEqual(box.x);
        expect(label.right).toBeLessThanOrEqual(box.x + box.width);
        for (const other of [...back, ...shoulder]) {
          expect(overlaps(label, other), `"${label.text}" overlaps "${other.text}"`).toBe(false);
        }
      }
    }
    const example = modelFor("cardigan", sizes[0], { includeSleeve: false });
    const exampleSvg = buildSidewaysCardiganPatternDiagramSvg(example);
    const exampleLines = textBoxes(exampleSvg).filter((box) => box.role === "neck-opening-rows");
    expect(exampleLines.map((label) => label.text)).toEqual([
      `${example.calc.backNeckOpeningRows} rows`,
      "5.5 in",
    ]);
    const pullover = buildSidewaysCardiganPatternDiagramSvg(modelFor("pullover", SAMPLE));
    const pulloverNeck = textBoxes(pullover).find((box) => box.role === "neck-opening-rows");
    const pulloverLine = neckLine(pullover);
    expect(pulloverNeck).toBeDefined();
    expect(pulloverNeck!.left).toBeGreaterThan(pulloverLine.x1);
  });
});

describe("Pullover Stitches & Rows annotations", () => {
  function dimSpan(svg: string, role: string) {
    const group = new RegExp(`data-role="${role}"[\\s\\S]*?</g>`).exec(svg)?.[0] ?? "";
    const line = /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(group);
    return {
      x1: Number(line?.[1]),
      y1: Number(line?.[2]),
      x2: Number(line?.[3]),
      y2: Number(line?.[4]),
    };
  }

  it("drops the half neck and places one full neck opening on the back neck", () => {
    const model = modelFor("pullover", SAMPLE);
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    const frame = buildSidewaysCardiganPatternDiagramFrame(model);
    const cardigan = buildSidewaysCardiganPatternDiagramSvg(modelFor("cardigan", SAMPLE, { includeSleeve: false }));
    const neck = dimSpan(svg, "dim-neck-opening");
    const neckTop = sidewaysKnitVisualY(frame, frame.backNeckEndY);
    const neckBot = sidewaysKnitVisualY(frame, frame.backNeckStartY);
    expect(svg).not.toContain('data-role="half-neck-rows"');
    expect(svg).not.toContain('data-role="dim-half-neck-opening"');
    expect(svg).not.toContain(">½ neck<");
    expect(svg).toContain('data-half-neck-rows="');
    expect((svg.match(/data-role="dim-neck-opening"/g) ?? []).length).toBe(1);
    expect(neck.x1).toBeCloseTo(cardiganDimLayout(frame).neckDimX, 1);
    expect(Math.min(neck.y1, neck.y2)).toBeCloseTo(Math.min(neckTop, neckBot), 1);
    expect(Math.max(neck.y1, neck.y2)).toBeCloseTo(Math.max(neckTop, neckBot), 1);
    expect(svg).toContain(`${model.calc.backNeckOpeningRows} rows`);
    expect(svg).toContain("7 in");
    expect(svg).not.toContain(`${model.calc.halfNeckRows} rows`);
    expect((svg.match(/data-role="front-rows"/g) ?? []).length).toBe(1);
    expect(svg).toContain(`${model.calc.frontRows * 2} rows`);
    expect(svg).toContain('data-role="dim-finished-bust"');
    expect(svg).toContain('data-role="dim-vneck-depth"');
    expect(svg).toContain('data-role="dim-armhole-depth"');
    expect(svg).toContain('data-role="dim-shoulder-section"');
    expect(svg).toContain('data-role="dim-back-section"');
    expect(svg).toContain('data-role="back-neck-sts"');
    expect(svg).toContain("Start at underarm");
    expect(svg).toContain(">scrap on / graft<");
    expect(cardigan).toContain('data-role="half-neck-rows"');
    expect(cardigan).toContain('data-role="dim-half-neck-opening"');
    expect(cardigan).toContain(">½ neck<");
    expect((cardigan.match(/data-role="front-rows"/g) ?? []).length).toBe(2);
    expect(cardigan).toContain(`${modelFor("cardigan", SAMPLE).calc.frontRows} rows`);
  });
});
