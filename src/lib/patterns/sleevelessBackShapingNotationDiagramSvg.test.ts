import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectInnerNeckDecreasePointsFromTimeline } from "./notationOverlaySvg";
import { shapingActionRowNumbers } from "./evenShapingSchedule";
import {
  armholeBindOffDecreaseFromEachSide,
  buildBackJapaneseNotationReplacements,
  formatRcNotation,
  garmentRcAtArmholeStart,
  isBackJapaneseNotationSupported,
} from "./sleevelessBackJapaneseNotation";
import { resolveSleevelessBackDiagramSrc } from "./sleevelessBackDiagramSrc";
import {
  buildSleevelessBackShapingNotationDiagramSvg,
  shouldUseGeneratedSleevelessBackNotation,
  SLEEVELESS_BACK_ARMHOLE_LABEL_SAFE_MAX_X,
  SLEEVELESS_BACK_ARMHOLE_LABEL_START_X,
  SLEEVELESS_BACK_ARMHOLE_NOTATION_GAP,
  SLEEVELESS_BACK_BODY_LABEL_OUTLINE_CLEARANCE,
  SLEEVELESS_BACK_NOTATION_VIEWBOX,
  SLEEVELESS_BACK_RC_RESET_GAP,
  sleevelessBackShoulderNotationLines,
  sleevelessBackShoulderPoints,
  tryBuildLiveSleevelessBackNotationSvg,
} from "./sleevelessBackShapingNotationDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

function baseBackPattern(): Record<string, unknown> {
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

function straightBodyPattern(): Record<string, unknown> {
  return baseBackPattern();
}

function inwardBodyPattern(): Record<string, unknown> {
  const pattern = baseBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 48;
  return pattern;
}

function outwardBodyPattern(): Record<string, unknown> {
  const pattern = baseBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.finished_hip = 32;
  return pattern;
}

function wideInwardBodyPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 10,
        neck_opening: 7,
        shoulder_width: 22,
        front_neck_depth: 3,
        back_neck_depth: 1,
        finished_hip: 62,
      },
    },
    style: { garmentStyle: "pullover", neckline: "round", recipientCategory: "mens" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

function deeperBackNeckPattern(): Record<string, unknown> {
  const pattern = baseBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.back_neck_depth = 2.5;
  return pattern;
}

function widerBackNeckPattern(): Record<string, unknown> {
  const pattern = baseBackPattern();
  const fit = pattern.fit as { selectedMeasurements: Record<string, number> };
  fit.selectedMeasurements.neck_opening = 9;
  return pattern;
}

function fineGaugeWidePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 48,
        back_neck_to_hem: 24,
        armhole_depth: 9,
        neck_opening: 7,
        shoulder_width: 18,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { garmentStyle: "pullover", neckline: "round", recipientCategory: "mens" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 7, gaugeRowsPerInch: 10, availableNeedles: 200 },
  };
}

function vNeckPulloverPattern(): Record<string, unknown> {
  const pattern = baseBackPattern();
  pattern.style = { ...(pattern.style as object), neckline: "v-neck" };
  return pattern;
}

function cardiganPattern(): Record<string, unknown> {
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
  const re = new RegExp(`${name}="([^"]*)"`);
  return re.exec(svg)?.[1] ?? "";
}

function svgNum(svg: string, name: string): number {
  return Number(svgAttr(svg, name));
}

function roles(svg: string, role: string): string[] {
  const re = new RegExp(`data-role="${role}"[^>]*>`, "g");
  return svg.match(re) ?? [];
}

function roleRcs(svg: string, role: string): string[] {
  return roles(svg, role)
    .map((tag) => /data-rc="([^"]*)"/.exec(tag)?.[1] ?? "")
    .filter(Boolean);
}

function firstTextPos(svg: string, role: string): { x: number; y: number } {
  return allTextPos(svg, role)[0] ?? { x: NaN, y: NaN };
}

function allTextPos(svg: string, role: string): { x: number; y: number }[] {
  return allTextMeta(svg, role).map(({ x, y }) => ({ x, y }));
}

function allTextMeta(
  svg: string,
  role: string,
): { x: number; y: number; anchor: string; text: string; stackOrder: number }[] {
  const re = new RegExp(`<text[^>]*data-role="${role}"[^>]*>([^<]*)`, "g");
  return [...svg.matchAll(re)].map((m) => {
    const tag = m[0];
    return {
      x: Number(/[\s]x="([^"]+)"/.exec(tag)?.[1] ?? NaN),
      y: Number(/[\s]y="([^"]+)"/.exec(tag)?.[1] ?? NaN),
      anchor: /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "",
      text: m[1] ?? "",
      stackOrder: Number(/data-stack-order="([^"]+)"/.exec(tag)?.[1] ?? NaN),
    };
  });
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

function cubicY(p0: number, c1: number, c2: number, p1: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p1;
}

function firstNeckCubic(svg: string): {
  x0: number;
  y0: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x1: number;
  y1: number;
} | null {
  const m = /M\s+(-?[\d.]+)\s+(-?[\d.]+)\s+C\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(
    pathD(svg, "back-neck-path"),
  );
  if (!m) return null;
  return {
    x0: Number(m[1]),
    y0: Number(m[2]),
    c1x: Number(m[3]),
    c1y: Number(m[4]),
    c2x: Number(m[5]),
    c2y: Number(m[6]),
    x1: Number(m[7]),
    y1: Number(m[8]),
  };
}

function neckPathHasVerticalSlot(svg: string): boolean {
  const d = pathD(svg, "back-neck-path");
  const lineRe = /[ML]\s+(-?[\d.]+)\s+(-?[\d.]+)/g;
  const pts: { x: number; y: number }[] = [];
  for (const m of d.matchAll(lineRe)) {
    pts.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  for (let i = 1; i < pts.length; i += 1) {
    const dx = Math.abs(pts[i]!.x - pts[i - 1]!.x);
    const dy = Math.abs(pts[i]!.y - pts[i - 1]!.y);
    if (dx < 2 && dy > 8) return true;
  }
  const cub = firstNeckCubic(svg);
  if (!cub) return false;
  const earlyX = cubicY(cub.x0, cub.c1x, cub.c2x, cub.x1, 0.12);
  const earlyY = cubicY(cub.y0, cub.c1y, cub.c2y, cub.y1, 0.12);
  return Math.abs(earlyX - cub.x0) < 1.5 && Math.abs(earlyY - cub.y0) > 8;
}

function expectValidSvg(svg: string): void {
  expect(svg).toContain(
    `viewBox="0 0 ${SLEEVELESS_BACK_NOTATION_VIEWBOX.width} ${SLEEVELESS_BACK_NOTATION_VIEWBOX.height}"`,
  );
  expect(svg).toContain('width="100%"');
  expect(svg).toContain('height="auto"');
  expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(svg).toContain('data-sleeveless-back-generated-notation="true"');
  expect(svg).not.toMatch(/\bNaN\b/);
  expect(svg).not.toMatch(/\bInfinity\b/);
  expect(svg).not.toMatch(/\bundefined\b/);
}

function expectParity(
  svg: string,
  result: ReturnType<typeof generateSleevelessBackPattern>,
  pattern: Record<string, unknown>,
): void {
  const repl = buildBackJapaneseNotationReplacements(result, pattern);
  expect(svgAttr(svg, "data-cast-on")).toBe(repl["jp-caston"]);
  expect(svgAttr(svg, "data-armhole-bo")).toBe(repl["jp-armhole-bo"]);
  expect(svgAttr(svg, "data-armhole-shaping")).toBe(repl["jp-armhole-shaping"]);
  expect(svgAttr(svg, "data-neck-bo")).toBe(repl["jp-neckline-bo"]);
  expect(svgAttr(svg, "data-neck-shaping")).toBe(repl["jp-neckline-shaping"]);
  expect(svgAttr(svg, "data-shoulder-shaping")).toBe(sleevelessBackShoulderNotationLines(result).join("\n"));
  expect(svgAttr(svg, "data-shoulder-shaping")).toBe(repl["jp-shoulder-shaping"]);
  expect(svgAttr(svg, "data-rc-reset")).toBe(repl.rc_reset);
  expect(svgAttr(svg, "data-rc-neck-start")).toBe(repl["rc-neckline-start"]);
  expect(svgAttr(svg, "data-rc-armhole-bo")).toBe(repl["rc-armhole-bo"]);
  expect(svgAttr(svg, "data-rc-shoulder-start")).toBe(repl["rc-shoulder-start"]);
  expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
  expect(svg).toContain(repl["jp-caston"]);
  if (repl["jp-armhole-shaping"]) expect(svg).toContain(repl["jp-armhole-shaping"].split("\n")[0]!);
  if (repl["jp-neckline-bo"]) expect(svg).toContain(repl["jp-neckline-bo"]);
  if (repl["jp-neckline-shaping"]) expect(svg).toContain(repl["jp-neckline-shaping"].split("\n")[0]!);
}

function expectYsInViewBox(svg: string): void {
  const vbH = SLEEVELESS_BACK_NOTATION_VIEWBOX.height;
  for (const name of ["data-neck-start-y", "data-armhole-start-y", "data-last-armhole-y", "data-shoulder-y"]) {
    const y = svgNum(svg, name);
    expect(Number.isFinite(y)).toBe(true);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(vbH);
  }
}

describe("buildSleevelessBackShapingNotationDiagramSvg", () => {
  it("is deterministic for the same fixture", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const a = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const b = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    expect(a).toBe(b);
    expectValidSvg(a);
    expect(a).toContain('data-supported="true"');
  });

  it("uses the actual Back cast-on count", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const repl = buildBackJapaneseNotationReplacements(result, pattern);
    const castOn = result.debug.hemCastOnStitches ?? result.debug.backStitches;
    expect(repl["jp-caston"]).toBe(`co${castOn}`);
    expect(svgAttr(svg, "data-cast-on")).toBe(repl["jp-caston"]);
    expect(allTextMeta(svg, "cast-on")[0]?.text).toBe(repl["jp-caston"]);
  });

  it("keeps straight body sides and omits body-shaping notation when widths match", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const hemSts = result.debug.hemCastOnStitches ?? result.debug.backStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? hemSts;
    expect(hemSts).toBe(bustSts);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("straight");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgAttr(svg, "data-body-shaping")).toBe("");
    expect(roles(svg, "body-shaping")).toHaveLength(0);
    expect(roles(svg, "body-event")).toHaveLength(0);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(2);
    expect(left[0]!.x).toBe(left[1]!.x);
    expect(right[0]!.x).toBe(right[1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBe(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBe(svgNum(svg, "data-bust-right"));
    expectValidSvg(svg);
    expectParity(svg, result, pattern);
  });

  it("slopes the body inward when cast-on is wider than bust", () => {
    const pattern = inwardBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const repl = buildBackJapaneseNotationReplacements(result, pattern);
    const hemSts = result.debug.hemCastOnStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? 0;
    const rows = result.debug.alineBodyShapingRowNumbers ?? [];
    expect(hemSts).toBeGreaterThan(bustSts);
    expect(rows.length).toBeGreaterThan(0);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("inward");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgNum(svg, "data-body-shaping-start-rc")).toBe(rows[0]!);
    expect(svgNum(svg, "data-body-shaping-end-rc")).toBe(rows[rows.length - 1]!);
    expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
    expect(svgAttr(svg, "data-body-shaping").length).toBeGreaterThan(0);
    expect(roles(svg, "body-shaping").length).toBeGreaterThan(0);
    expect(roles(svg, "body-event")).toHaveLength(rows.length);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left[0]!.x).toBeLessThan(left[left.length - 1]!.x);
    expect(right[0]!.x).toBeGreaterThan(right[right.length - 1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBeLessThan(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBeGreaterThan(svgNum(svg, "data-bust-right"));
    expect(svgNum(svg, "data-body-shaping-start-y")).toBeGreaterThan(svgNum(svg, "data-body-shaping-end-y"));
    expectValidSvg(svg);
    expectParity(svg, result, pattern);
  });

  it("slopes the body outward when the generator produces a narrower cast-on", () => {
    const pattern = outwardBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const hemSts = result.debug.hemCastOnStitches ?? 0;
    const bustSts = result.debug.bustBodyStitches ?? 0;
    if (!(hemSts < bustSts)) return;
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const repl = buildBackJapaneseNotationReplacements(result, pattern);
    const rows = result.debug.alineBodyShapingRowNumbers ?? [];
    expect(rows.length).toBeGreaterThan(0);
    expect(svgAttr(svg, "data-body-shaping-direction")).toBe("outward");
    expect(svgNum(svg, "data-body-start-stitches")).toBe(hemSts);
    expect(svgNum(svg, "data-body-end-stitches")).toBe(bustSts);
    expect(svgNum(svg, "data-body-shaping-start-rc")).toBe(rows[0]!);
    expect(svgNum(svg, "data-body-shaping-end-rc")).toBe(rows[rows.length - 1]!);
    expect(svgAttr(svg, "data-body-shaping")).toBe(repl["jp-body-shaping"]);
    expect(svgAttr(svg, "data-body-shaping")).toMatch(/^\+/);
    expect(roles(svg, "body-shaping").length).toBeGreaterThan(0);
    const left = pathPoints(svg, "left-body-path");
    const right = pathPoints(svg, "right-body-path");
    expect(left[0]!.x).toBeGreaterThan(left[left.length - 1]!.x);
    expect(right[0]!.x).toBeLessThan(right[right.length - 1]!.x);
    expect(svgNum(svg, "data-hem-left")).toBeGreaterThan(svgNum(svg, "data-bust-left"));
    expect(svgNum(svg, "data-hem-right")).toBeLessThan(svgNum(svg, "data-bust-right"));
    expectValidSvg(svg);
    expectParity(svg, result, pattern);
  });

  it("uses canonical Back armhole bind-off and decrease geometry", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const eachSide = result.debug.armholeStitchesEachSide!;
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide);
    expect(svgNum(svg, "data-bind-off-sts")).toBe(bindOffSts);
    expect(svgNum(svg, "data-decrease-sts")).toBe(decreaseSts);
    expect(svgAttr(svg, "data-armhole-bo")).toBe(`bo${bindOffSts}`);
    if (decreaseSts > 0) {
      expect(svgAttr(svg, "data-armhole-shaping")).toBe(`1s-2r-${decreaseSts}x`);
    }
    const expectedDecs = shapingActionRowNumbers(2, decreaseSts, 2).map((n) => formatRcNotation(n));
    const drawn = roleRcs(svg, "armhole-event");
    for (const rc of expectedDecs) {
      expect(drawn).toContain(rc);
    }
    expect(svgNum(svg, "data-last-armhole-y")).toBeLessThan(svgNum(svg, "data-armhole-start-y"));
    expectParity(svg, result, pattern);
  });

  it("matches existing Back Japanese notation helpers for armhole and neck", () => {
    for (const pattern of [straightBodyPattern(), inwardBodyPattern(), fineGaugeWidePattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
      expectParity(svg, result, pattern);
    }
  });

  it("responds to Back neckline depth and width", () => {
    const shallow = straightBodyPattern();
    const deep = deeperBackNeckPattern();
    const wide = widerBackNeckPattern();
    const shallowResult = generateSleevelessBackPattern(shallow);
    const deepResult = generateSleevelessBackPattern(deep);
    const wideResult = generateSleevelessBackPattern(wide);
    const shallowSvg = buildSleevelessBackShapingNotationDiagramSvg(shallowResult, shallow);
    const deepSvg = buildSleevelessBackShapingNotationDiagramSvg(deepResult, deep);
    const wideSvg = buildSleevelessBackShapingNotationDiagramSvg(wideResult, wide);

    expect(deepResult.debug.backNeckDepthRows).toBeGreaterThan(shallowResult.debug.backNeckDepthRows);
    expect(svgNum(deepSvg, "data-neck-depth-rows")).toBe(deepResult.debug.backNeckDepthRows);
    expect(svgNum(shallowSvg, "data-neck-depth-rows")).toBe(shallowResult.debug.backNeckDepthRows);
    expect(svgNum(deepSvg, "data-neck-depth-rows")).toBeGreaterThan(
      svgNum(shallowSvg, "data-neck-depth-rows"),
    );
    expect(svgNum(deepSvg, "data-neck-start-y") - svgNum(deepSvg, "data-neck-corner-y")).toBeGreaterThan(
      svgNum(shallowSvg, "data-neck-start-y") - svgNum(shallowSvg, "data-neck-corner-y"),
    );

    expect(wideResult.debug.necklineStitches ?? 0).toBeGreaterThan(shallowResult.debug.necklineStitches ?? 0);
    expect(svgNum(wideSvg, "data-neck-width-stitches")).toBeGreaterThan(
      svgNum(shallowSvg, "data-neck-width-stitches"),
    );
    expect(svgNum(wideSvg, "data-neck-right") - svgNum(wideSvg, "data-neck-left")).toBeGreaterThan(
      svgNum(shallowSvg, "data-neck-right") - svgNum(shallowSvg, "data-neck-left"),
    );
    expect(svgAttr(shallowSvg, "data-neck-contour")).toBe("scoop");
    expect(svgAttr(deepSvg, "data-neck-contour")).toBe("scoop");
    expect(pathD(shallowSvg, "back-neck-path")).toMatch(/C /);
    expect(pathD(deepSvg, "back-neck-path")).toMatch(/C /);
    const neck = pathPoints(shallowSvg, "back-neck-path");
    expect(neck.length).toBeGreaterThanOrEqual(3);
    expect(neck[0]!.x).toBeLessThan(neck[neck.length - 1]!.x);
    expectValidSvg(deepSvg);
    expectParity(deepSvg, deepResult, deep);
    expectParity(wideSvg, wideResult, wide);
  });

  it("draws a smooth scoop for a shallow ~1in Back neck, not a rectangular notch", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    expect(result.debug.backNeckDepthRows).toBeGreaterThan(0);
    expect(result.debug.backNeckDepthRows).toBeLessThanOrEqual(10);
    expect(pathD(svg, "back-neck-path")).toMatch(/C /);
    expect(pathD(svg, "back-neck-path")).not.toMatch(/ L /);
    expect(neckPathHasVerticalSlot(svg)).toBe(false);
    const cub = firstNeckCubic(svg)!;
    expect(cub).toBeTruthy();
    expect(cub.c1y).toBeCloseTo(cub.y0, 1);
    expect(Math.abs(cub.c1x - cub.x0)).toBeGreaterThan(4);
    expect(cub.y1).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 1);
    expect(svgNum(svg, "data-neck-depth-y")).toBeCloseTo(svgNum(svg, "data-neck-start-y"), 1);
    expect(svgNum(svg, "data-neck-left-x")).toBe(svgNum(svg, "data-neck-left"));
    expect(svgNum(svg, "data-neck-right-x")).toBe(svgNum(svg, "data-neck-right"));
    expect(svgNum(svg, "data-neck-right-x") - svgNum(svg, "data-neck-left-x")).toBeGreaterThan(8);
    for (const p of pathPoints(svg, "back-neck-path")) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SLEEVELESS_BACK_NOTATION_VIEWBOX.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(SLEEVELESS_BACK_NOTATION_VIEWBOX.height);
    }
    expectParity(svg, result, pattern);
  });

  it("deepens the generated scoop when the canonical Back neck is deeper", () => {
    const shallow = straightBodyPattern();
    const deep = deeperBackNeckPattern();
    const shallowResult = generateSleevelessBackPattern(shallow);
    const deepResult = generateSleevelessBackPattern(deep);
    const shallowSvg = buildSleevelessBackShapingNotationDiagramSvg(shallowResult, shallow);
    const deepSvg = buildSleevelessBackShapingNotationDiagramSvg(deepResult, deep);
    const shallowCub = firstNeckCubic(shallowSvg)!;
    const deepCub = firstNeckCubic(deepSvg)!;
    const shallowMidY = cubicY(shallowCub.y0, shallowCub.c1y, shallowCub.c2y, shallowCub.y1, 0.5);
    const deepMidY = cubicY(deepCub.y0, deepCub.c1y, deepCub.c2y, deepCub.y1, 0.5);
    expect(deepMidY - deepCub.y0).toBeGreaterThan(shallowMidY - shallowCub.y0);
    expect(svgNum(deepSvg, "data-neck-width-stitches")).toBe(deepResult.debug.necklineStitches);
    expect(pathD(deepSvg, "back-neck-path")).toMatch(/C /);
    expect(neckPathHasVerticalSlot(deepSvg)).toBe(false);
    expect(svgAttr(deepSvg, "data-neck-bo")).toBe(
      buildBackJapaneseNotationReplacements(deepResult, deep)["jp-neckline-bo"],
    );
  });

  it("widens the scoop when the canonical Back neck is wider", () => {
    const narrow = straightBodyPattern();
    const wide = widerBackNeckPattern();
    const narrowSvg = buildSleevelessBackShapingNotationDiagramSvg(
      generateSleevelessBackPattern(narrow),
      narrow,
    );
    const wideSvg = buildSleevelessBackShapingNotationDiagramSvg(generateSleevelessBackPattern(wide), wide);
    expect(svgNum(wideSvg, "data-neck-right-x") - svgNum(wideSvg, "data-neck-left-x")).toBeGreaterThan(
      svgNum(narrowSvg, "data-neck-right-x") - svgNum(narrowSvg, "data-neck-left-x"),
    );
  });

  it("does not draw a V for the Back neckline", () => {
    const svg = buildSleevelessBackShapingNotationDiagramSvg(
      generateSleevelessBackPattern(straightBodyPattern()),
      straightBodyPattern(),
    );
    expect(svgAttr(svg, "data-neck-contour")).toBe("scoop");
    expect(pathD(svg, "back-neck-path")).toMatch(/C /);
    expect(svgNum(svg, "data-neck-center-right")).toBeGreaterThan(svgNum(svg, "data-neck-center-left"));
    const cub = firstNeckCubic(svg)!;
    expect(cub.c1y).toBeCloseTo(cub.y0, 1);
    expect(cub.c2y).toBeCloseTo(cub.y1, 1);
  });

  it("places Back neckline notation in a reserved zone below the scoop", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    expect(roles(svg, "neck-label-zone")).toHaveLength(1);
    const neckPathBottom = svgNum(svg, "data-neck-start-y");
    for (const role of ["neck-bo", "neck-shaping"]) {
      for (const pos of allTextPos(svg, role)) {
        expect(pos.y).toBeGreaterThan(neckPathBottom + 8);
        expect(pos.x).toBeGreaterThan(svgNum(svg, "data-neck-left") - 20);
        expect(pos.x).toBeLessThan(svgNum(svg, "data-neck-right") + 20);
      }
    }
    const shoulder = firstTextPos(svg, "shoulder-shaping");
    const neckLabel = firstTextPos(svg, "neck-bo");
    if (Number.isFinite(shoulder.y) && Number.isFinite(neckLabel.y)) {
      expect(neckLabel.y).toBeGreaterThan(shoulder.y);
    }
    expect(firstTextPos(svg, "neck-start-rc").x).toBeLessThan(100);
  });

  it("draws a single sloped shoulder from filtered Back shoulder events", () => {
    for (const pattern of [straightBodyPattern(), inwardBodyPattern(), fineGaugeWidePattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
      const passes = sleevelessBackShoulderPoints(result);
      expect(svgAttr(svg, "data-shoulder-contour")).toBe("slope");
      expect(svgNum(svg, "data-shoulder-pass-count")).toBe(passes.length);
      expect(svgNum(svg, "data-shoulder-shaping-stitches")).toBe(
        passes.reduce((sum, p) => sum + p.amount, 0),
      );
      const left = pathPoints(svg, "left-shoulder-path");
      const right = pathPoints(svg, "right-shoulder-path");
      expect(left).toHaveLength(2);
      expect(right).toHaveLength(2);
      if (passes.length > 0) {
        expect(left[1]!.y).toBeLessThan(left[0]!.y);
        expect(right[1]!.y).toBeLessThan(right[0]!.y);
        expect(left[0]!.x).toBeLessThan(left[1]!.x);
        expect(right[0]!.x).toBeGreaterThan(right[1]!.x);
      }
      expect(svgAttr(svg, "data-shoulder-shaping")).not.toMatch(/^bo/i);
      expect(svgAttr(svg, "data-shoulder-shaping")).not.toBe(svgAttr(svg, "data-armhole-bo"));
      expect(firstTextPos(svg, "shoulder-shaping").y).toBeLessThan(svgNum(svg, "data-shoulder-top-y") - 16);
    }
  });

  it("keeps RC reset matching written Back instructions", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const repl = buildBackJapaneseNotationReplacements(result, pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    const armholeStart = garmentRcAtArmholeStart(result.debug)!;
    expect(svgAttr(svg, "data-reset")).toBe("true");
    expect(svg).toContain("↺ rc000");
    expect(roles(svg, "rc-reset")).toHaveLength(1);
    expect(svgAttr(svg, "data-rc-armhole-bo")).toBe(formatRcNotation(armholeStart));
    expect(svgAttr(svg, "data-rc-armhole-bo")).toBe(repl["rc-armhole-bo"]);
    expect(svgAttr(svg, "data-rc-neck-start")).toBe(repl["rc-neckline-start"]);
    expect(svgAttr(svg, "data-rc-shoulder-start")).toBe(repl["rc-shoulder-start"]);
    const armRc = firstTextPos(svg, "armhole-start-rc");
    const reset = firstTextPos(svg, "rc-reset");
    expect(Math.abs(armRc.y - reset.y)).toBeGreaterThanOrEqual(SLEEVELESS_BACK_RC_RESET_GAP);
    expect(armRc.x).toBeLessThan(svgNum(svg, "data-hem-left"));
    expect(reset.x).toBe(armRc.x);
  });

  it("places body-shaping notation inside the garment with outline clearance", () => {
    for (const pattern of [inwardBodyPattern(), wideInwardBodyPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
      const labels = allTextMeta(svg, "body-shaping");
      expect(labels.length).toBeGreaterThan(0);
      const labelX = svgNum(svg, "data-body-label-x");
      const outlineX = svgNum(svg, "data-body-outline-x-at-label");
      const clearance = svgNum(svg, "data-body-label-clearance");
      expect(clearance).toBe(SLEEVELESS_BACK_BODY_LABEL_OUTLINE_CLEARANCE);
      expect(roles(svg, "body-shaping-label-zone")).toHaveLength(1);
      expect(labelX).toBeGreaterThan(SLEEVELESS_BACK_NOTATION_VIEWBOX.width / 2);
      expect(outlineX).toBeGreaterThan(labelX);
      expect(outlineX - labelX).toBeGreaterThanOrEqual(clearance);
      expect(labelX).not.toBe(SLEEVELESS_BACK_ARMHOLE_LABEL_START_X);
      for (const t of labels) {
        expect(t.anchor).toBe("end");
        expect(t.x).toBeLessThan(outlineX);
      }
    }
  });

  it("keeps Armhole labels inside the right safe gutter", () => {
    for (const pattern of [straightBodyPattern(), inwardBodyPattern(), fineGaugeWidePattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
      const cap = svgNum(svg, "data-right-label-safe-max-x");
      expect(cap).toBe(SLEEVELESS_BACK_ARMHOLE_LABEL_SAFE_MAX_X);
      const bo = allTextMeta(svg, "armhole-bo");
      const shaping = allTextMeta(svg, "armhole-shaping");
      expect(bo.length).toBeGreaterThan(0);
      expect(shaping.length).toBeGreaterThan(0);
      const xs = [...bo, ...shaping].map((t) => t.x);
      expect(new Set(xs).size).toBe(1);
      expect(xs[0]).toBe(SLEEVELESS_BACK_ARMHOLE_LABEL_START_X);
      for (const t of [...bo, ...shaping]) {
        expect(t.x).toBeLessThanOrEqual(cap);
        expect(t.anchor).toBe("start");
      }
      expect(bo[0]!.y).toBeLessThan(shaping[0]!.y);
      expect(shaping[0]!.y - bo[0]!.y).toBe(SLEEVELESS_BACK_ARMHOLE_NOTATION_GAP);
    }
  });

  it("keeps semantic event hooks without customer-facing dots", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
    expect(roles(svg, "armhole-event").length).toBeGreaterThan(0);
    expect(roles(svg, "neck-event").length + roles(svg, "neck-start").length).toBeGreaterThan(0);
    expect(roles(svg, "shoulder-event").length).toBeGreaterThan(0);
    expect(roles(svg, "back-neck-path")).toHaveLength(1);
    expect(svg).not.toMatch(/<circle\b/);
    expect(svg).toMatch(/<g data-role="armhole-event"/);
    const timeline = result.backNeckShoulderTimeline ?? [];
    const neckPts = collectInnerNeckDecreasePointsFromTimeline(timeline, "right");
    if (neckPts.length > 0) {
      expect(roles(svg, "neck-event").length).toBeGreaterThan(0);
    }
  });

  it("adapts body width and cast-on when gauge and garment width change", () => {
    const base = {
      fit: {
        sizingChart: "girls",
        selectedMeasurements: {
          finished_bust_chest: 28,
          back_neck_to_hem: 16,
          armhole_depth: 6,
          neck_opening: 5,
          shoulder_width: 10,
          front_neck_depth: 2,
          back_neck_depth: 1,
        },
      },
      style: { garmentStyle: "pullover", neckline: "round", recipientCategory: "girls" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 4, gaugeRowsPerInch: 6, availableNeedles: 200 },
    };
    const fine = fineGaugeWidePattern();
    const baseSvg = buildSleevelessBackShapingNotationDiagramSvg(
      generateSleevelessBackPattern(base),
      base,
    );
    const fineResult = generateSleevelessBackPattern(fine);
    const fineSvg = buildSleevelessBackShapingNotationDiagramSvg(fineResult, fine);
    expectValidSvg(fineSvg);
    expectYsInViewBox(fineSvg);
    expectParity(fineSvg, fineResult, fine);
    expect(svgAttr(fineSvg, "data-cast-on")).not.toBe(svgAttr(baseSvg, "data-cast-on"));
    expect(svgNum(fineSvg, "data-body-width")).not.toBe(svgNum(baseSvg, "data-body-width"));
    expect(svgNum(fineSvg, "data-body-start-stitches")).not.toBe(svgNum(baseSvg, "data-body-start-stitches"));
  });

  it("does not emit invalid numeric tokens", () => {
    for (const pattern of [
      straightBodyPattern(),
      inwardBodyPattern(),
      outwardBodyPattern(),
      deeperBackNeckPattern(),
      widerBackNeckPattern(),
      fineGaugeWidePattern(),
      vNeckPulloverPattern(),
      cardiganPattern(),
    ]) {
      const result = generateSleevelessBackPattern(pattern);
      const svg = buildSleevelessBackShapingNotationDiagramSvg(result, pattern);
      expect(svg).not.toMatch(/\bNaN\b/);
      expect(svg).not.toMatch(/\bInfinity\b/);
      expect(svg).not.toMatch(/\bundefined\b/);
    }
  });

  it("supports V-neck pullover Back and cardigan Back without Front V assumptions", () => {
    const vNeck = vNeckPulloverPattern();
    const vResult = generateSleevelessBackPattern(vNeck);
    const vSvg = buildSleevelessBackShapingNotationDiagramSvg(vResult, vNeck);
    expect(vResult.neckShoulderShapingChart.sleevelessFullWidthVNeckFront).not.toBe(true);
    expect(svgAttr(vSvg, "data-neck-contour")).toBe("scoop");
    expect(vSvg).not.toContain('data-role="v-point"');
    expectParity(vSvg, vResult, vNeck);

    const cardigan = cardiganPattern();
    const cResult = generateSleevelessBackPattern(cardigan);
    const cSvg = buildSleevelessBackShapingNotationDiagramSvg(cResult, cardigan);
    expect(isBackJapaneseNotationSupported(cardigan, cResult)).toBe(true);
    expectValidSvg(cSvg);
    expectParity(cSvg, cResult, cardigan);
  });
});

describe("live Sleeveless Back notation cutover", () => {
  it("uses the generated renderer for supported Sleeveless Back", () => {
    for (const pattern of [straightBodyPattern(), inwardBodyPattern(), vNeckPulloverPattern()]) {
      const result = generateSleevelessBackPattern(pattern);
      const live = tryBuildLiveSleevelessBackNotationSvg(result, pattern);
      expect(shouldUseGeneratedSleevelessBackNotation(result, pattern)).toBe(true);
      expect(live).toBeTruthy();
      expect(live).toContain('data-sleeveless-back-generated-notation="true"');
      expect(live).toContain('data-supported="true"');
      expect(live).toBe(buildSleevelessBackShapingNotationDiagramSvg(result, pattern));
    }
  });

  it("falls back when the Back chart is not live", () => {
    const pattern = straightBodyPattern();
    const result = generateSleevelessBackPattern(pattern);
    const unsupported = {
      ...result,
      neckShoulderChartUsesLiveRows: false,
    };
    expect(shouldUseGeneratedSleevelessBackNotation(unsupported, pattern)).toBe(false);
    expect(tryBuildLiveSleevelessBackNotationSvg(unsupported, pattern)).toBeNull();
    const svg = buildSleevelessBackShapingNotationDiagramSvg(unsupported, pattern);
    expect(svg).toContain('data-supported="false"');
    expect(resolveSleevelessBackDiagramSrc("shaping-notation", pattern)).toContain("diagram-jp-back");
  });

  it("keeps the old Back Illustrator asset in the repo for fallback", () => {
    expect(
      existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-back.svg")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "../public/images/patterns/sleeveless/diagrams/diagram-jp-back-aline.svg")),
    ).toBe(true);
  });

  it("wires generated hydration before the Back template fetch", () => {
    const script = readFileSync(join(srcRoot, "scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(script).toContain("tryBuildLiveSleevelessBackNotationSvg");
    expect(script).toContain("sleevelessBackShapingNotationDiagramSvg.ts");

    const fnStart = script.indexOf("async function inlineBackJapaneseNotationSvg");
    expect(fnStart).toBeGreaterThan(-1);
    const fn = script.slice(fnStart, fnStart + 2200);
    expect(fn).toContain("tryBuildLiveSleevelessBackNotationSvg");
    expect(fn.indexOf("tryBuildLiveSleevelessBackNotationSvg")).toBeLessThan(
      fn.indexOf("resolveSleevelessBackDiagramSrc"),
    );
    expect(fn.indexOf("if (generatedSvg)")).toBeLessThan(fn.indexOf("await fetch(notationSrc"));
    expect(fn).not.toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
    expect(script).toContain("tryBuildLiveSleevelessFrontVNeckNotationSvg");
  });
});
