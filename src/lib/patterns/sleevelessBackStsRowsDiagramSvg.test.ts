import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import { buildSleevelessBackStsRowsDiagramModel } from "./sleevelessBackStsRowsDiagramModel";
import {
  buildSleevelessBackStsRowsDiagramSvg,
  SLEEVELESS_BACK_STS_ROWS_VIEWBOX,
  SLEEVELESS_BACK_STS_ROWS_VISUAL,
  tryBuildLiveSleevelessBackStsRowsDiagramSvg,
  tryBuildSleevelessBackStsRowsDiagramSvg,
} from "./sleevelessBackStsRowsDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

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

/** 24 sts / 6 in Back neck, 6 rows / 1 in Back neck depth. */
function shallowBackNeckPattern(): Record<string, unknown> {
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
    style: { garmentStyle: "pullover", neckline: "round", frontStyle: "closed", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 4, gaugeRowsPerInch: 6, availableNeedles: 200 },
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

function alineOutwardBackPattern(): Record<string, unknown> {
  const pattern = straightBackPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "aline";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function inferredOutwardBackPattern(): Record<string, unknown> {
  const pattern = straightBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function shapedBackPattern(): Record<string, unknown> {
  const pattern = straightBackPattern();
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function svgFor(pattern: Record<string, unknown>) {
  const result = generateSleevelessBackPattern(pattern);
  const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
  expect(model).not.toBeNull();
  const svg = tryBuildSleevelessBackStsRowsDiagramSvg(model);
  expect(svg).toBeTruthy();
  return { model: model!, svg: svg!, result };
}

function svgAttr(svg: string, name: string): string {
  const re = new RegExp(`${name}="([^"]*)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function widthLabelSts(svg: string, measure: string): number {
  const re = new RegExp(`data-measure="${measure}"[^>]*data-sts="([^"]+)"`);
  return Number(re.exec(svg)?.[1] ?? NaN);
}

function lengthLabelRows(svg: string, measure: string): number {
  const re = new RegExp(`data-measure="${measure}"[^>]*data-rows="([^"]+)"`);
  return Number(re.exec(svg)?.[1] ?? NaN);
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

const UPPER_WIDTH_TOL = 0.51;

function expectUpperSilhouetteMatchesStitchBudget(
  svg: string,
  model: NonNullable<ReturnType<typeof buildSleevelessBackStsRowsDiagramModel>>,
): void {
  const px = svgNum(svg, "data-bust-width") / model.widths.bustStitches;
  const afterWidth = svgNum(svg, "data-after-armhole-width");
  const trueAfterWidth = svgNum(svg, "data-true-after-width");
  const neckWidth = svgNum(svg, "data-neck-width");
  const shoulderSideWidth = svgNum(svg, "data-shoulder-side-width");
  const bustWidth = svgNum(svg, "data-bust-width");

  expect(trueAfterWidth).toBeGreaterThan(0);
  expect(Math.abs(trueAfterWidth - model.widths.stitchesAfterArmhole * px)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(afterWidth - trueAfterWidth)).toBeLessThan(UPPER_WIDTH_TOL);
  expect(svgNum(svg, "data-upper-scale")).toBeCloseTo(1, 2);
  expect(afterWidth).toBeLessThan(bustWidth);
  expect(Math.abs(shoulderSideWidth - model.widths.shoulderStitchesPerSide * px)).toBeLessThan(
    UPPER_WIDTH_TOL,
  );
  expect(Math.abs(neckWidth - (afterWidth - 2 * shoulderSideWidth))).toBeLessThan(UPPER_WIDTH_TOL);
  expect(Math.abs(afterWidth - (shoulderSideWidth + neckWidth + shoulderSideWidth))).toBeLessThan(
    UPPER_WIDTH_TOL,
  );
}

describe("buildSleevelessBackStsRowsDiagramSvg", () => {
  it("generates a responsive SVG for a normal straight-body Back", () => {
    const { svg, model } = svgFor(straightBackPattern());
    expect(svg).toContain(
      `viewBox="0 0 ${SLEEVELESS_BACK_STS_ROWS_VIEWBOX.width} ${SLEEVELESS_BACK_STS_ROWS_VIEWBOX.height}"`,
    );
    expect(svg).toContain('data-sleeveless-back-sts-rows-generated="true"');
    expect(svg).toContain('data-supported="true"');
    expect(svg).toContain('data-piece="back"');
    expect(svg).toContain('data-neckline-style="round"');
    expect(svg).toContain("C ");
    expect(svg).not.toContain('data-role="v-point"');
    expect(svg).toBe(buildSleevelessBackStsRowsDiagramSvg(model));
  });

  it("shows customer-facing stitch and row labels from the Back model", () => {
    const { svg, model } = svgFor(straightBackPattern());
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(lengthLabelRows(svg, "hem")).toBe(model.rows.hemRows);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(lengthLabelRows(svg, "neck-depth")).toBe(model.neckline.depthRows);
    expect(svg).toContain(expectedInches(model.widths.bustStitches, model.widths.stitchesPerInch));
    expect(svg).toContain(expectedInches(model.rows.expectedGarmentRows, model.rows.rowsPerInch));
  });

  it("derives post-armhole width from the Back stitch budget", () => {
    const { svg, model } = svgFor(straightBackPattern());
    expectUpperSilhouetteMatchesStitchBudget(svg, model);
    expect(svgNum(svg, "data-after-armhole-sts")).toBe(model.widths.stitchesAfterArmhole);
  });

  it("reconciles shoulders + neckline with the available post-armhole stitches", () => {
    const { svg, model } = svgFor(vNeckFrontStraightBackPattern());
    expectUpperSilhouetteMatchesStitchBudget(svg, model);
    const budgetSts =
      model.widths.shoulderStitchesPerSide +
      model.widths.necklineStitches +
      model.widths.shoulderStitchesPerSide;
    expect(budgetSts).toBeGreaterThanOrEqual(model.widths.stitchesAfterArmhole - 1);
    expect(budgetSts).toBeLessThanOrEqual(model.widths.stitchesAfterArmhole);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(model.rows.backNeckDepthRows);
    expect(svgNum(svg, "data-neck-depth-rows")).not.toBe(model.rows.backNeckDepthRows + 20);
  });

  it("draws a shallow Back neck curve without changing labels or upper widths", () => {
    const { svg, model } = svgFor(shallowBackNeckPattern());
    expect(model.neckline.depthRows).toBe(6);
    expect(model.widths.necklineStitches).toBe(24);
    expect(lengthLabelRows(svg, "neck-depth")).toBe(6);
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(6);
    expect(svg).toMatch(
      /<g data-role="length-measurement" data-measure="neck-depth"[\s\S]*?>6 rows<\/text>[\s\S]*?>1 in<\/text>/,
    );
    expect(widthLabelSts(svg, "neck")).toBe(24);

    const visualNeckH = svgNum(svg, "data-visual-neck-h");
    const rcMappedNeckH = svgNum(svg, "data-rc-mapped-neck-h");
    expect(visualNeckH).toBeGreaterThanOrEqual(SLEEVELESS_BACK_STS_ROWS_VISUAL.minBackNeckDepth);
    expect(visualNeckH).toBeLessThanOrEqual(SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBackNeckDepth);
    expect(rcMappedNeckH).toBeGreaterThan(SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBackNeckDepth);
    expect(visualNeckH).toBeLessThan(rcMappedNeckH);
    expect(visualNeckH).toBeLessThan(svgNum(svg, "data-visual-shoulder-h"));

    expectUpperSilhouetteMatchesStitchBudget(svg, model);
    expect(svgNum(svg, "data-after-armhole-width")).toBeCloseTo(svgNum(svg, "data-true-after-width"), 2);
    expect(svgNum(svg, "data-neck-width")).toBeCloseTo(
      svgNum(svg, "data-after-armhole-width") - 2 * svgNum(svg, "data-shoulder-side-width"),
      2,
    );
    expect(svgNum(svg, "data-upper-scale")).toBeCloseTo(1, 2);
  });

  it("draws the Front-style armhole scoop without changing stitch, row, or neck geometry", () => {
    const { svg, model } = svgFor(straightBackPattern());
    const px = svgNum(svg, "data-px-per-stitch");
    const boInset = Math.abs(svgNum(svg, "data-bo-left") - svgNum(svg, "data-bust-left"));
    expect(boInset).toBeGreaterThan(0);
    expect(Math.abs(boInset - model.armhole.bindOffStsEachSide * px)).toBeLessThan(UPPER_WIDTH_TOL);
    expect(svgNum(svg, "data-bind-off-sts")).toBe(model.armhole.bindOffStsEachSide);

    expectUpperSilhouetteMatchesStitchBudget(svg, model);
    expect(svgNum(svg, "data-after-armhole-sts")).toBe(model.widths.stitchesAfterArmhole);
    expect(svgNum(svg, "data-after-armhole-width")).toBeCloseTo(svgNum(svg, "data-true-after-width"), 2);

    expect(svgNum(svg, "data-armhole-rows")).toBe(model.rows.armholeRows);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(svgNum(svg, "data-visual-armhole-h")).toBeGreaterThan(0);
    expect(svgNum(svg, "data-last-armhole-rc")).toBe(model.armhole.lastGarmentRc);

    const lastDecrease = model.armhole.events
      .filter((ev) => ev.kind === "decrease")
      .reduce((max, ev) => Math.max(max, ev.garmentRc), model.armhole.startGarmentRc);
    expect(lastDecrease).toBeLessThan(model.armhole.lastGarmentRc);
    expect(svgNum(svg, "data-last-decrease-rc")).toBe(lastDecrease);

    const right = pathPoints(rolePaths(svg, "armhole-outline")[1] ?? "");
    expect(right).toHaveLength(4);
    expect(right[0]!.x).toBeCloseTo(svgNum(svg, "data-bust-right"), 2);
    expect(right[0]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
    expect(right[1]!.x).toBeCloseTo(svgNum(svg, "data-bo-right"), 2);
    expect(right[1]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
    expect(right[2]!.x).toBeCloseTo(svgNum(svg, "data-after-right"), 2);
    expect(right[2]!.y).toBeCloseTo(svgNum(svg, "data-last-armhole-y"), 2);
    expect(right[3]!.x).toBeCloseTo(svgNum(svg, "data-after-right"), 2);
    expect(right[3]!.y).toBeCloseTo(svgNum(svg, "data-shoulder-y"), 2);
    expect(right[2]!.y).toBeLessThan(right[1]!.y);
    expect(right[2]!.y).toBeGreaterThan(right[3]!.y);
    expect(right[3]!.y).not.toBeCloseTo(right[2]!.y, 0);
    expect(Math.abs(right[2]!.y - right[3]!.y)).toBeGreaterThan(
      Math.abs(right[1]!.y - right[2]!.y) * 0.5,
    );

    expect(svgNum(svg, "data-visual-neck-h")).toBeLessThanOrEqual(
      SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBackNeckDepth,
    );
    expect(svgNum(svg, "data-neck-left")).toBeCloseTo(
      svgNum(svg, "data-cx") - svgNum(svg, "data-neck-width") / 2,
      2,
    );
    expect(lengthLabelRows(svg, "neck-depth")).toBe(model.neckline.depthRows);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
  });

  it("keeps measurement values true after visual vertical bands are clamped", () => {
    const { svg, model } = svgFor(straightBackPattern());
    expect(svgNum(svg, "data-visual-armhole-h") / svgNum(svg, "data-visual-garment-h")).toBeLessThanOrEqual(
      SLEEVELESS_BACK_STS_ROWS_VISUAL.maxArmholeFraction,
    );
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(svgNum(svg, "data-after-armhole-width")).toBeCloseTo(svgNum(svg, "data-true-after-width"), 2);
  });

  it("generates an A-line Back SVG from the actual hem and bust stitch counts", () => {
    const { svg, model } = svgFor(alineBackPattern());
    expect(svg).toContain('data-sleeveless-back-sts-rows-generated="true"');
    expect(svgAttr(svg, "data-body-shape")).toBe("aline");
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("inward");
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

  it("tapers A-line Back only through the actual shaping RC span", () => {
    const { svg, model } = svgFor(alineBackPattern());
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
    expect(leftBody[leftBody.length - 1]!.y).toBeCloseTo(svgNum(svg, "data-armhole-start-y"), 2);
    expect(svgNum(svg, "data-shape-end-y")).toBeGreaterThan(svgNum(svg, "data-armhole-start-y") - 0.51);
  });

  it("keeps A-line Back upper-body, armhole, and neck geometry matching the equivalent Straight Back", () => {
    const straight = svgFor(straightBackPattern());
    const aline = svgFor(alineBackPattern());
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

    const right = pathPoints(rolePaths(aline.svg, "armhole-outline")[1] ?? "");
    expect(right).toHaveLength(4);
    expect(right[1]!.x).toBeCloseTo(svgNum(aline.svg, "data-bo-right"), 2);
    expect(right[2]!.y).toBeCloseTo(svgNum(aline.svg, "data-last-armhole-y"), 2);
    expect(right[2]!.y).toBeGreaterThan(right[3]!.y);
    expect(svgNum(aline.svg, "data-last-decrease-rc")).toBeLessThan(aline.model.armhole.lastGarmentRc);

    expect(svgNum(aline.svg, "data-visual-neck-h")).toBeLessThanOrEqual(
      SLEEVELESS_BACK_STS_ROWS_VISUAL.maxBackNeckDepth,
    );
    expect(svgNum(aline.svg, "data-visual-neck-h")).toBeGreaterThanOrEqual(
      SLEEVELESS_BACK_STS_ROWS_VISUAL.minBackNeckDepth,
    );
    expect(lengthLabelRows(aline.svg, "neck-depth")).toBe(aline.model.neckline.depthRows);
    expect(widthLabelSts(aline.svg, "neck")).toBe(aline.model.widths.necklineStitches);
  });

  it("keeps A-line Back stitch and row labels true after visual scaling", () => {
    const { svg, model } = svgFor(alineBackPattern());
    expect(widthLabelSts(svg, "cast-on")).toBe(model.widths.hemStitches);
    expect(widthLabelSts(svg, "bust")).toBe(model.widths.bustStitches);
    expect(widthLabelSts(svg, "neck")).toBe(model.widths.necklineStitches);
    expect(widthLabelSts(svg, "shoulder")).toBe(model.widths.shoulderStitchesPerSide);
    expect(lengthLabelRows(svg, "garment-length")).toBe(model.rows.expectedGarmentRows);
    expect(lengthLabelRows(svg, "body-length")).toBe(model.rows.rowsFromCastOnToArmholeStart);
    expect(lengthLabelRows(svg, "hem")).toBe(model.rows.hemRows);
    expect(lengthLabelRows(svg, "armhole")).toBe(model.rows.armholeRows);
    expect(lengthLabelRows(svg, "neck-depth")).toBe(model.neckline.depthRows);
    expect(svg).toContain(expectedInches(model.widths.hemStitches, model.widths.stitchesPerInch));
    expect(svg).toContain(expectedInches(model.widths.bustStitches, model.widths.stitchesPerInch));
  });

  it("generates an outward A-line Back when hem stitches are narrower than bust", () => {
    for (const pattern of [alineOutwardBackPattern(), inferredOutwardBackPattern()]) {
      const { svg, model } = svgFor(pattern);
      expect(svg).toContain('data-sleeveless-back-sts-rows-generated="true"');
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

  it("slopes outward A-line Back through the actual shaping RC span", () => {
    const { svg, model } = svgFor(alineOutwardBackPattern());
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
    expect(svgNum(svg, "data-shape-end-y")).toBeGreaterThan(svgNum(svg, "data-armhole-start-y") - 0.51);
  });

  it("keeps outward A-line Back upper-body geometry matching the equivalent Straight Back", () => {
    const straight = svgFor(straightBackPattern());
    const aline = svgFor(alineOutwardBackPattern());
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
    expect(lengthLabelRows(aline.svg, "neck-depth")).toBe(aline.model.neckline.depthRows);
    expect(widthLabelSts(aline.svg, "neck")).toBe(aline.model.widths.necklineStitches);
  });

  it("keeps outward A-line Back stitch and row labels true", () => {
    const { svg, model } = svgFor(alineOutwardBackPattern());
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

  it("returns null so shaped Back keeps the static fallback", () => {
    const pattern = shapedBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern)).toBeNull();
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pattern)).toContain("diagram-back-shaped");
  });
});

describe("live Sleeveless Back Stitches & Rows cutover", () => {
  it("uses the generated SVG for supported straight-body Back", () => {
    const pattern = straightBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
    const live = tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern);
    expect(live).toBeTruthy();
    expect(live).toBe(tryBuildSleevelessBackStsRowsDiagramSvg(model));
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pattern)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back.svg",
    );
  });

  it("uses the generated SVG for supported A-line Back", () => {
    const pattern = alineBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessBackStsRowsDiagramModel(result, pattern);
    const live = tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern);
    expect(live).toBeTruthy();
    expect(live).toContain('data-body-shape="aline"');
    expect(live).toBe(tryBuildSleevelessBackStsRowsDiagramSvg(model));
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pattern)).toBe(
      "/images/patterns/sleeveless/diagrams/diagram-back-aline.svg",
    );
  });

  it("uses the generated SVG for both A-line Back directions", () => {
    for (const pattern of [alineBackPattern(), alineOutwardBackPattern(), inferredOutwardBackPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const live = tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern);
      expect(live).toBeTruthy();
      expect(live).toContain('data-body-shape="aline"');
      expect(live).toContain("data-body-shaping-direction=");
    }
  });

  it("wires generated hydration before the Back Stitches & Rows template fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
    expect(script).toContain("sleevelessBackStsRowsDiagramSvg.ts");

    const fnStart = script.indexOf("async function hydrateSleevelessBackDiagram");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = script.indexOf("function bindSleevelessBackDiagramMode");
    const fn = script.slice(fnStart, fnEnd > fnStart ? fnEnd : fnStart + 2800);
    expect(fn).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
    expect(fn.indexOf('mode === "shaping-notation"')).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessBackStsRowsDiagramSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessBackStsRowsDiagramSvg")).toBeLessThan(
      fn.indexOf("inlineSvgWithReplacements"),
    );
    expect(fn).not.toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");
    expect(fn).not.toContain("tryBuildLiveSleevelessBackNotationSvg");
  });

  it("wires print Back loading to the same generated SVG with static fallback", () => {
    const print = readFileSync(join(srcRoot, "lib/patterns/sleevelessPrintDiagramSvg.ts"), "utf8");
    expect(print).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
    const backBranch = print.slice(
      print.indexOf('if (piece === "back")'),
      print.indexOf("} else {"),
    );
    expect(backBranch).toContain("tryBuildLiveSleevelessBackStsRowsDiagramSvg");
    expect(backBranch.indexOf("tryBuildLiveSleevelessBackStsRowsDiagramSvg")).toBeLessThan(
      backBranch.indexOf("resolveSleevelessBackDiagramSrc"),
    );
    expect(existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-back.svg"))).toBe(
      true,
    );
  });
});
