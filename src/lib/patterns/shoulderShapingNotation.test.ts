import { describe, expect, it } from "vitest";
import { buildActiveSideInstructionTableRows } from "./neckShoulderActiveSideChecklist";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import { buildNeckShoulderTimelineAndChartRows } from "./neckShoulderShapingChartRows";
import {
  collectCompleteShoulderShapingPoints,
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import type { RowEntry } from "./shapingTimeline";

function shoulderRow(row: number, amount: number, stitchesR: number): RowEntry {
  return {
    row,
    events: [{ kind: "bindOff", side: "right", edge: "outer", amount }],
    stitchesL: 10,
    stitchesR,
    netChangeL: 0,
    netChangeR: -amount,
    isSplit: true,
    centerWidth: 0,
    leftOuterEdge: 1,
    leftInnerEdge: 1,
    rightInnerEdge: 2,
    rightOuterEdge: 30,
  };
}

describe("shoulderShapingNotation", () => {
  it("does not double-count when timeline outer bind-offs already total the active shoulder (21 sts)", () => {
    const timeline: RowEntry[] = [
      shoulderRow(70, 5, 16),
      shoulderRow(72, 4, 12),
      shoulderRow(74, 4, 8),
      shoulderRow(76, 4, 4),
      shoulderRow(78, 4, 4),
      { ...shoulderRow(80, 0, 4), events: [], netChangeR: 0 },
    ];

    expect(
      collectCompleteShoulderShapingPoints(timeline, "right", undefined, {
        shoulderStitchesBudget: 21,
      }).map((p) => p.amount),
    ).toEqual([5, 4, 4, 4, 4]);
    expect(
      shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
        shoulderStitchesBudget: 21,
      }),
    ).toEqual(["5s-2r-1x", "4s-2r-4x"]);
    expect(
      totalStitchesFromShapingNotationLines(
        shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
          shoulderStitchesBudget: 21,
        }),
      ),
    ).toBe(21);
    expect(
      shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
        shoulderStitchesBudget: 21,
      }),
    ).not.toContain("4s-2r-5x");
  });

  it("caps synthetic remainder at shoulder budget (12 sts checklist: 4+4+2+2)", () => {
    const timeline: RowEntry[] = [
      shoulderRow(40, 4, 8),
      shoulderRow(42, 4, 4),
      shoulderRow(44, 2, 2),
      { ...shoulderRow(46, 0, 2), events: [], netChangeR: 0 },
    ];

    expect(
      collectCompleteShoulderShapingPoints(timeline, "right", undefined, {
        shoulderStitchesBudget: 12,
      }).map((p) => p.amount),
    ).toEqual([4, 4, 2, 2]);
    expect(
      shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
        shoulderStitchesBudget: 12,
      }),
    ).toEqual(["4s-2r-2x", "2s-2r-2x"]);
    expect(
      totalStitchesFromShapingNotationLines(
        shoulderShapingNotationLinesFromTimeline(timeline, "right", undefined, {
          shoulderStitchesBudget: 12,
        }),
      ),
    ).toBe(12);
  });

  it("compresses timeline outer shoulder bind-offs for schematic notation (4+4+4+2 → 4s-2r-3x + 2s-2r-1x without budget cap)", () => {
    const timeline: RowEntry[] = [
      shoulderRow(40, 4, 8),
      shoulderRow(42, 4, 4),
      shoulderRow(44, 4, 0),
      shoulderRow(46, 2, 0),
    ];

    expect(collectCompleteShoulderShapingPoints(timeline, "right").map((p) => p.amount)).toEqual([
      4, 4, 4, 2,
    ]);
    expect(shoulderShapingNotationLinesFromTimeline(timeline, "right")).toEqual([
      "4s-2r-3x",
      "2s-2r-1x",
    ]);
    expect(totalStitchesFromShapingNotationLines(shoulderShapingNotationLinesFromTimeline(timeline, "right"))).toBe(
      14,
    );
  });

  it("append final remainder when the last chunk is not yet an outer timeline event (21 sts)", () => {
    const timeline: RowEntry[] = [
      shoulderRow(70, 5, 16),
      shoulderRow(72, 4, 12),
      shoulderRow(74, 4, 8),
      shoulderRow(76, 4, 4),
      { ...shoulderRow(78, 0, 4), events: [], netChangeR: 0 },
    ];

    expect(collectCompleteShoulderShapingPoints(timeline, "right").map((p) => p.amount)).toEqual([
      5, 4, 4, 4, 4,
    ]);
    expect(shoulderShapingNotationLinesFromTimeline(timeline, "right")).toEqual(["5s-2r-1x", "4s-2r-4x"]);
    expect(totalStitchesFromShapingNotationLines(shoulderShapingNotationLinesFromTimeline(timeline, "right"))).toBe(
      21,
    );
  });

  it("matches checklist for live timeline with [5,4,4,4,4] schedule and minFinal remainder row", () => {
    const { timeline, chartRows } = buildNeckShoulderTimelineAndChartRows(
      {
        firstShapingRow: 100,
        shoulderStitchesPerSide: 21,
        centerNeckBindOff: 6,
        neckDepthRows: 20,
        stitchesAfterArmhole: 48,
        shoulderBindoffRows: 9,
        neckProfile: "back",
      },
      {
        shoulderSchedule: {
          leftChunks: [5, 4, 4, 4, 4],
          rightChunks: [5, 4, 4, 4, 4],
          placementRows: 9,
        },
        minFinalStitchesPerSide: 4,
      },
    );

    const chart = neckShoulderShapingChartFromRows(chartRows, { timeline });
    const rcStart = 70;
    const checklist = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const shoulderBo = checklist.filter((x) => /bind off/i.test(x.action) && x.edge === "Armhole");

    expect(shoulderBo.map((x) => x.action)).toEqual([
      "Bind off OR hold 5 sts",
      "Bind off OR hold 4 sts",
      "Bind off OR hold 4 sts",
      "Bind off OR hold 4 sts",
      "Bind off OR hold 4 sts",
    ]);
    expect(shoulderShapingNotationLinesFromTimeline(timeline, "right")).toEqual(["5s-2r-1x", "4s-2r-4x"]);
    expect(totalStitchesFromShapingNotationLines(shoulderShapingNotationLinesFromTimeline(timeline, "right"))).toBe(
      21,
    );
  });

  it("append final remainder to complete points when timeline ends with stitches on the active side", () => {
    const timeline: RowEntry[] = [
      {
        row: 8,
        events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 5 }],
        stitchesL: 10,
        stitchesR: 14,
        netChangeL: -5,
        netChangeR: -5,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 15,
      },
      {
        row: 10,
        events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 5 }],
        stitchesL: 10,
        stitchesR: 9,
        netChangeL: 0,
        netChangeR: -5,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 10,
      },
      {
        row: 12,
        events: [],
        stitchesL: 10,
        stitchesR: 4,
        netChangeL: 0,
        netChangeR: 0,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 10,
      },
    ];
    expect(collectCompleteShoulderShapingPoints(timeline, "right").map((p) => p.amount)).toEqual([5, 5, 4]);
    expect(totalStitchesFromShapingNotationLines(shoulderShapingNotationLinesFromTimeline(timeline, "right"))).toBe(
      14,
    );
  });
});
