import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import {
  SLEEVELESS_CARDIGAN_FULL_FRONT_ROUND_DIAGRAM_SRC,
  SLEEVELESS_CARDIGAN_FULL_FRONT_V_DIAGRAM_SRC,
  SLEEVELESS_PULLOVER_V_FRONT_DIAGRAM_SRC,
} from "./sleevelessFrontDiagramSrc";
import { cardiganFrontNeckOpeningStitches } from "./roundNeckNotation";
import { sleevelessCardiganFrontEdgeFinishingMode } from "./sleevelessPatternFinishing";
import { resolveSleevelessFrontDiagramSrc } from "./sleevelessFrontJapaneseNotation";
import { buildSleevelessFrontStsRowsDiagramModel } from "./sleevelessFrontStsRowsDiagramModel";
import {
  buildSleevelessFrontStsRowsDiagramSvg,
  SLEEVELESS_FRONT_STS_ROWS_VIEWBOX,
  SLEEVELESS_FRONT_STS_ROWS_VISUAL,
  tryBuildLiveSleevelessFrontStsRowsDiagramSvg,
  tryBuildSleevelessFrontStsRowsDiagramSvg,
} from "./sleevelessFrontStsRowsDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

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

function cardiganStraightPattern(neckline: "round" | "v-neck"): Record<string, unknown> {
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
    style: { garmentStyle: "cardigan", neckline, frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function cardiganVNeckPattern(): Record<string, unknown> {
  return cardiganStraightPattern("v-neck");
}

/** DEV-visible Cardigan V: 12 sts / 3 in neck and 24 rows / 4 in neck depth. */
function cardiganVReadablePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 4,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "cardigan", neckline: "v-neck", frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 4, gaugeRowsPerInch: 6, availableNeedles: 200 },
  };
}

function cardiganRoundReadablePattern(): Record<string, unknown> {
  const pattern = cardiganVReadablePattern();
  (pattern.style as { neckline: string }).neckline = "round";
  return pattern;
}

function cardiganRoundPattern(): Record<string, unknown> {
  return cardiganStraightPattern("round");
}

function cardiganAlinePattern(): Record<string, unknown> {
  const pattern = cardiganStraightPattern("v-neck");
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  return pattern;
}

function cardiganShapedPattern(): Record<string, unknown> {
  const pattern = cardiganStraightPattern("round");
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
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

function alineOutwardVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "aline";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function inferredOutwardVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function shapedVNeckPattern(): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function sameSizeRoundPattern(frontNeckDepth: number): Record<string, unknown> {
  const pattern = shallowVNeckPattern();
  (pattern.style as { neckline: string }).neckline = "round";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.front_neck_depth = frontNeckDepth;
  return pattern;
}

function svgFor(pattern: Record<string, unknown>): {
  model: NonNullable<ReturnType<typeof buildSleevelessFrontStsRowsDiagramModel>>;
  svg: string;
} {
  const result = generateSleevelessBackPattern(pattern);
  const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
  expect(model).not.toBeNull();
  const svg = tryBuildSleevelessFrontStsRowsDiagramSvg(model);
  expect(svg).toBeTruthy();
  return { model: model!, svg: svg! };
}

function svgAttr(svg: string, name: string): string {
  const re = new RegExp(`${name}="([^"]*)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function rolePaths(svg: string, role: string): string[] {
  const re = new RegExp(`data-role="${role}"[^>]*\\sd="([^"]+)"`, "g");
  return [...svg.matchAll(re)].map((m) => m[1] ?? "");
}

function pathPoints(d: string): { x: number; y: number }[] {
  const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return pts;
}

const UPPER_WIDTH_TOL = 0.51;

function expectUpperSilhouetteMatchesStitchBudget(
  svg: string,
  model: NonNullable<ReturnType<typeof buildSleevelessFrontStsRowsDiagramModel>>,
): void {
  const px = svgNum(svg, "data-bust-width") / model.widths.bustStitches;
  const afterWidth = svgNum(svg, "data-after-armhole-width");
  const trueAfterWidth = svgNum(svg, "data-true-after-width");
  const upperScale = svgNum(svg, "data-upper-scale");
  const neckWidth = svgNum(svg, "data-neck-width");
  const shoulderSideWidth = svgNum(svg, "data-shoulder-side-width");
  const afterLeft = svgNum(svg, "data-after-left");
  const afterRight = svgNum(svg, "data-after-right");
  const neckLeft = svgNum(svg, "data-neck-left");
  const neckRight = svgNum(svg, "data-neck-right");
  const bustWidth = svgNum(svg, "data-bust-width");

  expect(trueAfterWidth).toBeGreaterThan(0);
  expect(Math.abs(trueAfterWidth - model.widths.stitchesAfterArmhole * px)).toBeLessThan(
    UPPER_WIDTH_TOL,
  );
  expect(Math.abs(afterWidth - trueAfterWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(upperScale).toBeCloseTo(1, 2);
  expect(
    Math.abs(
      afterWidth / bustWidth -
        model.widths.stitchesAfterArmhole / model.widths.bustStitches,
    ),
  ).toBeLessThan(0.02);
  expect(afterWidth).toBeLessThan(bustWidth);

  expect(Math.abs(shoulderSideWidth - model.widths.shoulderStitchesPerSide * px)).toBeLessThan(
    UPPER_WIDTH_TOL,
  );
  expect(Math.abs(neckWidth - (afterWidth - 2 * shoulderSideWidth))).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(neckWidth - model.widths.necklineStitches * px)).toBeLessThan(px + UPPER_WIDTH_TOL);
  expect(Math.abs(afterWidth - (shoulderSideWidth + neckWidth + shoulderSideWidth))).toBeLessThan(
    UPPER_WIDTH_TOL,
  );

  expect(Math.abs(afterRight - afterLeft - afterWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(neckRight - neckLeft - neckWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(afterRight - neckRight - shoulderSideWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(neckLeft - afterLeft - shoulderSideWidth)).toBeLessThan(UPPER_WIDTH_TOL);

  const budgetSts =
    model.widths.shoulderStitchesPerSide +
    model.widths.necklineStitches +
    model.widths.shoulderStitchesPerSide;
  expect(budgetSts).toBeGreaterThanOrEqual(model.widths.stitchesAfterArmhole - 1);
  expect(budgetSts).toBeLessThanOrEqual(model.widths.stitchesAfterArmhole);
}

function expectCardiganFrontPieceMatchesStitchBudget(
  svg: string,
  model: NonNullable<ReturnType<typeof buildSleevelessFrontStsRowsDiagramModel>>,
): void {
  const px = svgNum(svg, "data-bust-width") / model.widths.bustStitches;
  const afterWidth = svgNum(svg, "data-after-armhole-width");
  const neckWidth = svgNum(svg, "data-neck-width");
  const shoulderSideWidth = svgNum(svg, "data-shoulder-side-width");
  const bustLeft = svgNum(svg, "data-bust-left");
  const afterLeft = svgNum(svg, "data-after-left");
  const afterRight = svgNum(svg, "data-after-right");
  const neckLeft = svgNum(svg, "data-neck-left");
  const neckRight = svgNum(svg, "data-neck-right");
  const cfX = svgNum(svg, "data-cf-x");

  expect(model.frontPiece).toBe("leftFront");
  expect(Math.abs(afterWidth - model.widths.stitchesAfterArmhole * px)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(shoulderSideWidth - model.widths.shoulderStitchesPerSide * px)).toBeLessThan(
    UPPER_WIDTH_TOL,
  );
  expect(Math.abs(neckWidth - model.widths.necklineStitches * px)).toBeLessThan(px + UPPER_WIDTH_TOL);
  expect(Math.abs(afterWidth - (shoulderSideWidth + neckWidth))).toBeLessThan(UPPER_WIDTH_TOL);
  expect(afterLeft).toBeCloseTo(bustLeft, 1);
  expect(neckLeft).toBeCloseTo(bustLeft, 1);
  expect(cfX).toBeCloseTo(bustLeft, 1);
  expect(Math.abs(afterRight - afterLeft - afterWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(neckRight - neckLeft - neckWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(afterRight - neckRight - shoulderSideWidth)).toBeLessThan(UPPER_WIDTH_TOL);
}

function widthLabelSts(svg: string, measure: string): number {
  const re = new RegExp(`data-measure="${measure}"[^>]*data-sts="([^"]+)"`);
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function lengthLabelRows(svg: string, measure: string): number {
  const re = new RegExp(`data-measure="${measure}"[^>]*data-rows="([^"]+)"`);
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function measureLineX(svg: string, measure: string): number {
  const re = new RegExp(
    `<g data-role="(?:length|width)-measurement" data-measure="${measure}"[\\s\\S]*?<line x1="([^"]+)"`,
  );
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function measureLineY(svg: string, measure: string): number {
  const re = new RegExp(
    `<g data-role="(?:length|width)-measurement" data-measure="${measure}"[\\s\\S]*?<line [^>]*y1="([^"]+)"`,
  );
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function measureLineX2(svg: string, measure: string): number {
  const re = new RegExp(
    `<g data-role="(?:length|width)-measurement" data-measure="${measure}"[\\s\\S]*?<line [^>]*x2="([^"]+)"`,
  );
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function measureLineY2(svg: string, measure: string): number {
  const re = new RegExp(
    `<g data-role="(?:length|width)-measurement" data-measure="${measure}"[\\s\\S]*?<line [^>]*y2="([^"]+)"`,
  );
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function measureTextXs(svg: string, measure: string): number[] {
  const re = new RegExp(
    `<text data-role="length-measurement" data-measure="${measure}"[^>]* x="([^"]+)"`,
    "g",
  );
  return [...svg.matchAll(re)].map((m) => Number(m[1]));
}

function measureTextYs(svg: string, measure: string): number[] {
  const re = new RegExp(
    `<text data-role="length-measurement" data-measure="${measure}"[^>]* y="([^"]+)"`,
    "g",
  );
  return [...svg.matchAll(re)].map((m) => Number(m[1]));
}

function expectedInches(count: number, perInch: number): string {
  if (!(perInch > 0) || !(count > 0)) return "";
  const n = count / perInch;
  const rounded = Math.round(n);
  const text =
    Math.abs(n - rounded) < 0.05
      ? String(rounded)
      : String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  return `${text} in`;
}

function expectNormalizedSectionHeights(svg: string): void {
  const hemH = svgNum(svg, "data-visual-hem-h");
  const bodyH = svgNum(svg, "data-visual-body-h");
  const armholeH = svgNum(svg, "data-visual-armhole-h");
  const shoulderH = svgNum(svg, "data-visual-shoulder-h");
  const neckH = svgNum(svg, "data-visual-neck-h");
  const garmentH = svgNum(svg, "data-visual-garment-h");

  expect(hemH).toBeGreaterThan(0);
  expect(bodyH).toBeGreaterThan(0);
  expect(armholeH).toBeGreaterThan(0);
  expect(shoulderH).toBeGreaterThan(0);
  expect(neckH).toBeGreaterThan(0);
  expect(garmentH).toBeGreaterThan(0);

  expect(armholeH).toBeLessThan(bodyH);
  expect(armholeH / garmentH).toBeLessThanOrEqual(SLEEVELESS_FRONT_STS_ROWS_VISUAL.maxArmholeFraction);
  expect(neckH).toBeLessThan(garmentH);
}

function expectValidSvg(svg: string): void {
  expect(svg).toContain(
    `viewBox="0 0 ${SLEEVELESS_FRONT_STS_ROWS_VIEWBOX.width} ${SLEEVELESS_FRONT_STS_ROWS_VIEWBOX.height}"`,
  );
  expect(svg).toContain('width="100%"');
  expect(svg).toContain('height="auto"');
  expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(svg).toContain('data-sleeveless-front-sts-rows-generated="true"');
  expect(svg).toContain('data-supported="true"');
  expect(svg).not.toMatch(/\bNaN\b/);
  expect(svg).not.toMatch(/\bInfinity\b/);
  expect(svg).not.toMatch(/\bundefined\b/);
  expect(svg).not.toMatch(/1s-\d+r-\d+x/);
  expect(svg).not.toMatch(/\bhold\d+/);
  expect(svg).not.toMatch(/\brc\d{3}\b/i);
  expect(svg).not.toMatch(/RC:\d/);
  expect(svg).not.toContain('data-role="armhole-event"');
  expect(svg).not.toContain('data-role="neck-event"');
}

describe("buildSleevelessFrontStsRowsDiagramSvg", () => {
  it("generates a responsive SVG for supported Front V-neck", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    expectValidSvg(svg);
    expect(svg).toBe(buildSleevelessFrontStsRowsDiagramSvg(model));
    expect(svgAttr(svg, "data-piece")).toBe("front");
    expect(svgAttr(svg, "data-garment-style")).toBe("pullover");
    expect(svgAttr(svg, "data-neckline-style")).toBe("v-neck");
    expect(svgAttr(svg, "data-body-shape")).toBe("straight");
  });

  it("generates a responsive SVG for supported Front round neck", () => {
    const { svg, model } = svgFor(roundPulloverPattern());
    expectValidSvg(svg);
    expect(svg).toBe(buildSleevelessFrontStsRowsDiagramSvg(model));
    expect(svgAttr(svg, "data-neckline-style")).toBe("round");
    expect(model.neckline.style).toBe("round");
    expect(svg).toContain("C ");
    expect(svg).not.toContain('data-role="v-point"');
    expectUpperSilhouetteMatchesStitchBudget(svg, model);
  });

  it("returns null for unsupported styles", () => {
    for (const pattern of [cardiganAlinePattern(), cardiganShapedPattern(), shapedVNeckPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
      expect(tryBuildSleevelessFrontStsRowsDiagramSvg(model)).toBeNull();
    }
    expect(tryBuildSleevelessFrontStsRowsDiagramSvg(null)).toBeNull();
  });

  it("generates Cardigan Straight Round and V left-Front diagrams", () => {
    const round = svgFor(cardiganRoundPattern());
    const v = svgFor(cardiganVNeckPattern());
    expectValidSvg(round.svg);
    expectValidSvg(v.svg);
    expect(svgAttr(round.svg, "data-garment-style")).toBe("cardigan");
    expect(svgAttr(v.svg, "data-garment-style")).toBe("cardigan");
    expect(svgAttr(round.svg, "data-front-piece")).toBe("leftFront");
    expect(svgAttr(v.svg, "data-front-piece")).toBe("leftFront");
    expect(svgAttr(round.svg, "data-neckline-style")).toBe("round");
    expect(svgAttr(v.svg, "data-neckline-style")).toBe("v-neck");
    expect(svgAttr(round.svg, "data-neckline-construction")).toBe("half-front-cf");
    expect(svgAttr(v.svg, "data-neckline-construction")).toBe("half-front-cf");
    expect(round.svg).toContain("C ");
    expect(v.svg).toContain('data-role="v-point"');
    expect(round.svg).toContain('data-role="center-front-edge"');
    expect(v.svg).toContain('data-role="center-front-edge"');
    expectCardiganFrontPieceMatchesStitchBudget(round.svg, round.model);
    expectCardiganFrontPieceMatchesStitchBudget(v.svg, v.model);
  });

  it("uses one Cardigan Front piece width from live half-panel values", () => {
    for (const pattern of [cardiganRoundPattern(), cardiganVNeckPattern()]) {
      const { svg, model } = svgFor(pattern);
      const result = generateSleevelessBackPattern(pattern);
      const d = result.debug;
      const pieceNeck = cardiganFrontNeckOpeningStitches(d.necklineStitches ?? 0);
      const postArmhole = d.cardiganFrontPostArmholeSts ?? d.cardiganHalfLeftStitchesAfterArmhole ?? 0;

      expect(model.widths.hemStitches).toBe(d.cardiganHalfLeftCastOnSts);
      expect(model.widths.bustStitches).toBe(d.cardiganHalfLeftBustBodySts);
      expect(model.widths.stitchesAfterArmhole).toBe(postArmhole);
      expect(model.widths.necklineStitches).toBe(pieceNeck);
      expect(model.widths.shoulderStitchesPerSide).toBe(postArmhole - pieceNeck);
      expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
      expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
      expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
      expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
      expect(svgNum(svg, "data-hem-sts")).toBe(model.widths.hemStitches);
      expect(svgNum(svg, "data-bust-sts")).toBe(model.widths.bustStitches);
      expect(model.widths.hemStitches).toBeLessThan(Math.round(d.backStitches ?? 0));
      expect(model.frontBand?.includedInPiece).toBe(false);
      expect(svgAttr(svg, "data-front-band-included")).toBe("false");
      expect(svgAttr(svg, "data-front-band-treatment")).toBe(
        sleevelessCardiganFrontEdgeFinishingMode(pattern) ?? "",
      );
    }
  });

  it("represents the center-front edge on the left of the Cardigan Front piece", () => {
    const { svg, model } = svgFor(cardiganRoundPattern());
    const cf = pathPoints(rolePaths(svg, "center-front-edge")[0] ?? "");
    expect(cf.length).toBeGreaterThanOrEqual(2);
    expect(cf[0]!.x).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    expect(cf[cf.length - 1]!.x).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    expect(svgNum(svg, "data-cf-x")).toBeCloseTo(svgNum(svg, "data-bust-left"), 1);
    expect(svgNum(svg, "data-neck-left")).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    expect(svgNum(svg, "data-after-left")).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    expect(model.armhole.events.every((ev) => ev.side === "right")).toBe(true);
    expect(svgNum(svg, "data-bo-right")).toBeLessThan(svgNum(svg, "data-bust-right"));
    expect(svgNum(svg, "data-after-right")).toBeLessThan(svgNum(svg, "data-bo-right") + 0.01);
    expect(rolePaths(svg, "armhole-outline").length).toBe(1);
  });

  it("uses actual Cardigan Round CF bind-off and V start/depth", () => {
    const round = svgFor(cardiganRoundPattern());
    const v = svgFor(cardiganVNeckPattern());
    const roundResult = generateSleevelessBackPattern(cardiganRoundPattern());
    const vResult = generateSleevelessBackPattern(cardiganVNeckPattern());

    expect(round.model.neckline.style).toBe("round");
    if (round.model.neckline.style === "round") {
      expect(round.model.neckline.centerBindOffStitches).toBe(
        roundResult.debug.cardiganFrontInitialNeckBindOffStitches,
      );
      expect(round.model.neckline.centerBindOffStitches).not.toBe(
        roundResult.debug.frontCenterNeckBindOffStitches,
      );
    }
    expect(svgNum(round.svg, "data-neck-start-rc")).toBe(roundResult.debug.frontNecklineStartRC);
    expect(svgNum(round.svg, "data-center-bind-off-sts")).toBe(
      roundResult.debug.cardiganFrontInitialNeckBindOffStitches,
    );

    expect(v.model.neckline.style).toBe("v-neck");
    expect(svgNum(v.svg, "data-neck-start-rc")).toBe(vResult.debug.frontNecklineStartRC);
    expect(svgNum(v.svg, "data-neck-depth-rows")).toBe(Math.round(vResult.debug.frontNeckDepthRows));
    const vPoint = /data-role="v-point" data-x="([^"]+)" data-y="([^"]+)"/.exec(v.svg);
    expect(vPoint?.[1]).toBe(svgAttr(v.svg, "data-cf-x"));
    expect(Number(vPoint?.[2])).toBeCloseTo(svgNum(v.svg, "data-neck-start-y"), 1);
  });

  it("keeps Cardigan V neck labels readable without changing geometry or values", () => {
    const { svg, model } = svgFor(cardiganVReadablePattern());
    expect(model.neckline.style).toBe("v-neck");
    expect(model.widths.necklineStitches).toBe(12);
    expect(model.neckline.depthRows).toBe(24);
    expect(widthLabelSts(svg, "neck")).toBe(12);
    expect(lengthLabelRows(svg, "neck-depth")).toBe(24);
    expect(svg).toContain("12 sts");
    expect(svg).toContain("3 in");
    expect(svg).toContain("24 rows");
    expect(svg).toContain("4 in");

    expectCardiganFrontPieceMatchesStitchBudget(svg, model);
    expect(svgNum(svg, "data-neck-left")).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    const vPoint = /data-role="v-point" data-x="([^"]+)" data-y="([^"]+)"/.exec(svg);
    expect(Number(vPoint?.[1])).toBeCloseTo(svgNum(svg, "data-cf-x"), 1);
    expect(Number(vPoint?.[2])).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 1);

    const neckArrowY = measureLineY(svg, "neck");
    const neckArrowX1 = measureLineX(svg, "neck");
    const neckArrowX2 = measureLineX2(svg, "neck");
    expect(neckArrowY).toBeLessThan(svgNum(svg, "data-shoulder-top-y"));
    expect(neckArrowX1).toBeCloseTo(svgNum(svg, "data-neck-left"), 1);
    expect(neckArrowX2).toBeCloseTo(svgNum(svg, "data-neck-right"), 1);

    const neckTextXs = [
      ...svg.matchAll(/<text data-role="width-measurement" data-measure="neck"[^>]* x="([^"]+)"/g),
    ].map((m) => Number(m[1]));
    const neckTextYs = [
      ...svg.matchAll(/<text data-role="width-measurement" data-measure="neck"[^>]* y="([^"]+)"/g),
    ].map((m) => Number(m[1]));
    expect(Math.max(...neckTextXs)).toBeLessThan(svgNum(svg, "data-cf-x"));
    expect(Math.max(...neckTextYs)).toBeLessThan(neckArrowY);
    expect(Math.max(...neckTextYs)).toBeLessThan(svgNum(svg, "data-shoulder-top-y"));

    const depthArrowX = measureLineX(svg, "neck-depth");
    const depthArrowY1 = measureLineY(svg, "neck-depth");
    const depthArrowY2 = measureLineY2(svg, "neck-depth");
    expect(depthArrowX).toBeLessThan(svgNum(svg, "data-cf-x"));
    expect(depthArrowY1).toBeCloseTo(svgNum(svg, "data-neck-corner-y"), 1);
    expect(depthArrowY2).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 1);

    const depthTextXs = measureTextXs(svg, "neck-depth");
    const depthTextYs = measureTextYs(svg, "neck-depth");
    expect(Math.max(...depthTextXs)).toBeLessThan(depthArrowX - 8);
    expect(Math.max(...depthTextXs)).toBeLessThan(svgNum(svg, "data-cf-x"));
    expect(Math.min(...depthTextYs)).toBeGreaterThan(Math.max(...neckTextYs) + 16);

    const shoulderLabelY = Number(
      /<text data-role="width-measurement" data-measure="shoulder"[^>]* y="([^"]+)"/.exec(svg)?.[1],
    );
    expect(shoulderLabelY).toBeGreaterThan(svgNum(svg, "data-shoulder-y"));
    expect(Math.max(...neckTextYs)).toBeLessThan(svgNum(svg, "data-neck-corner-y"));

    const round = svgFor(cardiganRoundReadablePattern());
    expect(svgAttr(round.svg, "data-neckline-style")).toBe("round");
    expect(measureLineY(round.svg, "neck")).toBeCloseTo(112, 1);
    const roundNeckTextX = Number(
      /<text data-role="width-measurement" data-measure="neck"[^>]* x="([^"]+)"/.exec(round.svg)?.[1],
    );
    expect(roundNeckTextX).toBeCloseTo(
      (svgNum(round.svg, "data-neck-left") + svgNum(round.svg, "data-neck-right")) / 2,
      1,
    );
    expect(measureLineX(round.svg, "neck-depth")).toBeGreaterThan(svgNum(round.svg, "data-cf-x"));
    expect(measureTextXs(round.svg, "neck-depth")[0]).toBeGreaterThan(svgNum(round.svg, "data-cf-x") - 8);

    const pullover = svgFor(amandaVNeckPattern());
    expect(svgAttr(pullover.svg, "data-garment-style")).toBe("pullover");
    const pulloverNeckLabelY = Number(
      /<text data-role="width-measurement" data-measure="neck"[^>]* y="([^"]+)"/.exec(pullover.svg)?.[1],
    );
    const pulloverShoulderLabelY = Number(
      /<text data-role="width-measurement" data-measure="shoulder"[^>]* y="([^"]+)"/.exec(pullover.svg)?.[1],
    );
    expect(pulloverNeckLabelY).toBeCloseTo(99.96, 1);
    expect(pulloverShoulderLabelY).toBeGreaterThan(svgNum(pullover.svg, "data-shoulder-y"));
    expect(measureLineY(pullover.svg, "neck")).toBeGreaterThan(svgNum(pullover.svg, "data-neck-corner-y"));
    expect(measureLineY(pullover.svg, "neck")).toBeLessThan(svgNum(pullover.svg, "data-neck-start-y"));
  });

  it("generates a responsive SVG for pullover A-line V-neck and round Front", () => {
    for (const pattern of [alineVNeckPattern(), alineRoundPattern()]) {
      const { svg, model } = svgFor(pattern);
      expect(svg).toContain('data-sleeveless-front-sts-rows-generated="true"');
      expect(svgAttr(svg, "data-body-shape")).toBe("aline");
      expect(svgAttr(svg, "data-body-shaping-direction")).toBe("inward");
      expect(model.bodyShape).toBe("aline");
      expect(model.bodyShaping.direction).toBe("inward");
    }
    const v = svgFor(alineVNeckPattern());
    expect(svgAttr(v.svg, "data-neckline-style")).toBe("v-neck");
    const round = svgFor(alineRoundPattern());
    expect(svgAttr(round.svg, "data-neckline-style")).toBe("round");
    expect(round.svg).toContain("C ");
  });

  it("sizes A-line hem and bust from the actual stitch counts", () => {
    const { svg, model } = svgFor(alineVNeckPattern());
    expect(svgNum(svg, "data-hem-sts")).toBe(model.widths.hemStitches);
    expect(svgNum(svg, "data-bust-sts")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(model.widths.hemStitches).toBeGreaterThan(model.widths.bustStitches);
    expect(svgNum(svg, "data-hem-width")).toBeGreaterThan(svgNum(svg, "data-bust-width"));
    const px = svgNum(svg, "data-px-per-stitch");
    expect(Math.abs(svgNum(svg, "data-hem-width") - model.widths.hemStitches * px)).toBeLessThan(
      UPPER_WIDTH_TOL,
    );
    expect(Math.abs(svgNum(svg, "data-bust-width") - model.widths.bustStitches * px)).toBeLessThan(
      UPPER_WIDTH_TOL,
    );
  });

  it("places the A-line taper on the actual shaping RC span", () => {
    const { svg, model } = svgFor(alineVNeckPattern());
    expect(model.bodyShaping.rowNumbers.length).toBeGreaterThan(0);
    expect(svgNum(svg, "data-shape-start-rc")).toBe(model.bodyShaping.startRc);
    expect(svgNum(svg, "data-shape-end-rc")).toBe(model.bodyShaping.endRc);
    expect(model.bodyShaping.startRc).toBe(model.bodyShaping.rowNumbers[0]);
    expect(model.bodyShaping.endRc).toBe(
      model.bodyShaping.rowNumbers[model.bodyShaping.rowNumbers.length - 1],
    );
    expect(svgNum(svg, "data-shape-start-y")).toBeLessThan(svgNum(svg, "data-bottom-y"));
    expect(svgNum(svg, "data-shape-end-y")).toBeLessThan(svgNum(svg, "data-shape-start-y"));
    expect(svgNum(svg, "data-armhole-start-y")).toBeLessThanOrEqual(svgNum(svg, "data-shape-end-y"));
    expect(model.bodyShaping.endRc).toBeLessThanOrEqual(model.armhole.startGarmentRc);

    const leftBody = pathPoints(rolePaths(svg, "left-body-path")[0] ?? "");
    expect(leftBody.length).toBeGreaterThan(2);
    expect(leftBody[0]!.x).toBeCloseTo(svgNum(svg, "data-hem-left"), 2);
    expect(leftBody[leftBody.length - 1]!.x).toBeCloseTo(svgNum(svg, "data-bust-left"), 2);
  });

  it("keeps A-line upper-body width, shoulder, and neck geometry matching the equivalent Straight Front", () => {
    const straight = svgFor(shallowVNeckPattern());
    const aline = svgFor(alineVNeckPattern());
    expect(aline.model.widths.bustStitches).toBe(straight.model.widths.bustStitches);
    expect(aline.model.widths.stitchesAfterArmhole).toBe(straight.model.widths.stitchesAfterArmhole);
    expect(aline.model.widths.necklineStitches).toBe(straight.model.widths.necklineStitches);
    expect(aline.model.widths.shoulderStitchesPerSide).toBe(straight.model.widths.shoulderStitchesPerSide);
    expectUpperSilhouetteMatchesStitchBudget(aline.svg, aline.model);
    expect(svgNum(aline.svg, "data-after-armhole-width")).toBeCloseTo(
      svgNum(straight.svg, "data-after-armhole-width"),
      1,
    );
    expect(svgNum(aline.svg, "data-neck-width")).toBeCloseTo(svgNum(straight.svg, "data-neck-width"), 1);
    expect(svgNum(aline.svg, "data-shoulder-side-width")).toBeCloseTo(
      svgNum(straight.svg, "data-shoulder-side-width"),
      1,
    );
    expect(svgNum(aline.svg, "data-upper-scale")).toBeCloseTo(1, 2);
  });

  it("keeps A-line stitch and row labels true after visual scaling", () => {
    const { svg, model } = svgFor(alineVNeckPattern());
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(lengthLabelRows(svg, "hem")).toBe(model.rows.hemRows);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(svg).toContain(expectedInches(model.widths.hemStitches, model.widths.stitchesPerInch));
    expect(svg).toContain(expectedInches(model.widths.bustStitches, model.widths.stitchesPerInch));
    expect(svg).toContain(expectedInches(model.rows.expectedGarmentRows, model.rows.rowsPerInch));
  });

  it("generates an outward A-line Front when hem stitches are narrower than bust", () => {
    for (const pattern of [alineOutwardVNeckPattern(), inferredOutwardVNeckPattern()]) {
      const { svg, model } = svgFor(pattern);
      expect(svg).toContain('data-sleeveless-front-sts-rows-generated="true"');
      expect(svgAttr(svg, "data-body-shape")).toBe("aline");
      expect(svgAttr(svg, "data-body-shaping-direction")).toBe("outward");
      expect(model.bodyShape).toBe("aline");
      expect(model.bodyShaping.direction).toBe("outward");
      expect(model.widths.hemStitches).toBeLessThan(model.widths.bustStitches);
      expect(svgNum(svg, "data-hem-sts")).toBe(model.widths.hemStitches);
      expect(svgNum(svg, "data-bust-sts")).toBe(model.widths.bustStitches);
      expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
      expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
      expect(svgNum(svg, "data-hem-width")).toBeLessThan(svgNum(svg, "data-bust-width"));
      expect(svgNum(svg, "data-hem-left")).toBeGreaterThan(svgNum(svg, "data-bust-left"));
    }
  });

  it("slopes outward A-line Front through the actual shaping RC span", () => {
    const { svg, model } = svgFor(alineOutwardVNeckPattern());
    expect(model.bodyShaping.rowNumbers.length).toBeGreaterThan(0);
    expect(svgNum(svg, "data-shape-start-rc")).toBe(model.bodyShaping.startRc);
    expect(svgNum(svg, "data-shape-end-rc")).toBe(model.bodyShaping.endRc);
    expect(svgNum(svg, "data-shape-start-y")).toBeLessThan(svgNum(svg, "data-bottom-y"));
    expect(svgNum(svg, "data-shape-end-y")).toBeLessThan(svgNum(svg, "data-shape-start-y"));
    expect(svgNum(svg, "data-armhole-start-y")).toBeLessThanOrEqual(svgNum(svg, "data-shape-end-y"));
    expect(model.bodyShaping.endRc).toBeLessThanOrEqual(model.armhole.startGarmentRc);

    const leftBody = pathPoints(rolePaths(svg, "left-body-path")[0] ?? "");
    expect(leftBody.length).toBeGreaterThan(2);
    expect(leftBody[0]!.x).toBeCloseTo(svgNum(svg, "data-hem-left"), 2);
    expect(leftBody[leftBody.length - 1]!.x).toBeCloseTo(svgNum(svg, "data-bust-left"), 2);
    expect(leftBody[0]!.x).toBeGreaterThan(leftBody[leftBody.length - 1]!.x);
    expect(leftBody[leftBody.length - 1]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
  });

  it("keeps outward A-line Front upper-body geometry matching the equivalent Straight Front", () => {
    const straight = svgFor(shallowVNeckPattern());
    const aline = svgFor(alineOutwardVNeckPattern());
    expect(aline.model.widths.bustStitches).toBe(straight.model.widths.bustStitches);
    expect(aline.model.widths.stitchesAfterArmhole).toBe(straight.model.widths.stitchesAfterArmhole);
    expect(aline.model.widths.necklineStitches).toBe(straight.model.widths.necklineStitches);
    expect(aline.model.widths.shoulderStitchesPerSide).toBe(straight.model.widths.shoulderStitchesPerSide);
    expectUpperSilhouetteMatchesStitchBudget(aline.svg, aline.model);
    expect(svgNum(aline.svg, "data-after-armhole-width")).toBeCloseTo(
      svgNum(straight.svg, "data-after-armhole-width"),
      1,
    );
    expect(svgNum(aline.svg, "data-neck-width")).toBeCloseTo(svgNum(straight.svg, "data-neck-width"), 1);
    expect(svgNum(aline.svg, "data-shoulder-side-width")).toBeCloseTo(
      svgNum(straight.svg, "data-shoulder-side-width"),
      1,
    );
    expect(svgNum(aline.svg, "data-upper-scale")).toBeCloseTo(1, 2);
  });

  it("keeps outward A-line Front stitch and row labels true", () => {
    const { svg, model } = svgFor(alineOutwardVNeckPattern());
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(lengthLabelRows(svg, "hem")).toBe(model.rows.hemRows);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(svg).toContain(expectedInches(model.widths.hemStitches, model.widths.stitchesPerInch));
    expect(svg).toContain(expectedInches(model.widths.bustStitches, model.widths.stitchesPerInch));
  });

  it("maps garment widths from model stitch counts", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    expect(svgNum(svg, "data-hem-sts")).toBe(model.widths.hemStitches);
    expect(svgNum(svg, "data-bust-sts")).toBe(model.widths.bustStitches);
    expect(svgNum(svg, "data-neck-sts")).toBe(model.widths.necklineStitches);
    expect(svgNum(svg, "data-after-armhole-sts")).toBe(model.widths.stitchesAfterArmhole);
    expect(svgNum(svg, "data-shoulder-sts")).toBe(model.widths.shoulderStitchesPerSide);

    expect(svgNum(svg, "data-hem-width")).toBeCloseTo(svgNum(svg, "data-bust-width"), 2);
    expect(svgNum(svg, "data-hem-right") - svgNum(svg, "data-hem-left")).toBeCloseTo(
      svgNum(svg, "data-hem-width"),
      2,
    );
    expect(svgNum(svg, "data-bust-right") - svgNum(svg, "data-bust-left")).toBeCloseTo(
      svgNum(svg, "data-bust-width"),
      2,
    );
    expect(
      Math.abs(
        svgNum(svg, "data-neck-right") - svgNum(svg, "data-neck-left") - svgNum(svg, "data-neck-width"),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);
    expect(
      Math.abs(
        svgNum(svg, "data-after-right") -
          svgNum(svg, "data-after-left") -
          svgNum(svg, "data-after-armhole-width"),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);

    const px = svgNum(svg, "data-bust-width") / model.widths.bustStitches;
    expect(svgNum(svg, "data-true-after-width") / model.widths.stitchesAfterArmhole).toBeCloseTo(
      px,
      1,
    );
    expect(svgNum(svg, "data-after-armhole-width")).toBeGreaterThanOrEqual(
      svgNum(svg, "data-true-after-width") - UPPER_WIDTH_TOL,
    );
    expect(svgNum(svg, "data-neck-width")).toBeLessThan(svgNum(svg, "data-after-armhole-width"));
    expect(svgNum(svg, "data-after-armhole-width")).toBeLessThan(svgNum(svg, "data-bust-width"));
    expect(
      Math.abs(
        svgNum(svg, "data-shoulder-side-width") -
          (svgNum(svg, "data-after-right") - svgNum(svg, "data-neck-right")),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);
  });

  it("places hem / body / armhole / neck / shoulder Y from model rows", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    const bottomY = svgNum(svg, "data-bottom-y");
    const hemY = svgNum(svg, "data-hem-y");
    const armholeStartY = svgNum(svg, "data-armhole-start-y");
    const lastArmholeY = svgNum(svg, "data-last-armhole-y");
    const neckStartY = svgNum(svg, "data-neck-start-y");
    const shoulderY = svgNum(svg, "data-shoulder-y");
    const neckCornerY = svgNum(svg, "data-neck-corner-y");

    expect(hemY).toBeLessThan(bottomY);
    expect(armholeStartY).toBeLessThan(hemY);
    expect(lastArmholeY).toBeLessThan(armholeStartY);
    expect(shoulderY).toBeLessThanOrEqual(lastArmholeY);
    expect(neckCornerY).toBeLessThanOrEqual(shoulderY);
    expect(neckStartY).toBeGreaterThan(neckCornerY);

    expect(svgNum(svg, "data-hem-rows")).toBe(model.rows.hemRows);
    expect(svgNum(svg, "data-armhole-rows")).toBe(model.rows.armholeRows);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(model.neckline.depthRows);
    expect(svgNum(svg, "data-total-rows")).toBe(model.rows.expectedGarmentRows);
    expect(svgNum(svg, "data-armhole-start-rc")).toBe(model.armhole.startGarmentRc);
    expect(svgNum(svg, "data-neck-start-rc")).toBe(model.neckline.startGarmentRc);
    expect(svgNum(svg, "data-shoulder-start-rc")).toBe(model.shoulder.startGarmentRc);
  });

  it("keeps armhole chronology bottom-up: BO, then decreases, then post-armhole width", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    const armholes = rolePaths(svg, "armhole-outline");
    expect(armholes).toHaveLength(2);
    const right = pathPoints(armholes[1]!);
    expect(right).toHaveLength(4);
    expect(right[0]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
    expect(right[1]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
    expect(right[1]!.x).toBeCloseTo(svgNum(svg, "data-bo-right"), 2);
    expect(right[2]!.y).toBeCloseTo(svgNum(svg, "data-last-armhole-y"), 2);
    expect(right[2]!.x).toBeCloseTo(svgNum(svg, "data-after-right"), 2);
    expect(right[3]!.y).toBeCloseTo(svgNum(svg, "data-shoulder-y"), 2);

    expect(svgNum(svg, "data-bind-off-rc")).toBe(model.armhole.startGarmentRc);
    expect(svgNum(svg, "data-first-decrease-y")).toBeLessThan(svgNum(svg, "data-armhole-start-y"));
    expect(svgNum(svg, "data-bo-right")).toBeLessThan(svgNum(svg, "data-bust-right"));
    expect(svgNum(svg, "data-after-right")).toBeLessThanOrEqual(svgNum(svg, "data-bo-right"));
    expect(svgNum(svg, "data-last-armhole-y")).toBeLessThan(svgNum(svg, "data-armhole-start-y"));
  });

  it("draws a clean two-point shoulder slope whose endpoints match the model widths", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    const shoulders = rolePaths(svg, "shoulder-outline");
    expect(shoulders).toHaveLength(2);
    const right = pathPoints(shoulders[1]!);
    expect(right).toHaveLength(2);
    expect(right[0]!.x).toBeCloseTo(svgNum(svg, "data-after-right"), 2);
    expect(right[0]!.y).toBeCloseTo(svgNum(svg, "data-shoulder-y"), 2);
    expect(right[1]!.x).toBeCloseTo(svgNum(svg, "data-neck-right"), 2);
    expect(right[1]!.y).toBeCloseTo(svgNum(svg, "data-neck-corner-y"), 2);
    expect(svgAttr(svg, "data-shoulder-contour")).toBe("slope");
    expect(svgNum(svg, "data-shoulder-point-count")).toBe(model.shoulder.points.length);
    expect(svgNum(svg, "data-shoulder-sts")).toBe(model.shoulder.stitchesPerSide);
  });

  it("draws a centered V whose width and depth come from the model", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    const neck = pathPoints(rolePaths(svg, "neckline-outline")[0]!);
    expect(neck).toHaveLength(3);
    const cx = svgNum(svg, "data-cx");
    expect(neck[1]!.x).toBeCloseTo(cx, 2);
    expect(Math.abs(neck[0]!.x - (cx - svgNum(svg, "data-neck-width") / 2))).toBeLessThan(
      UPPER_WIDTH_TOL,
    );
    expect(Math.abs(neck[2]!.x - (cx + svgNum(svg, "data-neck-width") / 2))).toBeLessThan(
      UPPER_WIDTH_TOL,
    );
    expect(neck[1]!.y).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 2);
    expect(Math.abs(neck[0]!.x - cx)).toBeCloseTo(Math.abs(neck[2]!.x - cx), 2);
    expect(svgNum(svg, "data-neck-sts")).toBe(model.neckline.necklineStitches);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(model.neckline.depthRows);
    expect(svgNum(svg, "data-neck-start-rc")).toBe(model.neckline.startGarmentRc);
  });

  it("changes V geometry for shallow, Amanda overlap, and deep-before-armhole fixtures", () => {
    const shallow = svgFor(shallowVNeckPattern());
    const amanda = svgFor(amandaVNeckPattern());
    const deep = svgFor(vNeckBeforeArmholePattern());

    expectValidSvg(shallow.svg);
    expectValidSvg(amanda.svg);
    expectValidSvg(deep.svg);

    const shallowDepth = svgNum(shallow.svg, "data-neck-start-y") - svgNum(shallow.svg, "data-neck-corner-y");
    const amandaDepth = svgNum(amanda.svg, "data-neck-start-y") - svgNum(amanda.svg, "data-neck-corner-y");
    const deepDepth = svgNum(deep.svg, "data-neck-start-y") - svgNum(deep.svg, "data-neck-corner-y");

    expect(amanda.model.neckline.depthRows).toBeGreaterThan(shallow.model.neckline.depthRows);
    expect(deep.model.neckline.depthRows).toBeGreaterThan(amanda.model.neckline.depthRows);
    expect(amandaDepth).toBeGreaterThan(shallowDepth);
    expect(deepDepth).toBeGreaterThan(amandaDepth);

    expect(svgNum(deep.svg, "data-neck-start-y")).toBeGreaterThan(
      svgNum(deep.svg, "data-armhole-start-y"),
    );
    expect(deep.model.neckline.style).toBe("v-neck");
    if (deep.model.neckline.style === "v-neck") {
      expect(deep.model.neckline.beginsBeforeArmhole).toBe(true);
    }
    expect(svgNum(amanda.svg, "data-neck-start-rc")).not.toBe(svgNum(shallow.svg, "data-neck-start-rc"));
    expect(svgNum(deep.svg, "data-cx")).toBeCloseTo(
      (svgNum(deep.svg, "data-neck-left") + svgNum(deep.svg, "data-neck-right")) / 2,
      2,
    );
  });

  it("shows customer-facing width labels from the model", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    expect(svg).toContain(`data-measure="cast-on"`);
    expect(svg).toContain(`data-measure="bust"`);
    expect(svg).toContain(`data-measure="neck"`);
    expect(svg).toContain(`data-measure="shoulder"`);
    expect(svg).toContain(`${model.widths.hemStitches} sts`);
    expect(svg).toContain(`${model.widths.bustStitches} sts`);
    expect(svg).toContain(`${model.widths.necklineStitches} sts`);
    expect(svg).toContain(`${model.widths.shoulderStitchesPerSide} sts`);
    expect(svg).toMatch(new RegExp(`data-measure="cast-on"[^>]*data-sts="${model.widths.hemStitches}"`));
    expect(svg).toMatch(new RegExp(`data-measure="bust"[^>]*data-sts="${model.widths.bustStitches}"`));
    expect(svg).toMatch(new RegExp(`data-measure="neck"[^>]*data-sts="${model.widths.necklineStitches}"`));
    expect(svg).toMatch(
      new RegExp(`data-measure="shoulder"[^>]*data-sts="${model.widths.shoulderStitchesPerSide}"`),
    );
  });

  it("shows customer-facing length labels from the model", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    expect(svg).toContain(`data-measure="garment-length"`);
    expect(svg).toContain(`data-measure="body-length"`);
    expect(svg).toContain(`data-measure="armhole"`);
    expect(svg).toContain(`data-measure="neck-depth"`);
    expect(svg).toContain(`${model.rows.expectedGarmentRows} rows`);
    expect(svg).toContain(`${model.rows.rowsFromCastOnToArmholeStart} rows`);
    expect(svg).toContain(`${model.rows.armholeRows} rows`);
    expect(svg).toContain(`${model.neckline.depthRows} rows`);
    expect(svg).toContain(`${model.rows.hemRows} rows`);
    expect(svgNum(svg, "data-body-length-rows")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(svgNum(svg, "data-armhole-rows")).toBe(model.rows.armholeRows);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(model.rows.frontNeckDepthRows);
    expect(svgNum(svg, "data-total-rows")).toBe(model.rows.expectedGarmentRows);
  });

  it("does not show debug RC chronology or Japanese notation", () => {
    const { svg } = svgFor(amandaVNeckPattern());
    expect(svg).toContain('data-role="width-measurement"');
    expect(svg).toContain('data-role="length-measurement"');
    expect(svg).toContain('data-role="body-outline"');
    expect(svg).toContain('data-role="armhole-outline"');
    expect(svg).toContain('data-role="neckline-outline"');
    expect(svg).toContain('data-role="shoulder-outline"');
    expect(svg).not.toContain("jp-");
    expect(svg).not.toMatch(/\bco\d+\b/);
    expect(svg).not.toMatch(/begins before armhole/i);
    expect(svg).not.toContain("data-role=\"armhole-start-guide\"");
    expect(svg).not.toContain("data-role=\"neck-start-guide\"");
  });

  it("reconciles upper silhouette width with the post-armhole stitch budget on every fixture", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()]) {
      const { svg, model } = svgFor(pattern);
      expectUpperSilhouetteMatchesStitchBudget(svg, model);
    }
  });

  it("keeps Shallow V upper chest at the canonical post-armhole width", () => {
    const { svg, model } = svgFor(shallowVNeckPattern());
    expectUpperSilhouetteMatchesStitchBudget(svg, model);
    const px = svgNum(svg, "data-bust-width") / model.widths.bustStitches;
    expect(svgNum(svg, "data-after-armhole-width")).not.toBeLessThan(
      model.widths.stitchesAfterArmhole * px - UPPER_WIDTH_TOL,
    );
    expect(svgNum(svg, "data-shoulder-sts")).toBe(model.widths.shoulderStitchesPerSide);
    expect(
      Math.abs(
        svgNum(svg, "data-shoulder-side-width") -
          model.widths.shoulderStitchesPerSide * px * svgNum(svg, "data-upper-scale"),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);
  });

  it("keeps Amanda overlap on neckline chronology only; upper stitch budget is unchanged", () => {
    const shallow = svgFor(shallowVNeckPattern());
    const amanda = svgFor(amandaVNeckPattern());
    expect(amanda.model.armhole.overlapsNeckline).toBe(true);
    expect(svgNum(amanda.svg, "data-neck-start-rc")).not.toBe(svgNum(shallow.svg, "data-neck-start-rc"));
    expect(svgNum(amanda.svg, "data-neck-start-y")).not.toBeCloseTo(
      svgNum(shallow.svg, "data-neck-start-y"),
      1,
    );

    expect(amanda.model.widths.stitchesAfterArmhole).toBe(shallow.model.widths.stitchesAfterArmhole);
    expect(amanda.model.widths.necklineStitches).toBe(shallow.model.widths.necklineStitches);
    expect(amanda.model.widths.shoulderStitchesPerSide).toBe(shallow.model.widths.shoulderStitchesPerSide);
    expectUpperSilhouetteMatchesStitchBudget(amanda.svg, amanda.model);
    expect(
      Math.abs(
        svgNum(amanda.svg, "data-after-armhole-width") - svgNum(shallow.svg, "data-after-armhole-width"),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);
    expect(
      Math.abs(svgNum(amanda.svg, "data-neck-width") - svgNum(shallow.svg, "data-neck-width")),
    ).toBeLessThan(UPPER_WIDTH_TOL);
    expect(
      Math.abs(
        svgNum(amanda.svg, "data-shoulder-side-width") - svgNum(shallow.svg, "data-shoulder-side-width"),
      ),
    ).toBeLessThan(UPPER_WIDTH_TOL);
  });

  it("does not let V-neck depth change post-armhole or cross-shoulder visual width", () => {
    const shallow = svgFor(shallowVNeckPattern());
    const amanda = svgFor(amandaVNeckPattern());
    const deep = svgFor(vNeckBeforeArmholePattern());

    expect(amanda.model.neckline.depthRows).toBeGreaterThan(shallow.model.neckline.depthRows);
    expect(deep.model.neckline.depthRows).toBeGreaterThan(amanda.model.neckline.depthRows);

    expect(svgNum(shallow.svg, "data-upper-scale")).toBeCloseTo(1, 2);
    expect(svgNum(amanda.svg, "data-upper-scale")).toBeCloseTo(1, 2);
    expect(svgNum(deep.svg, "data-upper-scale")).toBeCloseTo(1, 2);

    expect(shallow.model.widths.stitchesAfterArmhole).toBe(amanda.model.widths.stitchesAfterArmhole);
    expect(svgNum(shallow.svg, "data-after-armhole-width")).toBeCloseTo(
      svgNum(amanda.svg, "data-after-armhole-width"),
      1,
    );
    expect(svgNum(shallow.svg, "data-shoulder-side-width")).toBeCloseTo(
      svgNum(amanda.svg, "data-shoulder-side-width"),
      1,
    );
    expect(svgNum(shallow.svg, "data-neck-width")).toBeCloseTo(svgNum(amanda.svg, "data-neck-width"), 1);

    for (const { svg, model } of [shallow, amanda, deep]) {
      expect(
        Math.abs(
          svgNum(svg, "data-after-armhole-width") / svgNum(svg, "data-bust-width") -
            model.widths.stitchesAfterArmhole / model.widths.bustStitches,
        ),
      ).toBeLessThan(0.02);
    }
  });

  it("lets a Deep V wider remaining upper budget widen the shoulders instead of collapsing", () => {
    const amanda = svgFor(amandaVNeckPattern());
    const deep = svgFor(vNeckBeforeArmholePattern());
    expectUpperSilhouetteMatchesStitchBudget(deep.svg, deep.model);

    expect(deep.model.widths.stitchesAfterArmhole).toBeGreaterThan(
      amanda.model.widths.stitchesAfterArmhole,
    );
    expect(svgNum(deep.svg, "data-after-armhole-width")).toBeGreaterThan(
      svgNum(amanda.svg, "data-after-armhole-width"),
    );
    expect(svgNum(deep.svg, "data-shoulder-side-width")).toBeGreaterThan(
      svgNum(amanda.svg, "data-shoulder-side-width"),
    );
    expect(svgNum(deep.svg, "data-after-armhole-width") / svgNum(deep.svg, "data-bust-width")).toBeGreaterThan(
      svgNum(amanda.svg, "data-after-armhole-width") / svgNum(amanda.svg, "data-bust-width"),
    );
    expect(
      svgNum(deep.svg, "data-neck-width") / svgNum(deep.svg, "data-after-armhole-width"),
    ).toBeCloseTo(deep.model.widths.necklineStitches / deep.model.widths.stitchesAfterArmhole, 2);
  });

  it("preserves customer-facing width and length measurement labels", () => {
    const { svg, model } = svgFor(amandaVNeckPattern());
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
    expect(svg).toContain(`${model.widths.hemStitches} sts`);
    expect(svg).toContain(`${model.widths.bustStitches} sts`);
    expect(svg).toContain(`${model.widths.necklineStitches} sts`);
    expect(svg).toContain(`${model.widths.shoulderStitchesPerSide} sts`);

    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(lengthLabelRows(svg, "neck-depth")).toBe(model.neckline.depthRows);
    expect(svg).toContain(`${model.rows.expectedGarmentRows} rows`);
    expect(svg).toContain(`${model.rows.rowsFromCastOnToArmholeStart} rows`);
    expect(svg).toContain(`${model.rows.armholeRows} rows`);
    expect(svg).toContain(`${model.neckline.depthRows} rows`);
    expect(svg).toContain(`${model.rows.hemRows} rows`);
  });

  it("gives every section a readable visual height and keeps the armhole from dominating", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()]) {
      const { svg } = svgFor(pattern);
      expectNormalizedSectionHeights(svg);
    }
  });

  it("keeps Shallow V neck visibly shallower than the armhole without stretching the upper body", () => {
    const { svg, model } = svgFor(shallowVNeckPattern());
    expectNormalizedSectionHeights(svg);
    expect(svgNum(svg, "data-visual-neck-h")).toBeLessThan(svgNum(svg, "data-visual-armhole-h"));
    expect(model.neckline.depthRows).toBeLessThan(model.rows.armholeRows);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(model.neckline.depthRows);
    expect(svgNum(svg, "data-armhole-rows")).toBe(model.rows.armholeRows);
  });

  it("keeps Amanda overlap readable without stretching the upper section", () => {
    const shallow = svgFor(shallowVNeckPattern());
    const amanda = svgFor(amandaVNeckPattern());
    expectNormalizedSectionHeights(amanda.svg);
    expect(amanda.model.armhole.overlapsNeckline).toBe(true);
    expect(svgNum(amanda.svg, "data-visual-neck-h")).toBeGreaterThan(
      svgNum(shallow.svg, "data-visual-neck-h"),
    );
    expect(svgNum(amanda.svg, "data-visual-armhole-h")).toBeLessThan(
      svgNum(amanda.svg, "data-visual-body-h"),
    );
    expect(svgNum(amanda.svg, "data-neck-start-rc")).not.toBe(svgNum(shallow.svg, "data-neck-start-rc"));
  });

  it("keeps Deep V visibly deeper and starting before the armhole without unbalancing the silhouette", () => {
    const amanda = svgFor(amandaVNeckPattern());
    const deep = svgFor(vNeckBeforeArmholePattern());
    expectNormalizedSectionHeights(deep.svg);
    expect(deep.model.neckline.style).toBe("v-neck");
    if (deep.model.neckline.style === "v-neck") {
      expect(deep.model.neckline.beginsBeforeArmhole).toBe(true);
    }
    expect(svgNum(deep.svg, "data-neck-start-y")).toBeGreaterThan(svgNum(deep.svg, "data-armhole-start-y"));
    expect(svgNum(deep.svg, "data-visual-neck-h")).toBeGreaterThan(svgNum(amanda.svg, "data-visual-neck-h"));
    expect(svgNum(deep.svg, "data-visual-armhole-h")).toBeLessThan(svgNum(deep.svg, "data-visual-body-h"));
  });

  it("preserves stitch, row, and inch measurement values after visual scaling", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()]) {
      const { svg, model } = svgFor(pattern);
      expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
      expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
      expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
      expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
      expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
      expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
      expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
      expect(lengthLabelRows(svg, "neck-depth")).toBe(model.neckline.depthRows);

      const spi = model.widths.stitchesPerInch;
      const rpi = model.rows.rowsPerInch;
      expect(svg).toContain(expectedInches(model.widths.bustStitches, spi));
      expect(svg).toContain(expectedInches(model.widths.hemStitches, spi));
      expect(svg).toContain(expectedInches(model.widths.necklineStitches, spi));
      expect(svg).toContain(expectedInches(model.widths.shoulderStitchesPerSide, spi));
      expect(svg).toContain(expectedInches(model.rows.expectedGarmentRows, rpi));
      expect(svg).toContain(expectedInches(model.rows.armholeRows, rpi));
      expect(svg).toContain(expectedInches(model.neckline.depthRows, rpi));
    }
  });

  it("does not change garment widths when vertical bands are normalized", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()]) {
      const { svg, model } = svgFor(pattern);
      expectUpperSilhouetteMatchesStitchBudget(svg, model);
      expect(svgNum(svg, "data-bust-width")).toBeGreaterThan(svgNum(svg, "data-after-armhole-width"));
      expect(svgNum(svg, "data-after-armhole-width")).toBeGreaterThan(svgNum(svg, "data-neck-width"));
      expect(svgNum(svg, "data-hem-sts")).toBe(model.widths.hemStitches);
      expect(svgNum(svg, "data-bust-sts")).toBe(model.widths.bustStitches);
      expect(svgNum(svg, "data-after-armhole-sts")).toBe(model.widths.stitchesAfterArmhole);
      expect(svgNum(svg, "data-neck-sts")).toBe(model.widths.necklineStitches);
      expect(svgNum(svg, "data-shoulder-sts")).toBe(model.widths.shoulderStitchesPerSide);
    }
  });

  it("uses larger measurement type and keeps neck / shoulder labels apart", () => {
    const { svg } = svgFor(amandaVNeckPattern());
    expect(svg).toContain('font-size="17"');
    expect(svg).toContain('font-size="14"');
    expect(svg).not.toContain('font-size="13"');
    expect(svg).not.toContain('font-size="11"');
    expect(svg).not.toMatch(/1s-\d+r-\d+x/);
    expect(svg).not.toContain("jp-");

    const neckLabelY = Number(
      /<text data-role="width-measurement" data-measure="neck"[^>]* y="([^"]+)"/.exec(svg)?.[1],
    );
    const shoulderLabelY = Number(
      /<text data-role="width-measurement" data-measure="shoulder"[^>]* y="([^"]+)"/.exec(svg)?.[1],
    );
    expect(neckLabelY).toBeLessThan(svgNum(svg, "data-neck-corner-y"));
    expect(shoulderLabelY).toBeGreaterThan(svgNum(svg, "data-shoulder-y"));
    expect(shoulderLabelY - neckLabelY).toBeGreaterThan(28);
  });

  it("keeps the left total-rows line close to the body without colliding with hem labels", () => {
    for (const pattern of [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()]) {
      const { svg } = svgFor(pattern);
      const bustLeft = svgNum(svg, "data-bust-left");
      const totalLineX = measureLineX(svg, "garment-length");
      const hemLineX = measureLineX(svg, "hem");
      const totalTextXs = measureTextXs(svg, "garment-length");
      const hemTextXs = measureTextXs(svg, "hem");
      const totalTextYs = measureTextYs(svg, "garment-length");
      const hemTextYs = measureTextYs(svg, "hem");

      expect(bustLeft).toBeGreaterThanOrEqual(90);
      expect(totalLineX).toBeGreaterThan(totalTextXs[0]!);
      expect(bustLeft - totalLineX).toBeLessThanOrEqual(26);
      expect(bustLeft - totalLineX).toBeGreaterThanOrEqual(10);
      expect(hemLineX).toBeGreaterThan(totalLineX);
      expect(hemLineX).toBeLessThan(bustLeft);
      expect(Math.max(...hemTextXs)).toBeLessThan(totalLineX - 8);

      expect(hemTextYs.length).toBeGreaterThanOrEqual(2);
      expect(Math.abs(hemTextYs[1]! - hemTextYs[0]!)).toBeGreaterThanOrEqual(20);

      const totalBottom = Math.max(...totalTextYs) + 8;
      const hemTop = Math.min(...hemTextYs) - 8;
      expect(hemTop).toBeGreaterThan(totalBottom);
    }
  });

  it("keeps the same upper width when only round-neck depth changes", () => {
    const typical = svgFor(sameSizeRoundPattern(3));
    const shallow = svgFor(sameSizeRoundPattern(2));
    expect(typical.model.neckline.style).toBe("round");
    expect(shallow.model.neckline.style).toBe("round");
    expect(typical.model.widths.bustStitches).toBe(shallow.model.widths.bustStitches);
    expect(typical.model.widths.stitchesAfterArmhole).toBe(shallow.model.widths.stitchesAfterArmhole);
    expect(typical.model.widths.shoulderStitchesPerSide).toBe(shallow.model.widths.shoulderStitchesPerSide);
    expect(typical.model.widths.necklineStitches).toBe(shallow.model.widths.necklineStitches);
    expect(typical.model.neckline.depthRows).not.toBe(shallow.model.neckline.depthRows);
    expectUpperSilhouetteMatchesStitchBudget(typical.svg, typical.model);
    expectUpperSilhouetteMatchesStitchBudget(shallow.svg, shallow.model);
    expect(svgNum(typical.svg, "data-bust-width")).toBeCloseTo(svgNum(shallow.svg, "data-bust-width"), 1);
    expect(svgNum(typical.svg, "data-after-armhole-width")).toBeCloseTo(
      svgNum(shallow.svg, "data-after-armhole-width"),
      1,
    );
    expect(svgNum(typical.svg, "data-neck-width")).toBeCloseTo(svgNum(shallow.svg, "data-neck-width"), 1);
    expect(svgNum(typical.svg, "data-shoulder-side-width")).toBeCloseTo(
      svgNum(shallow.svg, "data-shoulder-side-width"),
      1,
    );
  });
});

describe("live Pullover V-neck Front Stitches & Rows cutover", () => {
  it("uses the generated SVG for supported pullover V-neck straight Front", () => {
    const cases = [shallowVNeckPattern(), amandaVNeckPattern(), vNeckBeforeArmholePattern()];
    for (const pattern of cases) {
      const result = generateSleevelessBackPattern(pattern);
      const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
      const live = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);

      expect(model).not.toBeNull();
      expect(live).toBeTruthy();
      expect(live).toContain('data-sleeveless-front-sts-rows-generated="true"');
      expect(live).toContain('data-supported="true"');
      expect(live).toBe(tryBuildSleevelessFrontStsRowsDiagramSvg(model));
      expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toBe(
        SLEEVELESS_PULLOVER_V_FRONT_DIAGRAM_SRC,
      );
    }
  });

  it("uses the generated SVG for supported pullover round-neck straight Front", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const live = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
    expect(live).toBeTruthy();
    expect(live).toContain('data-neckline-style="round"');
    expect(live).toContain('data-sleeveless-front-sts-rows-generated="true"');
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", pattern)).toContain("diagram-front-round");
  });

  it("uses the generated SVG for supported pullover A-line Front", () => {
    for (const pattern of [alineVNeckPattern(), alineRoundPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
      const live = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
      expect(model).not.toBeNull();
      expect(live).toBeTruthy();
      expect(live).toContain('data-body-shape="aline"');
      expect(live).toBe(tryBuildSleevelessFrontStsRowsDiagramSvg(model));
    }
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", alineVNeckPattern())).toContain(
      "diagram-front-v-aline",
    );
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", alineRoundPattern())).toContain(
      "diagram-front-round-aline",
    );
  });

  it("uses the generated SVG for both A-line Front directions", () => {
    for (const pattern of [alineVNeckPattern(), alineOutwardVNeckPattern(), inferredOutwardVNeckPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const live = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
      expect(live).toBeTruthy();
      expect(live).toContain('data-body-shape="aline"');
      expect(live).toContain("data-body-shaping-direction=");
    }
  });

  it("uses the generated SVG for supported Cardigan Straight Front", () => {
    for (const pattern of [cardiganRoundPattern(), cardiganVNeckPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
      const live = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
      expect(model).not.toBeNull();
      expect(live).toBeTruthy();
      expect(live).toContain('data-garment-style="cardigan"');
      expect(live).toContain('data-front-piece="leftFront"');
      expect(live).toBe(tryBuildSleevelessFrontStsRowsDiagramSvg(model));
    }
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", cardiganRoundPattern())).toBe(
      SLEEVELESS_CARDIGAN_FULL_FRONT_ROUND_DIAGRAM_SRC,
    );
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", cardiganVNeckPattern())).toBe(
      SLEEVELESS_CARDIGAN_FULL_FRONT_V_DIAGRAM_SRC,
    );
  });

  it("returns null so unsupported Front cases keep the existing SVG fallback", () => {
    const shaped = shapedVNeckPattern();
    const shapedResult = generateSleevelessBackPattern(shaped);
    expect(tryBuildLiveSleevelessFrontStsRowsDiagramSvg(shapedResult, shaped)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", shaped)).toContain("diagram-front-v-shaped");

    const cardiganAline = cardiganAlinePattern();
    const cardiganAlineResult = generateSleevelessBackPattern(cardiganAline);
    expect(tryBuildLiveSleevelessFrontStsRowsDiagramSvg(cardiganAlineResult, cardiganAline)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", cardiganAline)).toContain(
      "diagram-cardigan-v-aline",
    );

    const cardiganShaped = cardiganShapedPattern();
    const cardiganShapedResult = generateSleevelessBackPattern(cardiganShaped);
    expect(tryBuildLiveSleevelessFrontStsRowsDiagramSvg(cardiganShapedResult, cardiganShaped)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("sts-rows", cardiganShaped)).toContain(
      "diagram-cardigan-round-shaped",
    );
  });

  it("does not claim Back or Shaping Notation diagrams", () => {
    const pattern = amandaVNeckPattern();
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pattern)).toContain("diagram-back");
    expect(resolveSleevelessBackDiagramSrc("shaping-notation", pattern)).toContain("diagram-jp-back");
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toContain("diagram-jp-front-v");
  });

  it("keeps the old Front Illustrator assets in the repo for fallback", () => {
    expect(
      existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-front-round.svg")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-front-v.svg")),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-front-v-aline.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-front-round-aline.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-front-v.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-cardigan-round.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-cardigan-v.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-cardigan-v-aline.svg"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          srcRoot,
          "../public/images/patterns/sleeveless/diagrams/diagram-cardigan-round-aline.svg",
        ),
      ),
    ).toBe(true);
  });

  it("wires generated hydration before the Front Stitches & Rows template fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
    expect(script).toContain("sleevelessFrontStsRowsDiagramSvg.ts");
    expect(script).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");

    const fnStart = script.indexOf("async function hydrateSleevelessFrontDiagram");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = script.indexOf("async function hydrateSleevelessBackDiagram");
    const fn = script.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2800);
    expect(fn).toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
    expect(fn.indexOf('mode === "shaping-notation"')).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontStsRowsDiagramSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontStsRowsDiagramSvg")).toBeLessThan(
      fn.indexOf("resolveSleevelessFrontDiagramSrc"),
    );
    expect(fn.indexOf("if (generatedSvg)")).toBeLessThan(
      fn.indexOf('resolveSleevelessFrontDiagramSrc("sts-rows"'),
    );

    const notationFnStart = script.indexOf("async function inlineFrontJapaneseNotationSvg");
    const notationFnEnd = script.indexOf("async function hydrateSleevelessFrontDiagram");
    const notationFn = script.slice(notationFnStart, notationFnEnd);
    expect(notationFn).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(notationFn).not.toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");

    const backFnStart = script.indexOf("async function hydrateSleevelessBackDiagram");
    const backFnEnd = script.indexOf("function bindSleevelessBackDiagramMode");
    const backFn = script.slice(backFnStart, backFnEnd > backFnStart ? backFnEnd : backFnStart + 1800);
    expect(backFn).toContain("resolveSleevelessBackDiagramSrc");
    expect(backFn).not.toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
  });

  it("wires print Front loading to the same generated SVG with static fallback", () => {
    const print = readFileSync(join(srcRoot, "lib/patterns/sleevelessPrintDiagramSvg.ts"), "utf8");
    expect(print).toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
    const frontBranch = print.slice(print.indexOf('piece === "back"'));
    expect(frontBranch.indexOf("tryBuildLiveSleevelessFrontStsRowsDiagramSvg")).toBeGreaterThan(
      frontBranch.indexOf("} else {"),
    );
    expect(frontBranch.indexOf("tryBuildLiveSleevelessFrontStsRowsDiagramSvg")).toBeLessThan(
      frontBranch.indexOf("fetchSvgWithReplacements"),
    );

    const printPage = readFileSync(join(srcRoot, "scripts/sleeveless-print-page.ts"), "utf8");
    expect(printPage).toContain("loadSleevelessFrontDiagramSvgMarkup");
    expect(printPage).toContain("loadSleevelessBackDiagramSvgMarkup");
  });
});
