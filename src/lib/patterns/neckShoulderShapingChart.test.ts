import { describe, expect, it } from "vitest";
import {
  collapsePlainKnitChartRowsForDisplay,
  compactSymmetricalVNeckNeckEdgeRepeats,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";

function neckRow(
  rc: number,
  overrides: Partial<NeckShoulderShapingChartRow> = {},
): NeckShoulderShapingChartRow {
  return {
    row: rc,
    action: "Neck",
    leftSide: "-",
    leftNeck: "-1",
    centerNeck: "-",
    rightNeck: "-1",
    rightSide: "-",
    leftStitchCount: 40,
    rightStitchCount: 40,
    ...overrides,
  };
}

describe("compactSymmetricalVNeckNeckEdgeRepeats", () => {
  it("merges consecutive symmetrical inner-neck-only rows with identical cells", () => {
    const rows: NeckShoulderShapingChartRow[] = [
      neckRow(10, { leftStitchCount: 30, rightStitchCount: 30 }),
      neckRow(11, { leftStitchCount: 29, rightStitchCount: 29 }),
      neckRow(12, { leftStitchCount: 28, rightStitchCount: 28 }),
    ];
    const out = compactSymmetricalVNeckNeckEdgeRepeats(rows);
    expect(out).toHaveLength(1);
    expect(out[0]!.row).toBe(10);
    expect(out[0]!.chartRowSpanLast).toBe(12);
    expect(out[0]!.leftStitchCount).toBe(28);
    expect(out[0]!.action).toBe("Neck edge (repeat)");
  });

  it("does not merge across shoulder cells", () => {
    const rows: NeckShoulderShapingChartRow[] = [
      neckRow(10),
      { ...neckRow(11), leftSide: "-2", action: "Shoulder / Neck" },
      neckRow(12),
    ];
    const out = compactSymmetricalVNeckNeckEdgeRepeats(rows);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe("collapsePlainKnitChartRowsForDisplay with chartRowSpanLast", () => {
  it("shows RC range for compacted V-neck neck-edge span", () => {
    const rows: NeckShoulderShapingChartRow[] = [
      {
        row: 41,
        chartRowSpanLast: 66,
        action: "Neck edge (repeat)",
        leftSide: "-",
        leftNeck: "-1",
        centerNeck: "-",
        rightNeck: "-1",
        rightSide: "-",
        leftStitchCount: 14,
        rightStitchCount: 14,
      },
    ];
    const disp = collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
    expect(disp[0]!.rowLabel).toBe("041–066");
  });
});
