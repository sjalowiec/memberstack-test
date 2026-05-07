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

type NeckShoulderChartRenderOptions = {
  includeDoneColumn?: boolean;
  tableClassName?: string;
};

function chartBodyRowsHtml(chart: NeckShoulderShapingChart, options?: NeckShoulderChartRenderOptions): string {
  const includeDoneColumn = options?.includeDoneColumn !== false;
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
  const tableClassName = String(options?.tableClassName ?? "").trim();
  const sectionClass = tableClassName ? `ns-shaping-chart ${tableClassName}` : "ns-shaping-chart";
  const doneHeader = includeDoneColumn
    ? `<th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>`
    : "";

  return `<section class="${escapeHtml(sectionClass)}" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  ${intro}
  <div class="ns-shaping-chart__table-wrap">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneHeader}
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

/** Print-only compact written shaping rows for ink-efficient printouts. */
export function renderNeckShoulderShapingPrintInstructionTableHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart-print",
  introHtml?: string
): string {
  const headingId = `${idPrefix}-heading`;
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const rowsHtml = chart.rows
    .map((r) => {
      const rowLabel = String(Math.max(0, Math.floor(r.row)));
      const actionLabel = String(r.action ?? "").trim() || "—";
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const rowClass = hi === "shoulderAndNeck" ? "ns-shaping-mini__row ns-shaping-mini__row--mix" : "ns-shaping-mini__row";
      const leftText = buildLeftShapingText(r, actionLabel);
      const rightText = buildRightShapingText(r, actionLabel);
      const centerBo = centerBindOffCompact(r.centerNeck);
      let leftCell = leftText;
      if (centerBo) {
        leftCell = leftCell === "—" ? centerBo : `${centerBo}, ${leftCell}`;
      }
      const rightCell = rightText;
      const stitchCell = stitchRemainingCompact(r.leftStitchCount, r.rightStitchCount);
      return `<tr class="${rowClass}"><td class="ns-shaping-mini__rc">${escapeHtml(rowLabel)}</td><td>${escapeHtml(
        leftCell
      )}</td><td>${escapeHtml(rightCell)}</td><td class="ns-shaping-mini__sts">${escapeHtml(stitchCell)}</td></tr>`;
    })
    .join("");

  return `<section class="ns-shaping-mini" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-mini__title">Neckline / Shoulder Shaping</h2>
  ${intro}
  <div class="ns-shaping-mini__wrap">
    <table class="ns-shaping-mini__table">
      <thead>
        <tr>
          <th scope="col">RC</th>
          <th scope="col">Left</th>
          <th scope="col">Right</th>
          <th scope="col">Sts after</th>
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
