import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { tryBuildLiveDropShoulderSleeveNotationSvg } from "./dropShoulderSleeveShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg } from "./dropShoulderSleevePatternDiagramSvg";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { calculateSidewaysCardiganSleeve } from "./sidewaysCardiganSleeveCalc";
import {
  buildSidewaysCardiganSleeveShapingNotationSvg,
  buildSidewaysCardiganSleeveStitchesRowsSvg,
} from "./sidewaysCardiganSleeveDiagramSvg";
import { buildSleevelessBackShapingNotationDiagramSvg } from "./sleevelessBackShapingNotationDiagramSvg";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { calculateBasicSockPattern } from "./sock/sockMath";
import { buildSockShapingNotationDiagramSvg } from "./sock/sockShapingNotationDiagramSvg";
import { DS_VB_H, DS_VB_W } from "./dropShoulderPatternDiagramSvgShared";
import { SHAPING_NOTATION_RC_GUIDE, SHAPING_NOTATION_RC_MIN_FONT } from "./legoBlocks/shapingNotationRcLeaders";

const TAPERED = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening_width: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: { construction: "drop-shoulder", frontStyle: "closed", neckline: "round" },
};

function sleeve(direction: "cuff-up" | "top-down") {
  const body = calculateSidewaysCardiganBody({
    garmentLengthInches: 22,
    vNeckDepthInches: 8,
    finishedBustCircumferenceInches: 40,
    finishedUpperArmInches: 14,
    neckOpeningWidthInches: 7,
    backNeckDepthInches: 1,
    stitchesPerInch: 5,
    rowsPerInch: 7,
  });
  if (!body.ok) throw new Error(body.error.message);
  const result = calculateSidewaysCardiganSleeve({
    direction,
    finishedUpperArmInches: 14,
    finishedWristInches: 8,
    sleeveLengthInches: 18,
    stitchesPerInch: 5,
    rowsPerInch: 7,
    cuffDepthInches: 2,
    armholeDepthInches: body.calc.armholeDepthInches,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.calc;
}

function leaders(svg: string) {
  return [...svg.matchAll(/<line\b[^>]*data-role="rc-leader"[^>]*>/g)].map((match) => {
    const tag = match[0];
    const num = (name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
    return {
      label: /data-rc-label="([^"]+)"/.exec(tag)?.[1] ?? "",
      rc: num("data-row-counter"),
      y: num("y1"),
      y2: num("y2"),
      x2: num("x2"),
      actionY: num("data-action-y"),
      outlineX: num("data-outline-x"),
      stroke: /stroke="([^"]+)"/.exec(tag)?.[1] ?? "",
      dash: /stroke-dasharray="([^"]+)"/.exec(tag)?.[1] ?? "",
    };
  });
}

function rcLabels(svg: string) {
  return [...svg.matchAll(/<text\b[^>]*data-role="rc-landmark"[^>]*>[^<]*<\/text>/g)].map((match) => {
    const tag = match[0];
    const num = (name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
    const text = />[^<]*</.exec(tag)?.[0].slice(1, -1) ?? "";
    const size = num("font-size");
    const anchor = /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "end";
    const w = text.length * size * 0.56;
    const x = num("x");
    const left = anchor === "end" ? x - w : x;
    return {
      label: /data-rc-label="([^"]+)"/.exec(tag)?.[1] ?? "",
      rc: num("data-row-counter"),
      x,
      y: num("y"),
      size,
      left,
      right: anchor === "end" ? x : x + w,
      top: num("y") - size / 2,
      bottom: num("y") + size / 2,
    };
  });
}

function textBoxes(svg: string, role: string) {
  return [...svg.matchAll(new RegExp(`<text\\b[^>]*data-role="${role}"[^>]*>[^<]*</text>`, "g"))].map((match) => {
    const tag = match[0];
    const num = (name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
    const text = />[^<]*</.exec(tag)?.[0].slice(1, -1) ?? "";
    const size = num("font-size") || 14;
    const anchor = /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "middle";
    const w = text.length * size * 0.56;
    const x = num("x");
    const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
    return { left, right: left + w, top: num("y") - size / 2, bottom: num("y") + size / 2, x, y: num("y") };
  });
}

function overlaps(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function expectReadableSleeveNotation(svg: string, direction: "cuff-up" | "top-down") {
  const marks = rcLabels(svg);
  const lines = leaders(svg);
  expect(marks.length).toBeGreaterThan(0);
  expect(lines).toHaveLength(marks.length);
  for (const mark of marks) {
    const line = lines.find((item) => item.label === mark.label && item.rc === mark.rc);
    expect(line, mark.label).toBeTruthy();
    expect(line!.y).toBeCloseTo(line!.actionY, 2);
    expect(line!.y2).toBeCloseTo(line!.actionY, 2);
    expect(line!.x2).toBeCloseTo(line!.outlineX, 2);
    expect(line!.stroke).toBe(SHAPING_NOTATION_RC_GUIDE);
    expect(line!.dash).toBe("4 3");
    expect(mark.size).toBeGreaterThanOrEqual(SHAPING_NOTATION_RC_MIN_FONT);
    expect(mark.left).toBeGreaterThanOrEqual(0);
    expect(mark.right).toBeLessThanOrEqual(DS_VB_W);
    expect(mark.top).toBeGreaterThanOrEqual(0);
    expect(mark.bottom).toBeLessThanOrEqual(DS_VB_H);
    expect(mark.right).toBeLessThan(line!.outlineX);
    expect(line!.outlineX - mark.x).toBeLessThan(90);
    expect(mark.x).toBeLessThan(DS_VB_W / 2);
  }
  const roles = ["cast-on", "bind-off", "sleeve-cap-sts", "cuff", "row-span", "sleeve-shaping", "sleeve-piece-label"];
  for (const role of roles) {
    for (const box of textBoxes(svg, role)) {
      for (const mark of marks) {
        expect(
          overlaps(mark, { left: mark.left, right: mark.right, top: mark.top, bottom: mark.bottom }) &&
            overlaps(
              { left: mark.left, right: mark.right, top: mark.top, bottom: mark.bottom },
              box,
            ),
        ).toBe(false);
      }
    }
  }
  const centerRoles = textBoxes(svg, "sleeve-direction").concat(textBoxes(svg, "sleeve-shaping"));
  for (const shaping of textBoxes(svg, "sleeve-shaping")) {
    expect(shaping.x).toBeGreaterThan(DS_VB_W / 2);
    for (const other of centerRoles) {
      if (other === shaping) continue;
    }
  }
  expect(svg).not.toContain('data-role="sleeve-direction"');
  expect(svg).not.toContain('data-knit-direction=');
  expect(svg).not.toContain(">Cuff Up<");
  expect(svg).not.toContain(">Top Down<");
  expect(svg).toContain('data-both-edges="true"');
  expect(svg).toContain(`data-sleeve-direction="${direction}"`);
  const sizes = [...svg.matchAll(/font-size="(\d+(?:\.\d+)?)"/g)].map((match) => Number(match[1]));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
}

describe("sleeve shaping notation RC leaders", () => {
  it("places sideways cuff-up and top-down landmarks on the piece", () => {
    const cuffCalc = sleeve("cuff-up");
    const topCalc = { ...cuffCalc, direction: "top-down" as const };
    const cuff = buildSidewaysCardiganSleeveShapingNotationSvg({
      calc: cuffCalc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    })!;
    const top = buildSidewaysCardiganSleeveShapingNotationSvg({
      calc: topCalc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    })!;
    expectReadableSleeveNotation(cuff, "cuff-up");
    expectReadableSleeveNotation(top, "top-down");
    const cuffCastOn = rcLabels(cuff).find((mark) => mark.label === "cast-on")!;
    const topCastOn = rcLabels(top).find((mark) => mark.label === "cast-on")!;
    expect(cuffCastOn.y).toBeGreaterThan(rcLabels(cuff).find((mark) => mark.label === "bind-off")!.y);
    expect(topCastOn.y).toBeGreaterThan(rcLabels(top).find((mark) => mark.label === "cuff")!.y);
    const sts = buildSidewaysCardiganSleeveStitchesRowsSvg({
      calc: cuffCalc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    })!;
    expect(sts).toContain(">Cuff Up<");
    expect(sts).toContain('data-knit-direction="up"');
  });

  it("places drop-shoulder bottom-up and top-down landmarks on the piece", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const cuff = tryBuildLiveDropShoulderSleeveNotationSvg(result, "cuff-up", "in")!;
    const top = tryBuildLiveDropShoulderSleeveNotationSvg(result, "top-down", "in")!;
    expectReadableSleeveNotation(cuff, "cuff-up");
    expectReadableSleeveNotation(top, "top-down");
    const sts = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "cuff-up", "in")!;
    expect(sts).toContain(">SLEEVE<");
    expect(sts).not.toContain('data-role="rc-leader"');
  });

  it("leaves sleeveless body and socks on their existing notation", () => {
    const pattern = {
      fit: {
        sizingChart: "women",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 24,
          shoulder_width: 16,
          neck_opening_width: 7,
          back_neck_depth: 1,
        },
      },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
      style: { construction: "sleeveless", frontStyle: "closed", neckline: "round", bodyShape: "straight" },
    };
    const back = generateSleevelessBackPattern(pattern as never);
    const svg = buildSleevelessBackShapingNotationDiagramSvg(back, pattern);
    expect(svg).toContain('data-role="rc-caston"');
    expect(svg).toContain('stroke="#bdbec0"');
    expect(svg).toContain('stroke-dasharray="4 3"');
    expect(svg).not.toContain('data-role="rc-leader"');
    expect(svg).not.toContain('data-role="rc-landmark"');

    const sock = calculateBasicSockPattern({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
      constructionDirection: "cuff-to-toe",
    });
    if (!sock.ok) throw new Error(sock.errors.join("; "));
    const sockSvg = buildSockShapingNotationDiagramSvg(sock.calc);
    expect(sockSvg).toContain('data-sock-label="rc-start"');
    expect(sockSvg).not.toContain('data-role="rc-leader"');
  });
});
