/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import { collapsePlainChartRows, getNeckShoulderChartRowHighlightFromRow } from "./neckShoulderShapingChart";
import { renderShoulderShapingSvg, type ShoulderShapingSvgPiece } from "./shoulderShapingSvg";
import { renderNotationOverlayDiagram } from "./notationOverlaySvg";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import { formatShoulderBindoffRemainingInstruction } from "./sleevelessPatternOutput";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

const PRINT_KNIT_EVEN_LABEL = "Knit in pattern";
const SECOND_SIDE_INSTRUCTION_SUFFIX =
  "Repeat the table and shaping diagram logic for the second side, reversing the edge landmarks.";
const SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX = "Follow the second shoulder checklist below.";

function isPrintNoActionCell(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (t === "-" || t === "—" || t === "–") return true;
  return false;
}

function rcFloor(r: NeckShoulderShapingChart["rows"][number]): number {
  return Math.max(0, Math.floor(r.row));
}

function isExcludedFromPrintKnitEvenCompression(r: NeckShoulderShapingChart["rows"][number]): boolean {
  const action = String(r.action ?? "").trim();
  if (/neck/i.test(action)) return true;
  if (/shoulder/i.test(action)) return true;
  if (centerBindOffCompact(r.centerNeck)) return true;
  return false;
}

function isPrintRowCompressibleKnitEven(r: NeckShoulderShapingChart["rows"][number]): boolean {
  if (isExcludedFromPrintKnitEvenCompression(r)) return false;
  const actionLabel = String(r.action ?? "").trim() || "—";
  const left = buildLeftShapingText(r, actionLabel);
  const right = buildRightShapingText(r, actionLabel);
  return isPrintNoActionCell(left) && isPrintNoActionCell(right);
}

function stitchCountsMatch(
  a: NeckShoulderShapingChart["rows"][number],
  b: NeckShoulderShapingChart["rows"][number],
): boolean {
  return a.leftStitchCount === b.leftStitchCount && a.rightStitchCount === b.rightStitchCount;
}

function consecutiveRc(
  prev: NeckShoulderShapingChart["rows"][number],
  next: NeckShoulderShapingChart["rows"][number],
): boolean {
  return rcFloor(next) === rcFloor(prev) + 1;
}

type PrintInstructionTableRow = {
  rcLabel: string;
  sourceRow: NeckShoulderShapingChart["rows"][number];
  leftCell: string;
  rightCell: string;
  stitchCell: string;
};

type ActiveSideEdge = "Neck" | "Armhole";

type ActiveSideScheduledAction = {
  sourceRelativeRow: number;
  edge: ActiveSideEdge;
  amount: number;
  kind: "bindOff" | "decrease";
};

type ActiveSideInstructionTableRow = {
  rc: number;
  carriagePosition: "Right" | "Left";
  action: string;
  edge: ActiveSideEdge;
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

function carriagePositionForActiveSideRc(rc: number): "Right" | "Left" {
  return rc % 2 === 0 ? "Right" : "Left";
}

function edgeForActiveSideCarriagePosition(position: "Right" | "Left"): ActiveSideEdge {
  return position === "Right" ? "Neck" : "Armhole";
}

function requiredParityForActiveSideEdge(edge: ActiveSideEdge): 0 | 1 {
  return edge === "Neck" ? 0 : 1;
}

function formatActiveSideRc(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

function activeSideActionText(action: ActiveSideScheduledAction): string {
  const noun = action.amount === 1 ? "st" : "sts";
  const verb = action.kind === "bindOff" ? "Bind off" : "Decrease";
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
    action: "Knit in pattern",
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
  let rc = Math.max(0, Math.floor(rcStart));
  let stitchesRemaining = source.initialStitches;
  const actions = [...source.actions].sort((a, b) => {
    const dr = a.sourceRelativeRow - b.sourceRelativeRow;
    if (dr !== 0) return dr;
    if (a.edge === b.edge) return 0;
    return a.edge === "Neck" ? -1 : 1;
  });

  for (const action of actions) {
    while (rc < action.sourceRelativeRow) {
      addActiveSideKnitEvenRow(out, rc, stitchesRemaining);
      rc += 1;
    }
    while (rc % 2 !== requiredParityForActiveSideEdge(action.edge)) {
      addActiveSideKnitEvenRow(out, rc, stitchesRemaining);
      rc += 1;
    }
    const carriagePosition = carriagePositionForActiveSideRc(rc);
    stitchesRemaining = Math.max(0, stitchesRemaining - action.amount);
    out.push({
      rc,
      carriagePosition,
      action: activeSideActionText(action),
      edge: action.edge,
      stitchesRemaining,
    });
    rc += 1;
  }

  while (rc <= source.finalSourceRelativeRow) {
    addActiveSideKnitEvenRow(out, rc, stitchesRemaining);
    rc += 1;
  }

  return out;
}

function buildOppositeShoulderInstructionTableRows(
  rows: readonly ActiveSideInstructionTableRow[]
): ActiveSideInstructionTableRow[] {
  return rows.map((r) => ({
    ...r,
    carriagePosition: oppositeCarriagePosition(r.carriagePosition),
  }));
}

function buildOnePrintInstructionTableRow(r: NeckShoulderShapingChart["rows"][number]): PrintInstructionTableRow {
  const rowLabel = String(rcFloor(r));
  const actionLabel = String(r.action ?? "").trim() || "—";
  const leftText = buildLeftShapingText(r, actionLabel);
  const rightText = buildRightShapingText(r, actionLabel);
  const centerBo = centerBindOffCompact(r.centerNeck);
  let leftCell = leftText;
  if (centerBo) {
    leftCell = leftCell === "—" ? centerBo : `${centerBo}, ${leftCell}`;
  }
  return {
    rcLabel: rowLabel,
    sourceRow: r,
    leftCell,
    rightCell: rightText,
    stitchCell: stitchRemainingCompact(r.leftStitchCount, r.rightStitchCount),
  };
}

/** Preprocess chart rows for PDF/print: merge sequential knit-even rows (print table only). */
function buildPrintInstructionTableRows(rows: readonly NeckShoulderShapingChartRow[]): PrintInstructionTableRow[] {
  const out: PrintInstructionTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (!isPrintRowCompressibleKnitEven(row)) {
      out.push(buildOnePrintInstructionTableRow(row));
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < rows.length &&
      isPrintRowCompressibleKnitEven(rows[j + 1]!) &&
      stitchCountsMatch(row, rows[j + 1]!) &&
      consecutiveRc(rows[j]!, rows[j + 1]!)
    ) {
      j += 1;
    }
    if (j > i) {
      out.push({
        rcLabel: `${rcFloor(row)}-${rcFloor(rows[j]!)}`,
        sourceRow: row,
        leftCell: PRINT_KNIT_EVEN_LABEL,
        rightCell: "—",
        stitchCell: stitchRemainingCompact(row.leftStitchCount, row.rightStitchCount),
      });
      i = j + 1;
    } else {
      out.push(buildOnePrintInstructionTableRow(row));
      i += 1;
    }
  }
  return out;
}

type NeckShoulderChartRenderOptions = {
  includeDoneColumn?: boolean;
  tableClassName?: string;
  activeSideOnly?: boolean;
  activeSideRcStart?: number;
};

function chartBodyRowsHtml(chart: NeckShoulderShapingChart, options?: NeckShoulderChartRenderOptions): string {
  const activeSideOnly = options?.activeSideOnly === true;
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const includeDoneColumn = activeSideOnly ? false : options?.includeDoneColumn !== false;
  if (activeSideOnly) {
    return buildActiveSideInstructionTableRows(chart, activeSideRcStart)
      .map((r) => {
        return `<tr class="ns-shaping-chart__tr"><td class="ns-shaping-chart__td-num">${escapeHtml(
          formatActiveSideRc(r.rc)
        )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
          r.edge
        )}</td><td class="ns-shaping-chart__td-num">${r.stitchesRemaining}</td></tr>`;
      })
      .join("");
  }
  return collapsePlainChartRows(chart.rows)
    .map((displayRow) => {
      const r = displayRow.sourceRow;
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const trClass = rowClassFromHighlight(hi);
      const rowNum = Math.max(0, Math.floor(r.row));
      const doneCell = includeDoneColumn
        ? `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row ${rowNum} complete" /></label></td>`
        : "";
      return `<tr class="${trClass}">${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(displayRow.rowLabel)}</td><td>${escapeHtml(
        String(displayRow.actionLabel)
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.leftSide)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.leftNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.centerNeck)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.rightNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.rightSide)}</td><td class="ns-shaping-chart__td-num">${
        r.leftStitchCount
      }</td><td class="ns-shaping-chart__td-num">${r.rightStitchCount}</td></tr>`;
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
  const rowsHtml = chartBodyRowsHtml(chart, options);
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const includeDoneColumn = options?.includeDoneColumn !== false;
  const activeSideOnly = options?.activeSideOnly === true;
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const activeRows = activeSideOnly ? buildActiveSideInstructionTableRows(chart, activeSideRcStart) : [];
  const oppositeRows = activeSideOnly ? buildOppositeShoulderInstructionTableRows(activeRows) : [];
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const showDoneColumn = activeSideOnly ? false : includeDoneColumn;
  const tableClassName = String(options?.tableClassName ?? "").trim();
  const sectionClass = tableClassName ? `ns-shaping-chart ${tableClassName}` : "ns-shaping-chart";
  const doneHeader = showDoneColumn
    ? `<th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>`
    : "";

  const activeRowsHtml = activeRows
    .map((r) => {
      return `<tr class="ns-shaping-chart__tr"><td class="ns-shaping-chart__td-num">${escapeHtml(
        formatActiveSideRc(r.rc)
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-chart__td-num">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
  const oppositeRowsHtml = oppositeRows
    .map((r) => {
      return `<tr class="ns-shaping-chart__tr"><td class="ns-shaping-chart__td-num">${escapeHtml(
        formatActiveSideRc(r.rc)
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-chart__td-num">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");

  return `<section class="${escapeHtml(sectionClass)}" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  ${intro}
  <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneHeader}
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
      <tbody>${activeSideOnly ? activeRowsHtml : rowsHtml}</tbody>
    </table>
  </div>
  ${activeSideOnly ? renderActiveSideBindoffRemainingHtml(activeRows) : ""}
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
  <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
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
</div>`
      : ""
  }
</section>`;
}

/** Print-only compact written shaping rows for ink-efficient printouts. */
export function renderNeckShoulderShapingPrintInstructionTableHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart-print",
  introHtml?: string,
  options?: { showSecondShoulderChecklist?: boolean; activeSideRcStart?: number }
): string {
  const headingId = `${idPrefix}-heading`;
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const printRows = buildActiveSideInstructionTableRows(chart, activeSideRcStart);
  const showSecondShoulderChecklist = options?.showSecondShoulderChecklist === true;
  const oppositePrintRows = buildOppositeShoulderInstructionTableRows(printRows);
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const rowsHtml = printRows
    .map((r) => {
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        formatActiveSideRc(r.rc)
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
  const oppositeRowsHtml = oppositePrintRows
    .map((r) => {
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        formatActiveSideRc(r.rc)
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
  const geometrySvgHtml = `<h3 class="ns-shaping-mini__diagram-title">Neckline / Shoulder Diagram</h3>
<div class="ns-shaping-mini__diagram-block">
  <div class="ns-shaping-mini__svg-wrap">${renderNotationOverlayDiagram(chart, "right")}</div>
</div>`;
  const oppositeGeometrySvgHtml = `<h3 class="ns-shaping-mini__diagram-title">Neckline / Shoulder Diagram</h3>
<div class="ns-shaping-mini__diagram-block">
  <div class="ns-shaping-mini__svg-wrap">${renderNotationOverlayDiagram(chart, "left")}</div>
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
  ${renderActiveSideBindoffRemainingHtml(printRows, "ns-shaping-mini__bindoff-remaining")}
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
  piece?: ShoulderShapingSvgPiece
): string {
  void piece;
  const diagramHeadingId = `${idPrefix}-diagram-heading`;
  const svgHtml = renderNotationOverlayDiagram(chart, "right");
  const secondSvgHtml = renderNotationOverlayDiagram(chart, "left");

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
