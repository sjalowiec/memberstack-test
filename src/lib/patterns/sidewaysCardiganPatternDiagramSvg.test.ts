import { describe, expect, it } from "vitest";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import { formatDropShoulderSleeveShapingNotation } from "./dropShoulderSleeveShaping";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysVNeckSlopeSequence } from "./sidewaysCardiganBodyInstructions";
import {
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
} from "./sidewaysCardiganPatternDiagramSvg";
import {
  buildSidewaysCardiganShapingNotationDiagramSvg,
  sidewaysCardiganVNeckNotationLines,
} from "./sidewaysCardiganShapingNotationDiagramSvg";
import { calculateSidewaysCardiganSleeve } from "./sidewaysCardiganSleeveCalc";
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
  });
}

describe("Sideways Stitches & Rows diagram", () => {
  it("feeds calculated Sideways stitch and row values into the diagram", () => {
    const model = modelFor("cardigan", SAMPLE, { includeSleeve: false });
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    expect(svg).toContain('data-sideways-pattern-diagram="sts-rows"');
    expect(svg).toContain(`data-cast-on-sts="${model.castOnStitches}"`);
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
    expect(svg).toContain(`CO ${model.castOnStitches} sts`);
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

  it("renders Pullover construction starting at the underarm with a sleeve outline", () => {
    const model = modelFor("pullover", SAMPLE, { sleeveLengthInches: 18, wristInches: 8 });
    const svg = buildSidewaysCardiganPatternDiagramSvg(model);
    expect(svg).toContain('data-garment-style="pullover"');
    expect(svg).toContain('data-sideways-start="underarm"');
    expect(svg).toContain('data-cardigan-structure="underarm-graft"');
    expect(svg).toContain('data-role="sleeve-outline"');
    expect(svg).toContain('data-role="underarm-start"');
    expect(svg).toContain("Start at underarm");
    if (model.sleeveCalc) {
      expect(svg).toContain(`data-wrist-sts="${model.sleeveCalc.wristSts}"`);
      expect(svg).toContain(`data-top-sts="${model.sleeveCalc.topSts}"`);
      expect(svg).toContain(`${model.sleeveCalc.wristSts} sts`);
    }
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
      expect(cuffSvg).toContain(`${cuffUp.sleeveCalc.cuffRows} rows`);
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

function roleChunk(svg: string, role: string): string {
  const start = svg.indexOf(`data-role="${role}"`);
  if (start < 0) return "";
  const end = svg.indexOf("</text>", start);
  return svg.slice(start, end);
}

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
    expect(svg).toContain(formatCastOnNotation(model.castOnStitches));
    expect(svg).toContain(formatHoldNotation(model.calc.vNeckDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.armholeDepthStitches));
    expect(svg).toContain(formatCastOnNotation(model.calc.armholeDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.backNeckDepthStitches));
    expect(svg).toContain(formatCastOnNotation(model.calc.backNeckDepthStitches));
    expect(svg).toContain(formatBindOffNotation(model.calc.garmentLengthStitches));
    expect(svg).toContain(`data-vneck-sts="${model.calc.vNeckDepthStitches}"`);
    const first = roleChunk(svg, "jp-vneck-first");
    const second = roleChunk(svg, "jp-vneck-second");
    expect(first.indexOf(lines.increase[0]!)).toBeGreaterThanOrEqual(0);
    expect(first.indexOf(lines.increase[0]!)).toBeLessThan(first.indexOf(lines.increase[1]!));
    expect(second.indexOf(lines.decrease[0]!)).toBeGreaterThanOrEqual(0);
    expect(second.indexOf(lines.decrease[0]!)).toBeLessThan(second.indexOf(lines.decrease[1]!));
    expect(svg.match(/data-role="jp-armhole-slit"/g)).toHaveLength(2);
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
    expect(lines.increase).toEqual(["+5s-2r-1x", "+1s-2r-1x"]);
    expect(lines.decrease).toEqual(["-1s-2r-1x", "-5s-2r-1x"]);
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const first = roleChunk(svg, "jp-vneck-first");
    expect(first.indexOf("+5s-2r-1x")).toBeLessThan(first.indexOf("+1s-2r-1x"));
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
    expect(baseSvg).toContain(formatCastOnNotation(base.castOnStitches));
    expect(deeperSvg).toContain(formatCastOnNotation(deeper.castOnStitches));
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
    expect(pulloverSvg).toContain('data-role="sleeve-outline"');
    expect(cardiganSvg).not.toContain('data-role="sleeve-outline"');
    expect(pulloverSvg.match(/data-role="jp-armhole-slit"/g)).toHaveLength(1);
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
