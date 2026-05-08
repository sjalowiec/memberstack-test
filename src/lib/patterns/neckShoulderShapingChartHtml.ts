/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type { NeckShoulderShapingChart, NeckShoulderShapingChartRow } from "./neckShoulderShapingChart";
import { collapsePlainChartRows, getNeckShoulderChartRowHighlightFromRow } from "./neckShoulderShapingChart";
import { buildShapingGeometry } from "./buildShapingGeometry";
import { renderShapingGeometrySvg } from "./renderShapingGeometrySvg";
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

const PRINT_KNIT_EVEN_LABEL = "Knit even";

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
};

function chartBodyRowsHtml(chart: NeckShoulderShapingChart, options?: NeckShoulderChartRenderOptions): string {
  const includeDoneColumn = options?.includeDoneColumn !== false;
  const activeSideOnly = options?.activeSideOnly === true;
  if (activeSideOnly) {
    return chart.rows
      .map((r) => {
        const rowNum = Math.max(0, Math.floor(r.row));
        const neck = parseDecreaseCell(r.leftNeck);
        const shoulder = parseDecreaseCell(r.leftSide);
        const actionParts: string[] = [];
        if (neck > 0) actionParts.push(`Neck: -${neck}`);
        if (shoulder > 0) actionParts.push(`Shoulder: -${shoulder}`);
        const actionCell = actionParts.length > 0 ? actionParts.join("; ") : "—";
        const doneCell = includeDoneColumn
          ? `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row ${rowNum} complete" /></label></td>`
          : "";
        return `<tr class="ns-shaping-chart__tr">${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(
          String(rowNum)
        )}</td><td>${escapeHtml(actionCell)}</td><td class="ns-shaping-chart__td-num">${
          r.leftStitchCount
        }</td></tr>`;
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
          ${
            activeSideOnly
              ? `<th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action (Active Side)</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Sts (Active Side)</th>`
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
  ${
    activeSideOnly
      ? `<p class="ns-shaping-chart__active-side-note">Work one side only. When this side is complete, rehang the remaining stitches and repeat for the other side, reversing the shaping.</p>`
      : ""
  }
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
  const printRows = buildPrintInstructionTableRows(chart.rows);
  const rowsHtml = printRows
    .map((pr) => {
      const hi = getNeckShoulderChartRowHighlightFromRow(pr.sourceRow);
      const rowClass = hi === "shoulderAndNeck" ? "ns-shaping-mini__row ns-shaping-mini__row--mix" : "ns-shaping-mini__row";
      return `<tr class="${rowClass}"><td class="ns-shaping-mini__rc">${escapeHtml(pr.rcLabel)}</td><td>${escapeHtml(
        pr.leftCell
      )}</td><td>${escapeHtml(pr.rightCell)}</td><td class="ns-shaping-mini__sts">${escapeHtml(pr.stitchCell)}</td></tr>`;
    })
    .join("");
  const geometrySvgHtml =
    chart.timeline && chart.timeline.length > 0
      ? `<div class="ns-shaping-mini__svg-wrap">${renderShapingGeometrySvg(
          buildShapingGeometry(chart.timeline)
        )}</div>`
      : "";

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
          <th scope="col">Sts (L/R)</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <p class="ns-shaping-mini__sts-note">Sts (L/R) = stitches remaining on the Left shoulder / Right shoulder after the action on that row.</p>
  ${geometrySvgHtml}
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
  const diagramHeadingId = `${idPrefix}-diagram-heading`;
  let svgHtml = renderShoulderShapingSvg(chart, "right", piece ? { piece } : undefined);

  if (chart.timeline && chart.timeline.length > 0) {
    const geometry = buildShapingGeometry(chart.timeline) as ReturnType<typeof buildShapingGeometry> & {
      pieceType?: ShoulderShapingSvgPiece;
    };
    if (piece) geometry.pieceType = piece;
    svgHtml = renderShapingGeometrySvg(geometry);
  }

  const notationHintHtml = `<div class="ns-shaping-chart__diagram-notation-hint">
  <p class="ns-shaping-chart__diagram-notation-hint-main"><span class="glossary-tooltip-placeholder" data-glossary-id="354">Shaping notation</span>: <span class="ns-shaping-chart__diagram-notation-hint-kernel"><span class="ns-shaping-chart__diagram-notation-order">stitches</span>, <span class="ns-shaping-chart__diagram-notation-order">rows</span>, <span class="ns-shaping-chart__diagram-notation-order">times</span></span></p>
  <p class="ns-shaping-chart__diagram-notation-hint-example">${escapeHtml("Example: 1s-2r-3x = decrease 1 stitch every 2 rows, 3 times")}</p>
</div>`;

  return `<div class="ns-shaping-chart ns-shaping-chart--diagram-block" aria-labelledby="${escapeHtml(diagramHeadingId)}">
  <div class="ns-shaping-chart__diagram">
    <h3 id="${escapeHtml(diagramHeadingId)}" class="ns-shaping-chart__preview-title">Neckline / Shoulder Diagram</h3>
    ${notationHintHtml}
    <div class="ns-shaping-chart__diagram-svg-wrap">${svgHtml}</div>
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
