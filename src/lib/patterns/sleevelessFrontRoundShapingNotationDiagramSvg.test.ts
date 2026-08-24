import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pulloverArmholeEvents } from "./frontArmholeNecklineComposition";
import { neckEdgeNotationLinesFromNeckShoulderChart } from "./notationOverlaySvg";
import {
  armholeBindOffDecreaseFromEachSide,
  formatBindOffNotation,
  formatHoldNotation,
} from "./sleevelessBackJapaneseNotation";
import { resolveSleevelessFrontDiagramSrc } from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontRoundShapingNotationDiagramSvg,
  collectRoundFrontInnerNeckShapingPoints,
  pulloverRoundFrontArmholeDecreasePoints,
  pulloverRoundFrontCenterNeckNotation,
  pulloverRoundFrontNeckNotationLines,
  pulloverRoundFrontShoulderNotationLines,
  pulloverRoundFrontShoulderPoints,
  shouldUseGeneratedSleevelessFrontRoundNotation,
  SLEEVELESS_FRONT_ROUND_NOTATION_VIEWBOX,
  tryBuildLiveSleevelessFrontRoundNotationSvg,
} from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { buildSleevelessFrontStsRowsDiagramModel } from "./sleevelessFrontStsRowsDiagramModel";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "./sleevelessFrontStsRowsDiagramSvg";
import {
  shouldUseGeneratedSleevelessFrontVNeckNotation,
  tryBuildLiveSleevelessFrontVNeckNotationSvg,
} from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import {
  shouldUseGeneratedSleevelessBackNotation,
  tryBuildLiveSleevelessBackNotationSvg,
} from "./sleevelessBackShapingNotationDiagramSvg";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessRoundNeckShapingSchedule } from "./sleevelessRoundNeckShapingSchedule";
import { compressStitchDecreasePointsToNotationLines } from "./shapingNotationCompress";
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

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
    style: {
      garmentStyle: "pullover",
      neckline: "round",
      frontStyle: "closed",
      recipientCategory: "misses",
    },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function shallowRoundPulloverPattern(): Record<string, unknown> {
  const pattern = roundPulloverPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.front_neck_depth = 1;
  return pattern;
}

function alineRoundPulloverPattern(): Record<string, unknown> {
  const pattern = roundPulloverPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  (pattern.style as { bodyShape?: string }).bodyShape = "aline";
  return pattern;
}

function shapedRoundPulloverPattern(): Record<string, unknown> {
  const pattern = roundPulloverPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  (pattern.style as { bodyShape?: string }).bodyShape = "shaped";
  return pattern;
}

function vNeckPulloverPattern(): Record<string, unknown> {
  const pattern = roundPulloverPattern();
  (pattern.style as { neckline: string }).neckline = "v-neck";
  return pattern;
}

function cardiganRoundPattern(): Record<string, unknown> {
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
    style: { garmentStyle: "cardigan", neckline: "round", frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function svgAttr(svg: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function expectValidSvg(svg: string): void {
  expect(svg).toContain("<svg");
  expect(svg).toContain("</svg>");
  expect(svg).not.toMatch(/\bNaN\b/);
  expect(svg).not.toMatch(/\bInfinity\b/);
  expect(svg).not.toMatch(/\bundefined\b/);
}

describe("buildSleevelessFrontRoundShapingNotationDiagramSvg", () => {
  it("generates a supported Pullover Round Straight diagram", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const a = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const b = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    expect(a).toBe(b);
    expectValidSvg(a);
    expect(a).toContain('data-sleeveless-front-round-generated-notation="true"');
    expect(a).toContain('data-supported="true"');
    expect(a).toContain('data-neckline-style="round"');
    expect(a).toContain('data-neck-contour="scoop"');
    expect(a).toContain('data-body-shaping-direction="straight"');
    expect(a).toContain("viewBox=\"0 0 400 480\"");
    expect(SLEEVELESS_FRONT_ROUND_NOTATION_VIEWBOX).toEqual({ width: 400, height: 480 });
  });

  it("takes center neck bind-off or hold from the front timeline / schedule", () => {
    for (const pattern of [roundPulloverPattern(), shallowRoundPulloverPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
      const schedule = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline);
      expect(schedule).not.toBeNull();
      const expected = schedule!.centerHeld
        ? formatHoldNotation(schedule!.centerStitches)
        : formatBindOffNotation(schedule!.centerStitches);
      expect(pulloverRoundFrontCenterNeckNotation(result)).toBe(expected);
      expect(svgAttr(svg, "data-neck-bo")).toBe(expected);
      expect(svg).toContain(expected);
      expect(svgAttr(svg, "data-center-held")).toBe(schedule!.centerHeld ? "true" : "false");
      expect(svgNum(svg, "data-center-bind-off-sts")).toBe(schedule!.centerStitches);
    }
  });

  it("takes Round neck decrease notation from timeline inner events, not chart cells", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const timeline = result.frontNeckShoulderTimeline ?? [];
    const fromTimeline = compressStitchDecreasePointsToNotationLines(
      collectRoundFrontInnerNeckShapingPoints(timeline, "right"),
    );
    expect(pulloverRoundFrontNeckNotationLines(result)).toEqual(fromTimeline);
    expect(svgAttr(svg, "data-neck-shaping")).toBe(fromTimeline.join("\n"));
    for (const line of fromTimeline) {
      expect(svg).toContain(line);
    }
    const chartLines = neckEdgeNotationLinesFromNeckShoulderChart(
      result.frontNeckShoulderShapingChart,
      "right",
    );
    expect(fromTimeline).toEqual(
      compressStitchDecreasePointsToNotationLines(
        collectRoundFrontInnerNeckShapingPoints(timeline, "right"),
      ),
    );
    const source = readFileSync(
      join(srcRoot, "lib/patterns/sleevelessFrontRoundShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    expect(source).not.toContain("neckEdgeNotationLinesFromNeckShoulderChart");
    expect(chartLines.join("\n")).toBeDefined();
  });

  it("takes shoulder notation from timeline outer events", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const timeline = result.frontNeckShoulderTimeline ?? [];
    const fromTimeline = shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
      shoulderStitchesBudget: shoulderStitchesPerSideForDiagram(result.debug),
    });
    const lines = pulloverRoundFrontShoulderNotationLines(result);
    expect(lines.length).toBeGreaterThan(0);
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(lines.join("\n"));
    expect(pulloverRoundFrontShoulderPoints(result).length).toBeGreaterThan(0);
    if (fromTimeline.length > 0) {
      expect(lines).toEqual(fromTimeline);
    }
  });

  it("takes armhole notation from pulloverArmholeEvents", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const eachSide = result.debug.armholeStitchesEachSide!;
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide);
    const start = result.debug.armholeStartRow!;
    const events = pulloverArmholeEvents({
      firstArmholeGarmentRc: start,
      bindOffSts,
      decreaseSts,
    }).filter((ev) => ev.side === "right");
    const decreasePoints = events
      .filter((ev) => ev.kind === "decrease")
      .map((ev) => ({ row: ev.garmentRc - start, amount: ev.amount }));
    expect(pulloverRoundFrontArmholeDecreasePoints(result)).toEqual(decreasePoints);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(formatBindOffNotation(bindOffSts));
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(
      compressStitchDecreasePointsToNotationLines(decreasePoints).join("\n"),
    );
    expect(svgNum(svg, "data-bind-off-sts")).toBe(bindOffSts);
    expect(svgNum(svg, "data-decrease-sts")).toBe(decreaseSts);
  });

  it("matches generated Front Round Stitches & Rows stitch-true geometry", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    const sts = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    expect(model).not.toBeNull();
    expect(sts).toBeTruthy();
    expect(model!.neckline.style).toBe("round");

    expect(svgNum(svg, "data-hem-sts")).toBe(svgNum(sts!, "data-hem-sts"));
    expect(svgNum(svg, "data-bust-sts")).toBe(svgNum(sts!, "data-bust-sts"));
    expect(svgNum(svg, "data-after-armhole-sts")).toBe(svgNum(sts!, "data-after-armhole-sts"));
    expect(svgNum(svg, "data-neck-sts")).toBe(svgNum(sts!, "data-neck-sts"));
    expect(svgNum(svg, "data-shoulder-sts")).toBe(svgNum(sts!, "data-shoulder-sts"));
    expect(svgNum(svg, "data-neck-depth-rows")).toBe(svgNum(sts!, "data-neck-depth-rows"));
    expect(svgNum(svg, "data-bind-off-sts")).toBe(svgNum(sts!, "data-bind-off-sts"));

    const notationNeckRatio = svgNum(svg, "data-neck-width") / svgNum(svg, "data-after-armhole-width");
    const stsNeckRatio = svgNum(sts!, "data-neck-width") / svgNum(sts!, "data-after-armhole-width");
    expect(notationNeckRatio).toBeCloseTo(stsNeckRatio, 5);

    const notationShoulderRatio =
      svgNum(svg, "data-shoulder-side-width") / svgNum(svg, "data-after-armhole-width");
    const stsShoulderRatio =
      svgNum(sts!, "data-shoulder-side-width") / svgNum(sts!, "data-after-armhole-width");
    expect(notationShoulderRatio).toBeCloseTo(stsShoulderRatio, 5);

    const notationNeckDepthRatio = svgNum(svg, "data-visual-neck-h") / svgNum(svg, "data-visual-armhole-h");
    const stsNeckDepthRatio = svgNum(sts!, "data-visual-neck-h") / svgNum(sts!, "data-visual-armhole-h");
    expect(notationNeckDepthRatio).toBeCloseTo(stsNeckDepthRatio, 5);

    expect(svgNum(svg, "data-neck-left")).toBeLessThan(svgNum(svg, "data-cx"));
    expect(svgNum(svg, "data-neck-right")).toBeGreaterThan(svgNum(svg, "data-cx"));
    expect(svgNum(svg, "data-after-left")).toBeLessThan(svgNum(svg, "data-neck-left"));
    expect(svgNum(svg, "data-after-right")).toBeGreaterThan(svgNum(svg, "data-neck-right"));
    expect(svgNum(svg, "data-neck-start-y")).toBeGreaterThan(svgNum(svg, "data-neck-corner-y"));
    expect(svg).toContain('data-role="front-neck-path"');
    expect(svg).toContain("C ");
  });
});

describe("live Pullover Front Round notation cutover", () => {
  it("uses the generated renderer for Pullover Round Straight only", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const live = tryBuildLiveSleevelessFrontRoundNotationSvg(result, pattern);
    expect(shouldUseGeneratedSleevelessFrontRoundNotation(result, pattern)).toBe(true);
    expect(live).toBeTruthy();
    expect(live).toBe(buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern));
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toContain(
      "diagram-jp-front-round",
    );
  });

  it("leaves V Front generated renderer unchanged", () => {
    const pattern = vNeckPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessFrontRoundNotation(result, pattern)).toBe(false);
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(result, pattern)).toBeNull();
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(result, pattern)).toBe(true);
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(result, pattern)).toBeTruthy();
  });

  it("leaves Back generated renderer unchanged", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessBackNotation(result, pattern)).toBe(true);
    expect(tryBuildLiveSleevelessBackNotationSvg(result, pattern)).toBeTruthy();
    expect(tryBuildLiveSleevelessBackNotationSvg(result, pattern)).toContain(
      "data-sleeveless-back-generated-notation",
    );
  });

  it("falls back for A-line Round", () => {
    const pattern = alineRoundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessFrontRoundNotation(result, pattern)).toBe(false);
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(result, pattern)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toContain(
      "diagram-jp-front-round-aline",
    );
  });

  it("falls back for shaped/waist Round", () => {
    const pattern = shapedRoundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessFrontRoundNotation(result, pattern)).toBe(false);
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(result, pattern)).toBeNull();
  });

  it("falls back for Cardigan Round", () => {
    const pattern = cardiganRoundPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessFrontRoundNotation(result, pattern)).toBe(false);
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(result, pattern)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", pattern)).toContain(
      "diagram-jp-cardigan-round",
    );
  });

  it("keeps the old Illustrator Front Round asset as fallback", () => {
    expect(
      existsSync(
        join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-front-round.svg"),
      ),
    ).toBe(true);
  });

  it("wires generated Round hydration after V Front and before the template fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessFrontRoundNotationSvg");
    expect(script).toContain("sleevelessFrontRoundShapingNotationDiagramSvg.ts");

    const fnStart = script.indexOf("async function inlineFrontJapaneseNotationSvg");
    expect(fnStart).toBeGreaterThan(-1);
    const fnEnd = script.indexOf("async function hydrateSleevelessFrontDiagram");
    const fn = script.slice(fnStart, fnEnd);
    expect(fn).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(fn).toContain("tryBuildLiveSleevelessFrontRoundNotationSvg");
    expect(fn.indexOf("tryBuildLiveSleevelessFrontVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg")).toBeLessThan(
      fn.indexOf("resolveSleevelessFrontDiagramSrc"),
    );
    expect(fn.indexOf("if (generatedSvg)")).toBeLessThan(fn.indexOf("await fetch(notationSrc"));
    expect(fn).not.toContain("tryBuildLiveSleevelessFrontStsRowsDiagramSvg");

    const backFnStart = script.indexOf("async function inlineBackJapaneseNotationSvg");
    const backFn = script.slice(backFnStart, backFnStart + 1800);
    expect(backFn).not.toContain("tryBuildLiveSleevelessFrontRoundNotationSvg");
  });
});
