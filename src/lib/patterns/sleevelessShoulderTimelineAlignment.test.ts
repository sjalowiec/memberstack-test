import { describe, expect, it } from "vitest";
import { buildActiveSideInstructionTableRows } from "./neckShoulderActiveSideChecklist";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import { buildNeckShoulderTimelineAndChartRows } from "./neckShoulderShapingChartRows";
import { shoulderStitchesPerSideForDiagram } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  collectOuterShoulderBindOffPoints,
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import { computeShoulderBindoffSchedule } from "./shapingTimeline";
import { SLEEVELESS_QA_SCENARIOS } from "./testScenarios/sleevelessPatternQaMatrix";
import {
  expectedShoulderStitchesPerSide,
  shoulderNotationLinesForPiece,
} from "./testScenarios/sleevelessShoulderShapingAssertions";

const SIDE = "right" as const;

function outerShoulderAmounts(timeline: readonly import("./shapingTimeline").RowEntry[]): number[] {
  return collectOuterShoulderBindOffPoints(timeline, SIDE).map((p) => p.amount);
}

function shoulderChecklistAmounts(
  result: ReturnType<typeof generateSleevelessBackPattern>,
  piece: "back" | "front",
): number[] {
  const chart =
    piece === "back" ? result.neckShoulderShapingChart : result.frontNeckShoulderShapingChart;
  const rcStart =
    piece === "back"
      ? (result.debug.backNecklineStartLocalRC ?? 0)
      : (result.debug.frontNecklineStartLocalRC ?? 0);
  return buildActiveSideInstructionTableRows(chart, rcStart, {
    includeCenterNecklineSetupRow: true,
  })
    .filter((r) => /bind off/i.test(r.action) && r.edge === "Armhole")
    .map((r) => parseInt(r.action.match(/(\d+)/)?.[1] ?? "0", 10));
}

/** Golden beta express pattern — band 26, per-side budget 13 (shoulder mismatch repro case). */
const GOLDEN_BETA_PATTERN = {
  fit: {
    sizingChart: "misses",
    selectedSize: "5",
    selectedMeasurements: {
      finished_bust_chest: 41.5,
      back_neck_to_hem: 23.5,
      armhole_depth: 8,
      shoulder_width: 13.25,
      neck_width: 8,
      front_neck_depth: 5,
      back_neck_depth: 1,
    },
  },
  style: { recipientCategory: "misses", neckline: "round", patternMode: "express" },
  yarnGaugeMachine: { gaugeStitchesPerInch: 7, gaugeRowsPerInch: 11, availableNeedles: 200 },
} as const;

describe("sleeveless shoulder timeline alignment", () => {
  it("golden beta: front and back outer shoulder sequences match (was 4,4,4,2 vs 4,4,2,2)", () => {
    const result = generateSleevelessBackPattern(GOLDEN_BETA_PATTERN);
    const backTl = result.backNeckShoulderTimeline ?? [];
    const frontTl = result.frontNeckShoulderTimeline ?? [];
    expect(backTl.length).toBeGreaterThan(0);
    expect(frontTl.length).toBeGreaterThan(0);

    const backOuter = outerShoulderAmounts(backTl);
    const frontOuter = outerShoulderAmounts(frontTl);
    expect(backOuter).toEqual(frontOuter);

    const budget = expectedShoulderStitchesPerSide(result);
    expect(totalStitchesFromShapingNotationLines(shoulderNotationLinesForPiece(result, "back"))).toBe(
      budget,
    );
    expect(totalStitchesFromShapingNotationLines(shoulderNotationLinesForPiece(result, "front"))).toBe(
      budget,
    );
  });

  it("Men's Med QA: capped front/back shoulder totals and outer sequences match", () => {
    const result = generateSleevelessBackPattern(SLEEVELESS_QA_SCENARIOS[0].patternData);
    const backTl = result.backNeckShoulderTimeline ?? [];
    const frontTl = result.frontNeckShoulderTimeline ?? [];

    expect(outerShoulderAmounts(backTl)).toEqual(outerShoulderAmounts(frontTl));

    const budget = expectedShoulderStitchesPerSide(result);
    expect(totalStitchesFromShapingNotationLines(shoulderNotationLinesForPiece(result, "back"))).toBe(
      budget,
    );
    expect(totalStitchesFromShapingNotationLines(shoulderNotationLinesForPiece(result, "front"))).toBe(
      budget,
    );

    // Previously back outer was 7+7+6 while front was 7+7+4 — both checklists still total budget with remainder row.
    const frontChecklist = shoulderChecklistAmounts(result, "front");
    const backChecklist = shoulderChecklistAmounts(result, "back");
    expect(frontChecklist.reduce((s, n) => s + n, 0)).toBe(budget);
    expect(backChecklist.reduce((s, n) => s + n, 0)).toBe(budget);
  });

  it("21-st live timeline with minFinal: notation totals 21 without 4s-2r-5x over-count", () => {
    const patternNumbers = {
      firstShapingRow: 100,
      shoulderStitchesPerSide: 21,
      centerNeckBindOff: 6,
      neckDepthRows: 20,
      stitchesAfterArmhole: 48,
      shoulderBindoffRows: 9,
      neckProfile: "back" as const,
    };
    const schedule = computeShoulderBindoffSchedule(patternNumbers)!;
    const provisional = buildNeckShoulderTimelineAndChartRows(patternNumbers, { shoulderSchedule: schedule });
    const minFinal = Math.min(
      provisional.chartRows.at(-1)?.leftStitchCount ?? 0,
      provisional.chartRows.at(-1)?.rightStitchCount ?? 0,
    );
    const { timeline } = buildNeckShoulderTimelineAndChartRows(patternNumbers, {
      shoulderSchedule: schedule,
      minFinalStitchesPerSide: minFinal,
    });

    const lines = shoulderShapingNotationLinesFromTimeline(timeline, SIDE);
    expect(lines).toEqual(["5s-2r-1x", "4s-2r-4x"]);
    expect(totalStitchesFromShapingNotationLines(lines)).toBe(21);
    expect(lines).not.toContain("4s-2r-5x");
  });

  it("symmetric minFinal on back matches front outer sequence for short back / long front neck", () => {
    const patternData = SLEEVELESS_QA_SCENARIOS[0].patternData;
    const result = generateSleevelessBackPattern(patternData);
    const backTl = result.backNeckShoulderTimeline ?? [];
    const frontTl = result.frontNeckShoulderTimeline ?? [];
    expect(outerShoulderAmounts(backTl)).toEqual(outerShoulderAmounts(frontTl));
  });
});

describe("sleeveless shoulder invariants", () => {
  const cases = [
    { label: "golden beta", patternData: GOLDEN_BETA_PATTERN },
    { label: "Men's Med QA", patternData: SLEEVELESS_QA_SCENARIOS[0].patternData },
    {
      label: "pullover round misses",
      patternData: {
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
        style: { recipientCategory: "misses", neckline: "round" },
        yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
      },
    },
  ] as const;

  it.each(cases)("$label: front shoulder total === back shoulder total", ({ patternData }) => {
    const result = generateSleevelessBackPattern(patternData);
    const backLines = shoulderNotationLinesForPiece(result, "back");
    const frontLines = shoulderNotationLinesForPiece(result, "front");
    expect(totalStitchesFromShapingNotationLines(frontLines)).toBe(
      totalStitchesFromShapingNotationLines(backLines),
    );
    expect(backLines.join("\n")).toBe(frontLines.join("\n"));
  });

  it.each(cases)(
    "$label: JP shoulder notation total === diagram shoulder stitch label",
    ({ patternData }) => {
      const result = generateSleevelessBackPattern(patternData);
      const budget = shoulderStitchesPerSideForDiagram(result.debug);
      expect(budget).toBeDefined();

      const frontRepl = buildFrontJapaneseNotationReplacements(result, patternData);
      const jpTotal = totalStitchesFromShapingNotationLines(
        frontRepl["jp-shoulder-shaping"].split("\n").filter(Boolean),
      );
      expect(jpTotal).toBe(budget);
      expect(totalStitchesFromShapingNotationLines(shoulderNotationLinesForPiece(result, "front"))).toBe(
        budget,
      );
    },
  );
});
