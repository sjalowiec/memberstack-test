import { describe, expect, it } from "vitest";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import {
  innerNeckDecreaseNotationLinesFromTimeline,
  neckEdgeNotationLinesFromNeckShoulderChart,
} from "./notationOverlaySvg";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";

function stubRow(rc: number, innerRight: number): RowEntry {
  const ev: ShapingEvent[] =
    innerRight > 0
      ? [{ kind: "decrease", side: "right", edge: "inner", amount: innerRight }]
      : [];
  return {
    row: rc,
    events: ev,
    stitchesL: 30,
    stitchesR: 30,
    netChangeL: 0,
    netChangeR: innerRight > 0 ? -innerRight : 0,
    isSplit: true,
    centerWidth: 10,
    leftOuterEdge: 1,
    leftInnerEdge: 10,
    rightInnerEdge: 20,
    rightOuterEdge: 30,
  };
}

describe("innerNeckDecreaseNotationLinesFromTimeline", () => {
  it("returns 1s-1r-26x for 26 consecutive single-stitch inner-neck decreases", () => {
    const tl: RowEntry[] = Array.from({ length: 26 }, (_, i) => stubRow(500 + i, 1));
    expect(innerNeckDecreaseNotationLinesFromTimeline(tl, "right")).toEqual(["1s-1r-26x"]);
  });

  it("groups by interval change only (mixed gaps)", () => {
    const tl: RowEntry[] = [
      stubRow(10, 1),
      stubRow(12, 1),
      stubRow(14, 1),
      stubRow(15, 1),
      stubRow(16, 1),
    ];
    expect(innerNeckDecreaseNotationLinesFromTimeline(tl, "right")).toEqual(["1s-2r-3x", "1s-1r-2x"]);
  });
});

describe("neckEdgeNotationLinesFromNeckShoulderChart", () => {
  it("groups chart neck-edge cells into multiple summary lines (not timeline-only compaction)", () => {
    const base = {
      action: "Neck" as const,
      leftSide: "-",
      leftNeck: "-",
      centerNeck: "-",
      rightSide: "-",
      leftStitchCount: 40,
      rightStitchCount: 40,
    };
    const rows = [
      ...[0, 2, 4, 6, 8, 10, 12, 14].map((row) => ({ ...base, row, rightNeck: "-1" })),
      { ...base, row: 15, rightNeck: "-2" },
      { ...base, row: 16, rightNeck: "-3" },
      { ...base, row: 17, rightNeck: "-3" },
    ];
    const chart = neckShoulderShapingChartFromRows(rows);
    expect(neckEdgeNotationLinesFromNeckShoulderChart(chart, "right")).toEqual([
      "1s-2r-8x",
      "2s-1r-1x",
      "3s-1r-2x",
    ]);
  });

  it("uses timeline inner-neck decreases when innerNeckNotationFromTimeline is true", () => {
    const tl: RowEntry[] = Array.from({ length: 26 }, (_, i) => stubRow(100 + i, 1));
    const rows = neckShoulderChartRowsFromTimeline(tl);
    const chart = neckShoulderShapingChartFromRows(rows, { timeline: tl });
    expect(
      neckEdgeNotationLinesFromNeckShoulderChart(chart, "right", {
        innerNeckNotationFromTimeline: true,
      }),
    ).toEqual(["1s-1r-26x"]);
  });
});
