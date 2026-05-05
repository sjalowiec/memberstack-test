/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import { getNeckShoulderChartRowHighlightFromRow } from "./neckShoulderShapingChart";
import { renderShoulderShapingSvg } from "./shoulderShapingSvg";

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

/**
 * Full chart section markup (table + dev note + SVG preview) for client-side injection.
 */
export function renderNeckShoulderShapingChartSectionHtml(
  chart: NeckShoulderShapingChart
): string {
  const shoulderPreviewSvg = renderShoulderShapingSvg(chart, "right");
  const rowsHtml = chart.rows
    .map((r) => {
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const trClass = rowClassFromHighlight(hi);
      return `<tr class="${trClass}"><td class="ns-shaping-chart__td-num">${r.row}</td><td>${escapeHtml(
        String(r.action)
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.leftSide)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.leftNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.centerNeck)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.rightNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.rightSide)}</td><td class="ns-shaping-chart__td-num">${
        r.leftStitchCount
      }</td><td class="ns-shaping-chart__td-num">${r.rightStitchCount}</td></tr>`;
    })
    .join("");

  return `<section class="ns-shaping-chart" aria-labelledby="ns-shaping-chart-heading">
  <h2 id="ns-shaping-chart-heading" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  <p class="ns-shaping-chart__intro">
    Work each shoulder separately.<br />
    Right and Left refer to each side on the needlebed.<br />
    Highlighted rows indicate action happening on both sides.
  </p>
  <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
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
  <div class="ns-shaping-chart__preview" aria-labelledby="ns-shaping-preview-heading">
    <h3 id="ns-shaping-preview-heading" class="ns-shaping-chart__preview-title">Neckline / Shoulder Shape Preview</h3>
    <div class="ns-shaping-chart__preview-svg-wrap">${shoulderPreviewSvg}</div>
  </div>
</section>`;
}
