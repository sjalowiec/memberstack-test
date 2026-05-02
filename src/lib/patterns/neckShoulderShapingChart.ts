/**
 * Neckline / shoulder shaping chart — data source for the printed table and future SVG.
 * Replace demo rows with calculated values when wiring live pattern math.
 */

export type NeckShoulderChartAction = "Neck" | "Shoulder / Neck" | "Shoulder" | string;

/** One printed row of the shaping chart (machine row numbers are intentional here). */
export type NeckShoulderShapingChartRow = {
  row: number;
  action: NeckShoulderChartAction;
  /** Display cell: "-" when no change on that edge */
  leftSide: string;
  leftNeck: string;
  centerNeck: string;
  rightNeck: string;
  rightSide: string;
  leftStitchCount: number;
  rightStitchCount: number;
};

export type NeckShoulderShapingChart = {
  /** Column keys matching table order (for docs / SVG consumers). */
  columnKeys: readonly [
    "row",
    "action",
    "leftSide",
    "leftNeck",
    "centerNeck",
    "rightNeck",
    "rightSide",
    "leftStitchCount",
    "rightStitchCount",
  ];
  rows: NeckShoulderShapingChartRow[];
};

/** Why a row is visually emphasized (both sides worked on the same row). */
export type NeckShoulderChartRowHighlight =
  | "neckBothSides"
  | "shoulderAndNeck"
  | "shoulderBothSides";

/**
 * Demo chart — confirm layout and copy before swapping in calculated rows.
 */
/** Build a chart object from computed rows (same columnKeys as demo). */
export function neckShoulderShapingChartFromRows(
  rows: NeckShoulderShapingChartRow[]
): NeckShoulderShapingChart {
  return {
    columnKeys: [
      "row",
      "action",
      "leftSide",
      "leftNeck",
      "centerNeck",
      "rightNeck",
      "rightSide",
      "leftStitchCount",
      "rightStitchCount",
    ],
    rows,
  };
}

export const DEMO_NECK_SHOULDER_SHAPING_CHART: NeckShoulderShapingChart = {
  columnKeys: [
    "row",
    "action",
    "leftSide",
    "leftNeck",
    "centerNeck",
    "rightNeck",
    "rightSide",
    "leftStitchCount",
    "rightStitchCount",
  ],
  rows: [
    {
      row: 300,
      action: "Neck",
      leftSide: "-",
      leftNeck: "-",
      centerNeck: "-40",
      rightNeck: "-",
      rightSide: "-",
      leftStitchCount: 41,
      rightStitchCount: 41,
    },
    {
      row: 301,
      action: "Neck",
      leftSide: "-",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-",
      leftStitchCount: 40,
      rightStitchCount: 40,
    },
    {
      row: 302,
      action: "Shoulder / Neck",
      leftSide: "-6",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-6",
      leftStitchCount: 33,
      rightStitchCount: 33,
    },
    {
      row: 303,
      action: "Neck",
      leftSide: "-",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-",
      leftStitchCount: 32,
      rightStitchCount: 32,
    },
    {
      row: 304,
      action: "Shoulder / Neck",
      leftSide: "-6",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-6",
      leftStitchCount: 25,
      rightStitchCount: 25,
    },
    {
      row: 305,
      action: "Neck",
      leftSide: "-",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-",
      leftStitchCount: 24,
      rightStitchCount: 24,
    },
    {
      row: 306,
      action: "Shoulder / Neck",
      leftSide: "-6",
      leftNeck: "-1",
      centerNeck: "-",
      rightNeck: "-1",
      rightSide: "-6",
      leftStitchCount: 17,
      rightStitchCount: 17,
    },
    {
      row: 308,
      action: "Shoulder",
      leftSide: "-6",
      leftNeck: "-",
      centerNeck: "-",
      rightNeck: "-",
      rightSide: "-6",
      leftStitchCount: 11,
      rightStitchCount: 11,
    },
    {
      row: 310,
      action: "Shoulder",
      leftSide: "-6",
      leftNeck: "-",
      centerNeck: "-",
      rightNeck: "-",
      rightSide: "-6",
      leftStitchCount: 5,
      rightStitchCount: 5,
    },
    {
      row: 312,
      action: "Shoulder",
      leftSide: "-5",
      leftNeck: "-",
      centerNeck: "-",
      rightNeck: "-",
      rightSide: "-5",
      leftStitchCount: 0,
      rightStitchCount: 0,
    },
  ],
};

function parseDecreaseCell(cell: string): number {
  const t = String(cell ?? "").trim();
  if (!t || t === "-") return 0;
  const m = t.match(/^-(\d+)$/);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(t.replace(/^\+/, ""), 10);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Highlight from row content (works for live and demo chart rows). */
export function getNeckShoulderChartRowHighlightFromRow(
  r: NeckShoulderShapingChartRow
): NeckShoulderChartRowHighlight | null {
  const leftNeck = parseDecreaseCell(r.leftNeck);
  const rightNeck = parseDecreaseCell(r.rightNeck);
  const leftSide = parseDecreaseCell(r.leftSide);
  const rightSide = parseDecreaseCell(r.rightSide);
  const hasNeck = leftNeck > 0 || rightNeck > 0;
  const hasShoulder = leftSide > 0 || rightSide > 0;
  if (hasNeck && hasShoulder) return "shoulderAndNeck";
  if (hasNeck && leftNeck > 0 && rightNeck > 0 && !hasShoulder) return "neckBothSides";
  if (hasShoulder && leftSide > 0 && rightSide > 0 && !hasNeck) return "shoulderBothSides";
  return null;
}

/** @deprecated Prefer getNeckShoulderChartRowHighlightFromRow — demo-only row numbers. */
export function getNeckShoulderChartRowHighlight(
  rowNum: number
): NeckShoulderChartRowHighlight | null {
  if ([301, 303, 305].includes(rowNum)) return "neckBothSides";
  if ([302, 304, 306].includes(rowNum)) return "shoulderAndNeck";
  if ([308, 310, 312].includes(rowNum)) return "shoulderBothSides";
  return null;
}
