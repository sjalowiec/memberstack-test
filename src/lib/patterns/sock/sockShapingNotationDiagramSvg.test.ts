import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatBodyRowsNotation,
  formatCastOnNotation,
  formatRcNotation,
} from "../sleevelessBackJapaneseNotation";
import { formatShapingSegment } from "../shapingNotationCompress";
import { calculateBasicSockPattern, type BasicSockCalc, type BasicSockCalcInput } from "./sockMath";
import { SOCK_CANONICAL_POLYGON_POINTS, SOCK_CANONICAL_SVG_HREF, SOCK_CANONICAL_VIEWBOX } from "./sockCanonicalDiagram";
import {
  buildSockShapingNotationDiagramSvg,
  buildSockShapingNotationLines,
} from "./sockShapingNotationDiagramSvg";

function mustCalc(overrides: Partial<BasicSockCalcInput> = {}): BasicSockCalc {
  const result = calculateBasicSockPattern({
    footCircumferenceInches: 8.5,
    footLengthInches: 9,
    legCircumferenceInches: 8.5,
    legLengthInches: 4.5,
    stitchGaugeDisplay: 28,
    rowGaugeDisplay: 40,
    displayUnit: "inches",
    constructionDirection: "cuff-to-toe",
    ...overrides,
  });
  expect(result.ok, result.ok ? "" : result.errors.join("; ")).toBe(true);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return result.calc;
}

function attr(svg: string, name: string): string {
  const match = svg.match(new RegExp(`${name}="([^"]*)"`));
  expect(match, name).toBeTruthy();
  return match![1]!;
}

function geometryGroup(svg: string): string {
  const start = svg.indexOf("<g data-sock-canonical-geometry");
  const labels = svg.indexOf("<g data-sock-diagram-labels");
  expect(start).toBeGreaterThan(-1);
  const end = labels > start ? labels : svg.length;
  return svg.slice(start, end).trim();
}

function labelsGroup(svg: string): string {
  const match = svg.match(/<g data-sock-diagram-labels[\s\S]*?<\/g>/);
  expect(match).toBeTruthy();
  return match![0]!;
}

function labelXY(svg: string, id: string): { x: string; y: string } {
  const match = svg.match(new RegExp(`data-sock-label="${id}" x="([^"]+)" y="([^"]+)"`));
  expect(match, id).toBeTruthy();
  return { x: match![1]!, y: match![2]! };
}

function textCount(svg: string, text: string): number {
  return svg.split(`>${text}<`).length - 1;
}

function remainingStitchLabel(stitches: number): string {
  return stitches === 1 ? "1 st" : `${stitches} sts`;
}

function expectedShortRow(calc: BasicSockCalc, part: "heel" | "toe"): string {
  const shaping = calc[part];
  const startRc =
    part === "toe"
      ? calc.constructionDirection === "cuff-to-toe"
        ? calc.straightFootRows
        : 0
      : calc.constructionDirection === "cuff-to-toe"
        ? calc.legRows
        : calc.straightFootRows;
  return [
    formatRcNotation(startRc),
    `+${formatShapingSegment(1, 1, shaping.shortRowOutSteps)}`,
    remainingStitchLabel(shaping.remainingStitches),
    `-${formatShapingSegment(1, 1, shaping.shortRowInSteps)}`,
  ].join("|");
}

describe("Socks Shaping Notation from approved calc", () => {
  it("represents a straight leg with existing Nr / hold / Ns-Mr-Kx tokens on the canonical SVG", () => {
    const calc = mustCalc();
    const lines = buildSockShapingNotationLines(calc);
    expect(calc.legShapingSchedule.knitOrder.direction).toBe("none");
    expect(lines.castOn).toBe(formatCastOnNotation(calc.legStitches));
    expect(lines.leg).toEqual([formatBodyRowsNotation(calc.legShapingRowsAvailable)]);
    expect(lines.ankle).toBe(formatBodyRowsNotation(calc.ankleStraightRows));
    expect(lines.foot).toBe(formatBodyRowsNotation(calc.straightFootRows));
    expect(lines.heel).toEqual(expectedShortRow(calc, "heel").split("|"));
    expect(lines.toe).toEqual(expectedShortRow(calc, "toe").split("|"));
    const svg = buildSockShapingNotationDiagramSvg(calc);
    expect(attr(svg, "data-sock-layout")).toBe("canonical");
    expect(attr(svg, "data-sock-geometry-src")).toBe(SOCK_CANONICAL_SVG_HREF);
    expect(svg).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(attr(svg, "data-sock-notation-leg-direction")).toBe("none");
    expect(attr(svg, "data-sock-notation-leg")).toBe(lines.leg.join("|"));
    expect(attr(svg, "data-sock-notation-heel")).toBe(expectedShortRow(calc, "heel"));
    expect(attr(svg, "data-sock-notation-toe")).toBe(expectedShortRow(calc, "toe"));
    expect(svg).toContain(`+${formatShapingSegment(1, 1, calc.heel.shortRowOutSteps)}`);
    expect(svg).toContain(`-${formatShapingSegment(1, 1, calc.heel.shortRowInSteps)}`);
    expect(svg).toContain(remainingStitchLabel(calc.heel.remainingStitches));
    expect(svg).toContain(formatRcNotation(calc.legRows));
    expect(svg).toContain(formatRcNotation(calc.straightFootRows));
    expect(svg).not.toMatch(/hold\d/);
    expect(svg).not.toContain("hold ");
    expect(svg).not.toContain('data-sock-shape="heel-hourglass"');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
  });

  it("uses Magic Formula increase steps from the approved knit-order schedule", () => {
    const calc = mustCalc({ legCircumferenceInches: 7 });
    expect(calc.legShapingSchedule.knitOrder.direction).toBe("increase");
    const lines = buildSockShapingNotationLines(calc);
    const expected = calc.legShapingSchedule.steps.map((step) =>
      formatShapingSegment(step.sts, step.rows, step.times),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(lines.leg).toEqual(expected);
    const svg = buildSockShapingNotationDiagramSvg(calc);
    expect(attr(svg, "data-sock-notation-leg-direction")).toBe("increase");
    expect(attr(svg, "data-sock-notation-leg")).toBe(expected.join("|"));
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
  });

  it("uses Magic Formula decrease steps from the approved knit-order schedule", () => {
    const calc = mustCalc({ legCircumferenceInches: 10 });
    expect(calc.legShapingSchedule.knitOrder.direction).toBe("decrease");
    const lines = buildSockShapingNotationLines(calc);
    const expected = calc.legShapingSchedule.steps.map((step) =>
      formatShapingSegment(step.sts, step.rows, step.times),
    );
    expect(expected.length).toBeGreaterThan(0);
    expect(lines.leg).toEqual(expected);
    const svg = buildSockShapingNotationDiagramSvg(calc);
    expect(attr(svg, "data-sock-notation-leg-direction")).toBe("decrease");
    expect(attr(svg, "data-sock-notation-leg")).toBe(expected.join("|"));
  });

  it("places cast-on at the knitting start and finish at the knitting end", () => {
    const cuff = mustCalc({ constructionDirection: "cuff-to-toe" });
    const toeUp = mustCalc({ constructionDirection: "toe-up" });
    const cuffLines = buildSockShapingNotationLines(cuff);
    const toeUpLines = buildSockShapingNotationLines(toeUp);
    expect(cuffLines.castOn).toBe(formatCastOnNotation(cuff.legStitches));
    expect(toeUpLines.castOn).toBe(formatCastOnNotation(toeUp.totalSockStitches));
    expect(cuffLines.order).toBe("cuff-to-toe");
    expect(toeUpLines.order).toBe("toe-up");
    const cuffSvg = buildSockShapingNotationDiagramSvg(cuff);
    const toeUpSvg = buildSockShapingNotationDiagramSvg(toeUp);
    expect(attr(cuffSvg, "data-sock-notation-order")).toBe("cuff-to-toe");
    expect(attr(toeUpSvg, "data-sock-notation-order")).toBe("toe-up");
    expect(attr(cuffSvg, "data-sock-geometry-key")).toBe(attr(toeUpSvg, "data-sock-geometry-key"));
    expect(geometryGroup(cuffSvg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(toeUpSvg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(cuffSvg)).toContain("scale(1,-1)");
    expect(geometryGroup(toeUpSvg)).not.toContain("scale(");
    expect(cuffSvg).toContain("Cuff to Toe");
    expect(toeUpSvg).toContain("Toe Up");
    expect(labelsGroup(cuffSvg)).toContain(`data-sock-label="castOnCuff"`);
    expect(labelsGroup(toeUpSvg)).toContain(`data-sock-label="castOnToe"`);
    expect(Number(labelXY(cuffSvg, "castOnCuff").y)).toBeGreaterThan(Number(labelXY(cuffSvg, "sectionLeg").y));
    expect(Number(labelXY(toeUpSvg, "castOnToe").y)).toBeGreaterThan(Number(labelXY(toeUpSvg, "sectionToe").y));
    expect(Number(labelXY(cuffSvg, "finish").y)).toBeLessThan(Number(labelXY(cuffSvg, "sectionToe").y));
    expect(Number(labelXY(toeUpSvg, "finish").y)).toBeLessThan(Number(labelXY(toeUpSvg, "sectionLeg").y));
  });

  it("mirrors Sock 2 orientation without new notation tokens or reversed text", () => {
    const calc = mustCalc();
    const sock1 = buildSockShapingNotationDiagramSvg(calc);
    const sock2 = buildSockShapingNotationDiagramSvg(calc, { mirror: true });
    expect(attr(sock1, "data-sock-notation-leg")).toBe(attr(sock2, "data-sock-notation-leg"));
    expect(attr(sock1, "data-sock-notation-heel")).toBe(attr(sock2, "data-sock-notation-heel"));
    expect(attr(sock1, "data-sock-work-half")).toBe("right");
    expect(attr(sock2, "data-sock-work-half")).toBe("left");
    expect(geometryGroup(sock2)).toContain("scale(-1,-1)");
    expect(labelsGroup(sock2)).not.toContain("scale(-1");
    expect(textCount(labelsGroup(sock1), "Heel")).toBe(1);
    expect(textCount(labelsGroup(sock1), "Toe")).toBe(1);
    expect(sock1).not.toMatch(/holdL|SR|wrap-in/);
    expect(sock2).not.toMatch(/holdL|SR|wrap-in/);
    expect(sock1).not.toMatch(/hold\d/);
    expect(sock2).not.toMatch(/hold\d/);
  });

  it("shows signed decrease / remaining / increase once per heel and toe, with a start RC", () => {
    const woman = mustCalc();
    const infant = mustCalc({
      footCircumferenceInches: 4,
      footLengthInches: 3.5,
      legCircumferenceInches: 4,
      legLengthInches: 2.5,
    });
    expect(woman.heel.shortRowInSteps).not.toBe(infant.heel.shortRowInSteps);
    expect(woman.heel.remainingStitches).not.toBe(infant.heel.remainingStitches);
    for (const calc of [woman, infant]) {
      const lines = buildSockShapingNotationLines(calc);
      const svg = buildSockShapingNotationDiagramSvg(calc);
      for (const part of ["heel", "toe"] as const) {
        const expected = expectedShortRow(calc, part).split("|");
        expect(lines[part]).toEqual(expected);
        expect(expected).toHaveLength(4);
        expect(expected[1]).toBe(`+${formatShapingSegment(1, 1, calc[part].shortRowOutSteps)}`);
        expect(expected[2]).toBe(remainingStitchLabel(calc[part].remainingStitches));
        expect(expected[3]).toBe(`-${formatShapingSegment(1, 1, calc[part].shortRowInSteps)}`);
        expect(svg).toContain(expected[0]!);
        expect(svg).toContain(expected[1]!);
        expect(svg).toContain(expected[2]!);
        expect(svg).toContain(expected[3]!);
      }
      expect(lines.heel.slice(1)).toEqual(lines.toe.slice(1));
      expect(svg).not.toMatch(/hold\d/);
      expect(attr(svg, "data-sock-notation-heel")).not.toContain("hold");
      expect(attr(svg, "data-sock-notation-toe")).not.toContain("hold");
    }
    const womanSvg = buildSockShapingNotationDiagramSvg(woman);
    const infantSvg = buildSockShapingNotationDiagramSvg(infant);
    expect(attr(womanSvg, "data-sock-notation-heel")).not.toBe(
      attr(infantSvg, "data-sock-notation-heel"),
    );
  });

  it("keeps section Nr tokens and heel/toe shaping stacks, with a shared bottom-to-top arrow", () => {
    const calc = mustCalc();
    const svg = buildSockShapingNotationDiagramSvg(calc);
    expect(svg).toContain(formatBodyRowsNotation(calc.legShapingRowsAvailable));
    expect(svg).toContain(formatBodyRowsNotation(calc.ankleStraightRows));
    expect(svg).toContain(formatBodyRowsNotation(calc.straightFootRows));
    expect(svg).toContain(`${calc.heel.shortRowInSteps}r`);
    expect(svg).toContain(`+${formatShapingSegment(1, 1, calc.heel.shortRowOutSteps)}`);
    expect(svg).toContain(`-${formatShapingSegment(1, 1, calc.heel.shortRowInSteps)}`);
    expect(svg).toContain(remainingStitchLabel(calc.heel.remainingStitches));
    expect(svg).toContain('data-sock-reading-direction="bottom-to-top"');
    expect(svg).not.toContain("Direction of Knitting");
  });
});

describe("notation does not recreate Socks geometry", () => {
  it("does not import Magic Formula or short-row calculators", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "sockShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/magicFormulaIntervals/);
    expect(src).not.toMatch(/remainingStitchesAtOneThird/);
    expect(src).not.toMatch(/roundToEvenPreferUp/);
    expect(src).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(src).not.toMatch(/calculateShortRowShaping/);
    expect(src).not.toMatch(/calculateBasicSockPattern/);
    expect(src).toContain("formatCastOnNotation");
    expect(src).toContain("formatBodyRowsNotation");
    expect(src).toContain("formatRcNotation");
    expect(src).not.toContain("formatHoldNotation");
    expect(src).toContain("formatShapingSegment");
    expect(src).toContain("formatBindOffNotation");
    expect(src).toContain("sockCanonicalGeometryMarkup");
    expect(src).toContain("sockCanonicalReadingDirectionArrowMarkup");
    expect(src).not.toContain("sockDiagramSchematicMarkup");
    expect(src).not.toContain("buildSockDiagramLayout");
    expect(src).toContain('data-sock-layout="canonical"');
  });
});
