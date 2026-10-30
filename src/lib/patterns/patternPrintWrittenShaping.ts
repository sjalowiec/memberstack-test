/**
 * Written shaping for instructions-only and combined pattern printing.
 * Built from the same timeline and chart rows as the on-screen checklists.
 * The on-screen pattern still shows the charts and the checklist sentences.
 */

import {
  mergedShapingInstructionLines,
  ONE_SHOULDER_AT_A_TIME_NOTE,
  shapingActionsFromTimeline,
} from "./legoBlocks/neckShoulderExecution";
import { displayRcFromGarmentRc } from "./frontArmholeNecklineComposition";
import { roundNeckPlanFinishHeldStitchesLine } from "./roundNeckPlanPresentation";
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

function formatRcLabel(rc: number): string {
  return `RC: ${String(Math.max(0, Math.floor(rc))).padStart(3, "0")}`;
}

/**
 * Rewrite timeline row numbers into the counter the checklist shows.
 * After an armhole reset, garment rows at or after that reset become armhole-local readings.
 */
export function retargetWrittenRcLabels(text: string, rowCounterOrigin: number | null | undefined): string {
  const origin = Math.floor(Number(rowCounterOrigin));
  return text.replace(/RC:\s*(\d+)(?:\s*[–-]\s*(\d+))?/g, (_match, start: string, end?: string) => {
    const fromRc = Number.isFinite(origin) && origin > 0 ? displayRcFromGarmentRc(Number(start), origin) : Number(start);
    const from = formatRcLabel(fromRc);
    if (!end) return from;
    const toRc = Number.isFinite(origin) && origin > 0 ? displayRcFromGarmentRc(Number(end), origin) : Number(end);
    return `${from}–${String(Math.max(0, Math.floor(toRc))).padStart(3, "0")}`;
  });
}

/** Pad `RC: 7` and `RC: 7–9` so printed prose matches checklist cells. */
export function padWrittenRcLabels(text: string): string {
  return retargetWrittenRcLabels(text, null);
}

function timelineHasHold(timeline: readonly RowEntry[]): boolean {
  return timeline.some((entry) => entry.events.some((event) => event.kind === "hold"));
}

const SHAPING_READING_RE = /^RC: (\d{3}(?:–\d{3})?(?:, RC: \d{3}(?:–\d{3})?)*)\. ([\s\S]+)$/;

type ShapingReading = { tokens: string[]; body: string };

function parseShapingReading(line: string): ShapingReading | null {
  const match = SHAPING_READING_RE.exec(line);
  if (!match) return null;
  return { tokens: match[1].split(", RC: "), body: match[2] };
}

function formatShapingReading(reading: ShapingReading): string {
  return `RC: ${reading.tokens.join(", RC: ")}. ${reading.body}`;
}

/** Join neighboring rows that repeat the same action, carriage side, and wording. */
function groupAdjacentShapingReadings(lines: readonly string[]): string[] {
  const out: string[] = [];
  let current: ShapingReading | null = null;
  const flush = () => {
    if (!current) return;
    out.push(formatShapingReading(current));
    current = null;
  };
  for (const line of lines) {
    const reading = parseShapingReading(line);
    if (!reading) {
      flush();
      out.push(line);
      continue;
    }
    if (current && current.body === reading.body) current.tokens.push(...reading.tokens);
    else {
      flush();
      current = { tokens: [...reading.tokens], body: reading.body };
    }
  }
  flush();
  return out;
}

/**
 * When neck and shoulder actions alternate, keep both lists and say they alternate.
 * Every row-counter reading stays in the list. Identical neighboring rows are already grouped.
 */
function groupAlternatingShapingReadings(lines: readonly string[]): string[] {
  const readings = lines.map((line) => parseShapingReading(line));
  const out: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const first = readings[index];
    const second = readings[index + 1];
    if (!first || !second || first.body === second.body) {
      out.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    let end = index;
    while (end < lines.length) {
      const expected = (end - index) % 2 === 0 ? first.body : second.body;
      const reading = readings[end];
      if (!reading || reading.body !== expected) break;
      end += 1;
    }
    if (end - index >= 4) {
      const tokensFor = (offset: number) =>
        readings
          .slice(index, end)
          .filter((_, itemIndex) => (itemIndex - offset) % 2 === 0)
          .flatMap((reading) => reading?.tokens ?? []);
      const start = first.tokens[0] ?? "";
      out.push(`Starting at RC: ${start}, alternate the two readings below, one row at a time.`);
      out.push(formatShapingReading({ tokens: tokensFor(0), body: first.body }));
      out.push(formatShapingReading({ tokens: tokensFor(1), body: second.body }));
      index = end;
      continue;
    }
    out.push(lines[index] ?? "");
    index += 1;
  }
  return out;
}

/** Compact print schedule. Row numbers, carriage side, and the action text are unchanged. */
export function groupRepeatedShapingReadings(lines: readonly string[]): string[] {
  return groupAlternatingShapingReadings(groupAdjacentShapingReadings(lines));
}

/**
 * Neckline and shoulder prose for one piece.
 * Row numbers, stitch amounts, and the order of shaping come from `shapingActionsFromTimeline`.
 */
export function writtenNeckShoulderPrintParagraphs(
  timeline: readonly RowEntry[] | undefined,
  options?: { centerBindOffShapingLine?: string; rowCounterOrigin?: number | null },
): string[] {
  if (!timeline || timeline.length === 0) return [];
  const derived = shapingActionsFromTimeline(timeline, {
    centerBindOffShapingLine: options?.centerBindOffShapingLine,
  });
  const lines = groupRepeatedShapingReadings(
    mergedShapingInstructionLines(derived.neckActions, derived.shoulderActions).map((line) =>
      retargetWrittenRcLabels(line, options?.rowCounterOrigin),
    ),
  );
  if (lines.length === 0) return [];
  return [
    ONE_SHOULDER_AT_A_TIME_NOTE,
    ...lines,
    "Knit in pattern at all other rows in this section.",
    ...(timelineHasHold(timeline) ? [roundNeckPlanFinishHeldStitchesLine()] : []),
  ];
}

/**
 * Attach print-only neckline prose to the checklist sentence in a neckline section.
 * Other sections are left unchanged. Returns the same row objects when there is nothing to add.
 */
export function attachNecklinePrintInstructions(
  rows: readonly SleevelessPatternDisplayRow[],
  timeline: readonly RowEntry[] | undefined,
  rowCounterOrigin?: number | null,
): SleevelessPatternDisplayRow[] {
  const written = writtenNeckShoulderPrintParagraphs(timeline, { rowCounterOrigin });
  if (written.length === 0) return [...rows];
  let section = "";
  let attached = false;
  return rows.map((row) => {
    if (row.kind === "section") {
      section = row.title ?? "";
      return row;
    }
    if (attached || row.kind !== "block") return row;
    if (!/neckline|shoulder/i.test(section)) return row;
    const texts = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
    if (!texts.some((text) => isPatternPrintChecklistPointer(text))) return row;
    attached = true;
    return { ...row, printInstructionParagraphs: written };
  });
}

function expandChartAction(action: string): string {
  return action.replace(/\bDec\b/g, "Decrease").replace(/\bInc\b/g, "Increase");
}

/** One line per A-line chart row, using that row's counter, action, and stitches remaining. */
export function alinePrintWrittenParagraphs(
  rows: readonly { rc: number; action: string; stitchesRemaining: number }[] | undefined,
): string[] {
  if (!rows || rows.length === 0) return [];
  return [
    "A-line shaping readings. These row-counter readings and stitch counts are the same as the A-line shaping chart.",
    ...rows.map(
      (row) =>
        `${formatRcLabel(row.rc)}. ${expandChartAction(row.action)}. ${row.stitchesRemaining} stitches remain.`,
    ),
  ];
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
