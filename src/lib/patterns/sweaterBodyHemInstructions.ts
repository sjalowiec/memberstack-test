/**
 * Shared sweater body-hem choices.
 *
 * Bottom-up bodies (set-in, drop shoulder, sleeveless) count the finished hem
 * in the row-counter schedule. A 12-row hem is still 12 rows of finished length
 * when the knitter works 24 rows and folds them. After a folded hem, reset the
 * counter to that finished reading. After hand-knit ribbing, set it there,
 * because those rows were not knitted on the machine. Regular ribbing lands on
 * the reading by itself.
 *
 * Sideways sweaters are different. The hem is the lower edge, and the row
 * counter runs across the body. Those instructions keep the existing turning
 * needle and do not reset the counter.
 */

import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import {
  SIDEWAYS_HUNG_HEM_GLOSSARY_ID,
  SIDEWAYS_MOCK_RIB_GLOSSARY_ID,
} from "./sidewaysCardiganSleeveCuffCopy";
import {
  formatSidewaysFinishingInches,
  sidewaysCardiganFinishingProportions,
  sidewaysFoldedHemCastOnSentence,
} from "./sidewaysCardiganFinishing";

export type BodyHemChoiceOptions = {
  /**
   * Prepended to every hem line. Set-In Sleeve plain-text instructions use
   * `RC: 000`. Screen blocks leave this unset and show the counter as the block heading.
   */
  rcPrefix?: string;
  /** Strip glossary markup for plain-text instruction documents. */
  plainText?: boolean;
  /** Finished hem depth already calculated for this pattern, such as `2.00 in`. */
  finishedDepthLabel?: string;
};

/** Matches `formatRcColon` so later body headings stay on the same reading. */
export function finishedHemRowCounterLabel(hemRows: number): string {
  const n = Math.max(0, Math.floor(hemRows));
  return `RC: ${String(n).padStart(3, "0")}`;
}

export const SIDEWAYS_BODY_HEM_ROW_COUNTER_NOTE =
  "Keep the row counter running through the body. Do not reset it for the hem.";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function glossary(id: number, label: string, ariaLabel: string): string {
  return buildGlossaryTooltipPlaceholderHtml(id, label, escapeHtml, escapeHtml, {
    ariaLabel,
  });
}

function rowPhrase(rows: number): string {
  const n = Math.max(0, Math.floor(rows));
  return n === 1 ? "1 row" : `${n} rows`;
}

function stripMarkup(line: string): string {
  return line.replace(/<[^>]+>/g, "");
}

function presentLines(lines: string[], options?: BodyHemChoiceOptions): string[] {
  const text = options?.plainText ? lines.map(stripMarkup) : lines;
  const prefix = options?.rcPrefix?.trim();
  if (!prefix) return text;
  return text.map((line) => `${prefix} ${line}`);
}

/**
 * Bottom-up hem choices. Calculations keep using `hemRows` as the finished allowance.
 * Folded methods knit twice that many rows, then the counter returns to the finished reading.
 */
export function sweaterBodyHemChoiceLines(
  hemStitches: number,
  hemRows: number,
  options?: BodyHemChoiceOptions,
): string[] {
  const hungHem = glossary(SIDEWAYS_HUNG_HEM_GLOSSARY_ID, "hung hem", "Learn about hung hems");
  const mockRib = glossary(
    SIDEWAYS_MOCK_RIB_GLOSSARY_ID,
    "mock ribbing",
    "Learn about mock ribbing",
  );
  const rows = rowPhrase(hemRows);
  const folded = rowPhrase(Math.max(0, hemRows) * 2);
  const finishedRc = finishedHemRowCounterLabel(hemRows);
  const depth = options?.finishedDepthLabel ? ` (${options.finishedDepthLabel})` : "";
  const width = hemStitches > 0 ? `${hemStitches} stitches and ` : "";
  const lines = [
    `The finished hem is ${width}${rows} deep${depth}. Choose one way to work it:`,
    `1. Work ${rows} of ribbing in the needle arrangement of your choice. When the hem is complete, the row counter shows ${finishedRc}.`,
    `2. Knit a ${hungHem} for ${folded} so the hem can be folded. Reset the row counter to ${finishedRc}.`,
    `3. Knit ${mockRib} for ${folded} so the hem can be folded. Reset the row counter to ${finishedRc}.`,
    `4. Hand knit ribbing to the desired finished hem depth, then hang its stitches on the machine to continue the body. Set the row counter to ${finishedRc}.`,
  ];
  return presentLines(lines, options);
}

export function sweaterBodyHemChoiceDisplay(
  hemStitches: number,
  hemRows: number,
): { paragraphs: string[]; trustedParagraphs: string[] } {
  return {
    paragraphs: sweaterBodyHemChoiceLines(hemStitches, hemRows, { plainText: true }),
    trustedParagraphs: sweaterBodyHemChoiceLines(hemStitches, hemRows),
  };
}

/**
 * Sideways hem choices. The row counter measures the body width, so none of
 * these finishes reset it. The hung-hem choice keeps the turning-needle sentence.
 */
export function sidewaysBodyHemChoiceLines(
  turningNeedle: number,
  chartAudience?: unknown,
  options?: BodyHemChoiceOptions,
): string[] {
  const depth = formatSidewaysFinishingInches(
    sidewaysCardiganFinishingProportions(chartAudience).foldedHemOffsetInches,
  );
  const hungHem = glossary(SIDEWAYS_HUNG_HEM_GLOSSARY_ID, "hung hem", "Learn about hung hems");
  const mockRib = glossary(
    SIDEWAYS_MOCK_RIB_GLOSSARY_ID,
    "mock ribbing",
    "Learn about mock ribbing",
  );
  const folded = sidewaysFoldedHemCastOnSentence(turningNeedle, chartAudience);
  const lines = [
    `The finished hem is about ${depth}. This sweater is knitted sideways, so the hem is the lower edge. ${SIDEWAYS_BODY_HEM_ROW_COUNTER_NOTE} Choose one way to finish the hem edge:`,
    `1. Work ribbing for about ${depth} along the hem edge.`,
    `2. Knit a ${hungHem}. ${folded}`,
    `3. Work ${mockRib} along the hem edge for twice the finished hem depth so the hem can be folded.`,
    `4. Hand knit ribbing to the desired finished hem depth and sew it to the hem edge.`,
  ];
  return presentLines(lines, options);
}
