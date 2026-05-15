/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type {
  NeckShoulderShapingChart,
  NeckShoulderShapingChartDisplayRow,
  NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  chartDisplayRowsOnePerRc,
  collapsePlainKnitChartRowsForDisplay,
  getNeckShoulderChartRowHighlightFromRow,
  isFullWidthVNeckFrontStyleChart,
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  plainKnitSpanCarriageEdgeDisplay,
} from "./neckShoulderShapingChart";
import { renderShoulderShapingSvg, type ShoulderShapingSvgPiece } from "./shoulderShapingSvg";
import { renderNotationOverlayDiagram, type NotationOverlayDiagramOptions } from "./notationOverlaySvg";
import { getSleevelessShoulderNotationIconSrc, isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import {
  ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ACTIVE_SHOULDER_DIVIDE_SENTENCE,
  formatActiveShoulderCenterNecklinePlainSentence,
} from "./neckShoulderActiveIntroCopy";
import { formatShoulderBindoffRemainingInstruction } from "./sleevelessPatternOutput";

function sleevelessNotationOverlayOpts(
  piece: ShoulderShapingSvgPiece | undefined,
  patternData: Record<string, unknown> | undefined,
): NotationOverlayDiagramOptions | undefined {
  if (piece !== "front" && piece !== "back") return undefined;
  const outlineImageSrc = getSleevelessShoulderNotationIconSrc(piece, patternData);
  if (piece === "front" && patternData && isSleevelessVNeckChoice(patternData)) {
    return { outlineImageSrc, innerNeckNotationFromTimeline: true };
  }
  return { outlineImageSrc };
}

export {
  ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ACTIVE_SHOULDER_DIVIDE_SENTENCE,
} from "./neckShoulderActiveIntroCopy";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function chartProgressRcAttrFromActiveRow(r: ActiveSideInstructionTableRow): string {
  const start = Math.max(0, Math.floor(Number(r.rc)));
  const endRaw = r.rcEnd !== undefined ? Math.max(0, Math.floor(Number(r.rcEnd))) : start;
  return endRaw !== start ? `${start}-${endRaw}` : String(start);
}

function chartProgressRcAttrFromGarmentRow(r: NeckShoulderShapingChartRow): string {
  const lo = Math.max(0, Math.floor(Number(r.row)));
  const hi =
    r.chartRowSpanLast !== undefined && Number.isFinite(r.chartRowSpanLast)
      ? Math.max(0, Math.floor(Number(r.chartRowSpanLast)))
      : lo;
  return hi !== lo ? `${lo}-${hi}` : String(lo);
}

/** Stable checklist row identity for persistence (paired with [`data-chart-id`](/)). */
function buildActiveSideStableRowId(chartProgressId: string, r: ActiveSideInstructionTableRow): string {
  const start = Math.max(0, Math.floor(Number(r.rc)));
  const endRaw =
    r.rcEnd !== undefined && Number.isFinite(Number(r.rcEnd))
      ? Math.max(0, Math.floor(Number(r.rcEnd)))
      : start;
  return `${chartProgressId}|arc|${start}|${endRaw}|${Number(r.stitchesRemaining)}|${
    r.carriagePosition
  }|${r.action}|${r.edge}`;
}

function buildFullChartStableRowId(
  chartProgressId: string,
  displayRow: NeckShoulderShapingChartDisplayRow,
): string {
  const r = displayRow.sourceRow;
  const lo = Math.max(0, Math.floor(Number(r.row)));
  const hi =
    r.chartRowSpanLast !== undefined && Number.isFinite(r.chartRowSpanLast)
      ? Math.max(0, Math.floor(Number(r.chartRowSpanLast)))
      : lo;
  const center = String(r.centerNeck ?? "").trim();
  return `${chartProgressId}|full|${lo}|${hi}|${displayRow.rowLabel}|${displayRow.actionLabel}|${center}|${
    r.leftStitchCount
  }|${r.rightStitchCount}`;
}

function renderNsChartProgressToolbarHtml(): string {
  return `<div class="ns-shaping-chart__progress-toolbar no-print" role="toolbar" aria-label="Chart checklist tracking">
    <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-toggle-hide" data-chart-progress-toggle-hide aria-pressed="false">Hide completed rows</button>
    <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-reset" data-chart-progress-reset>Reset checklist</button>
  </div>`;
}

function rowClassFromHighlight(hi: ReturnType<typeof getNeckShoulderChartRowHighlightFromRow>): string {
  if (hi === "neckBothSides") return "ns-shaping-chart__tr ns-shaping-chart__tr--neck-both";
  if (hi === "shoulderAndNeck") return "ns-shaping-chart__tr ns-shaping-chart__tr--shoulder-neck";
  if (hi === "shoulderBothSides") return "ns-shaping-chart__tr ns-shaping-chart__tr--shoulder-both";
  return "ns-shaping-chart__tr";
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
  firstArmholeGarmentRc: number | null | undefined
): number {
  const fhRaw = Number(firstArmholeGarmentRc);
  if (!Number.isFinite(fhRaw)) return 0;
  const fh = Math.max(0, Math.floor(fhRaw));

  if (chart.timeline && chart.timeline.length > 0) {
    const sorted = [...chart.timeline].sort((a, b) => a.row - b.row);
    const center = sorted[0];
    if (!center) return 0;
    const second = sorted[1];
    const startGarment = second !== undefined ? second.row : center.row + 1;
    return Math.max(0, Math.floor(startGarment) - fh);
  }

  const rows = [...chart.rows].sort((a, b) => a.row - b.row);
  const first = rows[0];
  if (!first) return 0;
  const centerBo = parseDecreaseCell(String(first.centerNeck ?? "")) > 0;
  const sourceBaseRow = centerBo ? first.row + 1 : first.row;
  return Math.max(0, Math.floor(sourceBaseRow) - fh);
}

function sideColumnLabelFromAction(actionLabel: string): "Armhole" | "Shoulder" {
  return /shoulder/i.test(String(actionLabel ?? "")) ? "Shoulder" : "Armhole";
}

function buildLeftShapingText(r: NeckShoulderShapingChart["rows"][number], actionLabel: string): string {
  const sideValue = parseDecreaseCell(r.leftSide);
  const neckValue = parseDecreaseCell(r.leftNeck);
  const sideLabel = sideColumnLabelFromAction(actionLabel) === "Shoulder" ? "Shoulder" : "Armhole";
  const parts: string[] = [];
  if (sideValue > 0) parts.push(`${sideLabel} -${sideValue}`);
  if (neckValue > 0) parts.push(`Neck -${neckValue}`);
  return parts.join(", ") || "—";
}

function buildRightShapingText(r: NeckShoulderShapingChart["rows"][number], actionLabel: string): string {
  const sideValue = parseDecreaseCell(r.rightSide);
  const neckValue = parseDecreaseCell(r.rightNeck);
  const sideLabel = sideColumnLabelFromAction(actionLabel) === "Shoulder" ? "Shoulder" : "Armhole";
  const parts: string[] = [];
  if (neckValue > 0) parts.push(`Neck -${neckValue}`);
  if (sideValue > 0) parts.push(`${sideLabel} -${sideValue}`);
  return parts.join(", ") || "—";
}

function centerBindOffCompact(centerCell: string): string {
  const value = parseDecreaseCell(centerCell);
  return value > 0 ? `Center BO ${value}` : "";
}

function stitchRemainingCompact(left: number, right: number): string {
  if (left === right) return `${left} each`;
  return `L ${left} / R ${right}`;
}

const SECOND_SIDE_INSTRUCTION_SUFFIX =
  "Repeat the table and shaping diagram logic for the second side, reversing the edge landmarks.";
const SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX = "Follow the second shoulder checklist below.";

export type ActiveShoulderChartIntroLayout = "compact" | "labeled";

export type ActiveShoulderChartIntroOptions = {
  /** Armhole RC at center bind-off (same value as pattern debug `*NecklineStartLocalRC`), e.g. `RC:117`. */
  localStartRcLabel?: string | undefined;
  /** Whole-stitch center bind-off count from chart row 0; omit tail when unknown. */
  centerBindOffStitches?: number | undefined;
  /** Host-specific wrapper class (`print-chart-intro` vs `pattern-shaping-intro`). */
  wrapperClass: string;
  /** Reserved for callers (online vs print); intro wording is the same for both layouts. */
  layout: ActiveShoulderChartIntroLayout;
};

function activeShoulderAnchoredCenterBindOffHtml(
  localStartRcLabel: string | undefined,
  centerBindOffStitches: number | undefined
): string {
  return escapeHtml(
    formatActiveShoulderCenterNecklinePlainSentence({
      localStartRcLabel,
      centerBindOffStitches,
    })
  );
}

/**
 * Shared HTML intro placed above the active-shoulder shaping checklist (online pattern tab + print/PDF).
 */
export function renderActiveShoulderChartIntroHtml(options: ActiveShoulderChartIntroOptions): string {
  const wrappedClass = String(options.wrapperClass ?? "").trim() || "active-shoulder-chart-intro";
  const bindOffHtml = activeShoulderAnchoredCenterBindOffHtml(
    options.localStartRcLabel,
    options.centerBindOffStitches
  );
  const inner = `<p><strong>Center Neckline:</strong><br>${bindOffHtml}</p>
  <p><strong>Divide:</strong><br>${escapeHtml(ACTIVE_SHOULDER_DIVIDE_SENTENCE)}</p>
  <p>${escapeHtml(ACTIVE_SHOULDER_CHART_INTRO_SENTENCE)}</p>`;

  return `<div class="${escapeHtml(wrappedClass)}">
  ${inner}
</div>`;
}

type ActiveSideEdge = "Neck" | "Armhole";

type ActiveSideScheduledAction = {
  sourceRelativeRow: number;
  edge: ActiveSideEdge;
  amount: number;
  kind: "bindOff" | "decrease";
};

type ActiveSideInstructionTableRow = {
  rc: number;
  /** When set (print compaction), RC column shows `rc–rcEnd`. */
  rcEnd?: number;
  carriagePosition: string;
  action: string;
  edge: string;
  stitchesRemaining: number;
};

function oppositeCarriagePosition(position: "Right" | "Left"): "Right" | "Left" {
  return position === "Right" ? "Left" : "Right";
}

function instructionWithHeldStitches(heldShoulderStitches: number, showChecklist: boolean): string {
  const held = Math.max(0, Math.floor(heldShoulderStitches));
  const suffix = showChecklist ? SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX : SECOND_SIDE_INSTRUCTION_SUFFIX;
  return `Once this side is complete, cut yarn and rehang the remaining ${held} stitches. ${suffix}`;
}

/**
 * Final shoulder bind-off paragraph rendered IMMEDIATELY after the one-shoulder checklist table
 * and BEFORE any second-shoulder prompt/toggle/copy. Stitch count is read from the last rendered
 * checklist row (`stitchesRemaining`) so the line stays aligned with the visible final RC and
 * Sts Remaining cell. Returns an empty string when no row is present or no stitches remain.
 */
function renderActiveSideBindoffRemainingHtml(
  rows: readonly { stitchesRemaining: number }[],
  className = "ns-shaping-chart__active-side-bindoff",
): string {
  const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
  const remaining = last ? Math.max(0, Math.floor(Number(last.stitchesRemaining ?? 0))) : 0;
  const sentence = formatShoulderBindoffRemainingInstruction(remaining);
  if (!sentence) return "";
  return `<p class="${escapeHtml(className)}" data-active-side-bindoff>${escapeHtml(sentence)}</p>`;
}

/**
 * Carriage parity rule for the active-shoulder chart (active shoulder is the RIGHT side
 * of the back/front piece in this renderer):
 *
 * - Even RC ⇒ carriage on the Right ⇒ valid ONLY for the right-side edge of the
 *   active shoulder, which is the **Armhole / outer** edge.
 * - Odd RC ⇒ carriage on the Left ⇒ valid ONLY for the left-side edge of the
 *   active shoulder, which is the **Neck / inner** edge.
 *
 * A shaping action may only occur on the edge where the carriage is currently located;
 * actions that need a different edge are pushed forward by inserting plain knit rows
 * until the carriage parity matches the edge.
 */
function carriagePositionForActiveSideRc(rc: number): "Right" | "Left" {
  return rc % 2 === 0 ? "Right" : "Left";
}

function edgeForActiveSideCarriagePosition(position: "Right" | "Left"): ActiveSideEdge {
  return position === "Right" ? "Armhole" : "Neck";
}

function requiredParityForActiveSideEdge(edge: ActiveSideEdge): 0 | 1 {
  return edge === "Armhole" ? 0 : 1;
}

function formatActiveSideRc(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

/**
 * Action verb rules for the active-shoulder checklist `Action` column:
 * - Shoulder shaping bind-offs (Armhole edge, `kind === "bindOff"`) render as
 *   `Bind off / hold` so the knitter remembers to hold the bound-off stitches
 *   on waste yarn / a holder rather than removing them.
 * - Neckline bind-offs (Neck edge) keep the plain `Bind off` verb — only
 *   shoulder-edge bind-offs are held for later seaming/joining.
 * - Decreases (either edge) keep the `Decrease` verb.
 */
function activeSideActionText(action: ActiveSideScheduledAction): string {
  const noun = action.amount === 1 ? "st" : "sts";
  let verb: string;
  if (action.kind === "bindOff") {
    verb = action.edge === "Armhole" ? "Bind off / hold" : "Bind off";
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

function buildActiveSideActionsFromTimeline(timeline: readonly RowEntry[]): {
  initialStitches: number;
  finalSourceRelativeRow: number;
  actions: ActiveSideScheduledAction[];
} | null {
  const sorted = [...timeline].sort((a, b) => a.row - b.row);
  const center = sorted[0];
  if (!center) return null;
  const actions: ActiveSideScheduledAction[] = [];
  let finalSourceRelativeRow = 0;
  for (const entry of sorted.slice(1)) {
    const rel = Math.max(0, Math.floor(entry.row - center.row - 1));
    finalSourceRelativeRow = Math.max(finalSourceRelativeRow, rel);
    for (const event of entry.events) {
      const action = activeSideActionFromTimelineEvent(entry, event, center.row);
      if (action) actions.push(action);
    }
  }
  return {
    initialStitches: Math.max(0, Math.floor(center.stitchesR)),
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
  return { initialStitches, finalSourceRelativeRow, actions };
}

function buildActiveSideInstructionTableRows(
  chart: NeckShoulderShapingChart,
  rcStart = 0
): ActiveSideInstructionTableRow[] {
  const source =
    chart.timeline && chart.timeline.length > 0
      ? buildActiveSideActionsFromTimeline(chart.timeline)
      : chart.rows.length > 0
        ? buildActiveSideActionsFromChartRows(chart.rows)
        : null;
  if (!source) return [];

  const out: ActiveSideInstructionTableRow[] = [];
  /** 0-based checklist slot — aligns with {@link ActiveSideScheduledAction.sourceRelativeRow}. */
  let checklistIdx = 0;
  const rcBase = Math.max(0, Math.floor(rcStart));
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

function buildOppositeShoulderInstructionTableRows(
  rows: readonly ActiveSideInstructionTableRow[]
): ActiveSideInstructionTableRow[] {
  return rows.map((r) => ({
    ...r,
    carriagePosition:
      r.carriagePosition === "Right" || r.carriagePosition === "Left"
        ? oppositeCarriagePosition(r.carriagePosition)
        : r.carriagePosition,
  }));
}

/**
 * Merge consecutive “Knit in pattern” active-shoulder checklist rows when stitch counts stay the same and RCs are consecutive.
 * Used for on-screen pattern (`activeSideOnly`) and print mini-table except sleeveless-style V-neck charts (see {@link isFullWidthVNeckFrontStyleChart}).
 * Uses `plainKnitSpanCarriageEdgeDisplay` for alternating Side / Section labels.
 */
export function compactActiveSideInstructionRowsForPrint(
  rows: readonly ActiveSideInstructionTableRow[],
): ActiveSideInstructionTableRow[] {
  const out: ActiveSideInstructionTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL) {
      out.push(row);
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < rows.length &&
      rows[j + 1]!.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
      rows[j + 1]!.stitchesRemaining === row.stitchesRemaining &&
      rows[j + 1]!.rc === rows[j]!.rc + 1
    ) {
      j += 1;
    }
    const firstRc = row.rc;
    const lastRc = rows[j]!.rc;
    const { carriage, edge } = plainKnitSpanCarriageEdgeDisplay(firstRc, lastRc);
    if (j > i) {
      out.push({
        rc: firstRc,
        rcEnd: lastRc,
        carriagePosition: carriage,
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge,
        stitchesRemaining: row.stitchesRemaining,
      });
    } else {
      out.push({
        ...row,
        carriagePosition: carriage,
        edge,
      });
    }
    i = j + 1;
  }
  return out;
}

function formatActiveSideRcDisplay(r: ActiveSideInstructionTableRow): string {
  if (r.rcEnd !== undefined && r.rcEnd !== r.rc) {
    return `${formatActiveSideRc(r.rc)}\u2013${formatActiveSideRc(r.rcEnd)}`;
  }
  return formatActiveSideRc(r.rc);
}

function renderActiveSideInstructionRowsTrHtml(
  rows: readonly ActiveSideInstructionTableRow[],
  chartProgressId: string,
): string {
  return rows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      const rowId = buildActiveSideStableRowId(chartProgressId, r);
      const rcAttr = chartProgressRcAttrFromActiveRow(r);
      const doneCell = `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row RC ${escapeHtml(
        rcDisp
      )} complete" /></label></td>`;
      return `<tr class="ns-shaping-chart__tr" data-row-id="${escapeHtml(rowId)}" data-rc="${escapeHtml(rcAttr)}">${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-chart__td-num">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
}

function renderFullChartActionCellHtml(displayRow: NeckShoulderShapingChartDisplayRow): string {
  const action = escapeHtml(String(displayRow.actionLabel ?? ""));
  if (!displayRow.plainKnitCarriageLabel || !displayRow.plainKnitEdgeLabel) {
    return action;
  }
  return `${action}<div class="ns-shaping-chart__plain-knit-meta"><span class="ns-shaping-chart__plain-knit-side">${escapeHtml(
    displayRow.plainKnitCarriageLabel,
  )}</span><span class="ns-shaping-chart__plain-knit-meta-sep"> · </span><span class="ns-shaping-chart__plain-knit-section">${escapeHtml(
    displayRow.plainKnitEdgeLabel,
  )}</span></div>`;
}

type NeckShoulderChartRenderOptions = {
  includeDoneColumn?: boolean;
  tableClassName?: string;
  activeSideOnly?: boolean;
  activeSideRcStart?: number;
  /**
   * Full grid chart: plain “Knit in pattern” spans are always condensed when safe (same shared logic as print).
   * When true, row labels use `RC:` prefixes and merged spans show “stitch count unchanged” in stitch columns.
   */
  compactPlainKnitSpansForPrint?: boolean;
  /**
   * When true (e.g. temporary QA), logs to the browser console if active-side plain-knit compaction merged rows.
   */
  debugLogActiveSideCompaction?: boolean;
  /**
   * When false, sleeveless-style V-neck charts keep plain-knit RC span merging (full grid + active checklist).
   * Default: one row per RC for those charts (no en-dash RC labels).
   */
  fullWidthChartOneRowPerRc?: boolean;
};

function chartBodyRowsHtml(
  chart: NeckShoulderShapingChart,
  chartProgressId: string,
  options?: NeckShoulderChartRenderOptions,
): string {
  const activeSideOnly = options?.activeSideOnly === true;
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const includeDoneColumn = activeSideOnly ? true : options?.includeDoneColumn !== false;
  const compactPrint = options?.compactPlainKnitSpansForPrint === true;
  const rowLabelStyle = compactPrint ? "print" : "online";
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  if (activeSideOnly) {
    let activeRows = buildActiveSideInstructionTableRows(chart, activeSideRcStart);
    const activeRowsBeforeCompact = activeRows.length;
    /** Plain-knit merge matches full-chart rules except sleeveless V-neck (one RC per row). */
    if (!vNeckStyleOneRowPerRc) {
      activeRows = compactActiveSideInstructionRowsForPrint(activeRows);
    }
    if (
      import.meta.env.DEV &&
      options?.debugLogActiveSideCompaction === true &&
      activeRowsBeforeCompact > activeRows.length
    ) {
      console.debug("[kbm neck-shoulder] Active-side plain-knit compaction applied", {
        rowsBefore: activeRowsBeforeCompact,
        rowsAfter: activeRows.length,
      });
    }
    return renderActiveSideInstructionRowsTrHtml(activeRows, chartProgressId);
  }
  const displayRows = vNeckStyleOneRowPerRc
    ? chartDisplayRowsOnePerRc(chart.rows, { rowLabelStyle })
    : collapsePlainKnitChartRowsForDisplay(chart.rows, { rowLabelStyle });
  return displayRows
    .map((displayRow) => {
      const r = displayRow.sourceRow;
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const trClass = rowClassFromHighlight(hi);
      const rowNum = Math.max(0, Math.floor(r.row));
      const rowStableId = buildFullChartStableRowId(chartProgressId, displayRow);
      const rcAttr = chartProgressRcAttrFromGarmentRow(r);
      const doneCell = includeDoneColumn
        ? `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row ${rowNum} complete" /></label></td>`
        : "";
      const mergedPlainSpan =
        compactPrint &&
        displayRow.actionLabel === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
        displayRow.rowLabel.includes("\u2013");
      const stitchLeft = mergedPlainSpan ? "stitch count unchanged" : String(r.leftStitchCount);
      const stitchRight = mergedPlainSpan ? "stitch count unchanged" : String(r.rightStitchCount);
      const dataAttrs = ` data-row-id="${escapeHtml(rowStableId)}" data-rc="${escapeHtml(rcAttr)}"`;
      return `<tr class="${trClass}"${dataAttrs}>${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(displayRow.rowLabel)}</td><td>${renderFullChartActionCellHtml(
        displayRow,
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.leftSide)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.leftNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.centerNeck)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.rightNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.rightSide)}</td><td class="ns-shaping-chart__td-num">${escapeHtml(
        stitchLeft
      )}</td><td class="ns-shaping-chart__td-num">${escapeHtml(stitchRight)}</td></tr>`;
    })
    .join("");
}

/** Chart title and table only — pairs with {@link renderNeckShoulderShapingPreviewOnlyHtml}. */
export function renderNeckShoulderShapingChartTableOnlyHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart",
  introHtml?: string,
  options?: NeckShoulderChartRenderOptions
): string {
  const headingId = `${idPrefix}-heading`;
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const includeDoneColumnOption = options?.includeDoneColumn !== false;
  const activeSideOnly = options?.activeSideOnly === true;
  const progressChartIdPrimary = activeSideOnly ? `${idPrefix}-primary` : idPrefix;
  const progressChartIdSecondary = `${idPrefix}-secondary`;
  const rowsHtml = chartBodyRowsHtml(chart, progressChartIdPrimary, options);

  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  const activeRowsRaw = activeSideOnly ? buildActiveSideInstructionTableRows(chart, activeSideRcStart) : [];
  const oppositeRowsPrep = buildOppositeShoulderInstructionTableRows(activeRowsRaw);
  const oppositeRowsHtml = activeSideOnly
    ? renderActiveSideInstructionRowsTrHtml(
        vNeckStyleOneRowPerRc ? oppositeRowsPrep : compactActiveSideInstructionRowsForPrint(oppositeRowsPrep),
        progressChartIdSecondary,
      )
    : "";
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const showDoneColumn = activeSideOnly ? true : includeDoneColumnOption;
  const tableClassName = String(options?.tableClassName ?? "").trim();
  const sectionClass = tableClassName ? `ns-shaping-chart ${tableClassName}` : "ns-shaping-chart";
  const doneHeaderFullGrid = `<th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>`;
  const doneHeaderActiveSide = `<th scope="col" rowspan="1" class="ns-shaping-chart__th-complete" aria-label="Completion status">Done</th>`;
  const doneLeadingCell = activeSideOnly
    ? showDoneColumn
      ? doneHeaderActiveSide
      : ""
    : showDoneColumn
      ? doneHeaderFullGrid
      : "";

  const progressToolbarHtml = renderNsChartProgressToolbarHtml();

  return `<section class="${escapeHtml(sectionClass)}" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  ${intro}
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdPrimary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneLeadingCell}
          ${
            activeSideOnly
              ? `<th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Carriage Position</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Sts Remaining</th>`
              : `<th scope="col" rowspan="2" class="ns-shaping-chart__th-row">Row</th>
          <th scope="col" rowspan="2" class="ns-shaping-chart__th-action">Action</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Left</th>
          <th scope="colgroup" colspan="1" class="ns-shaping-chart__th-group">Center</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Right</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Stitch count</th>`
          }
        </tr>
        ${
          activeSideOnly
            ? ""
            : `<tr>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck center</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Left</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Right</th>
        </tr>`
        }
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
  </div>
  ${activeSideOnly ? renderActiveSideBindoffRemainingHtml(activeRowsRaw) : ""}
  ${
    activeSideOnly
      ? `<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--collapsed" data-second-shoulder-default-instruction>${escapeHtml(
          instructionWithHeldStitches(heldShoulderStitches, false)
        )}</p>
<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--expanded" data-second-shoulder-checked-instruction hidden>${escapeHtml(
          instructionWithHeldStitches(heldShoulderStitches, true)
        )}</p>
<div class="ns-shaping-chart__second-shoulder-toggle no-print">
  <p class="ns-shaping-chart__second-shoulder-toggle-copy">Want less mental reversing? Show a second checklist for the opposite shoulder.</p>
  <label class="ns-shaping-chart__second-shoulder-label">
    <input type="checkbox" class="ns-shaping-chart__second-shoulder-input" data-second-shoulder-toggle />
    Show second shoulder checklist
  </label>
</div>
<div class="ns-shaping-chart__second-shoulder-block" data-second-shoulder-content hidden>
  <h3 class="ns-shaping-chart__preview-title">Second Shoulder Checklist</h3>
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdSecondary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneHeaderActiveSide}
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Carriage Position</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${oppositeRowsHtml}</tbody>
    </table>
    </div>
  </div>
</div>`
      : ""
  }
</section>`;
}

/**
 * Print-only compact written shaping rows for ink-efficient printouts.
 * Pass `options.activeSideRcStart` as the Armhole RC at the first checklist row (continuous with
 * the armhole counter after the sole armhole RC reset). Defaults to 0 when unknown.
 */
export function renderNeckShoulderShapingPrintInstructionTableHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart-print",
  introHtml?: string,
  options?: {
    showSecondShoulderChecklist?: boolean;
    activeSideRcStart?: number;
    piece?: ShoulderShapingSvgPiece;
    patternData?: Record<string, unknown>;
    fullWidthChartOneRowPerRc?: boolean;
  },
): string {
  const headingId = `${idPrefix}-heading`;
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const printRowsRaw = buildActiveSideInstructionTableRows(chart, activeSideRcStart);
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  const printRows = vNeckStyleOneRowPerRc
    ? printRowsRaw
    : compactActiveSideInstructionRowsForPrint(printRowsRaw);
  const showSecondShoulderChecklist = options?.showSecondShoulderChecklist === true;
  const oppositePrintRowsRaw = buildOppositeShoulderInstructionTableRows(printRowsRaw);
  const oppositePrintRows = vNeckStyleOneRowPerRc
    ? oppositePrintRowsRaw
    : compactActiveSideInstructionRowsForPrint(oppositePrintRowsRaw);
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const rowsHtml = printRows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
  const oppositeRowsHtml = oppositePrintRows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
  /**
   * Diagram block: heading + bordered wrapper around the notation/SVG so the print
   * shaping section reads as "table → diagram" instead of leaving the SVG as a loose
   * floating image. Same wording as the online {@link renderNeckShoulderShapingDiagramOnlyHtml}
   * heading. Both back and front charts go through this function, so wrapping here
   * gives the front piece the same labeled diagram block as the back.
   */
  const printDiagramNotationHelpHtml = `<div class="ns-shaping-mini__diagram-notation-help">
  <div><strong>Shaping notation:</strong> stitches, rows, times</div>
  <div><em>Example:</em> 1s-2r-3x = decrease 1 stitch every 2 rows, 3 times</div>
</div>`;
  const notationOutlineOpts = sleevelessNotationOverlayOpts(options?.piece, options?.patternData);
  /* Notation sits inside the diagram border, directly above the SVG — matches knitter scan pattern (title → helper → art). */
  const geometrySvgHtml = `<h3 class="ns-shaping-mini__diagram-title">Neckline / Shoulder Diagram</h3>
<div class="ns-shaping-mini__diagram-block">
  ${printDiagramNotationHelpHtml}
  <div class="ns-shaping-mini__svg-wrap">${renderNotationOverlayDiagram(chart, "right", notationOutlineOpts)}</div>
</div>`;
  const oppositeGeometrySvgHtml = `<h3 class="ns-shaping-mini__diagram-title">Neckline / Shoulder Diagram</h3>
<div class="ns-shaping-mini__diagram-block">
  ${printDiagramNotationHelpHtml}
  <div class="ns-shaping-mini__svg-wrap">${renderNotationOverlayDiagram(chart, "left", notationOutlineOpts)}</div>
</div>`;

  return `<section class="ns-shaping-mini" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-mini__title">Neckline / Shoulder Shaping</h2>
  ${intro}
  <div class="ns-shaping-mini__wrap">
    <table class="ns-shaping-mini__table">
      <thead>
        <tr>
          <th scope="col">RC</th>
          <th scope="col">Carriage Position</th>
          <th scope="col">Action</th>
          <th scope="col">Edge</th>
          <th scope="col">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  ${renderActiveSideBindoffRemainingHtml(printRowsRaw, "ns-shaping-mini__bindoff-remaining")}
  <p class="ns-shaping-mini__sts-note">Sts Remaining is for this side only.</p>
  ${geometrySvgHtml}
  <p class="ns-shaping-mini__sts-note">${escapeHtml(instructionWithHeldStitches(heldShoulderStitches, false))}</p>
  ${
    showSecondShoulderChecklist
      ? `<section class="ns-shaping-mini__second-shoulder">
    <h3 class="ns-shaping-mini__title">Second Shoulder Checklist</h3>
    <div class="ns-shaping-mini__wrap">
      <table class="ns-shaping-mini__table">
        <thead>
          <tr>
            <th scope="col">RC</th>
            <th scope="col">Carriage Position</th>
            <th scope="col">Action</th>
            <th scope="col">Edge</th>
            <th scope="col">Sts Remaining</th>
          </tr>
        </thead>
        <tbody>${oppositeRowsHtml}</tbody>
      </table>
    </div>
    ${oppositeGeometrySvgHtml}
    <p class="ns-shaping-mini__sts-note">${escapeHtml(instructionWithHeldStitches(heldShoulderStitches, true))}</p>
  </section>`
      : ""
  }
</section>`;
}

/** Shape preview block only — render below the two-column piece layout on the pattern tab. */
export function renderNeckShoulderShapingPreviewOnlyHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart",
  piece?: ShoulderShapingSvgPiece
): string {
  const previewHeadingId = `${idPrefix}-preview-heading`;
  const shoulderPreviewSvg = renderShoulderShapingSvg(chart, "right", piece ? { piece } : undefined);

  return `<div class="ns-shaping-chart ns-shaping-chart--preview-block" aria-labelledby="${escapeHtml(previewHeadingId)}">
  <div class="ns-shaping-chart__preview">
    <h3 id="${escapeHtml(previewHeadingId)}" class="ns-shaping-chart__preview-title">Neckline / Shoulder Shape Preview</h3>
    <div class="ns-shaping-chart__preview-svg-wrap">${shoulderPreviewSvg}</div>
  </div>
</div>`;
}

/**
 * Online SVG diagram block for neckline / shoulder shaping.
 * Uses the same timeline geometry renderer as the print chart when live timeline data is available.
 */
export function renderNeckShoulderShapingDiagramOnlyHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart",
  piece?: ShoulderShapingSvgPiece,
  patternData?: Record<string, unknown>,
): string {
  const notationOutlineOpts = sleevelessNotationOverlayOpts(piece, patternData);
  const diagramHeadingId = `${idPrefix}-diagram-heading`;
  const svgHtml = renderNotationOverlayDiagram(chart, "right", notationOutlineOpts);
  const secondSvgHtml = renderNotationOverlayDiagram(chart, "left", notationOutlineOpts);

  const notationHintHtml = `<div class="ns-shaping-chart__diagram-notation-hint">
  <p class="ns-shaping-chart__diagram-notation-hint-main"><span class="glossary-tooltip-placeholder" data-glossary-id="354">Shaping notation</span>: <span class="ns-shaping-chart__diagram-notation-hint-kernel"><span class="ns-shaping-chart__diagram-notation-order">stitches</span>, <span class="ns-shaping-chart__diagram-notation-order">rows</span>, <span class="ns-shaping-chart__diagram-notation-order">times</span></span></p>
  <p class="ns-shaping-chart__diagram-notation-hint-example">${escapeHtml("Example: 1s-2r-3x = decrease 1 stitch every 2 rows, 3 times")}</p>
</div>`;

  return `<div class="ns-shaping-chart ns-shaping-chart--diagram-block" aria-labelledby="${escapeHtml(diagramHeadingId)}">
  <div class="ns-shaping-chart__diagram">
    <h3 id="${escapeHtml(diagramHeadingId)}" class="ns-shaping-chart__preview-title">Neckline / Shoulder Diagram</h3>
    ${notationHintHtml}
    <div class="ns-shaping-chart__diagram-svg-wrap">${svgHtml}</div>
    <div class="ns-shaping-chart__second-shoulder-block" data-second-shoulder-content hidden>
      <h3 class="ns-shaping-chart__preview-title">Second Shoulder Diagram</h3>
      <div class="ns-shaping-chart__diagram-svg-wrap">${secondSvgHtml}</div>
    </div>
  </div>
</div>`;
}

/**
 * Full chart section markup (table + SVG preview) for client-side injection or legacy single-column hosts.
 */
export function renderNeckShoulderShapingChartSectionHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart",
  piece?: ShoulderShapingSvgPiece
): string {
  return (
    renderNeckShoulderShapingChartTableOnlyHtml(chart, idPrefix) +
    renderNeckShoulderShapingPreviewOnlyHtml(chart, idPrefix, piece)
  );
}
