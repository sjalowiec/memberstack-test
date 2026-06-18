/**
 * Drop-shoulder sleeve row-by-row shaping checklist.
 *
 * Shaping steps from {@link dropShoulderSleeveShapingPlan} — shared with written instructions
 * and {@link buildDropShoulderSleeveJapaneseNotationReplacements}.
 */

import {
  generateDecreaseBreakdown,
  generateIncreaseBreakdown,
} from "../shaping/generateRowByRow";
import { sleeveShapingPerSide, type EvenShapingSchedule } from "./evenShapingSchedule";
import { dropShoulderSleeveShapingPlan } from "./dropShoulderSleeveShaping";

export const DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES = [
  "No sleeve shaping is needed.",
  "Knit straight to length.",
  "Bind off loosely or scrap off.",
] as const;

/** First line of the no-shaping note (for test substring matching). */
export const DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN =
  DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES[0];

export type DropShoulderSleeveShapingChartRow = {
  rc: number;
  action: string;
  edge: string;
  stitchesRemaining: number;
};

export type DropShoulderSleeveShapingChartInput = {
  topSts: number;
  wristSts: number;
  cuffRows: number;
  sleeveBodyRows: number;
  sleeveTotalRows: number;
  direction: "cuff-up" | "top-down";
};

export function dropShoulderSleeveNeedsShapingChart(input: DropShoulderSleeveShapingChartInput): boolean {
  return sleeveShapingPerSide(input.topSts, input.wristSts) > 0;
}

/** Shared schedule for written instructions, JP notation, and this checklist. */
export function dropShoulderSleeveShapingSchedule(
  input: Pick<DropShoulderSleeveShapingChartInput, "topSts" | "wristSts" | "sleeveBodyRows">,
): EvenShapingSchedule {
  return dropShoulderSleeveShapingPlan(input).schedule;
}

/**
 * RC of each shaping pass (increases cuff-up, decreases top-down).
 * Same steps as `jp-sleeve-shaping` / written sleeve body instructions.
 */
export function dropShoulderSleeveShapingRcSequence(
  input: DropShoulderSleeveShapingChartInput,
): number[] {
  const plan = dropShoulderSleeveShapingPlan({
    topSts: input.topSts,
    wristSts: input.wristSts,
    sleeveBodyRows: input.sleeveBodyRows,
  });
  if (plan.noShaping || plan.steps.length === 0) return [];

  const isCuffUp = input.direction === "cuff-up";
  const shapingStartRc = isCuffUp ? input.cuffRows : 0;
  const breakdown = isCuffUp
    ? generateIncreaseBreakdown(input.wristSts, plan.steps, "both")
    : generateDecreaseBreakdown(input.topSts, plan.steps, "both");
  return breakdown.map((entry) => shapingStartRc + entry.rowNumber);
}

export function buildDropShoulderSleeveShapingChartRows(
  input: DropShoulderSleeveShapingChartInput,
): DropShoulderSleeveShapingChartRow[] {
  const { topSts, wristSts, cuffRows, sleeveBodyRows, sleeveTotalRows, direction } = input;
  const plan = dropShoulderSleeveShapingPlan({ topSts, wristSts, sleeveBodyRows });
  if (plan.noShaping || plan.steps.length === 0) return [];

  const isCuffUp = direction === "cuff-up";
  const shapingStartRc = isCuffUp ? cuffRows : 0;
  const breakdown = isCuffUp
    ? generateIncreaseBreakdown(wristSts, plan.steps, "both")
    : generateDecreaseBreakdown(topSts, plan.steps, "both");

  const shapingAction = isCuffUp
    ? "Increase 1 stitch at each side"
    : "Decrease 1 stitch at each side";
  const rows: DropShoulderSleeveShapingChartRow[] = breakdown.map((entry) => ({
    rc: shapingStartRc + entry.rowNumber,
    action: shapingAction,
    edge: "Both sides",
    stitchesRemaining: entry.stitchesAfter,
  }));

  rows.push({
    rc: sleeveTotalRows,
    action: "Bind off loosely or scrap off",
    edge: isCuffUp ? "Top edge" : "Cuff edge",
    stitchesRemaining: 0,
  });

  return rows;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRcCell(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

function buildStableRowId(chartId: string, row: DropShoulderSleeveShapingChartRow): string {
  return `${chartId}|sleeve|${Math.max(0, Math.floor(row.rc))}|${row.action}|${row.edge}|${row.stitchesRemaining}`;
}

function renderProgressToolbarHtml(): string {
  return `<div class="ns-shaping-chart__progress-toolbar no-print">
    <div class="ns-shaping-chart__progress-toolbar-main" role="toolbar" aria-label="Sleeve shaping checklist tracking">
      <button type="button" role="switch" aria-checked="true" class="pattern-tips-switch ns-shaping-chart__progress-show-completed" data-chart-progress-show-completed>
        <span class="pattern-tips-switch__label">Show Completed Rows</span>
        <span class="pattern-tips-switch__track" aria-hidden="true"><span class="pattern-tips-switch__thumb"></span></span>
        <span class="pattern-tips-switch__state" data-chart-progress-show-state>Rows visible</span>
      </button>
      <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-reset" data-chart-progress-reset>Reset Checklist</button>
    </div>
  </div>`;
}

export type DropShoulderSleeveShapingChartRenderOptions = {
  chartId: string;
  /** When false, rely on an outer section heading (e.g. SLEEVE SHAPING CHART). */
  showTitle?: boolean;
};

/**
 * Interactive sleeve shaping checklist — same `ns-shaping-chart` hooks as neckline/shoulder charts.
 */
export function renderDropShoulderSleeveShapingChartHtml(
  rows: readonly DropShoulderSleeveShapingChartRow[],
  options: DropShoulderSleeveShapingChartRenderOptions,
): string {
  if (!rows || rows.length === 0) return "";
  const chartId = String(options.chartId || "drop-shoulder-sleeve-shaping-chart").trim();
  const headingId = `${chartId}-heading`;
  const showTitle = options.showTitle !== false;

  const rowsHtml = rows
    .map((row) => {
      const rcCell = formatRcCell(row.rc);
      const rowId = buildStableRowId(chartId, row);
      const rcAttr = String(Math.max(0, Math.floor(row.rc)));
      return `<tr class="ns-shaping-chart__tr" data-row-id="${escapeHtml(rowId)}" data-rc="${escapeHtml(
        rcAttr,
      )}"><td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark sleeve shaping row RC ${escapeHtml(
        rcCell,
      )} complete" /></label></td><td class="ns-shaping-chart__td-num">${escapeHtml(
        rcCell,
      )}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(
        row.edge,
      )}</td><td class="ns-shaping-chart__td-num">${escapeHtml(String(row.stitchesRemaining))}</td></tr>`;
    })
    .join("");

  const titleHtml = showTitle
    ? `<h3 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title ns-shaping-chart__title--body">Sleeve Shaping Chart</h3>`
    : "";

  return `<section class="ns-shaping-chart ns-shaping-chart--body drop-shoulder-sleeve-shaping-chart"${
    showTitle ? ` aria-labelledby="${escapeHtml(headingId)}"` : ""
  }>
  ${titleHtml}
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(chartId)}">
    ${renderProgressToolbarHtml()}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="ns-shaping-chart__table ns-shaping-chart__table--checklist">
      <thead>
        <tr>
          <th scope="col" class="ns-shaping-chart__th-complete" aria-label="Completion status">Done</th>
          <th scope="col" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" class="ns-shaping-chart__th-num">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
    </div>
  </div>
</section>`;
}
