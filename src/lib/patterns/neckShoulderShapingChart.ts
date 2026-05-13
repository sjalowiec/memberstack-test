/**
 * Neckline / shoulder shaping chart — data source for the printed table and future SVG.
 * Replace demo rows with calculated values when wiring live pattern math.
 */

import type { RowEntry } from "./shapingTimeline";

export type NeckShoulderChartAction = "Neck" | "Shoulder / Neck" | "Shoulder" | string;

/** One printed row of the shaping chart (machine row numbers are intentional here). */
export type NeckShoulderShapingChartRow = {
  row: number;
  /**
   * When set, the row label spans `row`..`chartRowSpanLast` (inclusive) for display (e.g. legacy
   * {@link compactSymmetricalVNeckNeckEdgeRepeats} data rows).
   */
  chartRowSpanLast?: number;
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
  /**
   * When true, HTML/print use the sleeveless **front** V-neck full-width display rules (one RC per
   * row, etc.). Back neckline charts must always omit this or set it false — back shaping stays
   * round/shallow regardless of the front neckline choice.
   */
  sleevelessFullWidthVNeckFront?: boolean;
};

export type NeckShoulderShapingChartDisplayRow = {
  rowLabel: string;
  actionLabel: string;
  sourceRow: NeckShoulderShapingChartRow;
  /**
   * Plain “Knit in pattern” rows only: carriage side(s) and working edge(s), matching active-shoulder parity
   * (even RC → Right / Armhole, odd RC → Left / Neck).
   */
  plainKnitCarriageLabel?: string;
  plainKnitEdgeLabel?: string;
};

/** Print/PDF compact rows — matches active-shoulder checklist plain-span wording. */
export const NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL = "Knit in pattern";

export type NeckShoulderRowLabelStyle = "online" | "print";

/** Carriage position and edge labels for one or more consecutive plain RCs (parity matches the active-shoulder checklist). */
export function plainKnitSpanCarriageEdgeDisplay(firstRc: number, lastRc: number): {
  carriage: string;
  edge: string;
} {
  const a = Math.max(0, Math.floor(Math.min(firstRc, lastRc)));
  const b = Math.max(0, Math.floor(Math.max(firstRc, lastRc)));
  const carriages: string[] = [];
  const edges: string[] = [];
  for (let rc = a; rc <= b; rc++) {
    carriages.push(rc % 2 === 0 ? "Right" : "Left");
    edges.push(rc % 2 === 0 ? "Armhole" : "Neck");
  }
  const uniqCar = new Set(carriages);
  const uniqEdge = new Set(edges);
  return {
    carriage:
      uniqCar.size === 1 ? [...uniqCar][0]! : "Alternating Left/Right",
    edge:
      uniqEdge.size === 1 ? [...uniqEdge][0]! : "Alternating Neck/Armhole",
  };
}

function isPlainKnitInstructionOnly(action: string): boolean {
  const t = String(action ?? "").trim();
  return t === "" || t === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL;
}

/** Narrative-only or shaping-related action text that must not merge with plain knit spans. */
function actionBlocksPlainKnitMerge(action: string): boolean {
  const t = String(action ?? "").trim();
  if (!t) return false;
  if (/\b(divide|hold|setup|checkpoint)\b/i.test(t)) return true;
  if (/\b(increase|bind\s*off|decrease)\b/i.test(t)) return true;
  if (/neck/i.test(t)) return true;
  if (/shoulder/i.test(t)) return true;
  return false;
}

export function parseDecreaseCellChart(text: unknown): number {
  const t = String(text ?? "").trim();
  if (!t || t === "-" || t === "—" || t === "–") return 0;
  const normalized = t.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(Math.trunc(n));
}

function hasAnyShapingCell(row: NeckShoulderShapingChartRow): boolean {
  return (
    parseDecreaseCellChart(row.leftSide) > 0 ||
    parseDecreaseCellChart(row.leftNeck) > 0 ||
    parseDecreaseCellChart(row.centerNeck) > 0 ||
    parseDecreaseCellChart(row.rightNeck) > 0 ||
    parseDecreaseCellChart(row.rightSide) > 0
  );
}

function rcFloorChart(row: NeckShoulderShapingChartRow): number {
  return Math.max(0, Math.floor(row.row));
}

function isEligiblePlainKnitMergeRow(row: NeckShoulderShapingChartRow): boolean {
  const action = String(row.action ?? "");
  if (!isPlainKnitInstructionOnly(action)) return false;
  if (actionBlocksPlainKnitMerge(action)) return false;
  return !hasAnyShapingCell(row);
}

function rowLabelSingle(rc: number, style: NeckShoulderRowLabelStyle): string {
  const n = Math.max(0, Math.floor(rc));
  const padded = String(n).padStart(3, "0");
  return style === "print" ? `RC:${padded}` : padded;
}

function rowLabelRange(start: number, end: number, style: NeckShoulderRowLabelStyle): string {
  const a = Math.max(0, Math.floor(start));
  const b = Math.max(0, Math.floor(end));
  const left = String(a).padStart(3, "0");
  const right = String(b).padStart(3, "0");
  if (left === right) return rowLabelSingle(a, style);
  if (style === "print") return `RC:${left}\u2013${right}`;
  return `${left}\u2013${right}`;
}

/**
 * Shared display compaction for neckline/shoulder grid charts (online + print).
 * Collapses consecutive plain “Knit in pattern” rows when stitch counts stay constant and RCs are consecutive.
 */
export function collapsePlainKnitChartRowsForDisplay(
  rows: readonly NeckShoulderShapingChartRow[],
  options: { rowLabelStyle: NeckShoulderRowLabelStyle },
): NeckShoulderShapingChartDisplayRow[] {
  const style = options.rowLabelStyle;
  const out: NeckShoulderShapingChartDisplayRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (!isEligiblePlainKnitMergeRow(row)) {
      const spanEnd = row.chartRowSpanLast;
      const firstRc = rcFloorChart(row);
      const rowLabel =
        spanEnd !== undefined && spanEnd > firstRc
          ? rowLabelRange(firstRc, spanEnd, style)
          : rowLabelSingle(firstRc, style);
      out.push({
        rowLabel,
        actionLabel: String(row.action ?? ""),
        sourceRow: row,
      });
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < rows.length) {
      const next = rows[j]!;
      if (!isEligiblePlainKnitMergeRow(next)) break;
      if (
        next.leftStitchCount !== row.leftStitchCount ||
        next.rightStitchCount !== row.rightStitchCount
      ) {
        break;
      }
      if (rcFloorChart(next) !== rcFloorChart(rows[j - 1]!) + 1) break;
      j += 1;
    }

    const firstRc = rcFloorChart(row);
    const lastRc = rcFloorChart(rows[j - 1]!);
    const meta = plainKnitSpanCarriageEdgeDisplay(firstRc, lastRc);

    if (j === i + 1) {
      out.push({
        rowLabel: rowLabelSingle(firstRc, style),
        actionLabel: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        sourceRow: row,
        plainKnitCarriageLabel: meta.carriage,
        plainKnitEdgeLabel: meta.edge,
      });
      i += 1;
      continue;
    }

    out.push({
      rowLabel: rowLabelRange(firstRc, lastRc, style),
      actionLabel: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
      sourceRow: row,
      plainKnitCarriageLabel: meta.carriage,
      plainKnitEdgeLabel: meta.edge,
    });
    i = j;
  }
  return out;
}

/**
 * Sleeveless V-neck **front** full-width chart display (explicit flag only). Geometry-only
 * inference was removed so a back round-neck chart can never pick up V-neck table/print styling
 * when the builder neckline is V-neck.
 */
export function isFullWidthVNeckFrontStyleChart(chart: NeckShoulderShapingChart): boolean {
  return chart.sleevelessFullWidthVNeckFront === true;
}

/**
 * One display row per chart data row — no consecutive plain-knit RC span merging (no en-dash row labels).
 * Plain “Knit in pattern” rows still get single-RC carriage / edge meta.
 */
export function chartDisplayRowsOnePerRc(
  rows: readonly NeckShoulderShapingChartRow[],
  options: { rowLabelStyle: NeckShoulderRowLabelStyle },
): NeckShoulderShapingChartDisplayRow[] {
  const style = options.rowLabelStyle;
  const out: NeckShoulderShapingChartDisplayRow[] = [];
  for (const row of rows) {
    const firstRc = rcFloorChart(row);
    const rowLabel = rowLabelSingle(firstRc, style);
    if (isEligiblePlainKnitMergeRow(row)) {
      const meta = plainKnitSpanCarriageEdgeDisplay(firstRc, firstRc);
      out.push({
        rowLabel,
        actionLabel: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        sourceRow: row,
        plainKnitCarriageLabel: meta.carriage,
        plainKnitEdgeLabel: meta.edge,
      });
    } else {
      out.push({
        rowLabel,
        actionLabel: String(row.action ?? ""),
        sourceRow: row,
      });
    }
  }
  return out;
}

/** @deprecated Prefer {@link collapsePlainKnitChartRowsForDisplay} with `rowLabelStyle: "online"`. */
export function collapsePlainChartRows(
  rows: readonly NeckShoulderShapingChartRow[],
): NeckShoulderShapingChartDisplayRow[] {
  return collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "online" });
}

/** @deprecated Prefer {@link collapsePlainKnitChartRowsForDisplay} with `rowLabelStyle: "print"`. */
export function collapsePlainKnitChartRowsForPrint(
  rows: readonly NeckShoulderShapingChartRow[],
): NeckShoulderShapingChartDisplayRow[] {
  return collapsePlainKnitChartRowsForDisplay(rows, { rowLabelStyle: "print" });
}

function centerNeckClearForVNeckCompact(row: NeckShoulderShapingChartRow): boolean {
  const c = String(row.centerNeck ?? "").trim();
  return !c || c === "-" || c === "—" || c === "–";
}

function isSymmetricalNeckOnlyRow(row: NeckShoulderShapingChartRow): boolean {
  if (!centerNeckClearForVNeckCompact(row)) return false;
  const ln = parseDecreaseCellChart(row.leftNeck);
  const rn = parseDecreaseCellChart(row.rightNeck);
  if (ln <= 0 || rn <= 0 || ln !== rn) return false;
  if (parseDecreaseCellChart(row.leftSide) > 0 || parseDecreaseCellChart(row.rightSide) > 0) return false;
  return true;
}

/**
 * Collapse consecutive full-width V-neck chart rows that only mirror inner-neck decreases (no shoulder
 * / center), same left/right neck cells, consecutive RC — one row with {@link NeckShoulderShapingChartRow.chartRowSpanLast}.
 */
export function compactSymmetricalVNeckNeckEdgeRepeats(
  rows: readonly NeckShoulderShapingChartRow[],
): NeckShoulderShapingChartRow[] {
  const sorted = [...rows].sort((a, b) => a.row - b.row);
  const out: NeckShoulderShapingChartRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const row = sorted[i]!;
    if (!isSymmetricalNeckOnlyRow(row)) {
      out.push({ ...row });
      i += 1;
      continue;
    }
    let j = i + 1;
    const leftKey = String(row.leftNeck);
    const rightKey = String(row.rightNeck);
    while (j < sorted.length) {
      const next = sorted[j]!;
      if (!isSymmetricalNeckOnlyRow(next)) break;
      if (String(next.leftNeck) !== leftKey || String(next.rightNeck) !== rightKey) break;
      if (rcFloorChart(next) !== rcFloorChart(sorted[j - 1]!) + 1) break;
      j += 1;
    }
    if (j === i + 1) {
      out.push({ ...row });
      i += 1;
      continue;
    }
    const last = sorted[j - 1]!;
    out.push({
      ...row,
      row: rcFloorChart(row),
      chartRowSpanLast: rcFloorChart(last),
      leftStitchCount: last.leftStitchCount,
      rightStitchCount: last.rightStitchCount,
      action: "Neck edge (repeat)",
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
  options?: { timeline?: RowEntry[]; sleevelessFullWidthVNeckFront?: boolean }
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
    ...(options?.sleevelessFullWidthVNeckFront === true
      ? { sleevelessFullWidthVNeckFront: true }
      : options?.sleevelessFullWidthVNeckFront === false
        ? { sleevelessFullWidthVNeckFront: false }
        : {}),
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
