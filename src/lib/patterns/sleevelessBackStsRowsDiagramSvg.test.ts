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

  it("returns null so A-line Back keeps the static fallback", () => {
    const pattern = alineBackPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(tryBuildLiveSleevelessBackStsRowsDiagramSvg(result, pattern)).toBeNull();
    expect(resolveSleevelessBackDiagramSrc("sts-rows", pattern)).toContain("diagram-back-aline");
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
