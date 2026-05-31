/**
 * Active-shoulder shaping checklist rows (Armhole RC, carriage parity, shaping actions).
 * Kept separate from {@link neckShoulderShapingChartHtml} so {@link sleevelessPatternOutput}
 * can read the same RC values as the rendered table without an import cycle.
 */

import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import {
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  isSleevelessCardiganFrontNeckShoulderChart,
} from "./neckShoulderShapingChart";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import { finalShoulderRemainderStitches } from "./shoulderShapingNotation";

type ActiveSideEdge = "Neck" | "Armhole";

type ActiveSideScheduledAction = {
  sourceRelativeRow: number;
  edge: ActiveSideEdge;
  amount: number;
  kind: "bindOff" | "decrease";
};

export type ActiveSideInstructionTableRow = {
  rc: number;
  /** When set (print compaction), RC column shows `rc–rcEnd`. */
  rcEnd?: number;
  carriagePosition: string;
  action: string;
  edge: string;
  stitchesRemaining: number;
  /**
   * When set, the Sts Remaining cell renders this string instead of the numeric
   * {@link stitchesRemaining} (center neckline divide/transition row only, e.g. `50 total / 20 active`).
   * `stitchesRemaining` still tracks the active-shoulder count so downstream rows and bind-off math are unaffected.
   */
  stitchesRemainingDisplay?: string;
};

/** Back neckline checklist: prepend center divide/setup row at the timeline center-bind-off RC. */
export type ActiveShoulderChecklistOptions = {
  includeCenterNecklineSetupRow?: boolean;
};

/** Edge label for the center neckline divide/setup row (not a worked shaping pass). */
export const ACTIVE_SHOULDER_CENTER_NECKLINE_SETUP_EDGE = "Center";

export function isCenterNecklineSetupChecklistRow(row: ActiveSideInstructionTableRow): boolean {
  return row.edge === ACTIVE_SHOULDER_CENTER_NECKLINE_SETUP_EDGE;
}

type CenterNecklineDivideInfo = {
  garmentRc: number;
  centerBindOff: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
};

function stitchCountPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  return k === 1 ? "1 stitch" : `${k} stitches`;
}

function timelineHasCenterBindOffRow(timeline: readonly RowEntry[]): boolean {
  const first = timeline[0];
  if (!first) return false;
  return first.events.some((e) => e.side === "center" && e.kind === "bindOff" && e.amount > 0);
}

function centerNecklineDivideInfo(chart: NeckShoulderShapingChart): CenterNecklineDivideInfo | null {
  if (chart.timeline && chart.timeline.length > 0) {
    const sorted = [...chart.timeline].sort((a, b) => a.row - b.row);
    const center = sorted[0];
    if (!center) return null;
    const centerBindOff = center.events
      .filter((e) => e.kind === "bindOff" && e.side === "center" && e.edge === "center")
      .reduce((sum, e) => sum + e.amount, 0);
    if (centerBindOff <= 0) return null;
    return {
      garmentRc: center.row,
      centerBindOff,
      stitchesLeftAfter: Math.max(0, Math.floor(center.stitchesL)),
      stitchesRightAfter: Math.max(0, Math.floor(center.stitchesR)),
    };
  }

  const sorted = [...chart.rows].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) return null;
  const centerBindOff = parseDecreaseCell(String(first.centerNeck ?? ""));
  if (centerBindOff <= 0) return null;
  return {
    garmentRc: first.row,
    centerBindOff,
    stitchesLeftAfter: Math.max(0, Math.floor(first.leftStitchCount)),
    stitchesRightAfter: Math.max(0, Math.floor(first.rightStitchCount)),
  };
}

function shouldIncludeCenterNecklineSetupRow(
  chart: NeckShoulderShapingChart,
  options?: ActiveShoulderChecklistOptions,
): boolean {
  if (isSleevelessCardiganFrontNeckShoulderChart(chart)) return false;
  return options?.includeCenterNecklineSetupRow === true && centerNecklineDivideInfo(chart) !== null;
}

/** Checklist action text — matches round-neck “scrap off … divide” intro wording. */
export function formatCenterNecklineSetupChecklistAction(info: CenterNecklineDivideInfo): string {
  const n = Math.max(0, Math.floor(info.centerBindOff));
  const centerWord = n === 1 ? "stitch" : "stitches";
  const L = Math.max(0, Math.floor(info.stitchesLeftAfter));
  const R = Math.max(0, Math.floor(info.stitchesRightAfter));
  const shoulders =
    L === R
      ? `${stitchCountPhrase(L)} on each shoulder`
      : `${stitchCountPhrase(L)} left, ${stitchCountPhrase(R)} right`;
  return `Scrap off center ${n} neckline ${centerWord} to divide; ${shoulders} remaining. Place opposite shoulder in hold; ${stitchCountPhrase(R)} active shoulder.`;
}

/**
 * Sts Remaining label for the center neckline divide row: full pre-divide count → active shoulder.
 * "Total" is the whole back width before the center stitches are scrapped off
 * (both shoulders + center); "active" is the working shoulder kept on the machine after the divide.
 */
export function formatCenterNecklineSetupStsRemainingDisplay(info: CenterNecklineDivideInfo): string {
  const active = Math.max(0, Math.floor(info.stitchesRightAfter));
  const total =
    Math.max(0, Math.floor(info.stitchesLeftAfter)) +
    Math.max(0, Math.floor(info.centerBindOff)) +
    active;
  return `${total} total / ${active} active`;
}

function buildCenterNecklineSetupChecklistRow(
  rc: number,
  info: CenterNecklineDivideInfo,
): ActiveSideInstructionTableRow {
  return {
    rc,
    carriagePosition: carriagePositionForActiveSideRc(rc),
    action: formatCenterNecklineSetupChecklistAction(info),
    edge: ACTIVE_SHOULDER_CENTER_NECKLINE_SETUP_EDGE,
    stitchesRemaining: Math.max(0, Math.floor(info.stitchesRightAfter)),
    stitchesRemainingDisplay: formatCenterNecklineSetupStsRemainingDisplay(info),
  };
}

function parseDecreaseCell(cell: string): number {
  const text = String(cell ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(Math.trunc(n));
}

/**
 * Armhole-local RC for the first row of the active-shoulder checklist (continuous with the armhole
 * counter — same base as {@link buildActiveSideInstructionTableRows} `rcStart`).
 */
export function armholeLocalRcActiveShoulderChecklistStart(
  chart: NeckShoulderShapingChart,
  firstArmholeGarmentRc: number | null | undefined,
  options?: ActiveShoulderChecklistOptions,
): number {
  const fhRaw = Number(firstArmholeGarmentRc);
  if (!Number.isFinite(fhRaw)) return 0;
  const fh = Math.max(0, Math.floor(fhRaw));
  const includeCenterSetup = shouldIncludeCenterNecklineSetupRow(chart, options);
  const divideInfo = includeCenterSetup ? centerNecklineDivideInfo(chart) : null;

  if (chart.timeline && chart.timeline.length > 0) {
    const sorted = [...chart.timeline].sort((a, b) => a.row - b.row);
    const center = sorted[0];
    if (!center) return 0;
    if (isSleevelessCardiganFrontNeckShoulderChart(chart) || !timelineHasCenterBindOffRow(chart.timeline)) {
      return Math.max(0, Math.floor(center.row) - fh);
    }
    if (divideInfo) {
      return Math.max(0, Math.floor(divideInfo.garmentRc) - fh);
    }
    const second = sorted[1];
    const startGarment = second !== undefined ? second.row : center.row + 1;
    return Math.max(0, Math.floor(startGarment) - fh);
  }

  const rows = [...chart.rows].sort((a, b) => a.row - b.row);
  const first = rows[0];
  if (!first) return 0;
  const centerBo = parseDecreaseCell(String(first.centerNeck ?? "")) > 0;
  if (divideInfo && centerBo) {
    return Math.max(0, Math.floor(divideInfo.garmentRc) - fh);
  }
  const sourceBaseRow = centerBo ? first.row + 1 : first.row;
  return Math.max(0, Math.floor(sourceBaseRow) - fh);
}

function carriagePositionForActiveSideRc(rc: number): "Right" | "Left" {
  return rc % 2 === 0 ? "Right" : "Left";
}

function edgeForActiveSideCarriagePosition(position: "Right" | "Left"): ActiveSideEdge {
  return position === "Right" ? "Armhole" : "Neck";
}

function requiredParityForActiveSideEdge(edge: ActiveSideEdge): 0 | 1 {
  return edge === "Armhole" ? 0 : 1;
}

function activeSideActionText(action: ActiveSideScheduledAction): string {
  const noun = action.amount === 1 ? "st" : "sts";
  let verb: string;
  if (action.kind === "bindOff") {
    verb = action.edge === "Armhole" ? "Bind off OR hold" : "Bind off";
  } else {
    verb = "Decrease";
  }
  return `${verb} ${action.amount} ${noun}`;
}

function addActiveSideKnitEvenRow(
  rows: ActiveSideInstructionTableRow[],
  rc: number,
  stitchesRemaining: number
): void {
  const carriagePosition = carriagePositionForActiveSideRc(rc);
  rows.push({
    rc,
    carriagePosition,
    action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
    edge: edgeForActiveSideCarriagePosition(carriagePosition),
    stitchesRemaining,
  });
}

function activeSideActionFromTimelineEvent(
  entry: RowEntry,
  event: ShapingEvent,
  centerRow: number
): ActiveSideScheduledAction | null {
  if (event.side !== "right" || event.amount <= 0) return null;
  if (event.edge !== "inner" && event.edge !== "outer") return null;
  if (event.kind !== "bindOff" && event.kind !== "decrease") return null;
  return {
    sourceRelativeRow: Math.max(0, Math.floor(entry.row - centerRow - 1)),
    edge: event.edge === "inner" ? "Neck" : "Armhole",
    amount: Math.max(0, Math.floor(event.amount)),
    kind: event.kind,
  };
}

function buildActiveSideActionsFromTimeline(
  timeline: readonly RowEntry[],
  chart?: NeckShoulderShapingChart,
): {
  initialStitches: number;
  finalSourceRelativeRow: number;
  actions: ActiveSideScheduledAction[];
} | null {
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) return null;
  const cardiganFront =
    chart !== undefined && isSleevelessCardiganFrontNeckShoulderChart(chart);
  const hasCenterDivide = !cardiganFront && timelineHasCenterBindOffRow(timeline);
  const center = hasCenterDivide ? first : null;
  const shapingEntries = hasCenterDivide ? sorted.slice(1) : sorted;
  const baseRow = hasCenterDivide && center ? center.row : first.row - 1;

  const actions: ActiveSideScheduledAction[] = [];
  let finalSourceRelativeRow = 0;
  for (const entry of shapingEntries) {
    const rel = Math.max(0, Math.floor(entry.row - baseRow - 1));
    finalSourceRelativeRow = Math.max(finalSourceRelativeRow, rel);
    for (const event of entry.events) {
      const action = activeSideActionFromTimelineEvent(
        entry,
        event,
        hasCenterDivide && center ? center.row : baseRow,
      );
      if (action) actions.push(action);
    }
  }
  const remainder = finalShoulderRemainderStitches(timeline, "right");
  if (remainder > 0) {
    actions.push({
      sourceRelativeRow: finalSourceRelativeRow + 1,
      edge: "Armhole",
      amount: remainder,
      kind: "bindOff",
    });
    finalSourceRelativeRow += 1;
  }

  const initialStitches =
    hasCenterDivide && center
      ? Math.max(0, Math.floor(center.stitchesR))
      : Math.max(0, Math.floor(first.stitchesR - first.netChangeR));

  return {
    initialStitches,
    finalSourceRelativeRow,
    actions,
  };
}

function buildActiveSideActionsFromChartRows(rows: readonly NeckShoulderShapingChartRow[]): {
  initialStitches: number;
  finalSourceRelativeRow: number;
  actions: ActiveSideScheduledAction[];
} {
  const sorted = [...rows].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) {
    return { initialStitches: 0, finalSourceRelativeRow: 0, actions: [] };
  }
  const firstHasCenterBindOff = parseDecreaseCell(first.centerNeck) > 0;
  const sourceRows = firstHasCenterBindOff ? sorted.slice(1) : sorted;
  const sourceBaseRow = firstHasCenterBindOff ? first.row + 1 : first.row;
  const firstSource = sourceRows[0];
  const firstSourceDecrease =
    firstSource !== undefined
      ? parseDecreaseCell(firstSource.rightNeck) + parseDecreaseCell(firstSource.rightSide)
      : 0;
  const initialStitches = firstHasCenterBindOff
    ? Math.max(0, Math.floor(first.rightStitchCount))
    : Math.max(0, Math.floor(first.rightStitchCount + firstSourceDecrease));
  const actions: ActiveSideScheduledAction[] = [];
  let finalSourceRelativeRow = 0;
  for (const row of sourceRows) {
    const rel = Math.max(0, Math.floor(row.row - sourceBaseRow));
    finalSourceRelativeRow = Math.max(finalSourceRelativeRow, rel);
    const neck = parseDecreaseCell(row.rightNeck);
    const armhole = parseDecreaseCell(row.rightSide);
    if (neck > 0) {
      actions.push({ sourceRelativeRow: rel, edge: "Neck", amount: neck, kind: "decrease" });
    }
    if (armhole > 0) {
      actions.push({ sourceRelativeRow: rel, edge: "Armhole", amount: armhole, kind: "bindOff" });
    }
  }
  const lastSource = sourceRows[sourceRows.length - 1];
  const remainder = lastSource ? Math.max(0, Math.floor(lastSource.rightStitchCount)) : 0;
  const lastArmhole = lastSource ? parseDecreaseCell(lastSource.rightSide) : 0;
  if (remainder > 0 && lastArmhole < remainder) {
    actions.push({
      sourceRelativeRow: finalSourceRelativeRow + 1,
      edge: "Armhole",
      amount: remainder,
      kind: "bindOff",
    });
    finalSourceRelativeRow += 1;
  }
  return { initialStitches, finalSourceRelativeRow, actions };
}

export function buildActiveSideInstructionTableRows(
  chart: NeckShoulderShapingChart,
  rcStart = 0,
  options?: ActiveShoulderChecklistOptions,
): ActiveSideInstructionTableRow[] {
  const source =
    chart.timeline && chart.timeline.length > 0
      ? buildActiveSideActionsFromTimeline(chart.timeline, chart)
      : chart.rows.length > 0
        ? buildActiveSideActionsFromChartRows(chart.rows)
        : null;
  if (!source) return [];

  const out: ActiveSideInstructionTableRow[] = [];
  const rcBase = Math.max(0, Math.floor(rcStart));
  const divideInfo = shouldIncludeCenterNecklineSetupRow(chart, options)
    ? centerNecklineDivideInfo(chart)
    : null;
  let checklistIdx = divideInfo ? 1 : 0;
  if (divideInfo) {
    out.push(buildCenterNecklineSetupChecklistRow(rcBase, divideInfo));
  }
  let stitchesRemaining = source.initialStitches;
  const actions = [...source.actions].sort((a, b) => {
    const dr = a.sourceRelativeRow - b.sourceRelativeRow;
    if (dr !== 0) return dr;
    if (a.edge === b.edge) return 0;
    return a.edge === "Neck" ? -1 : 1;
  });

  for (const action of actions) {
    while (checklistIdx < action.sourceRelativeRow) {
      addActiveSideKnitEvenRow(out, rcBase + checklistIdx, stitchesRemaining);
      checklistIdx += 1;
    }
    let displayRc = rcBase + checklistIdx;
    while (displayRc % 2 !== requiredParityForActiveSideEdge(action.edge)) {
      addActiveSideKnitEvenRow(out, displayRc, stitchesRemaining);
      checklistIdx += 1;
      displayRc = rcBase + checklistIdx;
    }
    const carriagePosition = carriagePositionForActiveSideRc(displayRc);
    stitchesRemaining = Math.max(0, stitchesRemaining - action.amount);
    out.push({
      rc: displayRc,
      carriagePosition,
      action: activeSideActionText(action),
      edge: action.edge,
      stitchesRemaining,
    });
    checklistIdx += 1;
  }

  while (checklistIdx <= source.finalSourceRelativeRow) {
    addActiveSideKnitEvenRow(out, rcBase + checklistIdx, stitchesRemaining);
    checklistIdx += 1;
  }

  return out;
}

function isPlainKnitActiveSideRow(row: ActiveSideInstructionTableRow): boolean {
  return row.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL;
}

/**
 * Armhole-local RC of the first neckline shaping action in the generated active-shoulder
 * checklist (after carriage parity — same rows as the print/online shaping table).
 */
export function armholeLocalRcFirstActiveSideNecklineShapingAction(
  chart: NeckShoulderShapingChart,
  firstArmholeGarmentRc: number | null | undefined
): number | undefined {
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, firstArmholeGarmentRc);
  const rows = buildActiveSideInstructionTableRows(chart, rcStart);
  const shapingRows = rows.filter(
    (row) => !isPlainKnitActiveSideRow(row) && !isCenterNecklineSetupChecklistRow(row),
  );
  const firstNeck = shapingRows.find((row) => row.edge === "Neck");
  const first = firstNeck ?? shapingRows[0];
  return first !== undefined ? first.rc : undefined;
}

function oppositeCarriagePosition(position: "Right" | "Left"): "Right" | "Left" {
  return position === "Right" ? "Left" : "Right";
}

function carriagePositionForSecondShoulderRc(rc: number): "Right" | "Left" {
  return oppositeCarriagePosition(carriagePositionForActiveSideRc(rc));
}

export function buildSecondShoulderInstructionTableRows(
  rows: readonly ActiveSideInstructionTableRow[],
): ActiveSideInstructionTableRow[] {
  return rows.map((r) => ({
    ...r,
    carriagePosition: carriagePositionForSecondShoulderRc(r.rc),
  }));
}
