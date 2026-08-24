import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import { buildBackJapaneseNotationReplacements } from "./sleevelessBackJapaneseNotation";
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";
import {
  buildFrontJapaneseNotationReplacements,
  resolveSleevelessFrontDiagramSrc,
} from "./sleevelessFrontJapaneseNotation";
import { buildSleevelessFrontStsRowsDiagramModel } from "./sleevelessFrontStsRowsDiagramModel";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";
import type { RowEntry } from "./shapingTimeline";
import {
  buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg,
  shouldUseGeneratedSleevelessFrontCardiganRoundNotation,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_ARMHOLE_LABEL_CLEARANCE,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_FS_NOTATION,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_FS_RC,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_VIEWBOX,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_RC_GUTTER_MIN_CLEARANCE,
  SLEEVELESS_FRONT_CARDIGAN_ROUND_SCOOP_EDGE_GAP,
  tryBuildLiveSleevelessFrontCardiganRoundNotationSvg,
} from "./sleevelessFrontCardiganRoundShapingNotationDiagramSvg";
import { shouldUseGeneratedSleevelessFrontCardiganVNeckNotation } from "./sleevelessFrontCardiganVNeckShapingNotationDiagramSvg";
import { collectRoundFrontInnerNeckShapingPoints } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "./sleevelessFrontStsRowsDiagramSvg";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontVNeckNotationSvg } from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessBackNotationSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function cardiganRoundStraightPattern(): Record<string, unknown> {
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

function cardiganVStraightPattern(): Record<string, unknown> {
  const pattern = cardiganRoundStraightPattern();
  pattern.style = { ...(pattern.style as object), neckline: "v-neck" };
  return pattern;
}

function cardiganRoundAlinePattern(): Record<string, unknown> {
  const pattern = cardiganRoundStraightPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  return pattern;
}

function pulloverVPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 6.86,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "pullover", neckline: "v-neck", frontStyle: "closed", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function pulloverRoundPattern(): Record<string, unknown> {
  const pattern = pulloverVPattern();
  pattern.style = { ...(pattern.style as object), neckline: "round" };
  (pattern.fit as { selectedMeasurements: Record<string, number> }).selectedMeasurements.front_neck_depth = 3;
  return pattern;
}

function svgAttr(svg: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function pathD(svg: string, role: string): string {
  return new RegExp(`data-role="${role}"[^>]*\\sd="([^"]+)"`).exec(svg)?.[1] ?? "";
}

function pathPoints(svg: string, role: string): { x: number; y: number }[] {
  const nums = [...pathD(svg, role).matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return pts;
}

function roles(svg: string, role: string): string[] {
  return svg.match(new RegExp(`data-role="${role}"[^>]*>`, "g")) ?? [];
}

function zoneAttr(svg: string, role: string, name: string): number {
  const tag = roles(svg, role)[0] ?? "";
  return Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1] ?? NaN);
}

function textXY(svg: string, role: string): { x: number; y: number; t: string; order: number }[] {
  const tags = svg.match(new RegExp(`<text[^>]*data-role="${role}"[^>]*>[^<]*`, "g")) ?? [];
  return tags.map((tag) => ({
    x: Number(/[\s]x="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    y: Number(/[\s]y="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    t: />([^<]*)$/.exec(tag)?.[1] ?? "",
    order: Number(/data-stack-order="([^"]+)"/.exec(tag)?.[1] ?? NaN),
  }));
}

describe("generated Cardigan Round Straight Front Shaping Notation", () => {
  it("generates one LEFT FRONT piece with straight CF and a right-only armhole", () => {
    const pattern = cardiganRoundStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(result, pattern);
    expect(shouldUseGeneratedSleevelessFrontCardiganRoundNotation(result, pattern)).toBe(true);
    expect(svg).toContain('data-sleeveless-cardigan-round-generated-notation="true"');
    expect(svg).toContain('data-supported="true"');
    expect(svg).toContain('data-front-piece="leftFront"');
    expect(svg).toContain('data-garment-style="cardigan"');
    expect(svg).toContain('data-neckline-style="round"');
    expect(svg).toContain('data-neckline-construction="half-front-cf"');
    expect(svg).toContain('data-front-band-included="false"');
    expect(svg).toContain('data-neck-contour="one-sided-scoop"');
    expect(svg).toContain(
      `viewBox="0 0 ${SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_VIEWBOX.width} ${SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_VIEWBOX.height}"`,
    );

    const cf = pathPoints(svg, "center-front-edge");
    expect(cf.length).toBeGreaterThanOrEqual(2);
    expect(cf[0]!.x).toBeCloseTo(cf[1]!.x, 2);
    expect(cf[0]!.x).toBeCloseTo(svgNum(svg, "data-cf-x"), 2);
    expect(cf[0]!.x).toBeCloseTo(svgNum(svg, "data-bust-left"), 2);

    expect(roles(svg, "armhole-outline")).toHaveLength(1);
    expect(roles(svg, "armhole-outline")[0]).toContain('data-side="right"');
    expect(svg).not.toContain('data-role="armhole-outline" data-side="left"');
    const armhole = pathPoints(svg, "armhole-outline");
    expect(armhole[0]!.x).toBeCloseTo(svgNum(svg, "data-bust-right"), 2);
    expect(armhole.every((p) => p.x >= svgNum(svg, "data-after-right") - 0.05)).toBe(true);
    expect(svg).not.toMatch(/data-role="left-shoulder-path"|data-side="left"[^>]*shoulder/);
  });

  it("reuses Cardigan Round Stitches & Rows geometry including the one-sided scoop", () => {
    const pattern = cardiganRoundStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const notation = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(result, pattern);
    const sts = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, pattern);
    expect(sts).toBeTruthy();
    const rows = sts!;
    expect(svgNum(notation, "data-hem-sts")).toBe(svgNum(rows, "data-hem-sts"));
    expect(svgNum(notation, "data-bust-sts")).toBe(svgNum(rows, "data-bust-sts"));
    expect(svgNum(notation, "data-after-armhole-sts")).toBe(svgNum(rows, "data-after-armhole-sts"));
    expect(svgNum(notation, "data-neck-sts")).toBe(svgNum(rows, "data-neck-sts"));
    expect(svgNum(notation, "data-shoulder-sts")).toBe(svgNum(rows, "data-shoulder-sts"));
    expect(svgNum(notation, "data-cf-x")).toBeCloseTo(svgNum(rows, "data-cf-x"), 2);
    expect(svgNum(notation, "data-bust-left")).toBeCloseTo(svgNum(rows, "data-bust-left"), 2);
    expect(svgNum(notation, "data-bust-right")).toBeCloseTo(svgNum(rows, "data-bust-right"), 2);
    expect(svgNum(notation, "data-after-right")).toBeCloseTo(svgNum(rows, "data-after-right"), 2);
    expect(svgNum(notation, "data-neck-left")).toBeCloseTo(svgNum(rows, "data-neck-left"), 2);
    expect(svgNum(notation, "data-neck-right")).toBeCloseTo(svgNum(rows, "data-neck-right"), 2);
    expect(svgNum(notation, "data-neck-start-y")).toBeCloseTo(svgNum(rows, "data-neck-start-y"), 2);
    expect(svgNum(notation, "data-armhole-start-y")).toBeCloseTo(svgNum(rows, "data-armhole-start-y"), 2);
    expect(svgNum(notation, "data-last-armhole-y")).toBeCloseTo(svgNum(rows, "data-last-armhole-y"), 2);
    expect(svgNum(notation, "data-shoulder-y")).toBeCloseTo(svgNum(rows, "data-shoulder-y"), 2);
    expect(pathD(notation, "body-outline")).toBe(pathD(rows, "body-outline"));
    expect(pathD(notation, "center-front-edge")).toBe(pathD(rows, "center-front-edge"));
    expect(pathD(notation, "neckline-outline")).toBe(pathD(rows, "neckline-outline"));
    expect(pathD(notation, "armhole-outline")).toBe(pathD(rows, "armhole-outline"));
    expect(pathD(notation, "shoulder-outline")).toBe(pathD(rows, "shoulder-outline"));
    expect(roles(notation, "neckline-outline")[0]).toContain('data-contour="one-sided-scoop"');
    expect(pathD(notation, "neckline-outline")).toMatch(/^M /);
    expect(pathD(notation, "neckline-outline")).toContain(" C ");
    expect(pathD(notation, "neckline-outline")).not.toMatch(/ L /);
  });

  it("uses Cardigan CF neck bind-off and live inner-edge neck/shoulder/armhole events", () => {
    const pattern = cardiganRoundStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    const timeline = result.frontNeckShoulderTimeline ?? [];
    const neckPts = collectRoundFrontInnerNeckShapingPoints(timeline, "right");
    const cfBo =
      result.debug.cardiganFrontInitialNeckBindOffStitches ??
      cardiganFrontInitialNeckBindOffStitches(
        result.debug.necklineStitches ?? 0,
        result.debug.frontNeckDepthRows ?? 0,
      );

    expect(svgAttr(svg, "data-cf-neck-bo-source")).toBe("cardiganFrontInitialNeckBindOffStitches");
    expect(svgAttr(svg, "data-neck-shaping-source")).toBe("frontNeckShoulderTimeline-inner-right");
    expect(svgNum(svg, "data-cf-neck-bo-sts")).toBe(cfBo);
    expect(svgAttr(svg, "data-neck-bo")).toBe(repl["jp-neckline-bo"]);
    expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
    expect(svg).not.toMatch(/>hold\d+</);
    expect(svgAttr(svg, "data-center-held")).toBe("false");
    expect(cfBo).toBeGreaterThan(0);
    expect(roles(svg, "neck-bo").length).toBe(1);
    expect(roles(svg, "cf-neck-bo-event").length).toBe(1);
    expect(svgNum(svg, "data-neck-decrease-count")).toBe(neckPts.length);
    expect(roles(svg, "neck-event").length).toBe(neckPts.length);
    expect(roles(svg, "shoulder-event").length).toBeGreaterThan(0);
    expect(roles(svg, "armhole-event").length).toBeGreaterThan(0);
    expect(result.debug.cardiganHalfLeftCastOnSts).toBeGreaterThan(0);
    expect(svgNum(svg, "data-hem-sts")).toBe(result.debug.cardiganHalfLeftCastOnSts);
    expect(svgNum(svg, "data-hem-sts")).toBeLessThan(result.debug.hemCastOnStitches ?? 999);
  });

  it("uses Front timeline + LEFT FRONT shoulder budget for visible shoulder notation", () => {
    const pattern = cardiganRoundStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    expect(model).toBeTruthy();
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(result, pattern);
    const frontLines = shoulderShapingNotationLinesFromTimeline(
      result.frontNeckShoulderTimeline ?? [],
      "right",
      undefined,
      { shoulderStitchesBudget: model!.shoulder.stitchesPerSide },
    );
    const backLines = shoulderShapingNotationLinesFromTimeline(
      result.backNeckShoulderTimeline ?? result.neckShoulderShapingChart.timeline ?? [],
      "right",
      undefined,
      { shoulderStitchesBudget: result.debug.shoulderStitches },
    );
    const jp = buildFrontJapaneseNotationReplacements(result, pattern)["jp-shoulder-shaping"];
    const backJp = buildBackJapaneseNotationReplacements(result, pattern)["jp-shoulder-shaping"];

    expect(svgAttr(svg, "data-shoulder-shaping-source")).toBe("frontNeckShoulderTimeline-right");
    expect(svgNum(svg, "data-shoulder-budget")).toBe(model!.shoulder.stitchesPerSide);
    expect(svgNum(svg, "data-shoulder-sts")).toBe(model!.widths.shoulderStitchesPerSide);
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(frontLines.join("\n"));
    expect(svgAttr(svg, "data-shoulder-shaping").length).toBeGreaterThan(0);
    expect(textXY(svg, "shoulder-shaping").map((t) => t.t).join("\n")).toBe(frontLines.join("\n"));
    expect(jp).toBe(backJp);
    expect(backLines.join("\n")).toBe(jp);
  });

  it("does not follow a poisoned Back timeline when Front and Back differ", () => {
    const pattern = cardiganRoundStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const model = buildSleevelessFrontStsRowsDiagramModel(result, pattern);
    expect(model).toBeTruthy();
    const frontLines = shoulderShapingNotationLinesFromTimeline(
      result.frontNeckShoulderTimeline ?? [],
      "right",
      undefined,
      { shoulderStitchesBudget: model!.shoulder.stitchesPerSide },
    ).join("\n");

    const fakeBack: RowEntry[] = [
      {
        row: 900,
        events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 7 }],
        stitchesL: 0,
        stitchesR: 0,
        netChangeL: 0,
        netChangeR: -7,
        isSplit: false,
        centerWidth: 0,
        leftOuterEdge: 0,
        leftInnerEdge: 0,
        rightInnerEdge: 0,
        rightOuterEdge: 0,
      },
    ];
    const poisoned: SleevelessBackPatternResult = {
      ...result,
      backNeckShoulderTimeline: fakeBack,
      neckShoulderShapingChart: {
        ...result.neckShoulderShapingChart,
        timeline: fakeBack,
      },
    };
    const poisonedJp = buildFrontJapaneseNotationReplacements(poisoned, pattern)["jp-shoulder-shaping"];
    expect(poisonedJp).not.toBe(frontLines);
    expect(poisonedJp.length).toBeGreaterThan(0);

    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(poisoned, pattern);
    expect(svgAttr(svg, "data-supported")).toBe("true");
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(frontLines);
    expect(svgAttr(svg, "data-shoulder-shaping")).not.toBe(poisonedJp);
    expect(svgAttr(svg, "data-neck-bo")).toBe(
      buildFrontJapaneseNotationReplacements(result, pattern)["jp-neckline-bo"],
    );
    expect(svgAttr(svg, "data-neck-shaping")).toBe(
      buildFrontJapaneseNotationReplacements(result, pattern)["jp-neckline-shaping"],
    );
    expect(svgAttr(svg, "data-armhole-bo")).toBe(
      buildFrontJapaneseNotationReplacements(result, pattern)["jp-armhole-bo"],
    );
    expect(pathD(svg, "body-outline")).toBe(
      pathD(buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(result, pattern), "body-outline"),
    );
  });

  it("stacks CF neck BO lowest and later neckline shaping above it", () => {
    const pattern = cardiganRoundStraightPattern();
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(
      generateSleevelessBackPattern(pattern),
      pattern,
    );
    const bo = textXY(svg, "neck-bo")[0];
    const shaping = textXY(svg, "neck-shaping");
    expect(bo).toBeTruthy();
    expect(bo!.order).toBe(0);
    expect(bo!.y).toBeGreaterThan(svgNum(svg, "data-neck-corner-y") - 1);
    for (const line of shaping) {
      expect(line.y).toBeLessThan(bo!.y);
      expect(line.order).toBeGreaterThan(0);
    }
    for (let i = 1; i < shaping.length; i += 1) {
      expect(shaping[i]!.y).toBeLessThan(shaping[i - 1]!.y);
    }
  });

  it("keeps neckline notation off the RC gutter and beside the scoop", () => {
    const pattern = cardiganRoundStraightPattern();
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(
      generateSleevelessBackPattern(pattern),
      pattern,
    );
    const gutterX = svgNum(svg, "data-rc-gutter-x");
    const rcSafeX = zoneAttr(svg, "neck-label-zone", "data-rc-safe-x");
    const scoopX = zoneAttr(svg, "neck-label-zone", "data-scoop-x");
    const neckX = zoneAttr(svg, "neck-label-zone", "data-x");
    expect(svgNum(svg, "data-rc-gutter-min-clearance")).toBe(
      SLEEVELESS_FRONT_CARDIGAN_ROUND_RC_GUTTER_MIN_CLEARANCE,
    );
    expect(rcSafeX).toBeCloseTo(gutterX + SLEEVELESS_FRONT_CARDIGAN_ROUND_RC_GUTTER_MIN_CLEARANCE, 2);
    expect(neckX).toBeGreaterThanOrEqual(rcSafeX - 0.05);
    expect(neckX).toBeGreaterThanOrEqual(scoopX + SLEEVELESS_FRONT_CARDIGAN_ROUND_SCOOP_EDGE_GAP - 0.05);
    expect(roles(svg, "neck-label-zone")[0]).toContain('data-placement="cardigan-round-scoop"');
    expect([...textXY(svg, "neck-bo"), ...textXY(svg, "neck-shaping")].every((t) => t.x >= rcSafeX)).toBe(
      true,
    );
    expect(textXY(svg, "neck-start-rc")[0]?.x).toBeCloseTo(gutterX, 2);
    expect(textXY(svg, "rc-reset")[0]?.x).toBeCloseTo(gutterX, 2);

    const ahX = zoneAttr(svg, "armhole-label-zone", "data-x");
    const ahOutline = zoneAttr(svg, "armhole-label-zone", "data-outline-x");
    expect(ahX).toBeGreaterThanOrEqual(
      ahOutline + SLEEVELESS_FRONT_CARDIGAN_ROUND_ARMHOLE_LABEL_CLEARANCE - 0.05,
    );
    const shX = zoneAttr(svg, "shoulder-label-zone", "data-x");
    const shOutline = zoneAttr(svg, "shoulder-label-zone", "data-outline-x");
    expect(shX).toBeGreaterThan(shOutline);
    expect(zoneAttr(svg, "shoulder-label-zone", "data-y")).toBeGreaterThan(
      svgNum(svg, "data-neck-corner-y") - 8,
    );
  });

  it("uses 17 / 14 typography", () => {
    const pattern = cardiganRoundStraightPattern();
    const svg = buildSleevelessFrontCardiganRoundShapingNotationDiagramSvg(
      generateSleevelessBackPattern(pattern),
      pattern,
    );
    expect(SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_FS_NOTATION).toBe(17);
    expect(SLEEVELESS_FRONT_CARDIGAN_ROUND_NOTATION_FS_RC).toBe(14);
    expect(svg).toContain('font-size="17"');
    expect(svg).toContain('font-size="14"');
    expect(svg).not.toContain('font-size="13"');
    expect(svg).not.toContain('font-size="12"');
  });

  it("keeps Cardigan V, Pullover V/Round, and Back notation gates unchanged", () => {
    const cardiganRound = cardiganRoundStraightPattern();
    const cardiganRoundResult = generateSleevelessBackPattern(cardiganRound);
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(cardiganRoundResult, cardiganRound)).toBe(
      false,
    );
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(cardiganRoundResult, cardiganRound)).toBeNull();
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(cardiganRoundResult, cardiganRound)).toBeNull();
    expect(tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(cardiganRoundResult, cardiganRound)).toBeTruthy();

    const cardiganV = cardiganVStraightPattern();
    const cardiganVResult = generateSleevelessBackPattern(cardiganV);
    expect(shouldUseGeneratedSleevelessFrontCardiganRoundNotation(cardiganVResult, cardiganV)).toBe(false);
    expect(tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(cardiganVResult, cardiganV)).toBeNull();
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(cardiganVResult, cardiganV)).toBe(true);

    const pulloverV = pulloverVPattern();
    const pulloverVResult = generateSleevelessBackPattern(pulloverV);
    expect(shouldUseGeneratedSleevelessFrontCardiganRoundNotation(pulloverVResult, pulloverV)).toBe(false);
    expect(tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(pulloverVResult, pulloverV)).toBeNull();
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(pulloverVResult, pulloverV)).toBeTruthy();

    const pulloverRound = pulloverRoundPattern();
    const pulloverRoundResult = generateSleevelessBackPattern(pulloverRound);
    expect(tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(pulloverRoundResult, pulloverRound)).toBeNull();
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(pulloverRoundResult, pulloverRound)).toBeTruthy();

    expect(tryBuildLiveSleevelessBackNotationSvg(cardiganRoundResult, cardiganRound)).toBeTruthy();
  });

  it("falls back for Cardigan Round A-line", () => {
    const aline = cardiganRoundAlinePattern();
    const alineResult = generateSleevelessBackPattern(aline);
    expect(shouldUseGeneratedSleevelessFrontCardiganRoundNotation(alineResult, aline)).toBe(false);
    expect(tryBuildLiveSleevelessFrontCardiganRoundNotationSvg(alineResult, aline)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", aline)).toContain(
      "diagram-jp-cardigan-round-aline",
    );
  });

  it("wires generated Cardigan Round hydration after Cardigan V and before static fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessFrontCardiganRoundNotationSvg");
    const fnStart = script.indexOf("async function inlineFrontJapaneseNotationSvg");
    const fnEnd = script.indexOf("async function hydrateSleevelessFrontDiagram");
    const fn = script.slice(fnStart, fnEnd);
    expect(fn.indexOf("tryBuildLiveSleevelessFrontVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontRoundNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg")).toBeLessThan(
      fn.indexOf("tryBuildLiveSleevelessFrontCardiganRoundNotationSvg"),
    );
    expect(fn.indexOf("tryBuildLiveSleevelessFrontCardiganRoundNotationSvg")).toBeLessThan(
      fn.indexOf("resolveSleevelessFrontDiagramSrc"),
    );
    expect(
      existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-round.svg")),
    ).toBe(true);
  });
});
