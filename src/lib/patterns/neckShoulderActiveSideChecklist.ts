/**
 * Active-shoulder shaping checklist rows (Armhole RC, carriage parity, shaping actions).
 * Kept separate from {@link neckShoulderShapingChartHtml} so {@link sleevelessPatternOutput}
 * can read the same RC values as the rendered table without an import cycle.
 */

import { ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE } from "./neckShoulderActiveIntroCopy";
import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import {
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  isFullWidthVNeckFrontStyleChart,
  isSleevelessCardiganFrontNeckShoulderChart,
} from "./neckShoulderShapingChart";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import { finalShoulderRemainderStitches } from "./shoulderShapingNotation";
import {
  displayRcFromGarmentRc,
  FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES,
} from "./frontArmholeNecklineComposition";

type ActiveSideEdge = "Neck" | "Armhole" | "Shoulder";

type ActiveSideScheduledAction = {
  sourceRelativeRow: number;
  edge: ActiveSideEdge;
  amount: number;
  kind: "bindOff" | "decrease" | "hold";
};

type ActiveSideActionSource = {
  initialStitches: number;
  finalSourceRelativeRow: number;
  actions: ActiveSideScheduledAction[];
  /**
   * When true, checklist RCs follow the timeline/written deep-round schedule
   * (center BO at local 000, neck-edge actions at 002, 004, …) without Neck-odd padding.
   * Cardigan, V-neck, shallow-front, and back-neck keep the legacy parity path.
   */
  alignDisplayRcToTimeline: boolean;
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
   * {@link stitchesRemaining} (center neckline divide/transition row only, e.g. `37 needles in work`).
   * `stitchesRemaining` still tracks the active-shoulder count so downstream rows and bind-off math are unaffected.
   */
  stitchesRemainingDisplay?: string;
  /** Presentation-only: insert the armhole row-counter reset in a Case 4 (neckline-first) checklist. */
  rowCounterReset?: boolean;
  rowCounterResetGarmentRc?: number;
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

/** Active-shoulder needles phrase for setup-row Sts Remaining / second-shoulder reminder copy. */
function needlesInWorkPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  return k === 1 ? "1 needle in work" : `${k} needles in work`;
}

function timelineHasCenterDivideRow(timeline: readonly RowEntry[]): boolean {
  const first = timeline[0];
  if (!first) return false;
  return first.events.some(
    (e) =>
      e.side === "center" &&
      e.amount > 0 &&
      (e.kind === "bindOff" || e.kind === "hold"),
  );
}

/** @deprecated Use {@link timelineHasCenterDivideRow}. */
function timelineHasCenterBindOffRow(timeline: readonly RowEntry[]): boolean {
  return timelineHasCenterDivideRow(timeline);
}

function centerNecklineDivideInfo(chart: NeckShoulderShapingChart): CenterNecklineDivideInfo | null {
  if (chart.timeline && chart.timeline.length > 0) {
    const sorted = [...chart.timeline].sort((a, b) => a.row - b.row);
    const center = sorted[0];
    if (!center) return null;
    const centerBindOff = center.events
      .filter(
        (e) =>
          (e.kind === "bindOff" || e.kind === "hold") &&
          e.side === "center" &&
          e.edge === "center",
      )
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

function vNeckDivideSetupInfo(
  chart: NeckShoulderShapingChart,
): { left: number; right: number } | null {
  if (!isFullWidthVNeckFrontStyleChart(chart)) return null;
  const composition = chart.frontVNeckArmholeComposition;
  if (composition) {
    return {
      left: Math.max(0, Math.floor(composition.leftAtDivide)),
      right: Math.max(0, Math.floor(composition.rightAtDivide)),
    };
  }
  const timeline = chart.timeline;
  if (!timeline?.length) return null;
  const first = [...timeline].sort((a, b) => a.row - b.row)[0];
  if (!first) return null;
  return {
    left: Math.max(0, Math.floor(first.stitchesL)),
    right: Math.max(0, Math.floor(first.stitchesR)),
  };
}

function shouldIncludeVNeckDivideSetupRow(
  chart: NeckShoulderShapingChart,
  options?: ActiveShoulderChecklistOptions,
): boolean {
  return options?.includeCenterNecklineSetupRow === true && vNeckDivideSetupInfo(chart) !== null;
}

export function formatVNeckDivideSetupChecklistAction(left: number, right: number): string {
  const L = Math.max(0, Math.floor(left));
  const R = Math.max(0, Math.floor(right));
  const sides =
    L === R
      ? `${stitchCountPhrase(L)} on each side`
      : `${stitchCountPhrase(L)} left, ${stitchCountPhrase(R)} right`;
  return `Divide at center: ${sides}. ${ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE} ${stitchCountPhrase(R)} on the active side.`;
}

/** Checklist action text — shallow hold back vs round-neck scrap-off divide intro. */
export function formatCenterNecklineSetupChecklistAction(
  info: CenterNecklineDivideInfo,
  options?: { shallowHoldBack?: boolean },
): string {
  const n = Math.max(0, Math.floor(info.centerBindOff));
  const centerWord = n === 1 ? "stitch" : "stitches";
  const R = Math.max(0, Math.floor(info.stitchesRightAfter));
  if (options?.shallowHoldBack) {
    return `Place center ${n} neckline ${centerWord} in hold; place opposite shoulder and opposite neckline stitches in hold. ${stitchCountPhrase(R)} on active (right) shoulder. ${ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE}`;
  }
  const L = Math.max(0, Math.floor(info.stitchesLeftAfter));
  const shoulders =
    L === R
      ? `${stitchCountPhrase(L)} on each shoulder`
      : `${stitchCountPhrase(L)} left, ${stitchCountPhrase(R)} right`;
  return `Scrap off center ${n} neckline ${centerWord} to divide; ${shoulders} remaining. ${ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE} ${stitchCountPhrase(R)} active shoulder.`;
}

function chartUsesShallowHoldBackCenter(chart?: NeckShoulderShapingChart): boolean {
  const first = chart?.timeline?.[0];
  if (!first) return false;
  if (chart !== undefined && isSleevelessCardiganFrontNeckShoulderChart(chart)) return false;
  return first.events.some(
    (e) => e.kind === "hold" && e.side === "center" && e.edge === "center" && e.amount > 0,
  );
}

/** Exported for chart intro HTML (shallow back hold divide detection). */
export function neckShoulderChartUsesShallowHoldBackCenter(
  chart?: NeckShoulderShapingChart,
): boolean {
  return chartUsesShallowHoldBackCenter(chart);
}

/**
 * Sts Remaining label for the center neckline divide/setup row after the neckline is divided:
 * active shoulder needles only (no pre-divide full-piece total).
 */
export function formatCenterNecklineSetupStsRemainingDisplay(info: CenterNecklineDivideInfo): string {
  return needlesInWorkPhrase(info.stitchesRightAfter);
}

function buildCenterNecklineSetupChecklistRow(
  rc: number,
  info: CenterNecklineDivideInfo,
  chart?: NeckShoulderShapingChart,
): ActiveSideInstructionTableRow {
  return {
    rc,
    carriagePosition: carriagePositionForActiveSideRc(rc),
    action: formatCenterNecklineSetupChecklistAction(info, {
      shallowHoldBack: chart !== undefined && chartUsesShallowHoldBackCenter(chart),
    }),
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
      return displayRcFromGarmentRc(center.row, fh);
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

/** Legacy carriage parity: Armhole/Shoulder on even RC, Neck on odd RC. */
function requiredParityForActiveSideEdge(edge: ActiveSideEdge): 0 | 1 {
  return edge === "Neck" ? 1 : 0;
}

/** Deep round pullover: center stitches are bound off (not held). */
function timelineHasDeepRoundCenterBindOff(timeline: readonly RowEntry[]): boolean {
  const first = timeline[0];
  if (!first) return false;
  return first.events.some(
    (e) => e.side === "center" && e.edge === "center" && e.kind === "bindOff" && e.amount > 0,
  );
}

function activeSideActionText(action: ActiveSideScheduledAction): string {
  // A shaping action always moves at least one stitch; coerce defensively so the count is
  // always rendered explicitly (e.g. "Decrease 1 st"), never blank/"undefined" if the
  // upstream amount is missing or non-finite.
  const amount = Number.isFinite(action.amount) ? Math.max(1, Math.round(action.amount)) : 1;
  const noun = amount === 1 ? "st" : "sts";
  let verb: string;
  if (action.kind === "hold") {
    verb = "Hold";
  } else if (action.kind === "bindOff") {
    verb = action.edge === "Armhole" || action.edge === "Shoulder" ? "Bind off OR hold" : "Bind off";
  } else {
    verb = "Decrease";
  }
  return `${verb} ${amount} ${noun}`;
}

function addActiveSideKnitEvenRow(
  rows: ActiveSideInstructionTableRow[],
  rc: number,
  stitchesRemaining: number,
  invertCarriage = false,
): void {
  const carriagePosition = invertCarriage
    ? carriagePositionForSecondShoulderRc(rc)
    : carriagePositionForActiveSideRc(rc);
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
  relativeOriginRow: number,
  /** When true, relative RC is `entry.row - origin` (deep round). Legacy uses `entry.row - origin - 1`. */
  alignDisplayRcToTimeline: boolean,
  side: "left" | "right",
  lastArmholeGarmentRc?: number,
): ActiveSideScheduledAction | null {
  if (event.side !== side || event.amount <= 0) return null;
  if (event.edge !== "inner" && event.edge !== "outer") return null;
  if (event.kind !== "bindOff" && event.kind !== "decrease" && event.kind !== "hold") return null;
  const rel = alignDisplayRcToTimeline
    ? Math.max(0, Math.floor(entry.row - relativeOriginRow))
    : Math.max(0, Math.floor(entry.row - relativeOriginRow - 1));
  let edge: ActiveSideEdge;
  if (event.edge === "inner") {
    edge = "Neck";
  } else if (event.kind === "decrease") {
    edge = "Armhole";
  } else if (lastArmholeGarmentRc !== undefined) {
    edge = entry.row <= lastArmholeGarmentRc ? "Armhole" : "Shoulder";
  } else {
    edge = "Armhole";
  }
  return {
    sourceRelativeRow: rel,
    edge,
    amount: Math.max(0, Math.floor(event.amount)),
    kind: event.kind,
  };
}

function buildActiveSideActionsFromTimeline(
  timeline: readonly RowEntry[],
  chart?: NeckShoulderShapingChart,
  side: "left" | "right" = "right",
): ActiveSideActionSource | null {
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) return null;
  const cardiganFront =
    chart !== undefined && isSleevelessCardiganFrontNeckShoulderChart(chart);
  const vNeckFront = chart !== undefined && isFullWidthVNeckFrontStyleChart(chart);
  const hasCenterDivide = !cardiganFront && timelineHasCenterBindOffRow(timeline);
  const center = hasCenterDivide ? first : null;
  const shapingEntries = hasCenterDivide ? sorted.slice(1) : sorted;
  /**
   * Align checklist RCs to timeline/written row numbers when shaping may fall on consecutive
   * rows (V-neck evenShapingSchedule, or deep round center bind-off schedules).
   * Legacy odd/even carriage padding must not apply — it infinite-pads every-row Neck decreases.
   */
  const alignDisplayRcToTimeline =
    vNeckFront ||
    (hasCenterDivide && !cardiganFront && timelineHasDeepRoundCenterBindOff(timeline));

  const relativeOriginRow =
    hasCenterDivide && center
      ? center.row
      : alignDisplayRcToTimeline
        ? first.row
        : first.row - 1;

  const actions: ActiveSideScheduledAction[] = [];
  let finalSourceRelativeRow = 0;
  for (const entry of shapingEntries) {
    const rel = alignDisplayRcToTimeline
      ? Math.max(0, Math.floor(entry.row - relativeOriginRow))
      : Math.max(0, Math.floor(entry.row - relativeOriginRow - 1));
    finalSourceRelativeRow = Math.max(finalSourceRelativeRow, rel);
    for (const event of entry.events) {
      const action = activeSideActionFromTimelineEvent(
        entry,
        event,
        relativeOriginRow,
        alignDisplayRcToTimeline,
        side,
        chart?.frontVNeckArmholeComposition?.lastArmholeGarmentRc,
      );
      if (action) actions.push(action);
    }
  }
  const remainder = finalShoulderRemainderStitches(timeline, side);
  if (remainder > 0) {
    actions.push({
      sourceRelativeRow: finalSourceRelativeRow + 1,
      edge: chart?.frontVNeckArmholeComposition ? "Shoulder" : "Armhole",
      amount: remainder,
      kind: "bindOff",
    });
    finalSourceRelativeRow += 1;
  }

  const initialStitches =
    hasCenterDivide && center
      ? Math.max(0, Math.floor(side === "left" ? center.stitchesL : center.stitchesR))
      : Math.max(
          0,
          Math.floor(
            side === "left"
              ? first.stitchesL - first.netChangeL
              : first.stitchesR - first.netChangeR,
          ),
        );

  return {
    initialStitches,
    finalSourceRelativeRow,
    actions,
    alignDisplayRcToTimeline,
  };
}

function buildActiveSideActionsFromChartRows(
  rows: readonly NeckShoulderShapingChartRow[],
): ActiveSideActionSource {
  const sorted = [...rows].sort((a, b) => a.row - b.row);
  const first = sorted[0];
  if (!first) {
    return {
      initialStitches: 0,
      finalSourceRelativeRow: 0,
      actions: [],
      alignDisplayRcToTimeline: false,
    };
  }
  const firstHasCenterBindOff = parseDecreaseCell(first.centerNeck) > 0;
  const sourceRows = firstHasCenterBindOff ? sorted.slice(1) : sorted;
  const firstSource = sourceRows[0];
  // Deep-round timeline places the first neck-edge action at center+2; shallow/legacy at center+1.
  const alignDisplayRcToTimeline =
    firstHasCenterBindOff &&
    firstSource !== undefined &&
    firstSource.row >= first.row + 2;
  const sourceBaseRow = alignDisplayRcToTimeline
    ? first.row
    : firstHasCenterBindOff
      ? first.row + 1
      : first.row;
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
  return { initialStitches, finalSourceRelativeRow, actions, alignDisplayRcToTimeline };
}

function displayChecklistRc(
  relative: number,
  rcBase: number,
  originGarmentRc: number | undefined,
  firstArmholeGarmentRc: number | undefined,
): number {
  if (
    originGarmentRc !== undefined &&
    firstArmholeGarmentRc !== undefined &&
    Number.isFinite(originGarmentRc) &&
    Number.isFinite(firstArmholeGarmentRc)
  ) {
    return displayRcFromGarmentRc(originGarmentRc + relative, firstArmholeGarmentRc);
  }
  return rcBase + relative;
}

function buildSideInstructionTableRows(
  chart: NeckShoulderShapingChart,
  rcStart: number,
  options: ActiveShoulderChecklistOptions | undefined,
  side: "left" | "right",
): ActiveSideInstructionTableRow[] {
  const source =
    chart.timeline && chart.timeline.length > 0
      ? buildActiveSideActionsFromTimeline(chart.timeline, chart, side)
      : chart.rows.length > 0
        ? buildActiveSideActionsFromChartRows(chart.rows)
        : null;
  if (!source) return [];

  const out: ActiveSideInstructionTableRow[] = [];
  const rcBase = Math.max(0, Math.floor(rcStart));
  const originGarmentRc =
    chart.timeline && chart.timeline.length > 0
      ? [...chart.timeline].sort((a, b) => a.row - b.row)[0]?.row
      : undefined;
  const firstArmholeGarmentRc = chart.frontVNeckArmholeComposition?.firstArmholeGarmentRc;
  const toDisplay = (rel: number) =>
    displayChecklistRc(rel, rcBase, originGarmentRc, firstArmholeGarmentRc);
  const invertCarriage = side === "left";
  const carriageFor = (rc: number) =>
    invertCarriage ? carriagePositionForSecondShoulderRc(rc) : carriagePositionForActiveSideRc(rc);
  const insertArmholeReset =
    chart.frontVNeckArmholeComposition?.necklineBeginsBeforeArmhole === true &&
    originGarmentRc !== undefined &&
    firstArmholeGarmentRc !== undefined &&
    originGarmentRc < firstArmholeGarmentRc;
  let armholeResetInserted = false;
  const pushArmholeResetIfNeeded = (rel: number, stitchesAtReset: number) => {
    if (!insertArmholeReset || armholeResetInserted) return;
    if (originGarmentRc === undefined || firstArmholeGarmentRc === undefined) return;
    if (originGarmentRc + rel < firstArmholeGarmentRc) return;
    out.push({
      rc: 0,
      carriagePosition: carriageFor(0),
      action: FRONT_VNECK_ARMHOLE_BEGINS_WHILE_VNECK_CONTINUES,
      edge: "Armhole",
      stitchesRemaining: stitchesAtReset,
      rowCounterReset: true,
      rowCounterResetGarmentRc: firstArmholeGarmentRc,
    });
    armholeResetInserted = true;
  };

  const divideInfo =
    side === "right" && shouldIncludeCenterNecklineSetupRow(chart, options)
      ? centerNecklineDivideInfo(chart)
      : null;
  const vDivide = shouldIncludeVNeckDivideSetupRow(chart, options)
    ? vNeckDivideSetupInfo(chart)
    : null;
  const hasSetup = Boolean(vDivide);
  let checklistIdx = divideInfo ? 1 : 0;
  if (divideInfo) {
    out.push(buildCenterNecklineSetupChecklistRow(toDisplay(0), divideInfo, chart));
  } else if (vDivide) {
    const setupRc = toDisplay(0);
    if (side === "left") {
      const held = Math.max(0, Math.floor(vDivide.left));
      out.push({
        rc: setupRc,
        carriagePosition: carriageFor(setupRc),
        action: formatSecondShoulderCenterSetupChecklistAction(held),
        edge: ACTIVE_SHOULDER_CENTER_NECKLINE_SETUP_EDGE,
        stitchesRemaining: held,
      });
    } else {
      out.push({
        rc: setupRc,
        carriagePosition: carriageFor(setupRc),
        action: formatVNeckDivideSetupChecklistAction(vDivide.left, vDivide.right),
        edge: ACTIVE_SHOULDER_CENTER_NECKLINE_SETUP_EDGE,
        stitchesRemaining: Math.max(0, Math.floor(vDivide.right)),
        stitchesRemainingDisplay: `${Math.max(0, Math.floor(vDivide.right))} (active side)`,
      });
    }
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
      if (hasSetup && checklistIdx === 0) {
        checklistIdx += 1;
        continue;
      }
      pushArmholeResetIfNeeded(checklistIdx, stitchesRemaining);
      addActiveSideKnitEvenRow(out, toDisplay(checklistIdx), stitchesRemaining, invertCarriage);
      checklistIdx += 1;
    }
    let displayRc = toDisplay(checklistIdx);
    if (source.alignDisplayRcToTimeline) {
      displayRc = toDisplay(action.sourceRelativeRow);
    } else {
      while (displayRc % 2 !== requiredParityForActiveSideEdge(action.edge)) {
        pushArmholeResetIfNeeded(checklistIdx, stitchesRemaining);
        addActiveSideKnitEvenRow(out, displayRc, stitchesRemaining, invertCarriage);
        checklistIdx += 1;
        displayRc = toDisplay(checklistIdx);
      }
    }
    pushArmholeResetIfNeeded(
      source.alignDisplayRcToTimeline ? action.sourceRelativeRow : checklistIdx,
      stitchesRemaining,
    );
    stitchesRemaining = Math.max(0, stitchesRemaining - action.amount);
    out.push({
      rc: displayRc,
      carriagePosition: carriageFor(displayRc),
      action: activeSideActionText(action),
      edge: action.edge,
      stitchesRemaining,
    });
    checklistIdx = source.alignDisplayRcToTimeline
      ? Math.max(checklistIdx, action.sourceRelativeRow + 1)
      : checklistIdx + 1;
  }

  while (checklistIdx <= source.finalSourceRelativeRow) {
    if (hasSetup && checklistIdx === 0) {
      checklistIdx += 1;
      continue;
    }
    pushArmholeResetIfNeeded(checklistIdx, stitchesRemaining);
    addActiveSideKnitEvenRow(out, toDisplay(checklistIdx), stitchesRemaining, invertCarriage);
    checklistIdx += 1;
  }

  if (stitchesRemaining > 0) {
    let displayRc = toDisplay(checklistIdx);
    const leftoverEdge: ActiveSideEdge = chart.frontVNeckArmholeComposition
      ? "Shoulder"
      : "Armhole";
    while (displayRc % 2 !== requiredParityForActiveSideEdge(leftoverEdge)) {
      pushArmholeResetIfNeeded(checklistIdx, stitchesRemaining);
      addActiveSideKnitEvenRow(out, displayRc, stitchesRemaining, invertCarriage);
      checklistIdx += 1;
      displayRc = toDisplay(checklistIdx);
    }
    pushArmholeResetIfNeeded(checklistIdx, stitchesRemaining);
    const amount = stitchesRemaining;
    const noun = amount === 1 ? "st" : "sts";
    stitchesRemaining = 0;
    out.push({
      rc: displayRc,
      carriagePosition: carriageFor(displayRc),
      action: `Bind off remaining ${amount} ${noun}`,
      edge: leftoverEdge,
      stitchesRemaining,
    });
  }

  return out;
}

export function buildActiveSideInstructionTableRows(
  chart: NeckShoulderShapingChart,
  rcStart = 0,
  options?: ActiveShoulderChecklistOptions,
): ActiveSideInstructionTableRow[] {
  return buildSideInstructionTableRows(chart, rcStart, options, "right");
}

/**
 * Second-side V-neck walk from the parked held-side count. Does not copy first-side
 * running stitch counts.
 */
export function buildHeldSideInstructionTableRows(
  chart: NeckShoulderShapingChart,
  rcStart = 0,
  options?: ActiveShoulderChecklistOptions,
): ActiveSideInstructionTableRow[] {
  return buildSideInstructionTableRows(chart, rcStart, options, "left");
}

function isPlainKnitActiveSideRow(row: ActiveSideInstructionTableRow): boolean {
  return row.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL;
}

/**
 * Armhole-local RC of the first neckline shaping action in the generated active-shoulder
 * checklist (same rows as the print/online shaping table).
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

/**
 * Armhole-local RC of the center neckline divide/setup row exactly as rendered in the
 * active-shoulder shaping chart (the round-neck "Scrap off center … to divide" row).
 * Returns `undefined` when the chart has no center neckline setup row (e.g. V-neck or
 * cardigan front). Single source of truth shared by the chart and the generated prose so
 * the instructional RC can never drift from the chart's divide row.
 */
export function armholeLocalRcCenterNecklineSetupRow(
  chart: NeckShoulderShapingChart,
  firstArmholeGarmentRc: number | null | undefined,
  options?: ActiveShoulderChecklistOptions,
): number | undefined {
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, firstArmholeGarmentRc, options);
  const rows = buildActiveSideInstructionTableRows(chart, rcStart, options);
  const setup = rows.find(isCenterNecklineSetupChecklistRow);
  return setup?.rc;
}

function oppositeCarriagePosition(position: "Right" | "Left"): "Right" | "Left" {
  return position === "Right" ? "Left" : "Right";
}

function carriagePositionForSecondShoulderRc(rc: number): "Right" | "Left" {
  return oppositeCarriagePosition(carriagePositionForActiveSideRc(rc));
}

/**
 * Second-shoulder replacement for the center neckline divide/setup action.
 * The divide already happened on the first shoulder — remind the knitter to resume the held
 * side using the same active-shoulder stitch count ({@link ActiveSideInstructionTableRow.stitchesRemaining}).
 */
export function formatSecondShoulderCenterSetupChecklistAction(
  activeShoulderStitches: number,
): string {
  return `Return to the held shoulder with ${needlesInWorkPhrase(activeShoulderStitches)}.`;
}

/**
 * Mirror the first-shoulder checklist for the held side: invert carriage parity from RC, and
 * rewrite any center neckline divide/setup row so the scrap-off/hold divide is not repeated
 * (presentation only — RC, edge, and stitch counts are unchanged).
 */
export function buildSecondShoulderInstructionTableRows(
  rows: readonly ActiveSideInstructionTableRow[],
): ActiveSideInstructionTableRow[] {
  return rows.map((r) => {
    const mirrored: ActiveSideInstructionTableRow = {
      ...r,
      carriagePosition: carriagePositionForSecondShoulderRc(r.rc),
    };
    if (isCenterNecklineSetupChecklistRow(r)) {
      mirrored.action = formatSecondShoulderCenterSetupChecklistAction(r.stitchesRemaining);
    }
    return mirrored;
  });
}
