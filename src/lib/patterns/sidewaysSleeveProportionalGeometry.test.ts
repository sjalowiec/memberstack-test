import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatDropShoulderSleeveWorkingNotation } from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveSideXAtY,
  type DropShoulderSleeveDiagramFrame,
} from "./dropShoulderSleeveDiagramSvgShared";
import { buildSidewaysCardiganEditSleeveMeasurementDiagramSvg } from "./sidewaysCardiganEditMeasurementDiagramSvg";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "./sidewaysCardiganSleeveDiagramSvg";
import {
  calculateSidewaysCardiganSleeve,
  type SidewaysCardiganSleeveCalc,
  type SidewaysCardiganSleeveCalcInput,
  type SidewaysCardiganSleeveDirection,
} from "./sidewaysCardiganSleeveCalc";
import { SIDEWAYS_SLEEVE_PX_PER_INCH } from "./sidewaysSleeveProportionalGeometry";

const PX = SIDEWAYS_SLEEVE_PX_PER_INCH;

const EXAMPLE = {
  finishedUpperArmInches: 18,
  finishedWristInches: 8.5,
  sleeveLengthInches: 16.75,
  cuffDepthInches: 2,
};

const SIZES = {
  small: { finishedUpperArmInches: 10, finishedWristInches: 6, sleeveLengthInches: 12, cuffDepthInches: 1.5 },
  typical: EXAMPLE,
  large: { finishedUpperArmInches: 22, finishedWristInches: 11, sleeveLengthInches: 24, cuffDepthInches: 2.5 },
} as const;

type SizeName = keyof typeof SIZES;

function calcFor(
  size: {
    finishedUpperArmInches: number;
    finishedWristInches: number;
    sleeveLengthInches: number;
    cuffDepthInches: number;
  },
  direction: SidewaysCardiganSleeveDirection,
): SidewaysCardiganSleeveCalc {
  const input: SidewaysCardiganSleeveCalcInput = {
    direction,
    finishedUpperArmInches: size.finishedUpperArmInches,
    finishedWristInches: size.finishedWristInches,
    sleeveLengthInches: size.sleeveLengthInches,
    cuffDepthInches: size.cuffDepthInches,
    armholeDepthInches: size.finishedUpperArmInches / 2,
    stitchesPerInch: 5,
    rowsPerInch: 7,
  };
  const result = calculateSidewaysCardiganSleeve(input);
  if (!result.ok) throw new Error(result.error.message);
  return result.calc;
}

function diagrams(
  size: {
    finishedUpperArmInches: number;
    finishedWristInches: number;
    sleeveLengthInches: number;
    cuffDepthInches: number;
  },
  direction: SidewaysCardiganSleeveDirection = "cuff-up",
) {
  const calc = calcFor(size, direction);
  const args = { calc, stitchesPerInch: 5, rowsPerInch: 7 };
  const sts = buildSidewaysCardiganSleeveStitchesRowsSvg(args);
  const notation = buildSidewaysCardiganSleeveShapingNotationSvg(args);
  expect(sts).toBeTruthy();
  expect(notation).toBeTruthy();
  return { calc, sts: sts!, notation: notation! };
}

function attr(svg: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(svg)?.[1] ?? "";
}

function parseViewBox(svg: string) {
  const parts = /viewBox="([^"]+)"/.exec(svg)?.[1]?.trim().split(/[\s,]+/).map(Number) ?? [];
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("missing viewBox");
  }
  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

function pathPoints(svg: string): Array<{ x: number; y: number }> {
  const d = /class="ds-sleeve-diagram__body" d="([^"]+)"/.exec(svg)?.[1] ?? "";
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x === undefined || y === undefined) continue;
    points.push({ x, y });
  }
  return points;
}

function edgeAt(points: Array<{ x: number; y: number }>, y: number) {
  const onEdge = points.filter((point) => Math.abs(point.y - y) < 0.05);
  expect(onEdge.length).toBeGreaterThanOrEqual(2);
  const xs = onEdge.map((point) => point.x);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  return { left, right, width: right - left };
}

function finishedSleeve(svg: string) {
  const points = pathPoints(svg);
  const wristY = Number(attr(svg, "data-wrist-y"));
  const upperY = Number(attr(svg, "data-upper-arm-y"));
  const wrist = edgeAt(points, wristY);
  const upper = edgeAt(points, upperY);
  const ys = points.map((point) => point.y);
  return {
    points,
    wristY,
    upperY,
    wristLeft: wrist.left,
    wristRight: wrist.right,
    upperLeft: upper.left,
    upperRight: upper.right,
    wristWidth: wrist.width,
    upperWidth: upper.width,
    length: Math.max(...ys) - Math.min(...ys),
    midX: (upper.left + upper.right) / 2,
    cuffDepth: Math.abs(Number(attr(svg, "data-cuff-join-y")) - wristY),
  };
}

function frameOf(svg: string): DropShoulderSleeveDiagramFrame {
  const sleeve = finishedSleeve(svg);
  const direction = attr(svg, "data-sleeve-direction") === "top-down" ? "top-down" : "cuff-up";
  const cuffJoinY = Number(attr(svg, "data-cuff-join-y"));
  return {
    direction,
    midX: sleeve.midX,
    top: Math.min(sleeve.upperY, sleeve.wristY),
    bottom: Math.max(sleeve.upperY, sleeve.wristY),
    cuffJoinY,
    wristY: sleeve.wristY,
    upperArmY: sleeve.upperY,
    wristLeft: sleeve.wristLeft,
    wristRight: sleeve.wristRight,
    upperLeft: sleeve.upperLeft,
    upperRight: sleeve.upperRight,
    cuffJoinLeft: sleeve.wristLeft,
    cuffJoinRight: sleeve.wristRight,
  };
}

function expectSameScale(svg: string, inches: { upper: number; wrist: number; length: number; cuff: number }) {
  const sleeve = finishedSleeve(svg);
  expect(sleeve.upperWidth).toBeCloseTo(inches.upper * PX, 2);
  expect(sleeve.wristWidth).toBeCloseTo(inches.wrist * PX, 2);
  expect(sleeve.length).toBeCloseTo(inches.length * PX, 2);
  expect(sleeve.cuffDepth).toBeCloseTo(inches.cuff * PX, 2);
  expect(sleeve.upperWidth / inches.upper).toBeCloseTo(sleeve.wristWidth / inches.wrist, 4);
  expect(sleeve.upperWidth / inches.upper).toBeCloseTo(sleeve.length / inches.length, 4);
  expect(sleeve.upperWidth / inches.upper).toBeCloseTo(sleeve.cuffDepth / inches.cuff, 4);
  expect(attr(svg, "data-sleeve-geometry")).toBe("proportional");
  expect(attr(svg, "data-sleeve-px-per-inch")).toBe(String(PX));
  expect(svg).not.toContain('viewBox="0 0 430 520"');
  return sleeve;
}

type Ink = { role: string; text: string; left: number; right: number; top: number; bottom: number };

function textInk(svg: string): Ink[] {
  const boxes: Ink[] = [];
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const role = /data-role="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const anchor = /text-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const transform = /transform="([^"]+)"/.exec(attrs)?.[1] ?? "";
    const baseX = Number(/\bx="([^"]+)"/.exec(attrs)?.[1] ?? 0);
    const baseY = Number(/\by="([^"]+)"/.exec(attrs)?.[1] ?? 0);
    const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)];
    const lines = tspans.length
      ? tspans.map((tspan) => ({
          text: tspan[2] ?? "",
          size: Number(/font-size="([^"]+)"/.exec(tspan[1] ?? "")?.[1] ?? 14),
          dy: Number(/\bdy="([^"]+)"/.exec(tspan[1] ?? "")?.[1] ?? 0),
        }))
      : [
          {
            text: inner.replace(/<[^>]+>/g, ""),
            size: Number(/font-size="([^"]+)"/.exec(attrs)?.[1] ?? 14),
            dy: 0,
          },
        ];
    let cursor = 0;
    for (const line of lines) {
      cursor += line.dy;
      const width = Math.max(line.size, line.text.length * line.size * 0.62);
      const left = anchor === "start" ? baseX : anchor === "end" ? baseX - width : baseX - width / 2;
      const local = {
        left,
        right: left + width,
        top: baseY + cursor - line.size * 0.92,
        bottom: baseY + cursor + line.size * 0.28,
      };
      const translated = /translate\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/.exec(transform);
      const rotated = /rotate\(\s*(-?\d+(?:\.\d+)?)/.exec(transform);
      if (translated && rotated && Number(rotated[1]) === -90) {
        const tx = Number(translated[1]);
        const ty = Number(translated[2]);
        boxes.push({
          role,
          text: line.text,
          left: tx + local.top,
          right: tx + local.bottom,
          top: ty - local.right,
          bottom: ty - local.left,
        });
      } else {
        boxes.push({ role, text: line.text, ...local });
      }
    }
  }
  return boxes;
}

function overlapsSleeve(box: Ink, frame: DropShoulderSleeveDiagramFrame): boolean {
  const sleeveTop = Math.min(frame.top, frame.bottom);
  const sleeveBottom = Math.max(frame.top, frame.bottom);
  if (box.bottom <= sleeveTop + 1 || box.top >= sleeveBottom - 1) return false;
  const y0 = Math.max(box.top, sleeveTop);
  const y1 = Math.min(box.bottom, sleeveBottom);
  for (const y of [y0, (y0 + y1) / 2, y1]) {
    const left = dropShoulderSleeveSideXAtY(frame, y, "left");
    const right = dropShoulderSleeveSideXAtY(frame, y, "right");
    if (box.right > left + 1 && box.left < right - 1) return true;
  }
  return false;
}

function expectLabelsClearOfSleeve(svg: string) {
  const vb = parseViewBox(svg);
  const frame = frameOf(svg);
  const ink = textInk(svg);
  expect(ink.length).toBeGreaterThan(0);
  for (const box of ink) {
    const label = `${box.role} "${box.text}"`;
    expect(box.left, label).toBeGreaterThanOrEqual(vb.x - 0.5);
    expect(box.right, label).toBeLessThanOrEqual(vb.x + vb.width + 0.5);
    expect(box.top, label).toBeGreaterThanOrEqual(vb.y - 0.5);
    expect(box.bottom, label).toBeLessThanOrEqual(vb.y + vb.height + 0.5);
    if (box.role === "sleeve-direction") continue;
    expect(overlapsSleeve(box, frame), label).toBe(false);
  }
  const num = (tag: string, name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
  const inside = (x: number, y: number) => {
    expect(x).toBeGreaterThanOrEqual(vb.x - 1);
    expect(x).toBeLessThanOrEqual(vb.x + vb.width + 1);
    expect(y).toBeGreaterThanOrEqual(vb.y - 1);
    expect(y).toBeLessThanOrEqual(vb.y + vb.height + 1);
  };
  for (const match of svg.matchAll(/<line\b[^>]*>/g)) {
    const tag = match[0];
    inside(num(tag, "x1"), num(tag, "y1"));
    inside(num(tag, "x2"), num(tag, "y2"));
  }
  for (const match of svg.matchAll(/<rect\b[^>]*>/g)) {
    const tag = match[0];
    const x = num(tag, "x");
    const y = num(tag, "y");
    inside(x, y);
    inside(x + num(tag, "width"), y + num(tag, "height"));
  }
  for (const match of svg.matchAll(/<polygon\b[^>]*>/g)) {
    const points = /points="([^"]+)"/.exec(match[0])?.[1] ?? "";
    const nums = points.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (x === undefined || y === undefined) continue;
      inside(x, y);
    }
  }
}

function expectCalcLabels(svg: string, calc: SidewaysCardiganSleeveCalc) {
  const notation = formatDropShoulderSleeveWorkingNotation(
    {
      topSts: calc.topSts,
      wristSts: calc.wristSts,
      cuffRows: calc.cuffRows,
      sleeveBodyRows: calc.sleeveBodyRows,
      sleeveTotalRows: calc.sleeveTotalRows,
      direction: calc.direction,
    },
    { includeRowSpans: true },
  );
  expect(attr(svg, "data-top-stitches")).toBe(String(calc.topSts));
  expect(attr(svg, "data-wrist-stitches")).toBe(String(calc.wristSts));
  expect(attr(svg, "data-cuff-rows")).toBe(String(calc.cuffRows));
  expect(attr(svg, "data-sleeve-body-rows")).toBe(String(calc.sleeveBodyRows));
  expect(attr(svg, "data-sleeve-total-rows")).toBe(String(calc.sleeveTotalRows));
  expect(attr(svg, "data-shaping-notation")).toBe(notation);
  expect(attr(svg, "data-upper-arm-inches")).toBe(String(calc.finished.upperArmInches));
  expect(attr(svg, "data-wrist-inches")).toBe(String(calc.finished.wristInches));
  expect(attr(svg, "data-sleeve-length-inches")).toBe(String(calc.finished.sleeveLengthInches));
}

describe("Sideways finished sleeve diagrams share proportional geometry", () => {
  it("draws 18 / 8.5 / 16.75 at one scale on both diagrams and both directions", () => {
    for (const direction of ["cuff-up", "top-down"] as const) {
      const { calc, sts, notation } = diagrams(EXAMPLE, direction);
      const stsShape = expectSameScale(sts, {
        upper: 18,
        wrist: 8.5,
        length: 16.75,
        cuff: 2,
      });
      const notationShape = expectSameScale(notation, {
        upper: 18,
        wrist: 8.5,
        length: 16.75,
        cuff: 2,
      });
      expect(notationShape.upperWidth).toBeCloseTo(stsShape.upperWidth, 4);
      expect(notationShape.wristWidth).toBeCloseTo(stsShape.wristWidth, 4);
      expect(notationShape.length).toBeCloseTo(stsShape.length, 4);
      expect(notationShape.cuffDepth).toBeCloseTo(stsShape.cuffDepth, 4);
      expect(stsShape.upperWidth).toBeCloseTo(288, 2);
      expect(stsShape.wristWidth).toBeCloseTo(136, 2);
      expect(stsShape.length).toBeCloseTo(268, 2);
      expect(stsShape.cuffDepth).toBeCloseTo(32, 2);
      expectCalcLabels(sts, calc);
      expectCalcLabels(notation, calc);
      const edit = buildSidewaysCardiganEditSleeveMeasurementDiagramSvg({
        garmentStyle: "cardigan",
        measurements: {
          finishedBustInches: 42,
          finishedLengthInches: 25,
          neckOpeningWidthInches: 7.5,
          vNeckDepthInches: 8,
          finishedUpperArmInches: 18,
          sleeveLengthInches: 16.75,
          wristInches: 8.5,
        },
      });
      const editD = /data-role="sleeve-outline"[^>]* d="([^"]+)"/.exec(edit)?.[1] ?? "";
      const editNums = [...editD.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
      const editPts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i + 1 < editNums.length; i += 2) {
        const x = editNums[i];
        const y = editNums[i + 1];
        if (x === undefined || y === undefined) continue;
        editPts.push({ x, y });
      }
      const editYs = editPts.map((point) => point.y);
      const editTop = Math.min(...editYs);
      const editBottom = Math.max(...editYs);
      const topXs = editPts.filter((point) => Math.abs(point.y - editTop) < 0.05).map((point) => point.x);
      const bottomXs = editPts.filter((point) => Math.abs(point.y - editBottom) < 0.05).map((point) => point.x);
      expect(Math.max(...topXs) - Math.min(...topXs)).toBeCloseTo(stsShape.upperWidth, 2);
      expect(Math.max(...bottomXs) - Math.min(...bottomXs)).toBeCloseTo(stsShape.wristWidth, 2);
      expect(editBottom - editTop).toBeCloseTo(stsShape.length, 2);
    }
  });

  it("changes only the matching edge when upper arm, wrist, or sleeve length changes", () => {
    const base = diagrams(EXAMPLE);
    const wider = diagrams({ ...EXAMPLE, finishedUpperArmInches: 22 });
    const tighter = diagrams({ ...EXAMPLE, finishedWristInches: 6.5 });
    const longer = diagrams({ ...EXAMPLE, sleeveLengthInches: 20.75 });
    for (const key of ["sts", "notation"] as const) {
      const baseShape = finishedSleeve(base[key]);
      const widerShape = finishedSleeve(wider[key]);
      const tighterShape = finishedSleeve(tighter[key]);
      const longerShape = finishedSleeve(longer[key]);
      expect(widerShape.upperWidth / baseShape.upperWidth).toBeCloseTo(22 / 18, 4);
      expect(widerShape.wristWidth).toBeCloseTo(baseShape.wristWidth, 2);
      expect(widerShape.length).toBeCloseTo(baseShape.length, 2);
      expect(attr(wider[key], "data-wrist-stitches")).toBe(attr(base[key], "data-wrist-stitches"));
      expect(attr(wider[key], "data-cuff-rows")).toBe(attr(base[key], "data-cuff-rows"));
      expect(attr(wider[key], "data-sleeve-total-rows")).toBe(attr(base[key], "data-sleeve-total-rows"));
      expect(attr(wider[key], "data-top-stitches")).toBe(String(wider.calc.topSts));
      expect(attr(wider[key], "data-top-stitches")).not.toBe(attr(base[key], "data-top-stitches"));

      expect(tighterShape.wristWidth / baseShape.wristWidth).toBeCloseTo(6.5 / 8.5, 4);
      expect(tighterShape.upperWidth).toBeCloseTo(baseShape.upperWidth, 2);
      expect(tighterShape.length).toBeCloseTo(baseShape.length, 2);
      expect(attr(tighter[key], "data-top-stitches")).toBe(attr(base[key], "data-top-stitches"));
      expect(attr(tighter[key], "data-cuff-rows")).toBe(attr(base[key], "data-cuff-rows"));
      expect(attr(tighter[key], "data-sleeve-total-rows")).toBe(attr(base[key], "data-sleeve-total-rows"));
      expect(attr(tighter[key], "data-wrist-stitches")).toBe(String(tighter.calc.wristSts));

      expect(longerShape.length / baseShape.length).toBeCloseTo(20.75 / 16.75, 4);
      expect(longerShape.upperWidth).toBeCloseTo(baseShape.upperWidth, 2);
      expect(longerShape.wristWidth).toBeCloseTo(baseShape.wristWidth, 2);
      expect(attr(longer[key], "data-top-stitches")).toBe(attr(base[key], "data-top-stitches"));
      expect(attr(longer[key], "data-wrist-stitches")).toBe(attr(base[key], "data-wrist-stitches"));
      expect(attr(longer[key], "data-cuff-rows")).toBe(attr(base[key], "data-cuff-rows"));
      expect(attr(longer[key], "data-sleeve-total-rows")).toBe(String(longer.calc.sleeveTotalRows));
      expect(attr(longer[key], "data-shaping-notation")).toBe(
        formatDropShoulderSleeveWorkingNotation(
          {
            topSts: longer.calc.topSts,
            wristSts: longer.calc.wristSts,
            cuffRows: longer.calc.cuffRows,
            sleeveBodyRows: longer.calc.sleeveBodyRows,
            sleeveTotalRows: longer.calc.sleeveTotalRows,
            direction: longer.calc.direction,
          },
          { includeRowSpans: true },
        ),
      );
    }
  });

  it("keeps labels inside the viewBox and off the sleeve at small, typical, and large sizes", () => {
    for (const name of Object.keys(SIZES) as SizeName[]) {
      for (const direction of ["cuff-up", "top-down"] as const) {
        const { sts, notation } = diagrams(SIZES[name], direction);
        expectLabelsClearOfSleeve(sts);
        expectLabelsClearOfSleeve(notation);
        const stsShape = finishedSleeve(sts);
        const notationShape = finishedSleeve(notation);
        expect(notationShape.upperWidth).toBeCloseTo(stsShape.upperWidth, 4);
        expect(notationShape.wristWidth).toBeCloseTo(stsShape.wristWidth, 4);
        expect(notationShape.length).toBeCloseTo(stsShape.length, 4);
      }
    }
  });

  it("builds both finished silhouettes from the shared proportional frame", () => {
    const src = readFileSync(resolve("src/lib/patterns/sidewaysCardiganSleeveDiagramSvg.ts"), "utf8");
    expect(src).toContain("sidewaysProportionalSleeveLocalFrame");
    expect(src).not.toContain("buildDropShoulderSleeveFrame");
    expect(src).not.toContain("wrapGeneratedDiagramSvg");
    expect(src).not.toContain("DS_VB_");
    const geometrySrc = readFileSync(resolve("src/lib/patterns/sidewaysSleeveProportionalGeometry.ts"), "utf8");
    expect(geometrySrc).toContain("upperArmInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(geometrySrc).toContain("wristInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(geometrySrc).toContain("sleeveLengthInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
  });
});
