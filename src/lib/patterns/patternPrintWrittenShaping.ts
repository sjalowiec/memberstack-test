/**
 * Print uses the on-screen instruction sentences.
 * Paper does not get a separate neckline essay or rewritten row readings.
 */

import type { RowEntry } from "./shapingTimeline";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

/** Sentences that point at a chart or checklist instead of stating the shaping. */
const CHECKLIST_POINTER_RE =
  /checklist below|follow the checklist row by row|following the chart below|shaping chart below|shaping map below|instructions below for the exact row-by-row/i;

export function isPatternPrintChecklistPointer(text: string): boolean {
  const plain = String(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  return CHECKLIST_POINTER_RE.test(plain);
}

/**
 * Print uses the on-screen instruction sentences. It does not add a paper-only
 * neckline essay or rewritten row readings.
 */
export function writtenNeckShoulderPrintParagraphs(
  _timeline: readonly RowEntry[] | undefined,
  _options?: { centerBindOffShapingLine?: string; rowCounterOrigin?: number | null },
): string[] {
  return [];
}

/**
 * Attach print-only neckline prose to the checklist sentence in a neckline section.
 * Other sections are left unchanged. Returns the same row objects when there is nothing to add.
 */
export function attachNecklinePrintInstructions(
  rows: readonly SleevelessPatternDisplayRow[],
  _timeline?: readonly RowEntry[] | undefined,
  _rowCounterOrigin?: number | null,
): SleevelessPatternDisplayRow[] {
  return rows.map((row) => {
    if (row.kind !== "block" || !row.printInstructionParagraphs?.length) return row;
    return { ...row, printInstructionParagraphs: undefined };
  });
}

/** The A-line chart stays the on-screen chart. Print does not rewrite it as prose. */
export function alinePrintWrittenParagraphs(
  _rows: readonly { rc: number; action: string; stitchesRemaining: number }[] | undefined,
): string[] {
  return [];
}

export function instructionParagraphClass(text: string, className: string): string {
  return isPatternPrintChecklistPointer(text) ? `${className} pattern-print-checklist-pointer` : className;
}

export function printWrittenShapingBlockHtml(
  paragraphs: readonly string[] | undefined,
  escapeHtml: (value: string) => string,
  lineClass = "sleeveless-pattern-line",
): string {
  if (!paragraphs || paragraphs.length === 0) return "";
  const inner = paragraphs
    .map((paragraph) => `<p class="${lineClass}">${escapeHtml(paragraph)}</p>`)
    .join("");
  return `<div class="pattern-print-written-shaping" hidden>${inner}</div>`;
}
