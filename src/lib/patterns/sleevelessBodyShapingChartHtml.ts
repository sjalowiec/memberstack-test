/**
 * Reusable interactive shaping-event chart for body / A-line side shaping.
 *
 * Visual + interactive parity with the neckline / shoulder shaping charts
 * (`neckShoulderShapingChartHtml.ts`): same `ns-shaping-chart` classes, the same
 * `data-chart-id` / `data-row-id` / `data-rc` progress-tracking hooks, and the same
 * checkbox markup so {@link initChartProgressTracking} wires it up automatically.
 *
 * The neckline/shoulder chart is too specific (Left/Center/Right neck + armhole columns,
 * carriage position, second-shoulder logic), so body shaping uses this small dedicated
 * helper with a Checkbox / Row Counter / Action layout.
 */

import type {
  SleevelessAlineShapingEdgeScope,
  SleevelessAlineShapingType,
} from "./sleevelessAlineShaping";

/** One body-shaping event: the row counter where it happens and the human action label. */
export type SleevelessBodyShapingChartRow = {
  /** Garment row counter (RC) where the shaping row is worked. */
  rc: number;
  /** e.g. `Dec 1 stitch at each side edge` / `Inc 1 stitch at armhole edge`. */
  action: string;
};

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Piece-aware, shaping-aware action label for a single body-shaping row.
 * - Verb: A-line (hip → bust) decreases (`Dec`); waist/shaped (bust → hip) increases (`Inc`).
 * - Edge: cardigan fronts shape one side only (`armhole edge`); back / pullover front use `each side edge`.
 */
export function sleevelessBodyShapingActionLabel(
  shapingType: SleevelessAlineShapingType,
  edgeScope: SleevelessAlineShapingEdgeScope,
): string {
  const verb = shapingType === "increase-to-bust" ? "Inc" : "Dec";
  const edge = edgeScope === "armholeEdgeOnly" ? "armhole edge" : "each side edge";
  return `${verb} 1 stitch at ${edge}`;
}

/** Build chart rows from the shaping plan's row numbers; empty for straight bodies. */
export function buildSleevelessBodyShapingChartRows(
  shapingType: SleevelessAlineShapingType,
  rowNumbers: readonly number[],
  edgeScope: SleevelessAlineShapingEdgeScope = "symmetricSides",
): SleevelessBodyShapingChartRow[] {
  if (shapingType === "straight") return [];
  const action = sleevelessBodyShapingActionLabel(shapingType, edgeScope);
  return rowNumbers
    .map((r) => Math.max(0, Math.floor(Number(r))))
    .filter((r) => Number.isFinite(r))
    .map((rc) => ({ rc, action }));
}

function formatRcCell(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

/** Stable per-row identity for progress persistence (paired with `data-chart-id`). */
function buildBodyShapingStableRowId(chartId: string, r: SleevelessBodyShapingChartRow): string {
  return `${chartId}|body|${Math.max(0, Math.floor(r.rc))}|${r.action}`;
}

/** Progress toolbar — mirrors the neckline/shoulder chart toolbar; `no-print` so it is online-only. */
function renderBodyShapingProgressToolbarHtml(): string {
  return `<div class="ns-shaping-chart__progress-toolbar no-print">
    <div class="ns-shaping-chart__progress-toolbar-main" role="toolbar" aria-label="Body shaping checklist tracking">
      <button type="button" role="switch" aria-checked="true" class="pattern-tips-switch ns-shaping-chart__progress-show-completed" data-chart-progress-show-completed>
        <span class="pattern-tips-switch__label">Show Completed Rows</span>
        <span class="pattern-tips-switch__track" aria-hidden="true"><span class="pattern-tips-switch__thumb"></span></span>
        <span class="pattern-tips-switch__state" data-chart-progress-show-state>Rows visible</span>
      </button>
      <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-reset" data-chart-progress-reset>Reset Checklist</button>
    </div>
  </div>`;
}

export type SleevelessBodyShapingChartRenderOptions = {
  /** Unique per-piece id used for the progress storage key (e.g. `sleeveless-body-shaping-chart-back`). */
  chartId: string;
  /** Section heading; defaults to `Body Shaping Chart`. */
  title?: string;
};

/**
 * Interactive (checkbox / RC / action) body-shaping chart HTML.
 * Returns an empty string when there are no shaping rows so callers can omit it.
 */
export function renderSleevelessBodyShapingChartHtml(
  rows: readonly SleevelessBodyShapingChartRow[],
  options: SleevelessBodyShapingChartRenderOptions,
): string {
  if (!rows || rows.length === 0) return "";
  const chartId = String(options.chartId || "sleeveless-body-shaping-chart").trim();
  const headingId = `${chartId}-heading`;
  const title = options.title ?? "Body Shaping Chart";

  const rowsHtml = rows
    .map((r) => {
      const rcCell = formatRcCell(r.rc);
      const rowId = buildBodyShapingStableRowId(chartId, r);
      const rcAttr = String(Math.max(0, Math.floor(r.rc)));
      return `<tr class="ns-shaping-chart__tr" data-row-id="${escapeHtml(rowId)}" data-rc="${escapeHtml(
        rcAttr,
      )}"><td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark body shaping row RC ${escapeHtml(
        rcCell,
      )} complete" /></label></td><td class="ns-shaping-chart__td-num">${escapeHtml(
        rcCell,
      )}</td><td>${escapeHtml(r.action)}</td></tr>`;
    })
    .join("");

  return `<section class="ns-shaping-chart ns-shaping-chart--body sleeveless-body-shaping-chart" aria-labelledby="${escapeHtml(
    headingId,
  )}">
  <h3 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title ns-shaping-chart__title--body">${escapeHtml(
    title,
  )}</h3>
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(chartId)}">
    ${renderBodyShapingProgressToolbarHtml()}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          <th scope="col" class="ns-shaping-chart__th-complete" aria-label="Completion status">Done</th>
          <th scope="col" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" class="ns-shaping-chart__th-action">Action</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
    </div>
  </div>
</section>`;
}
