/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import { collapsePlainChartRows, getNeckShoulderChartRowHighlightFromRow } from "./neckShoulderShapingChart";
import { renderShoulderShapingSvg, type ShoulderShapingSvgPiece } from "./shoulderShapingSvg";

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

function chartBodyRowsHtml(chart: NeckShoulderShapingChart): string {
  return collapsePlainChartRows(chart.rows)
    .map((displayRow) => {
      const r = displayRow.sourceRow;
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const trClass = rowClassFromHighlight(hi);
      const rowNum = Math.max(0, Math.floor(r.row));
      return `<tr class="${trClass}"><td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row ${rowNum} complete" /></label></td><td class="ns-shaping-chart__td-num">${escapeHtml(displayRow.rowLabel)}</td><td>${escapeHtml(
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
  introHtml?: string
): string {
  const headingId = `${idPrefix}-heading`;
  const rowsHtml = chartBodyRowsHtml(chart);
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";

  return `<section class="ns-shaping-chart" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  ${intro}
  <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          <th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>
          <th scope="col" rowspan="2" class="ns-shaping-chart__th-row">Row</th>
          <th scope="col" rowspan="2" class="ns-shaping-chart__th-action">Action</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Left</th>
          <th scope="colgroup" colspan="1" class="ns-shaping-chart__th-group">Center</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Right</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Stitch count</th>
        </tr>
        <tr>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck center</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Left</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Right</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
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
