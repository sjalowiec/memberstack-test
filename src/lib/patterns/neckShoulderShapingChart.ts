/**
 * Neckline / shoulder shaping chart — data source for the printed table and future SVG.
 * Replace demo rows with calculated values when wiring live pattern math.
 */

import type { RowEntry } from "./shapingTimeline";

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
  /**
   * Row-by-row needle edges from shapingTimeline — SVG preview uses this when present
   * so the diagram does not re-derive geometry from chart cells.
   */
  timeline?: RowEntry[];
};

export type NeckShoulderShapingChartDisplayRow = {
  rowLabel: string;
  actionLabel: string;
  sourceRow: NeckShoulderShapingChartRow;
};

const COLLAPSED_PLAIN_ACTION_TEXT = "Knit plain, no neckline or shoulder shaping";

function parseCellNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function hasMeaningfulActionValue(value: unknown): boolean {
  const text = String(value ?? "").trim();
  if (!text) return false;
  if (text === "-" || text === "0") return false;
  const numeric = parseCellNumber(text);
  if (numeric === 0) return false;
  return true;
}

function hasMeaningfulActionLabel(action: string): boolean {
  const text = String(action ?? "").trim();
  if (!text) return false;
  if (text === "-" || text === "0") return false;
  const normalized = text.toLowerCase();
  if (normalized === "none" || normalized === "no action") return false;
  return true;
}

function isNoActionChartRow(row: NeckShoulderShapingChartRow): boolean {
  if (hasMeaningfulActionLabel(row.action)) return false;
  return ![
    row.leftSide,
    row.leftNeck,
    row.centerNeck,
    row.rightNeck,
    row.rightSide,
  ].some((cell) => hasMeaningfulActionValue(cell));
}

/**
 * Display-only compaction for table rendering.
 * Keeps every shaping row, while collapsing consecutive no-action rows into a range.
 */
export function collapsePlainChartRows(
  rows: readonly NeckShoulderShapingChartRow[]
): NeckShoulderShapingChartDisplayRow[] {
  const out: NeckShoulderShapingChartDisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (!isNoActionChartRow(row)) {
      out.push({
        rowLabel: String(row.row),
        actionLabel: String(row.action ?? ""),
        sourceRow: row,
      });
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < rows.length) {
      const next = rows[j];
      if (!isNoActionChartRow(next)) break;
      if (
        next.leftStitchCount !== row.leftStitchCount ||
        next.rightStitchCount !== row.rightStitchCount
      ) {
        break;
      }
      if (next.row !== rows[j - 1].row + 1) break;
      j += 1;
    }

    if (j === i + 1) {
      out.push({
        rowLabel: String(row.row),
        actionLabel: COLLAPSED_PLAIN_ACTION_TEXT,
        sourceRow: row,
      });
      i += 1;
      continue;
    }

    const first = row.row;
    const last = rows[j - 1].row;
    out.push({
      rowLabel: `${first}\u2013${last}`,
      actionLabel: COLLAPSED_PLAIN_ACTION_TEXT,
      sourceRow: row,
    });
    i = j;
  }
  return out;
}

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
  rows: NeckShoulderShapingChartRow[],
  options?: { timeline?: RowEntry[] }
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
    ...(options?.timeline?.length ? { timeline: options.timeline } : {}),
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
