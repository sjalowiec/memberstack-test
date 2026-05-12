/**
 * Print-only HTML from {@link SleevelessPatternDisplayRow} rows — no interactive chrome.
 * Pattern math lives in {@link generateSleevelessBackPattern}; this is presentation only.
 */

import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Empty square for hand-marking printouts — styled in print route CSS. */
function printHeadingCheckboxMarkup(): string {
  return `<span class="print-heading-checkbox" aria-hidden="true"></span>`;
}

/** Plain text from trusted pattern HTML — for identifying tip-prefixed paragraphs in print. */
function stripTrustedPatternHtmlToPlain(html: string): string {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Skips legacy tip-prefixed instruction paragraphs; structured `tipHtml` on blocks is rendered in {@link renderPrintBlockRow}. */
function isOmittedTipParagraph(text: string): boolean {
  const plain = stripTrustedPatternHtmlToPlain(String(text));
  return /^tips?\s*:/i.test(plain);
}

/** Print: show `<details>` body without requiring an extra click in the PDF/print dialog. */
function detailsOpenForPrint(html: string): string {
  return String(html).replace(/<details\b/i, "<details open ");
}

function renderPrintBlockRow(
  row: Extract<SleevelessPatternDisplayRow, { kind: "block" }>,
  lastStitchRef: { value: number | undefined },
): string {
  const showStitch =
    row.stitchCount !== undefined &&
    (lastStitchRef.value === undefined || row.stitchCount !== lastStitchRef.value);
  if (showStitch) lastStitchRef.value = row.stitchCount;

  const leftBits: string[] = [];
  if (row.rc) {
    leftBits.push(`<p class="print-rc">${escapeHtml(row.rc)}</p>`);
  }
  for (const p of row.paragraphs) {
    const raw = String(p);
    if (isOmittedTipParagraph(raw)) continue;
    const t = String(p).trim();
    if (t) leftBits.push(`<p class="print-line">${escapeHtml(t)}</p>`);
  }
  if (row.tipHtml) {
    leftBits.push(`<div class="pattern-tip"><strong>Tip:</strong> ${row.tipHtml}</div>`);
  }
  if (row.collapsibleTipHtml) {
    leftBits.push(detailsOpenForPrint(row.collapsibleTipHtml));
  }

  const leftHtml =
    leftBits.length > 0 ? `<div class="print-inst-left">${leftBits.join("")}</div>` : "";
  const rightHtml =
    showStitch && row.stitchCount !== undefined
      ? `<div class="print-inst-sts">${row.stitchCount} sts</div>`
      : "";

  if (!leftHtml && !rightHtml) {
    return "";
  }
  if (!leftHtml && rightHtml) {
    return `<div class="print-inst-row print-inst-row--full print-inst-row--sts-only">${rightHtml}</div>`;
  }

  const rowClass = rightHtml ? "print-inst-row" : "print-inst-row print-inst-row--full";
  return `<div class="${rowClass}">${leftHtml}${rightHtml}</div>`;
}

/**
 * Renders one piece’s instruction rows (BACK or FRONT array). Injects `neckChartHtml` at chart mount points.
 */
export function renderSleevelessPrintPieceHtml(
  rows: readonly SleevelessPatternDisplayRow[],
  neckChartHtml: string,
): string {
  const list = Array.isArray(rows) ? rows : [];
  const lastStitchRef = { value: undefined as number | undefined };
  const chunks: string[] = [];

  for (const row of list) {
    if (row.kind === "piece") {
      chunks.push(
        `<h2 class="print-piece-title print-heading-with-checkbox">${printHeadingCheckboxMarkup()}<span class="print-heading-label">${escapeHtml(row.title)}</span></h2>`,
      );
      continue;
    }
    if (row.kind === "section") {
      chunks.push(
        `<h3 class="print-section-title print-heading-with-checkbox">${printHeadingCheckboxMarkup()}<span class="print-heading-label">${escapeHtml(row.title)}</span></h3>`,
      );
      continue;
    }
    if (row.kind === "neckShoulderChartTableMount") {
      chunks.push(`<div class="print-chart-wrap">${neckChartHtml}</div>`);
      continue;
    }
    if (row.kind === "neckShoulderChartPreviewMount") {
      continue;
    }
    if (row.kind === "block") {
      chunks.push(renderPrintBlockRow(row, lastStitchRef));
    }
  }

  return `<div class="print-piece-body">${chunks.join("")}</div>`;
}

/**
 * Splits display rows so prelude fits page-one layout; continuation begins at neckline/shoulder chart mount.
 */
export function splitRowsBeforeNeckShoulderChartMount(
  rows: readonly SleevelessPatternDisplayRow[],
): {
  preludeRows: SleevelessPatternDisplayRow[];
  continuationRows: SleevelessPatternDisplayRow[];
} {
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.findIndex((r) => r.kind === "neckShoulderChartTableMount");
  if (idx < 0) {
    return { preludeRows: [...list], continuationRows: [] };
  }
  return {
    preludeRows: list.slice(0, idx),
    continuationRows: list.slice(idx),
  };
}
