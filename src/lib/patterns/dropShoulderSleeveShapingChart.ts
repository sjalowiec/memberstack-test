/**
 * Drop-shoulder sleeve row-by-row shaping checklist.
 *
 * Shaping steps from {@link dropShoulderSleeveShapingPlan} — shared with written instructions
 * and {@link buildDropShoulderSleeveJapaneseNotationReplacements}.
 */

import { sleeveShapingPerSide, type EvenShapingSchedule } from "./evenShapingSchedule";
import { formatRowBasedShapingNotation, rowBasedShapingNotation } from "./shapingNotationCompress";
import {
  dropShoulderSleeveShapingBreakdown,
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingPlanForDirection,
  dropShoulderSleeveShapingVerb,
  formatDropShoulderSleeveShapingNotation,
} from "./dropShoulderSleeveShaping";

export const DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES = [
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
export const DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE = "Begin sleeve shaping.";

export type DropShoulderSleevePreShapingSpan = {
  /** Cuff-end RC (bottom-up) or sleeve-body start RC (top-down). */
  bodyStartRc: number;
  /** First shaping RC from {@link dropShoulderSleeveShapingRcSequence}, if any. */
  firstShapingRc: number | undefined;
  /** Even rows worked between `bodyStartRc` and `firstShapingRc` (0 when shaping starts immediately). */
  straightRows: number;
};

/**
 * Straight rows between sleeve-body start and the first shaping row — derived from the shared RC sequence.
 */
/**
 * Japanese notation for one sleeve edge, in knitting order.
 * Optional row spans use the existing `Nr` token. Omitting them keeps `1s-6r-13x` alone.
 */
export function formatDropShoulderSleeveWorkingNotation(
  input: DropShoulderSleeveShapingChartInput,
  options?: { includeRowSpans?: boolean },
): string {
  const plan = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: input.topSts,
      wristSts: input.wristSts,
      sleeveBodyRows: input.sleeveBodyRows,
    },
    input.direction,
  );
  const shaping = formatDropShoulderSleeveShapingNotation(plan.steps);
  if (!options?.includeRowSpans) return shaping;
  const spans = dropShoulderSleeveBodyRowSpans(input);
  const section = rowBasedShapingNotation({
    rowsBefore: spans.rowsBeforeShaping,
    segments: plan.steps
      .filter((step) => step.times > 0 && step.rows > 0)
      .map((step) => ({ stitches: step.sts, intervalRows: step.rows, times: step.times })),
    rowsAfter: spans.rowsAfterShaping,
    totalRows: input.sleeveBodyRows,
  });
  return formatRowBasedShapingNotation(section) || shaping;
}

/**
 * Even-row spans around the shared cuff-up shaping events.
 * Top Down reads those same events from the upper arm, so the spans swap.
 */
export function dropShoulderSleeveBodyRowSpans(input: DropShoulderSleeveShapingChartInput): {
  rowsBeforeShaping: number;
  rowsAfterShaping: number;
} {
  const cuffUpEvents = dropShoulderSleeveShapingRcSequence({ ...input, direction: "cuff-up" });
  if (cuffUpEvents.length === 0) {
    return { rowsBeforeShaping: input.sleeveBodyRows, rowsAfterShaping: 0 };
  }
  const bodyStart = input.cuffRows;
  const bodyEnd = input.cuffRows + input.sleeveBodyRows;
  const rowsFromCuff = Math.max(0, cuffUpEvents[0]! - bodyStart);
  const rowsAtUpperArm = Math.max(0, bodyEnd - cuffUpEvents[cuffUpEvents.length - 1]!);
  if (input.direction === "top-down") {
    return { rowsBeforeShaping: rowsAtUpperArm, rowsAfterShaping: rowsFromCuff };
  }
  return { rowsBeforeShaping: rowsFromCuff, rowsAfterShaping: rowsAtUpperArm };
}

export function dropShoulderSleevePreShapingSpan(
  input: DropShoulderSleeveShapingChartInput,
): DropShoulderSleevePreShapingSpan {
  const sequence = dropShoulderSleeveShapingRcSequence(input);
  const bodyStartRc = input.direction === "cuff-up" ? input.cuffRows : 0;
  const firstShapingRc = sequence[0];
  if (firstShapingRc === undefined) {
    return { bodyStartRc, firstShapingRc: undefined, straightRows: 0 };
  }
  const straightRows = Math.max(0, firstShapingRc - bodyStartRc);
  return { bodyStartRc, firstShapingRc, straightRows };
}

function cuffUpSleeveShapingRcSequence(input: DropShoulderSleeveShapingChartInput): number[] {
  const plan = dropShoulderSleeveShapingPlan({
    topSts: input.topSts,
    wristSts: input.wristSts,
    sleeveBodyRows: input.sleeveBodyRows,
  });
  if (plan.noShaping || plan.steps.length === 0) return [];
  const breakdown = dropShoulderSleeveShapingBreakdown(
    { topSts: input.topSts, wristSts: input.wristSts, direction: "cuff-up" },
    plan.steps,
  );
  return breakdown.map((entry) => input.cuffRows + entry.rowNumber);
}

/**
 * RC of each shaping pass, in knitting order.
 * Cuff-up events are measured from the cuff cast-on. Top-down reads those same
 * fabric rows from the upper-arm cast-on (`sleeve end − cuff-up RC`).
 * The named RC is the counter when the increase or decrease is worked; the
 * even rows before it are knitted to reach that RC.
 */
export function dropShoulderSleeveShapingRcSequence(
  input: DropShoulderSleeveShapingChartInput,
): number[] {
  const cuffUpEvents = cuffUpSleeveShapingRcSequence(input);
  if (input.direction !== "top-down") return cuffUpEvents;
  const fabricEnd = input.cuffRows + input.sleeveBodyRows;
  return cuffUpEvents.map((rc) => fabricEnd - rc).sort((a, b) => a - b);
}

export function buildDropShoulderSleeveShapingChartRows(
  input: DropShoulderSleeveShapingChartInput,
  options?: { finalAction?: string },
): DropShoulderSleeveShapingChartRow[] {
  const { topSts, wristSts, sleeveBodyRows, sleeveTotalRows, direction } = input;
  const plan = dropShoulderSleeveShapingPlan({ topSts, wristSts, sleeveBodyRows });
  if (plan.noShaping || plan.steps.length === 0) return [];

  const isCuffUp = direction === "cuff-up";
  const shapingRcs = dropShoulderSleeveShapingRcSequence(input);
  const breakdown = dropShoulderSleeveShapingBreakdown(
    { topSts, wristSts, direction },
    plan.steps,
  );

  const shapingVerb = dropShoulderSleeveShapingVerb(direction, topSts, wristSts);
  const shapingAction =
    shapingVerb === "increase"
      ? "Increase 1 stitch at each side"
      : "Decrease 1 stitch at each side";
  const rows: DropShoulderSleeveShapingChartRow[] = breakdown.map((entry, index) => ({
    rc: shapingRcs[index] ?? entry.rowNumber,
    action: shapingAction,
    edge: "Both sides",
    stitchesRemaining: entry.stitchesAfter,
  }));

  rows.push({
    rc: sleeveTotalRows,
    action: options?.finalAction ?? "Bind off loosely or scrap off",
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
      )} complete" /></label></td><td class="ns-shaping-chart__td-rc">${escapeHtml(
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
