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
  SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_CLEARANCE,
  SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_SAFE_MAX_X,
  SLEEVELESS_FRONT_ROUND_NECK_BO_BELOW_GUIDE,
  SLEEVELESS_FRONT_ROUND_NOTATION_FS_NOTATION,
  SLEEVELESS_FRONT_ROUND_NOTATION_FS_RC,
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

type TextPos = { x: number; y: number; fs: number; text: string };

function textPositions(svg: string, role: string): TextPos[] {
  const tags = [
    ...svg.matchAll(new RegExp(`<text(?=[^>]*data-role="${role}")([^>]*)>([^<]*)</text>`, "g")),
  ];
  return tags.map((m) => ({
    x: Number(/ x="([^"]+)"/.exec(m[1])?.[1]),
    y: Number(/ y="([^"]+)"/.exec(m[1])?.[1]),
    fs: Number(/font-size="([^"]+)"/.exec(m[1])?.[1]),
    text: m[2] ?? "",
  }));
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

  it("places neckline shaping inside the scoop above the center bind-off", () => {
    for (const pattern of [roundPulloverPattern(), shallowRoundPulloverPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
      const shaping = textPositions(svg, "neck-shaping");
      const bo = textPositions(svg, "neck-bo");
      expect(bo).toHaveLength(1);
      expect(bo[0]!.text).toMatch(/^(bo|hold)\d+$/);

      const neckLeft = svgNum(svg, "data-neck-left");
      const neckRight = svgNum(svg, "data-neck-right");
      const neckCornerY = svgNum(svg, "data-neck-corner-y");
      const neckStartY = svgNum(svg, "data-neck-start-y");

      expect(bo[0]!.x).toBeCloseTo(svgNum(svg, "data-cx"), 5);
      expect(bo[0]!.y).toBeGreaterThan(neckStartY);
      expect(bo[0]!.y).toBeCloseTo(neckStartY + SLEEVELESS_FRONT_ROUND_NECK_BO_BELOW_GUIDE, 5);

      if (shaping.length > 0) {
        const lastShapingY = Math.max(...shaping.map((p) => p.y));
        const firstShapingY = Math.min(...shaping.map((p) => p.y));
        for (const pos of shaping) {
          expect(pos.x).toBeCloseTo(svgNum(svg, "data-cx"), 5);
          expect(pos.x).toBeGreaterThan(neckLeft);
          expect(pos.x).toBeLessThan(neckRight);
        }
        expect(firstShapingY).toBeGreaterThanOrEqual(neckCornerY);
        expect(lastShapingY).toBeLessThan(neckStartY + 0.01);
        expect(lastShapingY).toBeLessThan(bo[0]!.y);
        expect(firstShapingY).toBeLessThan(161);
        expect(lastShapingY).toBeLessThan(181);
      }
    }
  });

  it("does not move armhole or shoulder notation when the center neck label shifts", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const armholeBo = textPositions(svg, "armhole-bo");
    const armholeShaping = textPositions(svg, "armhole-shaping");
    const shoulder = textPositions(svg, "shoulder-shaping");
    expect(armholeBo[0]!.x).toBeCloseTo(287.44, 2);
    expect(armholeBo[0]!.y).toBeCloseTo(184.43, 2);
    expect(armholeShaping[0]!.x).toBeCloseTo(287.44, 2);
    expect(armholeShaping[0]!.y).toBeCloseTo(166.43, 2);
    expect(shoulder[0]!.x).toBeCloseTo(254.76, 2);
    expect(Math.max(...shoulder.map((p) => p.y))).toBeCloseTo(86.46, 2);
  });

  it("places the armhole block next to the right armhole edge", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const armhole = [...textPositions(svg, "armhole-bo"), ...textPositions(svg, "armhole-shaping")];
    expect(armhole.length).toBeGreaterThan(0);
    const afterRight = svgNum(svg, "data-after-right");
    const previousCanvasSlotX = 320;
    for (const pos of armhole) {
      expect(pos.x).toBeGreaterThan(afterRight);
      expect(pos.x).toBeLessThan(previousCanvasSlotX);
      expect(pos.x).toBeLessThanOrEqual(SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_SAFE_MAX_X);
      expect(pos.x - afterRight).toBeLessThan(previousCanvasSlotX - afterRight);
      expect(pos.x - afterRight).toBeGreaterThanOrEqual(
        SLEEVELESS_FRONT_ROUND_ARMHOLE_LABEL_CLEARANCE - 0.01,
      );
    }
  });

  it("places shoulder notation next to the right shoulder slope", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const shoulder = textPositions(svg, "shoulder-shaping");
    expect(shoulder.length).toBeGreaterThan(0);
    const neckRight = svgNum(svg, "data-neck-right");
    const afterRight = svgNum(svg, "data-after-right");
    const shoulderY = svgNum(svg, "data-shoulder-y");
    const neckCornerY = svgNum(svg, "data-neck-corner-y");
    const previousLastBaseline = svgNum(svg, "data-shoulder-top-y") - 26;
    const lowest = Math.max(...shoulder.map((p) => p.y));
    for (const pos of shoulder) {
      expect(pos.x).toBeGreaterThan(neckRight);
      expect(pos.x).toBeLessThan(afterRight + 8);
      expect(pos.y).toBeLessThan(shoulderY);
    }
    expect(lowest).toBeGreaterThan(previousLastBaseline);
    expect(lowest).toBeGreaterThan(neckCornerY - 24);
    expect(lowest).toBeLessThan(shoulderY);
  });

  it("uses the Stitches & Rows measurement type scale", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    const sts = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
    expect(sts).toBeTruthy();
    expect(sts).toContain('font-size="17"');
    expect(sts).toContain('font-size="14"');
    expect(SLEEVELESS_FRONT_ROUND_NOTATION_FS_NOTATION).toBe(17);
    expect(SLEEVELESS_FRONT_ROUND_NOTATION_FS_RC).toBe(14);

    const primary = [
      ...textPositions(svg, "neck-shaping"),
      ...textPositions(svg, "neck-bo"),
      ...textPositions(svg, "armhole-bo"),
      ...textPositions(svg, "armhole-shaping"),
      ...textPositions(svg, "shoulder-shaping"),
      ...textPositions(svg, "cast-on"),
    ];
    expect(primary.length).toBeGreaterThan(0);
    for (const pos of primary) {
      expect(pos.fs).toBe(17);
    }
    const rc = [
      ...textPositions(svg, "rc-caston"),
      ...textPositions(svg, "rc-hem"),
      ...textPositions(svg, "armhole-start-rc"),
      ...textPositions(svg, "neck-start-rc"),
      ...textPositions(svg, "shoulder-start-rc"),
    ];
    expect(rc.length).toBeGreaterThan(0);
    for (const pos of rc) {
      expect(pos.fs).toBe(14);
    }
    expect(svg).not.toContain('font-size="13"');
    expect(svg).not.toContain('font-size="12"');
  });

  it("keeps notation strings and garment geometry unchanged", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontRoundShapingNotationDiagramSvg(result, pattern);
    expect(svgAttr(svg, "data-neck-bo")).toBe(pulloverRoundFrontCenterNeckNotation(result));
    expect(svgAttr(svg, "data-neck-shaping")).toBe(
      pulloverRoundFrontNeckNotationLines(result).join("\n"),
    );
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(
      pulloverRoundFrontShoulderNotationLines(result).join("\n"),
    );
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(
      compressStitchDecreasePointsToNotationLines(
        pulloverRoundFrontArmholeDecreasePoints(result),
      ).join("\n"),
    );
    expect(svgNum(svg, "data-cx")).toBe(198);
    expect(svgNum(svg, "data-neck-left")).toBe(165);
    expect(svgNum(svg, "data-neck-right")).toBe(231);
    expect(svgNum(svg, "data-after-right")).toBe(264);
    expect(svgNum(svg, "data-bust-right")).toBe(308);
    expect(svgNum(svg, "data-neck-start-y")).toBeCloseTo(139.03, 2);
    expect(svgNum(svg, "data-neck-corner-y")).toBeCloseTo(88.43, 2);
    expect(svgNum(svg, "data-shoulder-y")).toBeCloseTo(108.43, 2);
    expect(svgNum(svg, "data-armhole-start-y")).toBeCloseTo(198.43, 2);
    expect(svg).toContain('data-role="body-outline"');
    expect(svg).toContain('data-role="front-neck-path"');
    expect(svg).toContain('data-neck-contour="scoop"');
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
    const vSvg = tryBuildLiveSleevelessFrontVNeckNotationSvg(result, pattern);
    expect(vSvg).toBeTruthy();
    expect(vSvg).toContain('font-size="13"');
    expect(vSvg).toContain('font-size="12"');
    const vSource = readFileSync(
      join(srcRoot, "lib/patterns/sleevelessFrontVNeckShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    expect(vSource).toContain("const FS_RC = 12;");
    expect(vSource).toContain("const FS_NOTATION = 13;");
  });

  it("leaves Back generated renderer unchanged", () => {
    const pattern = roundPulloverPattern();
    const result = generateSleevelessBackPattern(pattern);
    expect(shouldUseGeneratedSleevelessBackNotation(result, pattern)).toBe(true);
    const backSvg = tryBuildLiveSleevelessBackNotationSvg(result, pattern);
    expect(backSvg).toBeTruthy();
    expect(backSvg).toContain("data-sleeveless-back-generated-notation");
    expect(backSvg).toContain('font-size="13"');
    expect(backSvg).toContain('font-size="12"');
    const backSource = readFileSync(
      join(srcRoot, "lib/patterns/sleevelessBackShapingNotationDiagramSvg.ts"),
      "utf8",
    );
    expect(backSource).toContain("const FS_RC = 12;");
    expect(backSource).toContain("const FS_NOTATION = 13;");
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
