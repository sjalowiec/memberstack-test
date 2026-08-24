import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import {
  buildFrontJapaneseNotationReplacements,
  resolveSleevelessFrontDiagramSrc,
} from "./sleevelessFrontJapaneseNotation";
import {
  buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg,
  shouldUseGeneratedSleevelessFrontCardiganVNeckNotation,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_ARMHOLE_LABEL_CLEARANCE,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_NOTATION,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_RC,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_VIEWBOX,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_RC_GUTTER_MIN_CLEARANCE,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_SHOULDER_OUTLINE_CLEARANCE,
  SLEEVELESS_FRONT_CARDIGAN_VNECK_V_EDGE_GAP,
  tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg,
} from "./sleevelessFrontCardiganVNeckShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontRoundNotationSvg } from "./sleevelessFrontRoundShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "./sleevelessFrontStsRowsDiagramSvg";
import {
  shouldUseGeneratedSleevelessFrontVNeckNotation,
  tryBuildLiveSleevelessFrontVNeckNotationSvg,
} from "./sleevelessFrontVNeckShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessBackNotationSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function cardiganVStraightPattern(): Record<string, unknown> {
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
    style: { garmentStyle: "cardigan", neckline: "v-neck", frontStyle: "open", recipientCategory: "misses" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function cardiganRoundPattern(): Record<string, unknown> {
  const pattern = cardiganVStraightPattern();
  pattern.style = { ...(pattern.style as object), neckline: "round" };
  return pattern;
}

function cardiganVAlinePattern(): Record<string, unknown> {
  const pattern = cardiganVStraightPattern();
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
  pattern.style = { ...(pattern.style as object), neckline: "round", front_neck_depth: 3 };
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

function textXY(svg: string, role: string): { x: number; y: number; anchor: string }[] {
  return (svg.match(new RegExp(`<text[^>]*data-role="${role}"[^>]*>`, "g")) ?? []).map((tag) => ({
    x: Number(/[\s]x="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    y: Number(/[\s]y="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    anchor: /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "",
  }));
}

function shoulderOutlineXAtY(
  afterRight: number,
  neckRight: number,
  shoulderY: number,
  neckCornerY: number,
  y: number,
): number {
  if (y >= shoulderY) return afterRight;
  if (y <= neckCornerY) return neckRight;
  const span = shoulderY - neckCornerY;
  if (!(span > 0)) return Math.max(afterRight, neckRight);
  const t = Math.min(1, Math.max(0, (shoulderY - y) / span));
  return afterRight + t * (neckRight - afterRight);
}

function armholeOutlineXAtY(
  right: number,
  afterRight: number,
  boRight: number,
  armholeStartY: number,
  lastArmholeY: number,
  y: number,
): number {
  if (y >= armholeStartY) return right;
  if (y <= lastArmholeY) return afterRight;
  const span = armholeStartY - lastArmholeY;
  if (!(span > 0)) return Math.max(right, afterRight);
  const t = Math.min(1, Math.max(0, (armholeStartY - y) / span));
  return boRight + t * (afterRight - boRight);
}

describe("generated Cardigan V Straight Front Shaping Notation", () => {
  it("generates one LEFT FRONT piece with CF left and armhole right", () => {
    const pattern = cardiganVStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(result, pattern);
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(result, pattern)).toBe(true);
    expect(svg).toContain('data-sleeveless-cardigan-v-generated-notation="true"');
    expect(svg).toContain('data-supported="true"');
    expect(svg).toContain('data-front-piece="leftFront"');
    expect(svg).toContain('data-garment-style="cardigan"');
    expect(svg).toContain('data-neckline-construction="half-front-cf"');
    expect(svg).toContain('data-front-band-included="false"');
    expect(svg).toContain(
      `viewBox="0 0 ${SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_VIEWBOX.width} ${SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_VIEWBOX.height}"`,
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

    const v = pathPoints(svg, "neckline-outline");
    expect(v).toHaveLength(2);
    expect(v[0]!.x).toBeCloseTo(svgNum(svg, "data-cf-x"), 2);
    expect(v[0]!.y).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 2);
    expect(v[1]!.x).toBeCloseTo(svgNum(svg, "data-neck-right"), 2);
    expect(svg).toContain('data-role="v-point"');
    expect(svg).not.toMatch(/data-role="left-shoulder-path"|data-side="left"[^>]*shoulder/);
  });

  it("reuses Cardigan V Stitches & Rows geometry for the same fixture", () => {
    const pattern = cardiganVStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const notation = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(result, pattern);
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
  });

  it("uses live Cardigan V timeline events and existing JP token strings", () => {
    const pattern = cardiganVStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    const timeline = result.frontNeckShoulderTimeline ?? [];
    const neckPts = collectInnerNeckDecreasePointsFromTimeline(timeline, "right");

    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);
    expect(svgAttr(svg, "data-timeline-source")).toBe(
      "frontNeckShoulderTimeline-full-width-v-right-edge",
    );
    expect(svgAttr(svg, "data-cast-on")).toBe(repl["jp-caston"]);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
    expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(repl["jp-shoulder-shaping"]);
    expect(svgAttr(svg, "data-neck-bo")).toBe("");
    expect(svg).not.toMatch(/>hold\d+</);
    expect(svg).not.toMatch(/data-role="neck-bo"/);
    expect(svgNum(svg, "data-neck-decrease-count")).toBe(neckPts.length);
    expect(roles(svg, "neck-event").length).toBe(neckPts.length);
    expect(roles(svg, "shoulder-event").length).toBeGreaterThan(0);
    expect(roles(svg, "armhole-event").length).toBeGreaterThan(0);
    expect(result.debug.cardiganHalfLeftCastOnSts).toBeGreaterThan(0);
    expect(svgNum(svg, "data-hem-sts")).toBe(result.debug.cardiganHalfLeftCastOnSts);
    expect(svgNum(svg, "data-hem-sts")).toBeLessThan(result.debug.hemCastOnStitches ?? 999);
  });

  it("anchors Cardigan V notation blocks to garment geometry, not canvas slots", () => {
    const pattern = cardiganVStraightPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(result, pattern);
    const repl = buildFrontJapaneseNotationReplacements(result, pattern);

    expect(svgAttr(svg, "data-shoulder-shaping")).toBe(repl["jp-shoulder-shaping"]);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
    expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
    expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
    expect(SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_NOTATION).toBe(17);
    expect(SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_RC).toBe(14);
    expect(svg).toContain('font-size="17"');
    expect(svg).toContain('font-size="14"');

    const afterRight = svgNum(svg, "data-after-right");
    const neckRight = svgNum(svg, "data-neck-right");
    const shoulderY = svgNum(svg, "data-shoulder-y");
    const neckCornerY = svgNum(svg, "data-neck-corner-y");
    const slopeMidX = (afterRight + neckRight) / 2;
    const shX = zoneAttr(svg, "shoulder-label-zone", "data-x");
    const shY = zoneAttr(svg, "shoulder-label-zone", "data-y");
    const slopeX = shoulderOutlineXAtY(afterRight, neckRight, shoulderY, neckCornerY, shY);
    expect(shX).toBeGreaterThan(slopeX);
    expect(shX).toBeGreaterThan(slopeMidX);
    expect(shX - slopeX).toBeGreaterThanOrEqual(
      SLEEVELESS_FRONT_CARDIGAN_VNECK_SHOULDER_OUTLINE_CLEARANCE - 0.05,
    );
    expect(shX - slopeX).toBeLessThan(40);
    expect(shY).toBeGreaterThan(neckCornerY - 4);
    expect(shY).toBeLessThan(shoulderY + 4);
    expect(textXY(svg, "shoulder-shaping").every((t) => t.anchor === "start")).toBe(true);

    const bustRight = svgNum(svg, "data-bust-right");
    const boRight = svgNum(svg, "data-bo-right");
    const armholeStartY = svgNum(svg, "data-armhole-start-y");
    const lastArmholeY = svgNum(svg, "data-last-armhole-y");
    const ahX = zoneAttr(svg, "armhole-label-zone", "data-x");
    const ahY = zoneAttr(svg, "armhole-label-zone", "data-y");
    const ahOutline = armholeOutlineXAtY(
      bustRight,
      afterRight,
      boRight,
      armholeStartY,
      lastArmholeY,
      ahY,
    );
    expect(ahY).toBeCloseTo(armholeStartY, 2);
    expect(ahX).toBeGreaterThan(afterRight);
    expect(ahX).toBeGreaterThanOrEqual(ahOutline + SLEEVELESS_FRONT_CARDIGAN_VNECK_ARMHOLE_LABEL_CLEARANCE - 0.05);
    expect(ahX - ahOutline).toBeLessThan(36);
    const ahTexts = [...textXY(svg, "armhole-bo"), ...textXY(svg, "armhole-shaping")];
    expect(ahTexts.length).toBeGreaterThan(0);
    expect(ahTexts.every((t) => t.x === ahX && t.x > ahOutline)).toBe(true);
    const bo = textXY(svg, "armhole-bo")[0];
    const dec = textXY(svg, "armhole-shaping")[0];
    expect(bo).toBeTruthy();
    expect(dec).toBeTruthy();
    expect(dec!.y).toBeGreaterThan(bo!.y);

    const gutterX = svgNum(svg, "data-rc-gutter-x");
    const neckX = zoneAttr(svg, "neck-label-zone", "data-x");
    const neckY = zoneAttr(svg, "neck-label-zone", "data-y");
    const vEdgeX = zoneAttr(svg, "neck-label-zone", "data-v-edge-x");
    const rcSafeX = zoneAttr(svg, "neck-label-zone", "data-rc-safe-x");
    expect(svgNum(svg, "data-rc-gutter-min-clearance")).toBe(
      SLEEVELESS_FRONT_CARDIGAN_VNECK_RC_GUTTER_MIN_CLEARANCE,
    );
    expect(rcSafeX).toBeCloseTo(gutterX + SLEEVELESS_FRONT_CARDIGAN_VNECK_RC_GUTTER_MIN_CLEARANCE, 2);
    expect(neckX).toBeGreaterThanOrEqual(rcSafeX - 0.05);
    expect(neckX).toBeGreaterThanOrEqual(vEdgeX + SLEEVELESS_FRONT_CARDIGAN_VNECK_V_EDGE_GAP - 0.05);
    expect(neckX).toBeLessThan(neckRight + 24);
    expect(roles(svg, "neck-label-zone")[0]).toContain('data-placement="cardigan-v"');
    expect(neckY).toBeGreaterThan(neckCornerY);
    expect(neckY).toBeLessThanOrEqual(svgNum(svg, "data-neck-start-y") + 0.05);
    expect(textXY(svg, "neck-shaping").every((t) => t.anchor === "start" && t.x >= rcSafeX)).toBe(true);
    expect(textXY(svg, "rc-reset")[0]?.x).toBeCloseTo(gutterX, 2);
    expect(textXY(svg, "neck-start-rc")[0]?.x).toBeCloseTo(gutterX, 2);
  });

  it("uses 17 / 14 typography", () => {
    const pattern = cardiganVStraightPattern();
    const svg = buildSleevelessFrontCardiganVNeckShapingNotationDiagramSvg(
      generateSleevelessBackPattern(pattern),
      pattern,
    );
    expect(SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_NOTATION).toBe(17);
    expect(SLEEVELESS_FRONT_CARDIGAN_VNECK_NOTATION_FS_RC).toBe(14);
    expect(svg).toContain('font-size="17"');
    expect(svg).toContain('font-size="14"');
    expect(svg).not.toContain('font-size="13"');
    expect(svg).not.toContain('font-size="12"');
  });

  it("keeps Pullover V, Pullover Round, and Back notation gates unchanged", () => {
    const cardiganV = cardiganVStraightPattern();
    const cardiganVResult = generateSleevelessBackPattern(cardiganV);
    expect(shouldUseGeneratedSleevelessFrontVNeckNotation(cardiganVResult, cardiganV)).toBe(false);
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(cardiganVResult, cardiganV)).toBeNull();
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(cardiganVResult, cardiganV)).toBeNull();

    const pulloverV = pulloverVPattern();
    const pulloverVResult = generateSleevelessBackPattern(pulloverV);
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(pulloverVResult, pulloverV)).toBe(
      false,
    );
    expect(tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(pulloverVResult, pulloverV)).toBeNull();
    expect(tryBuildLiveSleevelessFrontVNeckNotationSvg(pulloverVResult, pulloverV)).toBeTruthy();

    const pulloverRound = pulloverRoundPattern();
    const pulloverRoundResult = generateSleevelessBackPattern(pulloverRound);
    expect(tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(pulloverRoundResult, pulloverRound)).toBeNull();
    expect(tryBuildLiveSleevelessFrontRoundNotationSvg(pulloverRoundResult, pulloverRound)).toBeTruthy();

    expect(tryBuildLiveSleevelessBackNotationSvg(cardiganVResult, cardiganV)).toBeTruthy();
  });

  it("falls back for Cardigan Round and Cardigan A-line", () => {
    const round = cardiganRoundPattern();
    const roundResult = generateSleevelessBackPattern(round);
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(roundResult, round)).toBe(false);
    expect(tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(roundResult, round)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", round)).toContain(
      "diagram-jp-cardigan-round",
    );

    const aline = cardiganVAlinePattern();
    const alineResult = generateSleevelessBackPattern(aline);
    expect(shouldUseGeneratedSleevelessFrontCardiganVNeckNotation(alineResult, aline)).toBe(false);
    expect(tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg(alineResult, aline)).toBeNull();
    expect(resolveSleevelessFrontDiagramSrc("shaping-notation", aline)).toContain(
      "diagram-jp-cardigan-v-aline",
    );
  });

  it("wires generated Cardigan V hydration after Pullover V/Round and before static fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessFrontCardiganVNeckNotationSvg");
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
      fn.indexOf("resolveSleevelessFrontDiagramSrc"),
    );
    expect(existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-cardigan-v.svg"))).toBe(
      true,
    );
  });
});
