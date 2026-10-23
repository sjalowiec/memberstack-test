import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatBodyRowsNotation,
  formatCastOnNotation,
} from "../sleevelessBackJapaneseNotation";
import { formatShapingNotationRcLabel } from "../shapingNotationRcLandmarks";
import { formatShapingSegment } from "../shapingNotationCompress";
import { calculateBasicSockPattern, type BasicSockCalc, type BasicSockCalcInput } from "./sockMath";
import { SHAPING_NOTATION_RC_DASH, SHAPING_NOTATION_RC_GUIDE, SHAPING_NOTATION_RC_GUIDE_WIDTH } from "../legoBlocks/shapingNotationRcLeaders";
import {
  SOCK_CANONICAL_POLYGON_POINTS,
  SOCK_CANONICAL_SVG_HREF,
  SOCK_CANONICAL_VB_W,
  sockCanonicalFlipVertical,
  sockCanonicalMapY,
} from "./sockCanonicalDiagram";
import { OUTLINE, SOCK_DIAGRAM_RC_X, buildSockPatternDiagramSvg, sockDiagramRcMilestones } from "./sockPatternDiagramSvg";
import {
  buildSockShapingNotationDiagramSvg,
  buildSockShapingNotationLines,
  sockShapingNotationRcMilestones,
  sockShapingRcOutlineX,
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
  return [
    `+${formatShapingSegment(1, 1, shaping.shortRowOutSteps)}`,
    remainingStitchLabel(shaping.remainingStitches),
    `-${formatShapingSegment(1, 1, shaping.shortRowInSteps)}`,
  ].join("|");
}

function labelText(svg: string, id: string): string {
  const match = svg.match(new RegExp(`data-sock-label="${id}"[^>]*>([^<]*)</text>`));
  expect(match, id).toBeTruthy();
  return match![1]!;
}

function rcLabelIds(svg: string): string[] {
  return [...svg.matchAll(/data-sock-label="(rc-(?:leg|ankle|heel|foot|toe|bind-off))"/g)].map(
    (match) => match[1]!,
  );
}

function stackedShapeTexts(svg: string, id: "heel-shape" | "toe-shape"): string {
  const parts = [...svg.matchAll(new RegExp(`data-sock-label="${id}(?:-\\d+)?"[^>]*>([^<]*)</text>`, "g"))];
  return parts.map((match) => match[1]!).join("|");
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
    expect(svg).toContain(formatShapingNotationRcLabel(calc.legRows));
    expect(svg).toContain(formatShapingNotationRcLabel(calc.straightFootRows));
    expect(labelsGroup(svg)).not.toMatch(/>\d+r</);
    expect(rcLabelIds(labelsGroup(svg))).toEqual(["rc-leg", "rc-heel", "rc-foot", "rc-toe"]);
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
    for (const token of expected) {
      expect(labelsGroup(svg)).toContain(token);
    }
    expect(labelsGroup(svg)).not.toContain('data-sock-label="measureLeg"');
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
    for (const token of expected) {
      expect(labelsGroup(svg)).toContain(token);
    }
    expect(labelsGroup(svg)).not.toContain('data-sock-label="measureLeg"');
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

  it("shows signed decrease / remaining / increase once per heel and toe, without RC in the stacks", () => {
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
        expect(expected).toHaveLength(3);
        expect(expected[0]).toBe(`+${formatShapingSegment(1, 1, calc[part].shortRowOutSteps)}`);
        expect(expected[1]).toBe(remainingStitchLabel(calc[part].remainingStitches));
        expect(expected[2]).toBe(`-${formatShapingSegment(1, 1, calc[part].shortRowInSteps)}`);
        expect(svg).toContain(expected[0]!);
        expect(svg).toContain(expected[1]!);
        expect(svg).toContain(expected[2]!);
      }
      expect(lines.heel).toEqual(lines.toe);
      expect(stackedShapeTexts(svg, "heel-shape")).toBe(expectedShortRow(calc, "heel"));
      expect(stackedShapeTexts(svg, "toe-shape")).toBe(expectedShortRow(calc, "toe"));
      expect(stackedShapeTexts(svg, "heel-shape")).not.toMatch(/rc\d/);
      expect(stackedShapeTexts(svg, "toe-shape")).not.toMatch(/rc\d/);
      expect(labelsGroup(svg)).not.toContain('data-sock-label="heel-rc"');
      expect(labelsGroup(svg)).not.toContain('data-sock-label="toe-rc"');
      expect(svg).not.toMatch(/hold\d/);
      expect(attr(svg, "data-sock-notation-heel")).not.toContain("hold");
      expect(attr(svg, "data-sock-notation-heel")).not.toMatch(/rc\d/);
      expect(attr(svg, "data-sock-notation-toe")).not.toContain("hold");
      expect(attr(svg, "data-sock-notation-toe")).not.toMatch(/rc\d/);
    }
    const womanSvg = buildSockShapingNotationDiagramSvg(woman);
    const infantSvg = buildSockShapingNotationDiagramSvg(infant);
    expect(attr(womanSvg, "data-sock-notation-heel")).not.toBe(
      attr(infantSvg, "data-sock-notation-heel"),
    );
  });

  it("omits right-side section row-count labels and keeps heel/toe stacks plus the reading arrow", () => {
    const calc = mustCalc();
    const svg = buildSockShapingNotationDiagramSvg(calc);
    const labels = labelsGroup(svg);
    expect(labels).not.toContain(formatBodyRowsNotation(calc.legShapingRowsAvailable));
    expect(labels).not.toContain(formatBodyRowsNotation(calc.ankleStraightRows));
    expect(labels).not.toContain(formatBodyRowsNotation(calc.straightFootRows));
    expect(labels).not.toContain(`${calc.heel.shortRowInSteps}r`);
    expect(labels).not.toContain(`${calc.toe.shortRowInSteps}r`);
    expect(labels).not.toMatch(/>\d+r</);
    expect(labels).not.toContain('data-sock-label="measureLeg"');
    expect(labels).not.toContain('data-sock-label="measureAnkle"');
    expect(labels).not.toContain('data-sock-label="measureHeel"');
    expect(labels).not.toContain('data-sock-label="measureFoot"');
    expect(labels).not.toContain('data-sock-label="measureToe"');
    expect(svg).toContain(`+${formatShapingSegment(1, 1, calc.heel.shortRowOutSteps)}`);
    expect(svg).toContain(`-${formatShapingSegment(1, 1, calc.heel.shortRowInSteps)}`);
    expect(svg).toContain(remainingStitchLabel(calc.heel.remainingStitches));
    expect(svg).toContain('data-sock-reading-direction="bottom-to-top"');
    expect(svg).not.toContain("Direction of Knitting");
  });
});

describe("Shaping Notation RC milestones", () => {
  function assertSharedRcLabels(svg: string, calc: BasicSockCalc): void {
    const milestones = sockShapingNotationRcMilestones(calc);
    expect(milestones).toEqual(sockDiagramRcMilestones(calc));
    expect(rcLabelIds(labelsGroup(svg))).toEqual(milestones.map((milestone) => milestone.id));
    const flipVertical = sockCanonicalFlipVertical(calc.constructionDirection);
    for (const milestone of milestones) {
      expect(labelText(svg, milestone.id)).toBe(formatShapingNotationRcLabel(milestone.rc));
      expect(Number(labelXY(svg, milestone.id).x)).toBe(SOCK_DIAGRAM_RC_X);
      expect(Number(labelXY(svg, milestone.id).y)).toBe(
        sockCanonicalMapY(milestone.canonicalY, flipVertical),
      );
    }
    assertRcLeaders(svg, calc);
  }

  function assertRcLeaders(
    svg: string,
    calc: BasicSockCalc,
    options?: { mirror?: boolean; family?: "socks" | "christmas-stocking" },
  ): void {
    const milestones = sockShapingNotationRcMilestones(calc, { family: options?.family });
    const flipVertical = sockCanonicalFlipVertical(calc.constructionDirection);
    const outlineXFor = (canonicalY: number) =>
      sockShapingRcOutlineX(canonicalY, options?.mirror === true);
    expect(svg.match(/data-role="rc-leader"/g)?.length).toBe(milestones.length);
    for (const milestone of milestones) {
      const match = svg.match(
        new RegExp(
          `<line\\b[^>]*data-role="rc-leader"[^>]*data-rc-label="${milestone.id}"[^>]*x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"`,
        ),
      );
      expect(match, milestone.id).toBeTruthy();
      const y = sockCanonicalMapY(milestone.canonicalY, flipVertical);
      expect(Number(match![1])).toBe(SOCK_DIAGRAM_RC_X - 3);
      expect(Number(match![2])).toBe(y);
      expect(Number(match![3])).toBe(outlineXFor(milestone.canonicalY));
      expect(Number(match![4])).toBe(y);
      expect(Number(labelXY(svg, milestone.id).y)).toBe(y);
    }
    expect(svg).toContain(`stroke="${SHAPING_NOTATION_RC_GUIDE}"`);
    expect(svg).toContain(`stroke-width="${SHAPING_NOTATION_RC_GUIDE_WIDTH}"`);
    expect(svg).toContain(`stroke-dasharray="${SHAPING_NOTATION_RC_DASH}"`);
  }

  it("places Toe-Up RC labels on the same written boundaries as Stitches & Rows", () => {
    const calc = mustCalc({ constructionDirection: "toe-up" });
    const svg = buildSockShapingNotationDiagramSvg(calc);
    expect(calc.ankleStraightRows).toBeGreaterThan(0);
    expect(sockShapingNotationRcMilestones(calc)).toEqual([
      { id: "rc-toe", rc: 0, canonicalY: 472 },
      { id: "rc-foot", rc: 0, canonicalY: 424 },
      { id: "rc-heel", rc: calc.straightFootRows, canonicalY: 264 },
      { id: "rc-ankle", rc: 0, canonicalY: 216 },
      { id: "rc-leg", rc: calc.ankleStraightRows, canonicalY: 184 },
      { id: "rc-bind-off", rc: calc.legShapingRowsAvailable, canonicalY: 8 },
    ]);
    expect(attr(svg, "data-sock-rc-toe")).toBe("0");
    expect(attr(svg, "data-sock-rc-foot")).toBe("0");
    expect(attr(svg, "data-sock-rc-heel")).toBe(String(calc.straightFootRows));
    expect(attr(svg, "data-sock-rc-ankle")).toBe("0");
    expect(attr(svg, "data-sock-rc-leg")).toBe(String(calc.ankleStraightRows));
    expect(attr(svg, "data-sock-rc-bind-off")).toBe(String(calc.legShapingRowsAvailable));
    assertSharedRcLabels(svg, calc);
    expect(Number(labelXY(svg, "rc-toe").y)).toBeGreaterThan(Number(labelXY(svg, "rc-foot").y));
    expect(Number(labelXY(svg, "rc-foot").y)).toBeGreaterThan(Number(labelXY(svg, "rc-heel").y));
    expect(Number(labelXY(svg, "rc-heel").y)).toBeGreaterThan(Number(labelXY(svg, "rc-ankle").y));
    expect(Number(labelXY(svg, "rc-ankle").y)).toBeGreaterThan(Number(labelXY(svg, "rc-leg").y));
    expect(Number(labelXY(svg, "rc-leg").y)).toBeGreaterThan(Number(labelXY(svg, "rc-bind-off").y));
    expect(stackedShapeTexts(svg, "heel-shape")).not.toMatch(/rc\d/);
    expect(stackedShapeTexts(svg, "toe-shape")).not.toMatch(/rc\d/);
  });

  it("places Cuff-to-Toe RC labels on the same written boundaries as Stitches & Rows", () => {
    const calc = mustCalc({ constructionDirection: "cuff-to-toe" });
    const svg = buildSockShapingNotationDiagramSvg(calc);
    const shared = sockDiagramRcMilestones(calc);
    expect(sockShapingNotationRcMilestones(calc)).toEqual(shared);
    expect(shared).toEqual([
      { id: "rc-leg", rc: 0, canonicalY: 8 },
      { id: "rc-heel", rc: calc.legRows, canonicalY: 216 },
      { id: "rc-foot", rc: 0, canonicalY: 264 },
      { id: "rc-toe", rc: calc.straightFootRows, canonicalY: 424 },
    ]);
    expect(attr(svg, "data-sock-rc-leg")).toBe("0");
    expect(attr(svg, "data-sock-rc-heel")).toBe(String(calc.legRows));
    expect(attr(svg, "data-sock-rc-foot")).toBe("0");
    expect(attr(svg, "data-sock-rc-toe")).toBe(String(calc.straightFootRows));
    assertSharedRcLabels(svg, calc);
    expect(Number(labelXY(svg, "rc-leg").y)).toBeGreaterThan(Number(labelXY(svg, "rc-heel").y));
    expect(Number(labelXY(svg, "rc-heel").y)).toBeGreaterThan(Number(labelXY(svg, "rc-foot").y));
    expect(Number(labelXY(svg, "rc-foot").y)).toBeGreaterThan(Number(labelXY(svg, "rc-toe").y));
    expect(stackedShapeTexts(svg, "heel-shape")).not.toMatch(/rc\d/);
    expect(stackedShapeTexts(svg, "toe-shape")).not.toMatch(/rc\d/);
  });

  it("draws a shared leader from each boundary for both directions, both families, and the mirrored sock", () => {
    expect(sockShapingRcOutlineX(472, false)).toBe(OUTLINE.right);
    expect(sockShapingRcOutlineX(472, true)).toBe(SOCK_CANONICAL_VB_W - 148);
    expect(sockShapingRcOutlineX(216, true)).toBe(SOCK_CANONICAL_VB_W - OUTLINE.left);
    expect(sockShapingRcOutlineX(8, false)).toBe(OUTLINE.right);
    for (const constructionDirection of ["cuff-to-toe", "toe-up"] as const) {
      for (const family of ["socks", "christmas-stocking"] as const) {
        const calc = mustCalc({ constructionDirection });
        const svg = buildSockShapingNotationDiagramSvg(calc, { family });
        assertRcLeaders(svg, calc, { family });
        const mirrored = buildSockShapingNotationDiagramSvg(calc, { family, mirror: true });
        assertRcLeaders(mirrored, calc, { family, mirror: true });
        expect(buildSockPatternDiagramSvg(calc, { family })).not.toContain('data-role="rc-leader"');
      }
    }
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
    expect(src).toContain("sockDiagramRcMilestones");
    expect(src).toContain("formatCastOnNotation");
    expect(src).toContain("formatBodyRowsNotation");
    expect(src).toContain("sockDiagramRcLabelMarkup");
    expect(src).toContain("renderShapingNotationRcLeaders");
    expect(src).toContain("sockFinishedDiagramTypography");
    expect(src).not.toMatch(/size:\s*1\d/);
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
