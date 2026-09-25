import { describe, expect, it } from "vitest";
import { calculateSlopeShaping } from "./legoBlocks/slopeShaping";
import { formatDropShoulderSleeveShapingNotation } from "./dropShoulderSleeveShaping";
import { rowBasedShapingNotation } from "./shapingNotationCompress";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysVNeckSlopeSequence } from "./sidewaysCardiganBodyInstructions";
import {
  buildSidewaysCardiganPatternDiagramFrame,
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
  sidewaysDiagramEdgeStitchCount,
  sidewaysPatternDiagramCanvas,
} from "./sidewaysCardiganPatternDiagramSvg";
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
    expect(pulloverSvg).toContain('data-role="sleeve-outline"');
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
          if (style === "cardigan") {
            expect(armhole!.x).toBeGreaterThan(frame.neckX);
            expect(backNeck!.x).toBeGreaterThan(frame.neckX);
            expect(svg).toContain('data-role="vneck-sts-leader"');
            expect(vNeck!.right).toBeLessThanOrEqual(frame.vCutX + 4);
          } else {
            expect(armhole!.right).toBeLessThan(frame.hemX);
            expect(backNeck!.x).toBeGreaterThan(frame.neckX);
            expect(vNeck!.right).toBeLessThan(frame.hemX);
          }
          for (const label of labels) {
            expect(label.top).toBeGreaterThan(box.y);
            expect(label.left).toBeGreaterThanOrEqual(box.x - 1);
            expect(label.right).toBeLessThanOrEqual(box.x + box.width + 1);
          }
          const callouts = new Set(["armhole-sts", "back-neck-sts", "vneck-sts", "cast-on-sts", "bind-off-sts"]);
          for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) {
              const a = labels[i]!;
              const b = labels[j]!;
              if (style === "pullover" && !callouts.has(a.role) && !callouts.has(b.role)) continue;
              const hits = a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;
              expect(hits, `${style} ${unit} ${a.role} "${a.text}" overlaps ${b.role} "${b.text}"`).toBe(false);
            }
          }
        }
      }
    }
  });
});
