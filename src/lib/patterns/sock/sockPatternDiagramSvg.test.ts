import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculateBasicSockPattern, type BasicSockCalc, type BasicSockCalcInput } from "./sockMath";
import {
  SOCK_CANONICAL_ANCHORS,
  SOCK_CANONICAL_POLYGON_POINTS,
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VIEWBOX,
  SOCK_STS_ROWS_PAD_RIGHT,
  escapeSockSvgText,
  sockCanonicalCalcLabelFields,
  sockCanonicalViewBox,
} from "./sockCanonicalDiagram";
import { buildSockPatternDiagramSvg } from "./sockPatternDiagramSvg";
import { buildSockShapingNotationDiagramSvg } from "./sockShapingNotationDiagramSvg";

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

function viewBoxRight(svg: string): number {
  const parts = attr(svg, "viewBox").trim().split(/\s+/).map(Number);
  expect(parts).toHaveLength(4);
  return parts[0]! + parts[2]!;
}

function geometryGroup(svg: string): string {
  const start = svg.indexOf("<g data-sock-canonical-geometry");
  const dims = svg.indexOf("<g data-sock-diagram-dims");
  const labels = svg.indexOf("<g data-sock-diagram-labels");
  expect(start).toBeGreaterThan(-1);
  const overlayStarts = [dims, labels].filter((index) => index > start);
  const end = overlayStarts.length ? Math.min(...overlayStarts) : svg.length;
  return svg.slice(start, end).trim();
}

function labelsGroup(svg: string): string {
  const match = svg.match(/<g data-sock-diagram-labels[\s\S]*?<\/g>/);
  expect(match).toBeTruthy();
  return match![0]!;
}

describe("Stitches & Rows diagram", () => {
  it("uses the canonical SVG and overlays approved calc stitch/row values", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    expect(attr(svg, "data-sock-diagram-mode")).toBe("pattern");
    expect(attr(svg, "data-sock-layout")).toBe("canonical");
    expect(attr(svg, "data-sock-geometry-src")).toBe(SOCK_CANONICAL_SVG_HREF);
    expect(svg).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(svg).toContain('id="sock-canonical-outline"');
    expect(attr(svg, "data-sock-cuff-sts")).toBe(String(calc.legStitches));
    expect(attr(svg, "data-sock-tube-sts")).toBe(String(calc.totalSockStitches));
    expect(attr(svg, "data-sock-leg-rows")).toBe(String(calc.legShapingRowsAvailable));
    expect(attr(svg, "data-sock-ankle-rows")).toBe(String(calc.ankleStraightRows));
    expect(attr(svg, "data-sock-foot-rows")).toBe(String(calc.straightFootRows));
    expect(attr(svg, "data-sock-heel-work")).toBe(String(calc.heel.workingStitches));
    expect(attr(svg, "data-sock-heel-hold")).toBe(String(calc.heel.heldStitches));
    expect(attr(svg, "data-sock-heel-center")).toBe(String(calc.heel.remainingStitches));
    expect(attr(svg, "data-sock-heel-short-row")).toBe(String(calc.heel.shortRowKnittingRows));
    expect(attr(svg, "data-sock-toe-work")).toBe(String(calc.toe.workingStitches));
    expect(attr(svg, "data-sock-toe-hold")).toBe(String(calc.toe.heldStitches));
    expect(attr(svg, "data-sock-toe-center")).toBe(String(calc.toe.remainingStitches));
    expect(attr(svg, "data-sock-toe-short-row")).toBe(String(calc.toe.shortRowKnittingRows));
    expect(svg).toContain(`${calc.legStitches} sts`);
    expect(svg).toContain("Leg");
    expect(svg).toContain(rowPhrase(calc.legShapingRowsAvailable));
    expect(svg).toContain("Ankle");
    expect(svg).toContain(rowPhrase(calc.ankleStraightRows));
    expect(svg).toContain("Sole and Instep");
    expect(svg).toContain(rowPhrase(calc.straightFootRows));
    expect(svg).toContain(fields.heelWorkLabel);
    expect(svg).toContain(fields.heelCenterLabel);
    expect(labelsGroup(svg)).not.toContain(" work");
    expect(labelsGroup(svg)).not.toContain(" held");
    expect(labelsGroup(svg)).not.toContain("short-row");
    expect(svg).not.toContain('data-sock-shape="heel-hourglass"');
    expect(svg).not.toContain("sockDiagramSchematicMarkup");
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
    expect(svg).toContain("viewBox=");
  });

  it("does not duplicate the tube stitch label when the leg is straight", () => {
    const calc = mustCalc();
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    expect(calc.legStitches).toBe(calc.totalSockStitches);
    expect(svg.split(`${calc.legStitches} sts`).length - 1).toBe(1);
  });

  it("shows both cuff and tube stitch counts when the top leg is shaped", () => {
    const calc = mustCalc({ legCircumferenceInches: 10 });
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    expect(calc.legStitches).not.toBe(calc.totalSockStitches);
    expect(svg).toContain(`${calc.legStitches} sts`);
    expect(svg).toContain(`${calc.totalSockStitches} sts`);
    expect(geometryGroup(svg)).not.toContain(" sts");
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
  });
});

describe("Pattern schematic is the canonical SVG, not the Summary image", () => {
  it("keeps instruction-map geometry on the Pattern page only", () => {
    const calc = mustCalc({ legCircumferenceInches: 10 });
    const pattern = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    expect(attr(pattern, "data-sock-layout")).toBe("canonical");
    expect(pattern).toContain(`${calc.legStitches} sts`);
    expect(pattern).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(pattern).not.toContain("socks-pattern-summary.webp");
    expect(pattern).not.toContain("socks-pattern-summary-transparent.webp");
  });

  it("Sock 2 mirrors the same SVG without reversing text", () => {
    const calc = mustCalc();
    const sock1 = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const sock2 = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror: true });
    expect(attr(sock1, "data-sock-geometry-key")).toBe(attr(sock2, "data-sock-geometry-key"));
    expect(attr(sock1, "data-sock-geometry-src")).toBe(attr(sock2, "data-sock-geometry-src"));
    expect(geometryGroup(sock1)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(sock2)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(sock1)).not.toContain("scale(-1");
    expect(geometryGroup(sock2)).toContain("scale(-1,-1)");
    expect(geometryGroup(sock2)).toContain("data-sock-flip-vertical=\"true\"");
    expect(attr(sock1, "data-sock-work-half")).toBe("right");
    expect(attr(sock2, "data-sock-work-half")).toBe("left");
    expect(attr(sock1, "data-sock-of-pair")).toBe("1");
    expect(attr(sock2, "data-sock-of-pair")).toBe("2");
    expect(labelsGroup(sock2)).toContain('data-sock-text-unmirrored="true"');
    expect(labelsGroup(sock2)).not.toContain("scale(-1");
    expect(labelsGroup(sock2)).toContain("Leg");
    expect(labelsGroup(sock2)).toContain(`${calc.legStitches} sts`);
    expect(labelsGroup(sock2)).not.toContain("geL");
  });

  it("orients Cuff-to-Toe and Toe-Up from the same polygon", () => {
    const cuff = buildSockPatternDiagramSvg(mustCalc({ constructionDirection: "cuff-to-toe" }), {
      mode: "pattern",
    });
    const toeUp = buildSockPatternDiagramSvg(mustCalc({ constructionDirection: "toe-up" }), {
      mode: "pattern",
    });
    expect(geometryGroup(cuff)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(toeUp)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(attr(cuff, "data-sock-geometry-key")).toBe(attr(toeUp, "data-sock-geometry-key"));
    expect(attr(cuff, "data-sock-knit-order")).toBe("cuff-to-toe");
    expect(attr(toeUp, "data-sock-knit-order")).toBe("toe-up");
    expect(attr(cuff, "data-sock-flip-vertical")).toBe("true");
    expect(attr(toeUp, "data-sock-flip-vertical")).toBe("false");
    expect(geometryGroup(cuff)).toContain("scale(1,-1)");
    expect(geometryGroup(toeUp)).not.toContain("scale(");
  });
});

describe("overlay placement has no duplicate heel/toe blocks", () => {
  it("shows Heel and Toe once, inside the shaping area, with calc stitch values once each", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const labels = labelsGroup(svg);
    expect(labelCount(svg, "sectionHeel")).toBe(1);
    expect(labelCount(svg, "sectionToe")).toBe(1);
    expect(textCount(labels, "Heel")).toBe(1);
    expect(textCount(labels, "Toe")).toBe(1);
    expect(labelCount(svg, "heel-work")).toBe(1);
    expect(labelCount(svg, "heel-center")).toBe(1);
    expect(labelCount(svg, "toe-work")).toBe(1);
    expect(labelCount(svg, "toe-center")).toBe(1);
    expect(labels).toContain(fields.cuffStsLabel);
    expect(labels).toContain(fields.heelWorkLabel);
    expect(labels).toContain(fields.heelCenterLabel);
    expect(labels).toContain(fields.toeWorkLabel);
    expect(labels).toContain(fields.toeCenterLabel);
    expect(labels).not.toContain("work ·");
    expect(labels).not.toContain(" held");
    expect(labels).not.toContain("short-row");
    expect(Number(labelXY(svg, "sectionHeel").x)).toBe(SOCK_CANONICAL_ANCHORS.sectionHeel.x);
    expect(Number(labelXY(svg, "sectionToe").x)).toBe(SOCK_CANONICAL_ANCHORS.sectionToe.x);
    expect(Number(labelXY(svg, "sectionHeel").x)).toBeGreaterThan(144);
    expect(Number(labelXY(svg, "heel-work").x)).toBe(SOCK_CANONICAL_ANCHORS.heelWork.x);
    expect(Number(labelXY(svg, "heel-center").y)).toBeGreaterThan(Number(labelXY(svg, "heel-work").y));
    expect(Number(labelXY(svg, "toe-center").y)).toBeGreaterThan(Number(labelXY(svg, "toe-work").y));
  });

  it("shows heldStitches once in the Heel and Toe held halves", () => {
    const calc = mustCalc();
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const heldLabel =
      calc.heel.heldStitches === 1 ? "1 st" : `${calc.heel.heldStitches} sts`;
    expect(attr(svg, "data-sock-heel-hold")).toBe(String(calc.heel.heldStitches));
    expect(attr(svg, "data-sock-toe-hold")).toBe(String(calc.toe.heldStitches));
    expect(labelCount(svg, "heel-held")).toBe(1);
    expect(labelCount(svg, "toe-held")).toBe(1);
    expect(labelCount(svg, "heel-work")).toBe(1);
    expect(labelCount(svg, "heel-center")).toBe(1);
    expect(labelCount(svg, "toe-work")).toBe(1);
    expect(labelCount(svg, "toe-center")).toBe(1);
    expect(labelsGroup(svg)).toContain(heldLabel);
    expect(Number(labelXY(svg, "heel-held").x)).toBeLessThan(144);
    expect(Number(labelXY(svg, "toe-held").x)).toBeLessThan(144);
    expect(Number(labelXY(svg, "heel-work").x)).toBeGreaterThan(144);
    expect(Number(labelXY(svg, "heel-center").y)).toBeGreaterThan(Number(labelXY(svg, "heel-work").y));
    expect(Number(labelXY(svg, "toe-center").y)).toBeGreaterThan(Number(labelXY(svg, "toe-work").y));
    expect(jp).not.toContain('data-sock-label="heel-held"');
    expect(jp).not.toContain('data-sock-label="toe-held"');
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    const sock2 = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror: true });
    expect(Number(labelXY(sock2, "heel-held").x)).toBeGreaterThan(144);
    expect(Number(labelXY(sock2, "toe-held").x)).toBeGreaterThan(144);
  });

  it("fills right-side inches and rows from the approved calc", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    expect(Number(attr(svg, "data-sock-leg-in"))).toBeCloseTo(fields.upperLegInches, 5);
    expect(Number(attr(svg, "data-sock-ankle-in"))).toBeCloseTo(fields.ankleInches, 5);
    expect(Number(attr(svg, "data-sock-heel-in"))).toBeCloseTo(fields.heelInches, 5);
    expect(Number(attr(svg, "data-sock-foot-in"))).toBeCloseTo(fields.footInches, 5);
    expect(Number(attr(svg, "data-sock-toe-in"))).toBeCloseTo(fields.toeInches, 5);
    expect(attr(svg, "data-sock-leg-rows")).toBe(String(calc.legShapingRowsAvailable));
    expect(attr(svg, "data-sock-ankle-rows")).toBe(String(calc.ankleStraightRows));
    expect(attr(svg, "data-sock-foot-rows")).toBe(String(calc.straightFootRows));
    expect(attr(svg, "data-sock-heel-short-row")).toBe(String(calc.heel.shortRowKnittingRows));
    expect(attr(svg, "data-sock-toe-short-row")).toBe(String(calc.toe.shortRowKnittingRows));
    const labels = labelsGroup(svg);
    expect(labels).toContain(escapeSockSvgText(fields.measureLeg[0]!));
    expect(labels).toContain(escapeSockSvgText(fields.measureAnkle[0]!));
    expect(labels).toContain(escapeSockSvgText(fields.measureHeel[0]!));
    expect(labels).toContain(escapeSockSvgText(fields.measureFoot[0]!));
    expect(labels).toContain(escapeSockSvgText(fields.measureToe[0]!));
    expect(labels).toContain(rowPhrase(calc.legShapingRowsAvailable));
    expect(labels).toContain(rowPhrase(calc.ankleStraightRows));
    expect(labels).toContain(rowPhrase(calc.straightFootRows));
    expect(labels).toContain(
      `${calc.heel.shortRowInSteps} / ${calc.heel.shortRowOutSteps} rows`,
    );
    expect(labels).toContain(
      `${calc.toe.shortRowInSteps} / ${calc.toe.shortRowOutSteps} rows`,
    );
    expect(Number(labelXY(svg, "measureLeg-0").x)).toBeGreaterThan(276);
    expect(Number(labelXY(svg, "measureLeg-0").x)).toBeGreaterThan(dimLineX(svg, "leg-length"));
  });

  it("shows physical one-way heel/toe inches and separate short-row in/out rows", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const heelPhase = `${calc.heel.shortRowInSteps} / ${calc.heel.shortRowOutSteps} rows`;
    const toePhase = `${calc.toe.shortRowInSteps} / ${calc.toe.shortRowOutSteps} rows`;
    expect(calc.heel.shortRowKnittingRows).toBe(
      calc.heel.shortRowInSteps + calc.heel.shortRowOutSteps,
    );
    expect(calc.toe.shortRowKnittingRows).toBe(
      calc.toe.shortRowInSteps + calc.toe.shortRowOutSteps,
    );
    expect(Number(attr(svg, "data-sock-heel-in"))).toBeCloseTo(calc.heelDepthInches, 5);
    expect(Number(attr(svg, "data-sock-toe-in"))).toBeCloseTo(calc.toeDepthInches, 5);
    expect(labelText(svg, "measureHeel-0")).toBe(escapeSockSvgText(fields.measureHeel[0]!));
    expect(labelText(svg, "measureToe-0")).toBe(escapeSockSvgText(fields.measureToe[0]!));
    expect(labelText(svg, "measureHeel-1")).toBe(heelPhase);
    expect(labelText(svg, "measureToe-1")).toBe(toePhase);
    expect(labelText(svg, "measureHeel-1")).not.toBe(rowPhrase(calc.heel.shortRowKnittingRows));
    expect(labelText(svg, "measureToe-1")).not.toBe(rowPhrase(calc.toe.shortRowKnittingRows));
    expect(labelText(svg, "measureHeel-1")).not.toBe(rowPhrase(calc.heel.shortRowInSteps));
    expect(calc.footLengthInches).toBeCloseTo(
      calc.heelDepthInches + calc.straightFootLengthInches + calc.toeDepthInches,
      5,
    );
    expect(labelText(jp, "measureHeel")).toBe(`${calc.heel.shortRowInSteps}r`);
    expect(labelText(jp, "measureToe")).toBe(`${calc.toe.shortRowInSteps}r`);
    expect(labelText(jp, "measureHeel")).not.toBe(`${calc.heel.shortRowKnittingRows}r`);
    expect(labelText(jp, "measureToe")).not.toBe(`${calc.toe.shortRowKnittingRows}r`);
  });

  it("widens the Stitches & Rows viewBox so right-side row labels are not clipped", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const heelPhase = `${calc.heel.shortRowInSteps} / ${calc.heel.shortRowOutSteps} rows`;
    const toePhase = `${calc.toe.shortRowInSteps} / ${calc.toe.shortRowOutSteps} rows`;
    expect(attr(svg, "viewBox")).toBe(sockCanonicalViewBox(SOCK_STS_ROWS_PAD_RIGHT));
    expect(attr(jp, "viewBox")).toBe(SOCK_CANONICAL_VIEWBOX);
    expect(viewBoxRight(svg)).toBeGreaterThan(viewBoxRight(jp));
    expect(dimLineX(svg, "leg-length")).toBe(294);
    expect(Number(labelXY(svg, "measureLeg-0").x)).toBe(304);
    expect(Number(labelXY(svg, "measureHeel-1").x)).toBe(304);
    expect(Number(labelXY(svg, "measureToe-1").x)).toBe(304);
    expect(viewBoxRight(svg) - 304).toBeGreaterThanOrEqual(100);
    expect(labelText(svg, "measureLeg-1")).toBe(fields.measureLeg[1]!);
    expect(labelText(svg, "measureAnkle-1")).toBe(fields.measureAnkle[1]!);
    expect(labelText(svg, "measureHeel-1")).toBe(heelPhase);
    expect(labelText(svg, "measureFoot-1")).toBe(fields.measureFoot[1]!);
    expect(labelText(svg, "measureToe-1")).toBe(toePhase);
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    const page = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(page).toContain("overflow-x: visible");
    expect(page).toMatch(/@media print[\s\S]*overflow: visible/);
  });

  it("uses the same overlay anchors for Stitches & Rows and Shaping Notation", () => {
    const calc = mustCalc();
    const sts = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    for (const id of ["sectionLeg", "sectionAnkle", "sectionHeel", "sectionFoot", "sectionToe"] as const) {
      expect(labelXY(sts, id)).toEqual(labelXY(jp, id));
    }
    expect(labelXY(sts, "measureLeg-0").x).not.toBe(labelXY(jp, "measureLeg").x);
    expect(labelXY(sts, "heel-center")).toEqual(labelXY(jp, "heel-hold"));
    expect(labelXY(sts, "toe-work")).toEqual(labelXY(jp, "toe-shape"));
    const sock2 = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror: true });
    expect(Number(labelXY(jp, "measureLeg").x)).toBe(SOCK_CANONICAL_ANCHORS.measureLeg.x);
    expect(Number(labelXY(sock2, "measureLeg-0").x)).toBe(Number(labelXY(sts, "measureLeg-0").x));
    expect(Number(labelXY(sock2, "sectionHeel").x)).toBe(
      284 - SOCK_CANONICAL_ANCHORS.sectionHeel.x,
    );
  });

  it("draws Drop Shoulder-style dimension lines with two end caps", () => {
    const calc = mustCalc();
    const fields = sockCanonicalCalcLabelFields(calc);
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const heldLabel =
      calc.heel.heldStitches === 1 ? "1 st" : `${calc.heel.heldStitches} sts`;

    const horizontal = [
      "cuff-width",
      "heel-held-width",
      "heel-work-width",
      "toe-held-width",
      "toe-work-width",
    ] as const;
    const vertical = [
      "leg-length",
      "ankle-length",
      "heel-length",
      "foot-length",
      "toe-length",
    ] as const;

    for (const role of horizontal) {
      const group = dimGroup(svg, role);
      expect(group, role).toContain('data-sock-dim-axis="h"');
      expect(group, role).toContain('data-end-cap="true"');
      expect(endCapCount(group), role).toBe(2);
      expect(group, role).not.toContain("<polygon");
    }
    for (const role of vertical) {
      const group = dimGroup(svg, role);
      expect(group, role).toContain('data-sock-dim-axis="v"');
      expect(group, role).toContain('data-end-cap="true"');
      expect(endCapCount(group), role).toBe(2);
      expect(group, role).not.toContain("<polygon");
      expect(dimLineX(svg, role)).toBe(dimLineX2(svg, role));
    }

    expect(dimLineX(svg, "cuff-width")).toBe(12);
    expect(dimLineX2(svg, "cuff-width")).toBe(276);
    expect(dimLineY(svg, "cuff-width")).toBe(dimLineY2(svg, "cuff-width"));
    expect(dimLineX(svg, "heel-held-width")).toBe(12);
    expect(dimLineX2(svg, "heel-held-width")).toBe(148);
    expect(dimLineX(svg, "heel-work-width")).toBe(148);
    expect(dimLineX2(svg, "heel-work-width")).toBe(276);
    expect(dimLineX(svg, "toe-held-width")).toBe(12);
    expect(dimLineX2(svg, "toe-held-width")).toBe(148);
    expect(dimLineX(svg, "toe-work-width")).toBe(148);
    expect(dimLineX2(svg, "toe-work-width")).toBe(276);

    expect(dimLineY(svg, "leg-length")).toBe(296);
    expect(dimLineY2(svg, "leg-length")).toBe(472);
    expect(dimLineY(svg, "ankle-length")).toBe(264);
    expect(dimLineY2(svg, "ankle-length")).toBe(296);
    expect(dimLineY(svg, "heel-length")).toBe(216);
    expect(dimLineY2(svg, "heel-length")).toBe(264);
    expect(dimLineY(svg, "foot-length")).toBe(56);
    expect(dimLineY2(svg, "foot-length")).toBe(216);
    expect(dimLineY(svg, "toe-length")).toBe(8);
    expect(dimLineY2(svg, "toe-length")).toBe(56);

    expect(labelCount(svg, "cuff")).toBe(1);
    expect(labelCount(svg, "heel-held")).toBe(1);
    expect(labelCount(svg, "toe-held")).toBe(1);
    expect(labelCount(svg, "heel-work")).toBe(1);
    expect(labelCount(svg, "heel-center")).toBe(1);
    expect(labelCount(svg, "toe-work")).toBe(1);
    expect(labelCount(svg, "toe-center")).toBe(1);
    expect(labelsGroup(svg)).toContain(fields.cuffStsLabel);
    expect(labelsGroup(svg)).toContain(heldLabel);
    expect(labelsGroup(svg)).toContain(fields.heelWorkLabel);
    expect(labelsGroup(svg)).toContain(fields.heelCenterLabel);
    expect(labelsGroup(svg)).toContain(escapeSockSvgText(fields.measureLeg[0]!));
    expect(labelsGroup(svg)).toContain(rowPhrase(calc.legShapingRowsAvailable));
    expect(attr(svg, "data-sock-cuff-sts")).toBe(String(calc.legStitches));
    expect(attr(svg, "data-sock-heel-hold")).toBe(String(calc.heel.heldStitches));
    expect(attr(svg, "data-sock-heel-work")).toBe(String(calc.heel.workingStitches));
    expect(attr(svg, "data-sock-heel-center")).toBe(String(calc.heel.remainingStitches));

    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(svg)).not.toContain("data-sock-dim");
    expect(geometryGroup(svg)).not.toContain("data-sock-end-cap");
    expect(jp).not.toContain("data-sock-dim");
    expect(jp).not.toContain("data-sock-end-cap");
    expect(jp).toContain(SOCK_CANONICAL_POLYGON_POINTS);

    const sock2 = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror: true });
    expect(dimLineX(sock2, "cuff-width")).toBe(8);
    expect(dimLineX2(sock2, "cuff-width")).toBe(272);
    expect(
      (dimLineX(sock2, "heel-held-width") + dimLineX2(sock2, "heel-held-width")) / 2,
    ).toBeGreaterThan(144);
    expect(dimLineX(sock2, "leg-length")).toBe(dimLineX(svg, "leg-length"));
  });
});

describe("knitting-order orientation is independent of Sock 1 / Sock 2 mirror", () => {
  it("Cuff to Toe reads bottom-up from cuff/leg to toe with cast-on at the bottom", () => {
    const calc = mustCalc({ constructionDirection: "cuff-to-toe" });
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const ys = sectionYs(svg);
    const jpYs = sectionYs(jp);
    expect(attr(svg, "data-sock-knit-order")).toBe("cuff-to-toe");
    expect(attr(jp, "data-sock-knit-order")).toBe("cuff-to-toe");
    expect(ys.leg).toBeGreaterThan(ys.ankle);
    expect(ys.ankle).toBeGreaterThan(ys.heel);
    expect(ys.heel).toBeGreaterThan(ys.foot);
    expect(ys.foot).toBeGreaterThan(ys.toe);
    expect(jpYs).toEqual(ys);
    expect(Number(labelXY(svg, "cast-on").y)).toBeGreaterThan(ys.leg);
    expect(Number(labelXY(svg, "finish").y)).toBeLessThan(ys.toe);
    expect(labelsGroup(svg)).toContain("cast on");
    expect(labelsGroup(svg)).toContain("waste yarn");
    expect(Number(labelXY(jp, "castOnCuff").y)).toBeGreaterThan(jpYs.leg);
    expect(Number(labelXY(jp, "finish").y)).toBeLessThan(jpYs.toe);
    expect(labelsGroup(jp)).toContain("waste yarn");
    expect(dimLineY(svg, "leg-length")).toBeGreaterThan(dimLineY2(svg, "toe-length"));
    expect(Number(labelXY(svg, "measureLeg-0").y)).toBeGreaterThan(
      Number(labelXY(svg, "measureToe-0").y),
    );
    expect(attr(svg, "data-sock-heel-hold")).toBe(String(calc.heel.heldStitches));
    expect(attr(svg, "data-sock-toe-center")).toBe(String(calc.toe.remainingStitches));
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
  });

  it("Toe Up reads bottom-up from toe to cuff/leg with cast-on at the bottom", () => {
    const calc = mustCalc({ constructionDirection: "toe-up" });
    const svg = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
    const jp = buildSockShapingNotationDiagramSvg(calc);
    const ys = sectionYs(svg);
    const jpYs = sectionYs(jp);
    expect(attr(svg, "data-sock-knit-order")).toBe("toe-up");
    expect(attr(jp, "data-sock-knit-order")).toBe("toe-up");
    expect(ys.toe).toBeGreaterThan(ys.foot);
    expect(ys.foot).toBeGreaterThan(ys.heel);
    expect(ys.heel).toBeGreaterThan(ys.ankle);
    expect(ys.ankle).toBeGreaterThan(ys.leg);
    expect(jpYs).toEqual(ys);
    expect(Number(labelXY(svg, "cast-on").y)).toBeGreaterThan(ys.toe);
    expect(Number(labelXY(svg, "finish").y)).toBeLessThan(ys.leg);
    expect(labelsGroup(svg)).toContain("cast on");
    expect(labelsGroup(svg)).toContain("bind off");
    expect(Number(labelXY(jp, "castOnToe").y)).toBeGreaterThan(jpYs.toe);
    expect(Number(labelXY(jp, "finish").y)).toBeLessThan(jpYs.leg);
    expect(labelsGroup(jp)).toMatch(/bo\d+/);
    expect(dimLineY(svg, "toe-length")).toBeGreaterThan(dimLineY(svg, "leg-length"));
    expect(Number(labelXY(svg, "measureToe-0").y)).toBeGreaterThan(
      Number(labelXY(svg, "measureLeg-0").y),
    );
    expect(Number(labelXY(svg, "heel-center").y)).toBeLessThan(Number(labelXY(svg, "heel-work").y));
    expect(geometryGroup(svg)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
    expect(geometryGroup(svg)).not.toContain("scale(");
  });

  it("Sock 2 is a horizontal mirror only for both construction directions", () => {
    for (const direction of ["cuff-to-toe", "toe-up"] as const) {
      const calc = mustCalc({ constructionDirection: direction });
      const sock1 = buildSockPatternDiagramSvg(calc, { mode: "pattern" });
      const sock2 = buildSockPatternDiagramSvg(calc, { mode: "pattern", mirror: true });
      const jp1 = buildSockShapingNotationDiagramSvg(calc);
      const jp2 = buildSockShapingNotationDiagramSvg(calc, { mirror: true });
      expect(sectionYs(sock1)).toEqual(sectionYs(sock2));
      expect(sectionYs(jp1)).toEqual(sectionYs(sock1));
      expect(sectionYs(jp2)).toEqual(sectionYs(sock1));
      expect(Number(labelXY(sock1, "sectionHeel").x)).toBeGreaterThan(144);
      expect(Number(labelXY(sock2, "sectionHeel").x)).toBeLessThan(144);
      expect(Number(labelXY(sock1, "cast-on").y)).toBe(Number(labelXY(sock2, "cast-on").y));
      expect(labelsGroup(sock2)).not.toContain("scale(-1");
      expect(geometryGroup(sock1)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
      expect(geometryGroup(sock2)).toContain(SOCK_CANONICAL_POLYGON_POINTS);
      if (direction === "cuff-to-toe") {
        expect(geometryGroup(sock1)).toContain("scale(1,-1)");
        expect(geometryGroup(sock2)).toContain("scale(-1,-1)");
      } else {
        expect(geometryGroup(sock1)).not.toContain("scale(");
        expect(geometryGroup(sock2)).toContain("scale(-1,1)");
        expect(geometryGroup(sock2)).not.toContain("scale(-1,-1)");
      }
    }
  });
});

describe("diagram SVG does not recreate Socks math", () => {
  it("does not import Magic Formula or short-row calculators", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = [
      readFileSync(resolve(dir, "sockPatternDiagramSvg.ts"), "utf8"),
      readFileSync(resolve(dir, "sockCanonicalDiagram.ts"), "utf8"),
      readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8"),
    ].join("\n");
    expect(src).not.toMatch(/magicFormulaIntervals/);
    expect(src).not.toMatch(/remainingStitchesAtOneThird/);
    expect(src).not.toMatch(/roundToEvenPreferUp/);
    expect(src).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(src).not.toMatch(/calculateShortRowShaping/);
    expect(src).not.toMatch(/calculateBasicSockPattern/);
    expect(src).toContain("buildSockPatternDiagramSvg");
    expect(src).toContain("sockCanonicalGeometryMarkup");
    expect(src).toContain("socks-summary.svg");
    expect(src).not.toContain("sockDiagramSchematicMarkup");
    expect(src).not.toContain("buildSockDiagramLayout");
  });
});

function labelCount(svg: string, id: string): number {
  return (svg.match(new RegExp(`data-sock-label="${id}"`, "g")) ?? []).length;
}

function textCount(svg: string, text: string): number {
  return svg.split(`>${text}<`).length - 1;
}

function labelXY(svg: string, id: string): { x: string; y: string } {
  const match = svg.match(new RegExp(`data-sock-label="${id}" x="([^"]+)" y="([^"]+)"`));
  expect(match, id).toBeTruthy();
  return { x: match![1]!, y: match![2]! };
}

function labelText(svg: string, id: string): string {
  const match = svg.match(new RegExp(`data-sock-label="${id}"[^>]*>([^<]*)</text>`));
  expect(match, id).toBeTruthy();
  return match![1]!;
}

function sectionYs(svg: string): {
  leg: number;
  ankle: number;
  heel: number;
  foot: number;
  toe: number;
} {
  return {
    leg: Number(labelXY(svg, "sectionLeg").y),
    ankle: Number(labelXY(svg, "sectionAnkle").y),
    heel: Number(labelXY(svg, "sectionHeel").y),
    foot: Number(labelXY(svg, "sectionFoot").y),
    toe: Number(labelXY(svg, "sectionToe").y),
  };
}

function rowPhrase(n: number): string {
  return n === 1 ? "1 row" : `${n} rows`;
}

function dimGroup(svg: string, role: string): string {
  const match = svg.match(new RegExp(`<g data-sock-dim="${role}"[\\s\\S]*?</g>`));
  expect(match, role).toBeTruthy();
  return match![0]!;
}

function dimLineAttr(svg: string, role: string, attrName: "x1" | "y1" | "x2" | "y2"): number {
  const group = dimGroup(svg, role);
  const line = group.match(
    /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/,
  );
  expect(line, role).toBeTruthy();
  const index = { x1: 1, y1: 2, x2: 3, y2: 4 }[attrName];
  return Number(line![index]);
}

function dimLineX(svg: string, role: string): number {
  return dimLineAttr(svg, role, "x1");
}

function dimLineX2(svg: string, role: string): number {
  return dimLineAttr(svg, role, "x2");
}

function dimLineY(svg: string, role: string): number {
  return dimLineAttr(svg, role, "y1");
}

function dimLineY2(svg: string, role: string): number {
  return dimLineAttr(svg, role, "y2");
}

function endCapCount(group: string): number {
  return (group.match(/data-sock-end-cap="true"/g) ?? []).length;
}
