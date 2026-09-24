import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { tryBuildLiveDropShoulderSleeveNotationSvg } from "./dropShoulderSleeveShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderBackNotationSvg } from "./dropShoulderBackShapingNotationDiagramSvg";
import { dropShoulderSleeveShapingRcSequence } from "./dropShoulderSleeveShapingChart";
import { formatRcColon } from "./sleevelessPatternOutput";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import { rowBasedShapingNotation } from "./shapingNotationCompress";
import { calculateBasicSockPattern } from "./sock/sockMath";
import { buildSockShapingNotationDiagramSvg } from "./sock/sockShapingNotationDiagramSvg";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import type { SidewaysCardiganBodyCalcInput } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganBodyInstructions,
  sidewaysBodyRowLandmarks,
} from "./sidewaysCardiganBodyInstructions";
import { buildSidewaysCardiganPatternDiagramModel } from "./sidewaysCardiganPatternDiagramSvg";
import { buildSidewaysCardiganShapingNotationDiagramSvg } from "./sidewaysCardiganShapingNotationDiagramSvg";
import { calculateSidewaysCardiganSleeve } from "./sidewaysCardiganSleeveCalc";
import { buildSidewaysCardiganSleeveShapingNotationSvg } from "./sidewaysCardiganSleeveDiagramSvg";
import {
  assertRowBasedShapingRcLandmarks,
  formatEstablishedDiagramRcLabel,
  formatShapingNotationRcLabel,
  sidewaysGarmentRcLandmarks,
  sleeveShapingRcLandmarks,
} from "./shapingNotationRcLandmarks";

const BODY: SidewaysCardiganBodyCalcInput = {
  garmentLengthInches: 22,
  vNeckDepthInches: 8,
  finishedBustCircumferenceInches: 40,
  finishedUpperArmInches: 14,
  neckOpeningWidthInches: 7,
  backNeckDepthInches: 1,
  stitchesPerInch: 5,
  rowsPerInch: 7,
};

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
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

function rcTexts(svg: string): { label: string; rc: number; x: number; y: number; size: number }[] {
  return [...svg.matchAll(/<text\b[^>]*data-role="rc-landmark"[^>]*>/g)].map((match) => {
    const tag = match[0];
    const num = (name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
    return {
      label: /data-rc-label="([^"]+)"/.exec(tag)?.[1] ?? "",
      rc: num("data-row-counter"),
      x: num("x"),
      y: num("y"),
      size: num("font-size"),
    };
  });
}

function textBoxes(svg: string, role: string): { x: number; y: number; w: number; h: number }[] {
  return [...svg.matchAll(new RegExp(`<text\\b[^>]*data-role="${role}"[^>]*>[^<]*</text>`, "g"))].map(
    (match) => {
      const tag = match[0];
      const num = (name: string) => Number(new RegExp(`${name}="([^"]+)"`).exec(tag)?.[1]);
      const text = />[^<]*</.exec(tag)?.[0].slice(1, -1) ?? "";
      const size = num("font-size") || 14;
      const anchor = /text-anchor="([^"]+)"/.exec(tag)?.[1] ?? "middle";
      const w = text.length * size * 0.55;
      const x = num("x");
      const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
      return { x: left, y: num("y") - size / 2, w, h: size };
    },
  );
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function expectNoRcCollision(svg: string, roles: string[]): void {
  const rc = textBoxes(svg, "rc-landmark");
  for (const role of roles) {
    for (const box of textBoxes(svg, role)) {
      for (const mark of rc) {
        expect(overlaps(mark, box), role).toBe(false);
      }
    }
  }
}

function bodyModel(style: "cardigan" | "pullover") {
  const calc = calculateSidewaysCardiganBody(BODY);
  if (!calc.ok) throw new Error(calc.error.message);
  const instructions = buildSidewaysCardiganBodyInstructions(BODY, style);
  if (!instructions.ok) throw new Error(instructions.error.message);
  return { calc: calc.calc, instructions: instructions.instructions };
}

describe("shared shaping notation RC landmarks", () => {
  it("formats counters the way written instructions do", () => {
    expect(formatShapingNotationRcLabel(0)).toBe("RC: 000");
    expect(formatShapingNotationRcLabel(20)).toBe("RC: 020");
    expect(formatShapingNotationRcLabel(119)).toBe("RC: 119");
    expect(formatShapingNotationRcLabel(20)).toBe(formatRcColon(20));
    expect(formatEstablishedDiagramRcLabel(0)).toBe(formatRcNotation(0));
    expect(formatEstablishedDiagramRcLabel(0)).toBe("rc000");
  });

  it("rejects row-based shaping that cannot name its start and final RC", () => {
    const section = rowBasedShapingNotation({
      rowsBefore: 6,
      segments: [{ stitches: 1, intervalRows: 6, times: 4 }],
      rowsAfter: 3,
      totalRows: 33,
    });
    expect(() => assertRowBasedShapingRcLandmarks(section, [])).toThrow(/starting RC and a final RC/);
  });

  it("marks a repeated sleeve schedule once at the first and last action", () => {
    const input = {
      topSts: 80,
      wristSts: 40,
      cuffRows: 14,
      sleeveBodyRows: 70,
      sleeveTotalRows: 84,
      direction: "cuff-up" as const,
    };
    const sequence = dropShoulderSleeveShapingRcSequence(input);
    const marks = sleeveShapingRcLandmarks(input);
    expect(marks[0]).toMatchObject({ label: "cast-on", rowCounter: 0 });
    expect(marks.find((mark) => mark.label === "cuff")?.rowCounter).toBe(14);
    expect(marks.find((mark) => mark.label === "first-shaping")?.rowCounter).toBe(sequence[0]);
    expect(marks.find((mark) => mark.label === "final-shaping")?.rowCounter).toBe(
      sequence[sequence.length - 1],
    );
    expect(marks.at(-1)).toMatchObject({ label: "bind-off", rowCounter: 84 });
    expect(marks.filter((mark) => mark.label === "first-shaping" || mark.label === "final-shaping")).toHaveLength(
      sequence.length > 1 ? 2 : 1,
    );
    expect(marks.length).toBeLessThan(sequence.length);
  });

  it("resets top-down sleeve counters at the upper-arm cast-on", () => {
    const shared = {
      topSts: 80,
      wristSts: 40,
      cuffRows: 14,
      sleeveBodyRows: 70,
      sleeveTotalRows: 84,
    };
    const cuffUp = sleeveShapingRcLandmarks({ ...shared, direction: "cuff-up" });
    const topDown = sleeveShapingRcLandmarks({ ...shared, direction: "top-down" });
    const topSequence = dropShoulderSleeveShapingRcSequence({ ...shared, direction: "top-down" });
    expect(topDown[0]).toMatchObject({ label: "cast-on", rowCounter: 0 });
    expect(topDown.find((mark) => mark.label === "first-shaping")?.rowCounter).toBe(topSequence[0]);
    expect(topDown.find((mark) => mark.label === "final-shaping")?.rowCounter).toBe(
      topSequence[topSequence.length - 1],
    );
    expect(topDown.find((mark) => mark.label === "cuff")?.rowCounter).toBe(shared.sleeveBodyRows);
    expect(topDown.at(-1)?.rowCounter).toBe(shared.sleeveTotalRows);
    expect(topDown.find((mark) => mark.label === "first-shaping")?.rowCounter).not.toBe(
      cuffUp.find((mark) => mark.label === "first-shaping")?.rowCounter,
    );
  });

  it("matches sideways cardigan written landmarks and skips a label per repeat", () => {
    const { calc, instructions } = bodyModel("cardigan");
    const marks = sidewaysGarmentRcLandmarks({
      garmentStyle: "cardigan",
      calc,
      increaseSequence: instructions.increaseSequence,
      decreaseSequence: instructions.decreaseSequence,
    });
    const written = sidewaysBodyRowLandmarks("cardigan", instructions.sectionRowCounts);
    expect(marks[0]?.rowCounter).toBe(0);
    expect(marks.find((mark) => mark.label === "first-shaping")?.rowCounter).toBe(
      instructions.firstV.actionRowCounters[0],
    );
    expect(marks.some((mark) => mark.rowCounter === written.firstSideSeam && mark.label === "armhole")).toBe(
      true,
    );
    expect(marks.some((mark) => mark.rowCounter === written.firstBackNeckEdge)).toBe(true);
    expect(marks.some((mark) => mark.rowCounter === written.secondBackNeckEdge)).toBe(true);
    expect(marks.some((mark) => mark.rowCounter === written.secondSideSeam && mark.label === "armhole")).toBe(
      true,
    );
    expect(marks.at(-1)?.rowCounter).toBe(written.finalBindOff);
    expect(marks.length).toBeLessThan(instructions.firstV.actionRowCounters.length * 2);
  });

  it("marks a V-neck schedule change and does not label every repeat", () => {
    const { calc } = bodyModel("cardigan");
    const increase = [2, 2, 2, 2, 1, 1, 1];
    const marks = sidewaysGarmentRcLandmarks({
      garmentStyle: "cardigan",
      calc,
      increaseSequence: increase,
      decreaseSequence: [...increase].reverse(),
    });
    const changes = marks.filter((mark) => mark.label === "schedule-change");
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.length).toBeLessThan(increase.length);
    expect(marks.filter((mark) => mark.anchor === "v1").length).toBeLessThan(increase.length);
  });

  it("uses pullover seams and omits the cardigan's first side seam at RC 0", () => {
    const { calc, instructions } = bodyModel("pullover");
    const marks = sidewaysGarmentRcLandmarks({
      garmentStyle: "pullover",
      calc,
      increaseSequence: instructions.increaseSequence,
      decreaseSequence: instructions.decreaseSequence,
    });
    expect(marks.filter((mark) => mark.rowCounter === 0)).toEqual([
      expect.objectContaining({ label: "cast-on" }),
    ]);
    expect(marks.some((mark) => mark.rowCounter === instructions.landmarks.secondSideSeam)).toBe(true);
    expect(marks.at(-1)?.rowCounter).toBe(instructions.landmarks.finalBindOff);
  });
});

describe("shaping notation diagrams show cumulative RC landmarks", () => {
  it("draws sideways cardigan, cuff-up, and top-down landmarks without covering notation", () => {
    const { calc, instructions } = bodyModel("cardigan");
    const model = buildSidewaysCardiganPatternDiagramModel({
      garmentStyle: "cardigan",
      calc,
      input: BODY,
      vNeckIncreaseSequence: instructions.increaseSequence,
      vNeckDecreaseSequence: instructions.decreaseSequence,
    });
    const svg = buildSidewaysCardiganShapingNotationDiagramSvg(model);
    const rcs = rcTexts(svg);
    expect(rcs[0]?.rc).toBe(0);
    expect(rcs.at(-1)?.label).toBe("bind-off");
    expect(rcs.every((mark) => mark.size >= 12)).toBe(true);
    expect(svg).toContain('width="100%"');
    expect(svg).toContain("2r");
    expectNoRcCollision(svg, ["jp-caston", "jp-final-bo", "jp-vneck-first", "jp-hold"]);

    const sleeve = calculateSidewaysCardiganSleeve({
      direction: "cuff-up",
      finishedUpperArmInches: 14,
      finishedWristInches: 8,
      sleeveLengthInches: 18,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      cuffDepthInches: 2,
      armholeDepthInches: calc.armholeDepthInches,
    });
    if (!sleeve.ok) throw new Error(sleeve.error.message);
    const cuffSvg = buildSidewaysCardiganSleeveShapingNotationSvg({
      calc: sleeve.calc,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    })!;
    const topSvg = buildSidewaysCardiganSleeveShapingNotationSvg({
      calc: { ...sleeve.calc, direction: "top-down" },
      stitchesPerInch: 5,
      rowsPerInch: 7,
    })!;
    expect(rcTexts(cuffSvg)[0]).toMatchObject({ label: "cast-on", rc: 0 });
    expect(rcTexts(cuffSvg).at(-1)?.label).toBe("bind-off");
    expect(rcTexts(topSvg)[0]).toMatchObject({ label: "cast-on", rc: 0 });
    expect(rcTexts(topSvg).find((mark) => mark.label === "cuff")?.rc).toBe(sleeve.calc.sleeveBodyRows);
    expect(rcTexts(cuffSvg).find((mark) => mark.label === "first-shaping")?.rc).not.toBe(
      rcTexts(topSvg).find((mark) => mark.label === "first-shaping")?.rc,
    );
    expect(cuffSvg).toContain("s-");
    expectNoRcCollision(cuffSvg, ["cast-on", "bind-off", "cuff", "sleeve-shaping", "row-span"]);
    expectNoRcCollision(topSvg, ["cast-on", "bind-off", "cuff", "sleeve-shaping", "row-span"]);
    expect(cuffSvg).not.toContain('data-role="sleeve-direction"');
    expect(cuffSvg).not.toContain('data-knit-direction=');
  });

  it("adds drop-shoulder sleeve RC landmarks and leaves body notation on rc000", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const cuff = tryBuildLiveDropShoulderSleeveNotationSvg(result, "cuff-up", "in")!;
    const top = tryBuildLiveDropShoulderSleeveNotationSvg(result, "top-down", "in")!;
    expect(rcTexts(cuff)[0]).toMatchObject({ label: "cast-on", rc: 0 });
    expect(rcTexts(cuff).some((mark) => mark.label === "first-shaping")).toBe(true);
    expect(rcTexts(cuff).at(-1)?.label).toBe("bind-off");
    expect(rcTexts(top)[0]).toMatchObject({ label: "cast-on", rc: 0 });
    expect(rcTexts(top).find((mark) => mark.label === "cuff")?.rc).toBe(
      result.debug.dropShoulderSleeveBodyRows,
    );
    expect(rcTexts(cuff).find((mark) => mark.label === "first-shaping")?.rc).not.toBe(
      rcTexts(top).find((mark) => mark.label === "first-shaping")?.rc,
    );
    expect(cuff).toMatch(/\d+s-\d+r-\d+x/);
    expectNoRcCollision(cuff, ["cast-on", "sleeve-cap-sts", "cuff", "sleeve-shaping", "row-span", "sleeve-piece-label"]);
    expect(cuff).not.toContain('data-knit-direction=');
    expect(top).not.toContain('data-role="sleeve-direction"');
    const back = tryBuildLiveDropShoulderBackNotationSvg(result)!;
    expect(back).toContain('data-role="rc-caston"');
    expect(back).toContain(formatRcNotation(0));
  });

  it("keeps Socks on the established rc000 milestones", () => {
    const result = calculateBasicSockPattern({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
      constructionDirection: "cuff-to-toe",
    });
    if (!result.ok) throw new Error(result.errors.join("; "));
    const svg = buildSockShapingNotationDiagramSvg(result.calc);
    expect(svg).toContain(formatRcNotation(0));
    expect(svg).toContain('data-sock-label="rc-start"');
    expect(svg).toContain('data-sock-label="rc-finish"');
    expect(svg).toContain('width="100%"');
  });
});
