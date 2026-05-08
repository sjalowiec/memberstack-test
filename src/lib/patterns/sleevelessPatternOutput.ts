/**
 * Plain-text pattern output for sleeveless garments (machine knitting).
 * First slice: BACK piece only — no finishing, pickup, or armhole pickup blocks.
 */

import { calculateArmholeShaping, type ArmholeResult } from "./legoBlocks/armholeBlock";
import {
  generateNeckShoulderExecution,
  shapingActionsFromTimeline,
  type CenterBindOffExecutionText,
  type NeedleRange,
  type ShapingAction,
} from "./legoBlocks/neckShoulderExecution";
import { calculateBasicPatternNumbers } from "./patternCalculator";
import { calculateHemRows } from "./hemDefaults";
import {
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderTimelineAndChartRows,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";
import { computeShoulderBindoffSchedule, type RowEntry } from "./shapingTimeline";
import {
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
} from "./legoBlocks/roundNeckline";

/**
 * Trusted HTML for ribbed-hem helper (mock ribbing / hung hem tooltips).
 * Same wording as hat brim tip — render only via innerHTML from pattern output, never user input.
 */
export const RIBBED_HEM_PATTERN_TIP_HTML =
  'Work even in your chosen hem treatment — for example 1x1 or 2x2 ribbing or <span class="pattern-term" data-tooltip="Stitch pattern that copies knit and purl ribbing by having needles out of work. A favorite for knitters without a ribber.">mock ribbing</span>, a rolled stockinette edge, a fold-up band, or a <span class="pattern-term" data-tooltip="A folded, double-layer hem formed by hanging the cast-on stitches back onto the needles.">hung hem</span> — for the depth shown.';

/** Trusted HTML for collapsible body-shaping marker tip (glossary id 310). */
export const BODY_MARKER_TIP_DETAILS_HTML =
  '<details class="pattern-tip sleeveless-shaping-help-toggle"><summary>Tip: Use markers to track shaping</summary><p>Many machine knitters place small removable <span class="pattern-term" data-glossary-id="310" data-tooltip="Hang a contrasting loop on the edge needle to locate a specific row or checkpoint later.">markers</span> directly into the edge of the fabric at shaping rows or length checkpoints. This makes it easier to verify your progress while the garment is still on the machine.</p></details>';

/** Row/stitch audit for console — verify math before changing pattern wording. */
export type SleevelessBackPatternDebug = {
  finishedBustChest: number | undefined;
  stitchesPerInch: number;
  rowsPerInch: number;
  backStitches: number;
  /** Chart shoulder width (inches) from selected measurements. */
  shoulderWidthInches: number | undefined;
  /** B — stitch count after armhole (shoulder width × sts/in from calculator). */
  stitchesAfterArmhole: number | undefined;
  /** A − B total stitches removed in armhole shaping. */
  armholeStitchesTotal: number | undefined;
  /** (A − B) / 2 per armhole side. */
  armholeStitchesEachSide: number | undefined;
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  necklineShoulderRows: number;
  totalCalculatedRows: number;
  expectedGarmentRows: number;
  backNeckToHem: number | undefined;
  armholeDepth: number | undefined;
  bodyInchesToArmhole: number | undefined;
  reservedNecklineShoulderInches: number;
  reservedNecklineShoulderRows: number;
  remainingRowsBeforeNeckline: number;
  /** Neck opening width in inches (neck_width or neck_opening / neckOpening). */
  necklineWidthInches: number | undefined;
  /** N — neckline stitch count from neck opening × gauge (relative to B). */
  necklineStitches: number | undefined;
  /** Initial center bind-off/hold (round-neck formula), not full neckline width. */
  centerNeckBindOffStitches: number | undefined;
  /** Inner-neck edge decreases per side after center row — (N − center) / 2 from round-neck formula. */
  sideNeckShapingStitchesPerSide: number;
  /** Each shoulder: (B − N) / 2 after armhole. */
  shoulderStitches: number | undefined;
  /** B − N — stitches for both shoulders together. */
  stitchesAfterNeckline: number | undefined;
  frontNeckDepth: number | undefined;
  /** Front neck depth in rows — shifts neckline start RC earlier; shaping chart matches back (same span). */
  frontNeckDepthRows: number;
  /** Back neck depth in rows — unified timeline row budget with shoulder shaping. */
  backNeckDepthRows: number;
  /** RC rows for shoulder bind-off placement span (1" at row gauge). */
  shoulderBindoffRows: number | undefined;
  /** RC where back neckline / shoulder block begins (same total stitches as front; front may start earlier). */
  backNecklineStartRC: number;
  frontNecklineStartRC: number;
  finalRC: number;
  /** First RC of armhole shaping (bind-off row); `undefined` when armhole math is unavailable. */
  armholeStartRow?: number;
  /** Last RC of the armhole block (after decreases + work-even rows). */
  armholeEndRow?: number;
  /** First RC where shoulder bind-offs occur on the back timeline. */
  shoulderStartRow?: number;
  /** Final RC of the back piece (must equal `expectedGarmentRows` when length math is valid). */
  backFinalRow?: number;
  /** Final RC of the front piece (must equal `expectedGarmentRows` and `backFinalRow`). */
  frontFinalRow?: number;
  /** First / last `row` column on {@link frontNeckShoulderShapingChart}. */
  frontChartFirstRowRc?: number;
  frontChartLastRowRc?: number;
  /** Passed to {@link buildTimeline} as center-bind-off row for back (must match chart column `row`). */
  backFirstShapingRowPassedToTimeline?: number;
  /** Passed to {@link buildTimeline} as center-bind-off row for front (must match chart column `row`). */
  frontFirstShapingRowPassedToTimeline?: number;
  /** First / last RC on back neckline timeline (chart + SVG + execution shaping RCs). */
  backNeckShoulderTimelineFirstRC?: number;
  backNeckShoulderTimelineLastRC?: number;
  /** First / last RC on front neckline timeline. */
  frontNeckShoulderTimelineFirstRC?: number;
  frontNeckShoulderTimelineLastRC?: number;
  /** Min / max RC parsed from merged execution lines (neck + shoulder schedule). */
  frontExecutionRcMin?: number;
  frontExecutionRcMax?: number;
  /** First / last RC used by shoulder SVG when chart carries `timeline` (same as timeline bounds). */
  frontSvgFirstRc?: number;
  frontSvgLastRc?: number;
};

/** Two-column pattern UI: piece banner, section title, or instruction block with optional stitch count. */
export type SleevelessPatternDisplayRow =
  | { kind: "piece"; title: string }
  | { kind: "section"; title: string }
  /** Filled client-side with chart table (see pattern tab). */
  | { kind: "neckShoulderChartTableMount" }
  /** Filled client-side with shape preview SVG (see pattern tab); rendered below two-column piece layout. */
  | { kind: "neckShoulderChartPreviewMount" }
  | {
      kind: "block";
      /** e.g. RC:014 — optional when block is prose-only */
      rc?: string;
      paragraphs: string[];
      /** Trusted HTML only (e.g. {@link RIBBED_HEM_PATTERN_TIP_HTML}); rendered as innerHTML in the pattern tab. */
      tipHtml?: string;
      /** Trusted HTML for expandable tip blocks (`<details>` UI). */
      collapsibleTipHtml?: string;
      /** Total stitches on the piece after this block; right column only when different from last shown */
      stitchCount?: number;
    };

export type SleevelessBackPatternResult = {
  warnings: string[];
  /** Plain lines derived from {@link displayRows} (debug / console). */
  lines: string[];
  /** Structured back instructions for two-column rendering. */
  displayRows: SleevelessPatternDisplayRow[];
  /** Structured front instructions (reuses back through armhole by reference). */
  frontDisplayRows: SleevelessPatternDisplayRow[];
  debug: SleevelessBackPatternDebug;
  /** Row-by-row neckline / shoulder chart — source of truth for printed table and SVG. */
  neckShoulderShapingChart: NeckShoulderShapingChart;
  /** Front neckline/shoulder chart — same stitch math and row span as back; start RC differs when front neck is deeper. */
  frontNeckShoulderShapingChart: NeckShoulderShapingChart;
  /** True when chart rows were generated from back calculations; false when demo fallback is used. */
  neckShoulderChartUsesLiveRows: boolean;
  frontNeckShoulderChartUsesLiveRows: boolean;
  /** Single source of truth for back chart + SVG + execution shaping RCs (when live rows). */
  backNeckShoulderTimeline?: RowEntry[];
  /** Single source of truth for front chart + SVG + execution shaping RCs (when live rows). */
  frontNeckShoulderTimeline?: RowEntry[];
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function pickAudience(patternData: Record<string, unknown>): string | undefined {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  const chart = fit.sizingChart ?? fit.knitFor;
  if (typeof chart === "string" && chart.trim()) return chart.trim();
  const cat = style.recipientCategory;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  return undefined;
}

function selectedMeasurements(patternData: Record<string, unknown>): Record<string, unknown> {
  const fit = section(patternData.fit);
  const sm = fit.selectedMeasurements;
  if (sm && typeof sm === "object" && !Array.isArray(sm)) {
    return sm as Record<string, unknown>;
  }
  return {};
}

/** Positive measurement from selectedMeasurements or fallback. */
function measurementInches(sm: Record<string, unknown>, key: string): number | undefined {
  const v = sm[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Optional whole-stitch count from selectedMeasurements (builder / persisted JSON). */
function optionalNonNegativeStitchCount(sm: Record<string, unknown>, key: string): number | undefined {
  const v = sm[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

/**
 * Half-bust stitch count for the back piece (one half of finished circumference).
 */
function backStitchesFromPattern(bustChestStitches: number): number {
  if (!Number.isFinite(bustChestStitches) || bustChestStitches <= 0) return 0;
  return Math.round(bustChestStitches / 2);
}

/** Row counter label for pattern text: `RC:000` (no space after colon). */
export function formatRcColon(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC:${String(n).padStart(3, "0")}`;
}

type ArmholeRcPlan = {
  endRC: number;
  totalRows: number;
};

/**
 * Armhole row budget: two bind-off rows, decrease phase, then work even.
 */
function planArmholeRcRange(result: ArmholeResult, firstArmholeRC: number): ArmholeRcPlan {
  const { decreaseRows, evenRows } = result;
  const totalRows = 2 + decreaseRows + evenRows;
  const endRC = firstArmholeRC + totalRows - 1;
  return { endRC, totalRows };
}

function tipHtmlToPlainLine(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenDisplayRowsToLines(rows: readonly SleevelessPatternDisplayRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (r.kind === "piece") {
      out.push(r.title, "");
    } else if (r.kind === "section") {
      out.push(r.title, "");
    } else if (r.kind === "neckShoulderChartTableMount") {
      out.push("Neckline / shoulder shaping chart", "");
    } else if (r.kind === "neckShoulderChartPreviewMount") {
      out.push("Neckline / shoulder shape preview", "");
    } else {
      if (r.rc) out.push(r.rc);
      for (const p of r.paragraphs) {
        if (p.trim()) out.push(p);
      }
      if (r.tipHtml) out.push(tipHtmlToPlainLine(r.tipHtml));
      if (r.collapsibleTipHtml) out.push(tipHtmlToPlainLine(r.collapsibleTipHtml));
      if (r.stitchCount !== undefined) out.push(`${r.stitchCount} sts`);
      out.push("");
    }
  }
  return out;
}

/** Plain continuation only — single paragraph, no stitch-count column (presentation merge). */
const PLAIN_KNIT_PATTERN_FOR_ROWS_RE = /^Knit in pattern for (\d+) rows?\.?$/i;

const PLAIN_KNIT_UNTIL_RC_RE = /^Knit in pattern until RC (\d{1,4})\.\s*$/i;

/** Preferred plain-span wording: next instruction row RC (not the last work-even RC). */
const KNIT_TO_RC_RE = /^Knit to RC (\d{1,4})\.\s*$/i;

/** Legacy front-clamp parsing (older saved display rows). */
const KNIT_EVEN_ROWS_TO_RC_RE = /^Knit (\d+) rows even \(to RC (\d{1,4})\)\.\s*$/i;
const KNIT_ONE_ROW_EVEN_TO_RC_RE = /^Knit 1 row even \(to RC (\d{1,4})\)\.\s*$/i;

function extractPlainKnitPatternRowCount(paragraph: string): number | undefined {
  const m = paragraph.trim().match(PLAIN_KNIT_PATTERN_FOR_ROWS_RE);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function extractPlainKnitUntilRcTarget(paragraph: string): number | undefined {
  const m = paragraph.trim().match(PLAIN_KNIT_UNTIL_RC_RE);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function extractKnitToRcTarget(paragraph: string): number | undefined {
  const m = paragraph.trim().match(KNIT_TO_RC_RE);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Last RC of a plain span when the block header is the span start RC and `rowCount` plain rows are worked.
 * Next shaping / action row RC = startRc + rowCount.
 */
function plainSpanLastRc(startRc: number, rowCount: number): number {
  const s = Math.max(0, Math.floor(startRc));
  const n = Math.max(0, Math.floor(rowCount));
  return s + n - 1;
}

/** RC of the first row where the next instruction applies, after working `rowCount` plain rows from `startRc`. */
function plainSpanNextActionRc(startRc: number, rowCount: number): number {
  const s = Math.max(0, Math.floor(startRc));
  const n = Math.max(0, Math.floor(rowCount));
  return s + n;
}

/**
 * Plain span to a known next action row (same RC as the following instruction block).
 * When `startRc` is omitted, falls back to row-count-only wording (no RC anchor).
 * Returns an empty string when `rowCount` is zero so callers can omit the line/block.
 */
export function formatPlainKnitInPatternSpan(rowCount: number, startRc?: number): string {
  const n = Math.max(0, Math.floor(rowCount));
  if (n <= 0) return "";
  const start =
    startRc !== undefined && Number.isFinite(startRc) ? Math.max(0, Math.floor(startRc)) : undefined;
  if (start === undefined) {
    return n === 1 ? "Knit in pattern for 1 row." : `Knit in pattern for ${n} rows.`;
  }
  const nextAction = plainSpanNextActionRc(start, n);
  return `Knit to RC ${nextAction}.`;
}

/** Non-empty paragraph list for a plain span, or `[]` when the span has zero rows. */
function plainKnitSpanParagraphs(rowCount: number, startRc?: number): string[] {
  const line = formatPlainKnitInPatternSpan(rowCount, startRc).trim();
  return line ? [line] : [];
}

function plainSpanRowCountFromParagraph(
  paragraph: string,
  blockStartRc: number | undefined
): number | undefined {
  const knitTo = extractKnitToRcTarget(paragraph);
  if (knitTo !== undefined && blockStartRc !== undefined) {
    const rows = knitTo - blockStartRc;
    return rows > 0 ? rows : undefined;
  }
  const forN = extractPlainKnitPatternRowCount(paragraph);
  if (forN !== undefined) return forN;
  const end = extractPlainKnitUntilRcTarget(paragraph);
  if (end === undefined || blockStartRc === undefined) return undefined;
  // Legacy: "until RC Y" gave last plain row Y; next action is Y + 1.
  return end - blockStartRc + 1;
}

function extractKnitEvenRowsToRc(paragraph: string): { rows: number; endRc: number } | undefined {
  const t = paragraph.trim();
  const m1 = t.match(KNIT_EVEN_ROWS_TO_RC_RE);
  if (m1) {
    const rows = parseInt(m1[1], 10);
    const endRc = parseInt(m1[2], 10);
    if (!Number.isFinite(rows) || rows <= 0 || !Number.isFinite(endRc)) return undefined;
    return { rows, endRc };
  }
  const m2 = t.match(KNIT_ONE_ROW_EVEN_TO_RC_RE);
  if (m2) {
    const endRc = parseInt(m2[1], 10);
    if (!Number.isFinite(endRc)) return undefined;
    return { rows: 1, endRc };
  }
  return undefined;
}

/** Plain span from current wording + optional block RC (supports legacy “rows even (to RC …)”). */
function extractPlainSpanRowsAndEndRc(
  paragraph: string,
  blockStartRc: number | undefined
): { rows: number; endRc: number } | undefined {
  const even = extractKnitEvenRowsToRc(paragraph);
  if (even !== undefined) return even;
  const knitTo = extractKnitToRcTarget(paragraph);
  if (knitTo !== undefined && blockStartRc !== undefined) {
    const rows = knitTo - blockStartRc;
    if (rows > 0) return { rows, endRc: knitTo - 1 };
  }
  const until = extractPlainKnitUntilRcTarget(paragraph);
  if (until !== undefined && blockStartRc !== undefined) {
    const rows = until - blockStartRc + 1;
    if (rows > 0) return { rows, endRc: until };
  }
  const forN = extractPlainKnitPatternRowCount(paragraph);
  if (forN !== undefined && blockStartRc !== undefined) {
    return { rows: forN, endRc: plainSpanLastRc(blockStartRc, forN) };
  }
  return undefined;
}

/** Inverse of {@link formatRcColon} for clamping front shared rows. */
function parseRcColonLabel(rcLabel: string | undefined): number | undefined {
  if (!rcLabel) return undefined;
  const m = String(rcLabel).trim().match(/^RC:(\d{1,4})$/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Front neckline often begins before the back neckline RC. Shared back execution rows can include
 * upper-body plain spans that run past the front neck start — trim or omit those so front
 * RCs never rewind before the FRONT NECKLINE & SHOULDERS section.
 */
function clampFrontSharedRowsBeforeNeckStart(
  rows: readonly SleevelessPatternDisplayRow[],
  frontNecklineStartRC: number
): SleevelessPatternDisplayRow[] {
  const neckFirst = Math.max(0, Math.floor(frontNecklineStartRC));
  if (neckFirst <= 0) return [...rows];

  const out: SleevelessPatternDisplayRow[] = [];

  for (const row of rows) {
    if (row.kind !== "block") {
      out.push(row);
      continue;
    }

    const startRc = parseRcColonLabel(row.rc);
    if (startRc !== undefined && startRc >= neckFirst) {
      continue;
    }

    const maxPlainRows =
      startRc !== undefined ? Math.max(0, neckFirst - startRc) : Number.POSITIVE_INFINITY;

    const newParagraphs: string[] = [];
    for (const p of row.paragraphs) {
      const span = extractPlainSpanRowsAndEndRc(p, startRc);
      if (span !== undefined && startRc !== undefined) {
        const clamped =
          maxPlainRows === Number.POSITIVE_INFINITY ? span.rows : Math.min(span.rows, maxPlainRows);
        if (clamped <= 0) continue;
        const spanLine = formatPlainKnitInPatternSpan(clamped, startRc);
        if (spanLine.trim()) newParagraphs.push(spanLine);
        continue;
      }

      newParagraphs.push(p);
    }

    if (newParagraphs.length === 0) continue;

    out.push({
      ...row,
      paragraphs: newParagraphs,
    });
  }

  return out;
}

function isMergeablePlainKnitBlock(
  row: SleevelessPatternDisplayRow
): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> & { paragraphs: [string] } {
  if (row.kind !== "block") return false;
  if (row.tipHtml) return false;
  if (row.collapsibleTipHtml) return false;
  if (row.stitchCount !== undefined) return false;
  if (row.paragraphs.length !== 1) return false;
  const p = row.paragraphs[0];
  const start = parseRcColonLabel(row.rc);
  if (extractPlainKnitPatternRowCount(p) !== undefined) return true;
  if (extractKnitToRcTarget(p) !== undefined) return start !== undefined;
  return start !== undefined && extractPlainKnitUntilRcTarget(p) !== undefined;
}

/**
 * Merge consecutive plain RC-targeted span blocks (“Knit to RC …” / legacy “Knit in pattern …”) into one
 * line with summed rows and the first RC. Sections/pieces break adjacency automatically.
 */
function mergeAdjacentPlainKnitBlocks(
  rows: readonly SleevelessPatternDisplayRow[]
): SleevelessPatternDisplayRow[] {
  const out: SleevelessPatternDisplayRow[] = [];
  let i = 0;
    while (i < rows.length) {
    const row = rows[i];
    if (row.kind === "neckShoulderChartTableMount" || row.kind === "neckShoulderChartPreviewMount") {
      out.push(row);
      i++;
      continue;
    }
    if (!isMergeablePlainKnitBlock(row)) {
      out.push(row);
      i++;
      continue;
    }

    let total = plainSpanRowCountFromParagraph(row.paragraphs[0], parseRcColonLabel(row.rc))!;
    const firstRc = row.rc;
    let j = i + 1;
    while (j < rows.length) {
      const candidate = rows[j];
      if (!isMergeablePlainKnitBlock(candidate)) break;
      total += plainSpanRowCountFromParagraph(candidate.paragraphs[0], parseRcColonLabel(candidate.rc))!;
      j++;
    }

    if (j > i + 1) {
      const mergedLine = formatPlainKnitInPatternSpan(total, parseRcColonLabel(firstRc));
      if (mergedLine.trim()) {
        out.push({
          kind: "block",
          rc: firstRc,
          paragraphs: [mergedLine],
        });
      }
      i = j;
    } else {
      out.push(row);
      i++;
    }
  }
  return out;
}

function parseChartCellDelta(cell: string): number {
  const t = cell.trim();
  if (t === "-" || t === "") return 0;
  const m = t.match(/^-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Sum center bind-off stitches on the first timeline row (partial or full neckline width). */
function centerBindOffAmountFirstTimelineRow(timeline: readonly RowEntry[]): number {
  const row0 = timeline[0];
  if (!row0) return 0;
  return row0.events
    .filter((e) => e.kind === "bindOff" && e.side === "center" && e.edge === "center")
    .reduce((s, e) => s + e.amount, 0);
}

function stitchCountPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  return k === 1 ? "1 stitch" : `${k} stitches`;
}

/**
 * Parenthetical for how the center bind-off spans needle 0 — floor/ceil split when N is odd
 * (matches common machine-bed convention).
 */
export function formatCenterNecklineBindOffAroundZeroPhrase(totalCenterBindOff: number): string {
  const N = Math.max(0, Math.floor(totalCenterBindOff));
  if (N <= 0) return "";
  if (N === 1) return "1 stitch at the center (needle 0)";
  const leftOf = Math.floor(N / 2);
  const rightOf = N - leftOf;
  if (leftOf === rightOf) return `${leftOf} stitches on each side of 0`;
  return `${leftOf} stitches left of 0, ${rightOf} stitches right of 0`;
}

/** Remaining shoulder-side stitches after the center bind-off (from chart row 0). */
export function formatShouldersRemainingAfterCenterBindOffPhrase(
  stitchesLeftAfter: number,
  stitchesRightAfter: number
): string {
  const L = Math.max(0, Math.floor(stitchesLeftAfter));
  const R = Math.max(0, Math.floor(stitchesRightAfter));
  if (L === R) return `${stitchCountPhrase(L)} on each side`;
  return `${stitchCountPhrase(L)} on the left and ${stitchCountPhrase(R)} on the right`;
}

/** Preamble-style execution (scrap/bind workflow block): knit to center, then bind off with full counts. */
export function formatCenterNecklineBindOffPreambleExecution(args: {
  totalCenterBindOff: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  const N = Math.max(0, Math.floor(args.totalCenterBindOff));
  const around = formatCenterNecklineBindOffAroundZeroPhrase(N);
  const shoulders = formatShouldersRemainingAfterCenterBindOffPhrase(
    args.stitchesLeftAfter,
    args.stitchesRightAfter
  );
  const centerWord = N === 1 ? "stitch" : "stitches";
  return `Knit to center. Bind off the center ${N} ${centerWord} (${around}). You now have ${shoulders}. Work each side separately.`;
}

/** RC-targeted shaping sentence (same counts as preamble; no “Knit to center” — RC already anchors position). */
export function formatCenterNecklineBindOffShapingExecution(args: {
  totalCenterBindOff: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  const N = Math.max(0, Math.floor(args.totalCenterBindOff));
  const around = formatCenterNecklineBindOffAroundZeroPhrase(N);
  const shoulders = formatShouldersRemainingAfterCenterBindOffPhrase(
    args.stitchesLeftAfter,
    args.stitchesRightAfter
  );
  const centerWord = N === 1 ? "stitch" : "stitches";
  return `Bind off the center ${N} ${centerWord} (${around}). You now have ${shoulders}. Work each side separately.`;
}

function centerBindOffExecutionTextFromChartRow(
  timeline: readonly RowEntry[],
  chartRow0: NeckShoulderShapingChartRow | undefined
): CenterBindOffExecutionText | undefined {
  if (!timeline.length || !chartRow0) return undefined;
  const nCenter = centerBindOffAmountFirstTimelineRow(timeline);
  if (nCenter <= 0) return undefined;
  return {
    preambleLine: formatCenterNecklineBindOffPreambleExecution({
      totalCenterBindOff: nCenter,
      stitchesLeftAfter: chartRow0.leftStitchCount,
      stitchesRightAfter: chartRow0.rightStitchCount,
    }),
    shapingAtRcLine: formatCenterNecklineBindOffShapingExecution({
      totalCenterBindOff: nCenter,
      stitchesLeftAfter: chartRow0.leftStitchCount,
      stitchesRightAfter: chartRow0.rightStitchCount,
    }),
  };
}

/** Preamble line “RC: X” — row before first shaping row on the timeline (knit through X, then shape at X+1). */
function preambleStartRcBeforeFirstShapingRow(firstShapingRow: number): number {
  return Math.max(0, Math.floor(firstShapingRow) - 1);
}

function timelineRcBounds(timeline: readonly RowEntry[] | undefined): {
  first?: number;
  last?: number;
} {
  if (!timeline?.length) return {};
  const rows = timeline.map((e) => e.row);
  return { first: Math.min(...rows), last: Math.max(...rows) };
}

/** Scan plain execution lines for RC: n and RC: n–m (merged span headers). */
function parseRcBoundsFromExecutionLines(lines: readonly string[]): {
  min?: number;
  max?: number;
} {
  const nums: number[] = [];
  for (const line of lines) {
    for (const m of line.matchAll(/\bRC:\s*(\d{1,4})\b/g)) {
      nums.push(parseInt(m[1], 10));
    }
  }
  if (nums.length === 0) return {};
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Published neckline/shoulder prose when chart + SVG carry row-by-row detail. */
const NECKLINE_SHOULDER_INSTRUCTION_PARAGRAPHS: readonly string[] = [
  "After the center bind-off, place one shoulder on hold and work one shoulder at a time. Follow the shaping instructions row by row for the shoulder being worked, then repeat the same shaping for the second shoulder.",
];

/**
 * Short summary for BACK NECKLINE & SHOULDERS — chart row 0 overrides bind-off count when live rows are present.
 */
function backNecklineShoulderSummaryParagraphs(args: {
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  shoulderStitches?: number;
  /** Optional note for front display — ignored when chart row 0 supplies center bind-off. */
  scoopFirstCenterBindOff?: number;
}): string[] | null {
  let leftS: number | undefined;
  let rightS: number | undefined;

  const nFit = args.necklineStitches;
  const sFit = args.shoulderStitches;
  if (sFit !== undefined && sFit > 0) {
    leftS = sFit;
    rightS = sFit;
  }

  let bindOffCenter =
    nFit !== undefined && nFit > 0 ? initialCenterNeckStitches(nFit) : undefined;

  if (args.neckChartRows.length > 0) {
    const r0 = args.neckChartRows[0];
    const dc = parseChartCellDelta(r0.centerNeck);
    if (dc > 0) bindOffCenter = dc;
    if (leftS === undefined || leftS <= 0) leftS = r0.leftStitchCount;
    if (rightS === undefined || rightS <= 0) rightS = r0.rightStitchCount;
  }

  const totalNeck = nFit;

  if (
    bindOffCenter === undefined ||
    leftS === undefined ||
    rightS === undefined ||
    bindOffCenter <= 0 ||
    leftS <= 0 ||
    rightS <= 0 ||
    totalNeck === undefined ||
    totalNeck <= 0
  ) {
    return null;
  }

  return [...NECKLINE_SHOULDER_INSTRUCTION_PARAGRAPHS];
}

export function buildSleevelessBackDisplayRows(args: {
  castOnSts: number;
  hemRows: number;
  hemRowsValid: boolean;
  bodyToArmholeRows: number;
  bodyRowsValid: boolean;
  armholeMath: ArmholeResult | null;
  firstArmholeRC: number | null;
  stitchesAfterArmhole: number | undefined;
  upperBackRows: number;
  upperStartRc: number;
  evenRowPadRows: number;
  padStartRc: number;
  /**
   * Back neckline first shaping row — when set with upper-back / pad rows, those plain rows are
   * emitted as one RC-targeted plain span immediately before BACK NECKLINE & SHOULDERS.
   */
  backNecklineStartRC?: number;
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  useNeckChartRows: boolean;
  necklineStitches?: number;
  shoulderStitches?: number;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "BACK" });
  let carriedAfterArmholeSts =
    args.stitchesAfterArmhole !== undefined && args.stitchesAfterArmhole > 0
      ? args.stitchesAfterArmhole
      : undefined;

  const A = args.castOnSts;
  const ribs = args.hemRows;
  const hemRcLabel = formatRcColon(0);

  rows.push({
    kind: "block",
    rc: hemRcLabel,
    paragraphs:
      A > 0
        ? [`Cast on ${A} stitches for the back.`]
        : [
            "Cast-on stitch count could not be calculated from your measurements. Add finished bust or chest and stitch gauge in the builder, then open this tab again.",
          ],
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "RIBBED HEM" });
  rows.push({
    kind: "block",
    rc: hemRcLabel,
    paragraphs: args.hemRowsValid
      ? plainKnitSpanParagraphs(ribs, 0)
      : [
          "Hem rows could not be calculated — check row gauge and sizing chart. Knit your hem to the depth you prefer, then continue.",
        ],
    tipHtml: args.hemRowsValid ? RIBBED_HEM_PATTERN_TIP_HTML : undefined,
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "BODY" });
  rows.push({
    kind: "block",
    rc: formatRcColon(ribs),
    paragraphs: args.bodyRowsValid
      ? plainKnitSpanParagraphs(args.bodyToArmholeRows, ribs)
      : [
          "Body length to the armhole could not be calculated. Confirm back neck to hem, armhole depth, and row gauge in Fit, then try again.",
        ],
    collapsibleTipHtml: BODY_MARKER_TIP_DETAILS_HTML,
    stitchCount: A > 0 ? A : undefined,
  });

  const plainRowsBeforeBackNeck = args.upperBackRows + args.evenRowPadRows;
  const backNeckFirstRc =
    args.backNecklineStartRC !== undefined && args.backNecklineStartRC > 0
      ? Math.max(0, Math.floor(args.backNecklineStartRC))
      : undefined;
  /**
   * Anchor the bridge to the actual first neckline shaping RC so the visible span matches the
   * chart/timeline. Start RC is derived from `neckStartRC − N` so it stays consistent with the
   * row budget (N = upper-back + pad rows) even when the stored `upperStartRc` label differs by
   * one from the closed RC interval [start, end].
   */
  const bridgeEndRc =
    backNeckFirstRc !== undefined && backNeckFirstRc > 0 ? backNeckFirstRc - 1 : undefined;
  const nBridge = plainRowsBeforeBackNeck;
  const bridgeStartRcFromNeck =
    bridgeEndRc !== undefined && nBridge > 0 ? bridgeEndRc - nBridge + 1 : undefined;
  const useRcBridgingToNeck =
    backNeckFirstRc !== undefined &&
    nBridge > 0 &&
    bridgeEndRc !== undefined &&
    bridgeStartRcFromNeck !== undefined &&
    bridgeStartRcFromNeck >= 0;

  rows.push({ kind: "section", title: "ARMHOLE" });

  if (
    args.armholeMath &&
    args.firstArmholeRC !== null &&
    A > 0 &&
    args.stitchesAfterArmhole !== undefined &&
    args.stitchesAfterArmhole > 0 &&
    args.stitchesAfterArmhole < A
  ) {
    const m = args.armholeMath;
    const first = args.firstArmholeRC;
    const bo = m.bindOffSts;
    const afterBo1 = A - bo;
    const afterBo2 = A - 2 * bo;
    const decreasesTotal = 2 * Math.max(0, m.decreaseSts);
    const B = afterBo2 - decreasesTotal;
    const decStart = first + 2;
    const lastDecreaseRc = decStart + 2 * (m.decreaseSts - 1);
    const decreaseRowParityWord = decStart % 2 === 1 ? "odd" : "even";

    let postArmholeInstructionRc: number | undefined;
    if (m.evenRows > 0) {
      postArmholeInstructionRc = first + 2 + m.decreaseRows;
    } else if (useRcBridgingToNeck) {
      postArmholeInstructionRc = bridgeStartRcFromNeck;
    } else if (args.upperBackRows > 0) {
      postArmholeInstructionRc = args.upperStartRc;
    } else if (args.evenRowPadRows > 0) {
      postArmholeInstructionRc = args.padStartRc;
    }

    rows.push({
      kind: "block",
      rc: formatRcColon(first),
      paragraphs: [
        `At RC ${first}, bind off ${bo} stitches at the armhole edge (carriage side). Knit across.`,
      ],
      // Display stitches at row start; row action applies after this row.
      stitchCount: A,
    });
    rows.push({
      kind: "block",
      rc: formatRcColon(first + 1),
      paragraphs: [
        `At RC ${first + 1}, bind off ${bo} stitches at the remaining armhole edge (carriage side). Knit across.`,
      ],
      stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
    });

    if (m.decreaseSts > 0) {
      rows.push({
        kind: "block",
        rc: formatRcColon(decStart),
        paragraphs: [
          `At RC ${decStart}, at each armhole edge, decrease 1 stitch every other row, ${m.decreaseSts} times total.`,
          `Work decreases on ${decreaseRowParityWord} rows from RC ${decStart} through RC ${lastDecreaseRc}.`,
        ],
        stitchCount: afterBo2 > 0 ? afterBo2 : undefined,
      });
    }

    const armholeBridgeRc =
      m.decreaseSts > 0 &&
      postArmholeInstructionRc !== undefined &&
      lastDecreaseRc < postArmholeInstructionRc - 1
        ? postArmholeInstructionRc - 1
        : undefined;
    if (armholeBridgeRc !== undefined) {
      rows.push({
        kind: "block",
        rc: formatRcColon(armholeBridgeRc),
        paragraphs: [`At RC ${armholeBridgeRc}, knit even. ${B} sts remain.`],
        stitchCount: B > 0 ? B : undefined,
      });
    }

    if (m.evenRows > 0) {
      const evStart = first + 2 + m.decreaseRows;
      const evParas = plainKnitSpanParagraphs(m.evenRows, evStart);
      if (evParas.length > 0) {
        rows.push({
          kind: "block",
          rc: formatRcColon(evStart),
          paragraphs: evParas,
          stitchCount: B > 0 ? B : undefined,
        });
      }
    }
    carriedAfterArmholeSts = B > 0 ? B : carriedAfterArmholeSts;
  } else {
    rows.push({
      kind: "block",
      paragraphs: [
        "Armhole shaping could not be generated. In Fit, confirm armhole depth, shoulder width, finished bust or chest, and stitch gauge so shoulder stitch count can be calculated.",
      ],
    });
  }

  if (useRcBridgingToNeck) {
    const bridgeStartRc = bridgeStartRcFromNeck;
    const n = nBridge;
    const bridgeParas = plainKnitSpanParagraphs(n, bridgeStartRc);
    if (bridgeParas.length > 0) {
      rows.push({
        kind: "block",
        rc: formatRcColon(bridgeStartRc),
        paragraphs: bridgeParas,
        stitchCount:
          carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
            ? carriedAfterArmholeSts
            : undefined,
      });
    }
  } else {
    if (args.upperBackRows > 0) {
      const upperParas = plainKnitSpanParagraphs(args.upperBackRows, args.upperStartRc);
      if (upperParas.length > 0) {
        rows.push({
          kind: "block",
          rc: formatRcColon(args.upperStartRc),
          paragraphs: upperParas,
          stitchCount:
            carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
              ? carriedAfterArmholeSts
              : undefined,
        });
      }
    }
    if (args.evenRowPadRows > 0) {
      const padParas = plainKnitSpanParagraphs(args.evenRowPadRows, args.padStartRc);
      if (padParas.length > 0) {
        rows.push({
          kind: "block",
          rc: formatRcColon(args.padStartRc),
          paragraphs: padParas,
          stitchCount:
            carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
              ? carriedAfterArmholeSts
              : undefined,
        });
      }
    }
  }

  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
    });
    if (summary) {
      rows.push({ kind: "block", paragraphs: summary });
    } else {
      rows.push({
        kind: "block",
        paragraphs: [
          "Set neck opening width (and shoulder width) in the builder to generate row-by-row neckline and shoulder steps.",
        ],
      });
    }
  } else if (
    args.necklineStitches !== undefined &&
    args.shoulderStitches !== undefined &&
    args.necklineStitches > 0 &&
    args.shoulderStitches > 0
  ) {
    rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
    });
    rows.push({
      kind: "block",
      paragraphs:
        summary ??
        [
          "Neckline summary could not be generated. Confirm neck opening and shoulder width in Fit, then open this tab again.",
        ],
    });
  } else {
    rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
    rows.push({
      kind: "block",
      paragraphs: [
        "Set neck opening width (and shoulder width) in the builder to generate row-by-row neckline and shoulder steps.",
      ],
    });
  }

  rows.push({ kind: "neckShoulderChartTableMount" });
  rows.push({ kind: "neckShoulderChartPreviewMount" });

  return rows;
}

export function buildSleevelessFrontDisplayRows(args: {
  frontNecklineStartRC: number;
  sharedExecutionRows: readonly SleevelessPatternDisplayRow[];
  useNeckChartRows: boolean;
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  shoulderStitches?: number;
  /** When set and less than {@link necklineStitches}, summary describes partial first bind-off + gradual scoop. */
  scoopFirstCenterBindOff?: number;
}): SleevelessPatternDisplayRow[] {
  const sharedRows = args.sharedExecutionRows
    .filter((row) => {
      if (row.kind === "piece") return false;
      if (row.kind === "section" && row.title === "BACK NECKLINE & SHOULDERS") return false;
      if (row.kind === "neckShoulderChartTableMount" || row.kind === "neckShoulderChartPreviewMount") {
        return false;
      }
      return true;
    })
    .map((row): SleevelessPatternDisplayRow => {
      if (row.kind !== "block") return row;
      return {
        ...row,
        paragraphs: row.paragraphs.map((p) =>
          p.replace(/\bfor the back\b/gi, (m) => (m[0] === "f" ? "for the front" : "For the front"))
        ),
      };
    });

  const sharedRowsClamped = clampFrontSharedRowsBeforeNeckStart(sharedRows, args.frontNecklineStartRC);

  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "FRONT" });
  rows.push({
    kind: "block",
    paragraphs: [
      `Front follows the same sequence as the back until neckline shaping begins at RC ${Math.max(
        0,
        Math.floor(args.frontNecklineStartRC)
      )}.`,
    ],
  });
  rows.push(...sharedRowsClamped);

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
      scoopFirstCenterBindOff: args.scoopFirstCenterBindOff,
    });
    if (summary) rows.push({ kind: "block", paragraphs: summary });
  } else {
    rows.push({
      kind: "block",
      paragraphs: [
        "Front neckline and shoulder shaping could not be generated. Confirm front neck depth, neck opening, shoulder width, and gauge.",
      ],
    });
  }

  rows.push({ kind: "neckShoulderChartTableMount" });
  rows.push({ kind: "neckShoulderChartPreviewMount" });

  return rows;
}

function makePlaceholderNeckShoulderExecution(startRC: number) {
  const center: NeedleRange = {
    label: "center neckline stitches",
    start: "TODO L?",
    end: "TODO R?",
    stitchCount: 0,
  };
  const left: NeedleRange = {
    label: "left shoulder stitches",
    start: "TODO L?",
    end: "TODO L?",
    stitchCount: 0,
  };
  const right: NeedleRange = {
    label: "right shoulder stitches",
    start: "TODO R?",
    end: "TODO R?",
    stitchCount: 0,
  };
  const neckActions: ShapingAction[] = [
    {
      startRC: startRC + 1,
      text: "TODO: At neck edge, work neckline decreases per chart (stitch / row counts TBD).",
    },
  ];
  const shoulderActions: ShapingAction[] = [
    {
      startRC: startRC + 1,
      text: "TODO: At armhole / shoulder edge, work shoulder shaping per chart (short-rows or bind-offs TBD).",
    },
  ];
  return generateNeckShoulderExecution({
    startRC,
    centerNeck: center,
    leftShoulder: left,
    rightShoulder: right,
    neckActions,
    shoulderActions,
  });
}

/**
 * Merge overlap so AT THE SAME TIME only when RC ranges overlap (handled inside generateNeckShoulderExecution).
 * Demo uses overlapping RC for neck + shoulder; real data can separate them.
 */
export function generateSleevelessBackPattern(
  patternData: Record<string, unknown>
): SleevelessBackPatternResult {
  const warnings: string[] = [];

  const basic = calculateBasicPatternNumbers(patternData);
  const {
    stitchesPerInch,
    rowsPerInch,
    bustChestStitches,
    stitchesAfterArmhole: rawStitchesAfterArmhole,
  } = basic;
  // Keep left/right shaping balanced by normalizing the post-armhole total to an even count.
  const stitchesAfterArmhole =
    rawStitchesAfterArmhole !== undefined && rawStitchesAfterArmhole > 0
      ? rawStitchesAfterArmhole % 2 === 0
        ? rawStitchesAfterArmhole
        : rawStitchesAfterArmhole + 1
      : rawStitchesAfterArmhole;

  if (!Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    warnings.push("Row gauge is missing or invalid — row counts and RC targets may be wrong.");
  }
  if (!Number.isFinite(stitchesPerInch) || stitchesPerInch <= 0) {
    warnings.push("Stitch gauge is missing or invalid — stitch counts may be wrong.");
  }

  const audience = pickAudience(patternData);
  const sm = selectedMeasurements(patternData);

  const finishedBust = measurementInches(sm, "finished_bust_chest") ?? basic.finishedBustChest;
  const backNeckToHem = measurementInches(sm, "back_neck_to_hem");
  const armholeDepthIn = measurementInches(sm, "armhole_depth");
  const shoulderWidthIn = measurementInches(sm, "shoulder_width");
  const backNeckDepthIn = measurementInches(sm, "back_neck_depth");
  const frontNeckDepthIn = measurementInches(sm, "front_neck_depth");
  const neckWidthIn =
    measurementInches(sm, "neck_width") ??
    measurementInches(sm, "neck_opening") ??
    measurementInches(sm, "neckOpening");

  const castOnSts =
    (() => {
      const baseCastOn =
        backStitchesFromPattern(bustChestStitches) ||
        (finishedBust > 0 && stitchesPerInch > 0
          ? Math.round((finishedBust * stitchesPerInch) / 2)
          : 0);
      // Keep the pattern symmetrical by using an even cast-on stitch count.
      return baseCastOn > 0 && baseCastOn % 2 !== 0 ? baseCastOn + 1 : baseCastOn;
    })();

  const hemRows = calculateHemRows(rowsPerInch, audience);
  const rowGauge = rowsPerInch;

  if (castOnSts <= 0) {
    warnings.push("Could not derive cast-on stitch count — need finished bust/chest and stitch gauge.");
  }

  if (!backNeckToHem || !armholeDepthIn) {
    warnings.push(
      "back_neck_to_hem and/or armhole_depth missing — section row totals use TODO placeholders."
    );
  }

  const totalGarmentRows =
    backNeckToHem && rowGauge > 0 ? Math.round(backNeckToHem * rowGauge) : 0;

  const neckShoulderInches = Math.max(2, (backNeckDepthIn ?? 2.5) + 2);
  const neckShoulderRowsEstimate =
    rowGauge > 0 ? Math.max(12, Math.round(neckShoulderInches * rowGauge)) : 28;

  const armholeDepthRows =
    armholeDepthIn && rowGauge > 0 ? Math.max(1, Math.round(armholeDepthIn * rowGauge)) : 0;

  const armholeStitchesTotal =
    castOnSts > 0 && stitchesAfterArmhole !== undefined
      ? castOnSts - stitchesAfterArmhole
      : undefined;
  const armholeStitchesEachSide =
    armholeStitchesTotal !== undefined ? armholeStitchesTotal / 2 : undefined;

  /** Neckline N and shoulders use B = stitchesAfterArmhole (after armhole), not cast-on A. */
  let necklineStitches: number | undefined;
  let shoulderStitches: number | undefined;
  let stitchesAfterNeckline: number | undefined;

  const neckOpeningStitchesExplicit = optionalNonNegativeStitchCount(sm, "neck_opening_stitches");
  const canDeriveNeckFromInches = neckWidthIn !== undefined && stitchesPerInch > 0;

  if (
    castOnSts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole < castOnSts &&
    (canDeriveNeckFromInches || (neckOpeningStitchesExplicit !== undefined && neckOpeningStitchesExplicit > 0))
  ) {
    const B = stitchesAfterArmhole;
    let N: number;
    if (neckOpeningStitchesExplicit !== undefined && neckOpeningStitchesExplicit > 0) {
      N = neckOpeningStitchesExplicit;
    } else {
      let neckOpeningStitches = Math.round(neckWidthIn! * stitchesPerInch);
      // Normalize neckline opening stitch count for symmetrical shaping
      if (neckOpeningStitches % 2 !== 0) {
        neckOpeningStitches -= 1;
      }
      N = neckOpeningStitches;
    }
    N = Math.max(1, N);
    /** No cap vs B — neck opening and shoulders come from the same base split as the back; front scoop only shifts RC / row span. */
    necklineStitches = N;
    stitchesAfterNeckline = B - N;
    shoulderStitches = Math.floor(stitchesAfterNeckline / 2);

    if (N >= B) {
      warnings.push(
        "Center neck bind-off stitch count should be less than shoulder-line stitches (B) — check neck opening vs shoulder width."
      );
    }
    if (shoulderStitches <= 0) {
      warnings.push("shoulder stitches must be greater than zero — check neck opening vs shoulder width.");
    }
  } else if (castOnSts > 0 && stitchesAfterArmhole !== undefined && stitchesAfterArmhole >= castOnSts) {
    warnings.push("stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder vs bust.");
  }

  let sideNeckShapingStitchesPerSide = 0;
  if (necklineStitches !== undefined && necklineStitches > 0) {
    sideNeckShapingStitchesPerSide = neckEdgeDecreasesPerSide(necklineStitches);
  }

  /**
   * Rows from hem to first armhole row: full-width knitting below the armhole curve,
   * excluding armhole depth and an allowance for neck + shoulder (so total length is not double-counted).
   */
  let bodyToArmholeRows = 0;
  if (backNeckToHem && armholeDepthIn && rowGauge > 0) {
    const bodyFlatInches = backNeckToHem - armholeDepthIn - neckShoulderInches;
    if (bodyFlatInches <= 0) {
      warnings.push(
        "Garment length may be too short for the default neck/shoulder allowance — verify measurements."
      );
    }
    const rowsFromHemToUnderarm = Math.max(0, Math.round(Math.max(0, bodyFlatInches) * rowGauge));
    bodyToArmholeRows = Math.max(0, rowsFromHemToUnderarm - hemRows);
  }

  /**
   * Single running row counter: section start RC for the next block. Cast-on and ribbed hem are
   * shown at 0; after hem, add hemRows; body is shown at that value; after body, add body rows;
   * armhole starts at that value — each transition is startRC + rows worked (starting row is not
   * double-counted as an extra worked row).
   */
  let currentRC = 0;

  if (hemRows > 0) {
    currentRC += hemRows;
  } else {
    warnings.push("Hem rows are 0 — check row gauge and audience for default hem depth.");
  }

  if (bodyToArmholeRows > 0) {
    currentRC += bodyToArmholeRows;
  } else {
    warnings.push("Body rows to armhole could not be computed — need back neck to hem, armhole depth, and row gauge.");
  }

  /** After hem + body: RC where armhole shaping begins (same as currentRC). */
  let rc = currentRC;

  let armholePlan: ArmholeRcPlan | null = null;
  let armholeMathResult: ArmholeResult | null = null;
  let firstArmholeRCNum: number | null = null;

  if (
    castOnSts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole > 0 &&
    stitchesAfterArmhole < castOnSts &&
    armholeDepthRows > 0
  ) {
    try {
      armholeMathResult = calculateArmholeShaping({
        startingStitches: castOnSts,
        targetStitches: stitchesAfterArmhole,
        totalRows: armholeDepthRows,
      });
      firstArmholeRCNum = currentRC;
      armholePlan = planArmholeRcRange(armholeMathResult, firstArmholeRCNum);
      rc = armholePlan.endRC;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(msg);
    }
  } else {
    if (stitchesAfterArmhole === undefined) {
      warnings.push(
        "stitchesAfterArmhole not available — need shoulder_width in selected measurements and stitch gauge."
      );
    } else if (stitchesAfterArmhole >= castOnSts) {
      warnings.push(
        "stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder width vs bust."
      );
    }
    if (!armholeDepthRows) {
      warnings.push("Armhole depth rows could not be computed.");
    }
  }

  const armholeTotalForBudget = armholePlan ? armholePlan.totalRows : 0;
  const baseThroughArmhole = hemRows + bodyToArmholeRows + armholeTotalForBudget;
  const armholeStartRC =
    armholePlan && firstArmholeRCNum !== null ? firstArmholeRCNum : undefined;
  const armholeEndRC = armholePlan ? armholePlan.endRC : undefined;

  /**
   * Neckline depth rows are computed BEFORE upper-back scheduling so the back neckline
   * + shoulder section can be placed BACKWARD from totalGarmentRows. This keeps the
   * piece exactly totalGarmentRows long instead of stacking the neckline on top of it.
   */
  const frontNeckDepthRows =
    rowGauge > 0 && frontNeckDepthIn !== undefined
      ? Math.max(1, Math.round(frontNeckDepthIn * rowGauge))
      : 0;
  /** Back neckline vertical depth in rows (single budget for unified neck + shoulder timeline). */
  const backNeckDepthRows =
    rowGauge > 0 ? Math.max(1, Math.round((backNeckDepthIn ?? 2.5) * rowGauge)) : 0;
  const shoulderBindoffRows =
    rowGauge > 0 ? Math.max(1, Math.round(rowGauge * 1)) : 1;

  /**
   * Schedule the back neckline + shoulder section so the final piece ends EXACTLY at
   * totalGarmentRows. Upper-back rows fill the gap from the end of the armhole to the
   * row before neckline shaping starts. The previous solver targeted totalGarmentRows
   * directly, then placed the neckline section *after* that — overshooting the piece
   * by backNeckDepthRows.
   */
  let upperBackRows = 0;
  /** Kept for downstream display compatibility; the new schedule no longer emits parity pads. */
  let evenRowPadRows = 0;
  let upperStartRc = 0;
  let padStartRc = 0;
  let neckStartRC: number;

  /**
   * Critical invariant: the back piece must end on RC = totalGarmentRows. The neckline / shoulder
   * timeline runs for backNeckDepthRows rows ending on totalGarmentRows, so its first row is
   * `totalGarmentRows - backNeckDepthRows + 1`. We anchor `neckStartRC` to that backward-scheduled
   * value UNCONDITIONALLY (even when the body / armhole budget is tight), which guarantees the
   * final visible RC across displayRows, chartRows, and SVG labels never exceeds totalGarmentRows.
   * The previous schedule allowed `neckStartRC = baseThroughArmhole + 1`, which could push the
   * back past totalGarmentRows when the body + armhole budget consumed too many rows.
   */
  if (totalGarmentRows > 0 && backNeckDepthRows > 0) {
    const desiredNeckStart = Math.max(1, totalGarmentRows - backNeckDepthRows + 1);
    if (desiredNeckStart <= baseThroughArmhole) {
      warnings.push(
        "Row budget is tight: hem + body + armhole + back neck depth exceed total garment rows — verify lengths."
      );
    } else {
      upperBackRows = desiredNeckStart - 1 - baseThroughArmhole;
      if (upperBackRows > 0) {
        upperStartRc = rc + 1;
        rc += upperBackRows;
      }
    }
    neckStartRC = desiredNeckStart;
  } else {
    if (totalGarmentRows === 0) {
      warnings.push(
        "Upper-back row count not derived — check total length vs hem, body, armhole, and neck reserve."
      );
    }
    neckStartRC = rc + 1;
  }

  let neckExec = makePlaceholderNeckShoulderExecution(
    preambleStartRcBeforeFirstShapingRow(neckStartRC)
  );

  if (
    castOnSts > 0 &&
    neckWidthIn === undefined &&
    (neckOpeningStitchesExplicit === undefined || neckOpeningStitchesExplicit <= 0)
  ) {
    warnings.push(
      "Neck opening not set (neck_width, neck_opening, neckOpening, or neck_opening_stitches) — neckline stitch counts are placeholders."
    );
  }

  /**
   * Front neckline ends at the same row as the back (totalGarmentRows) but starts earlier
   * when the front scoop is deeper. When `frontNeckDepthRows` is 0, the front timeline reuses
   * `backNeckDepthRows`, so the start row matches the back.
   */
  const effectiveFrontNeckDepthRows =
    frontNeckDepthRows > 0 ? frontNeckDepthRows : backNeckDepthRows;
  const frontNecklineStartRC =
    totalGarmentRows > 0 && effectiveFrontNeckDepthRows > 0
      ? Math.max(0, totalGarmentRows - effectiveFrontNeckDepthRows + 1)
      : Math.max(0, rc - Math.max(0, frontNeckDepthRows) + 1);

  /**
   * When neckline / shoulder math can be derived from inputs, the chart is built from the live
   * timeline below. Until then the chart is empty rather than the legacy demo (rows 300-312),
   * which would otherwise leak demo RCs into the rendered chart and break the
   * "max visible BACK RC === totalGarmentRows" invariant.
   */
  let neckShoulderShapingChart: NeckShoulderShapingChart = neckShoulderShapingChartFromRows([]);
  let neckShoulderChartUsesLiveRows = false;
  let frontNeckShoulderShapingChart: NeckShoulderShapingChart = neckShoulderShapingChartFromRows([]);
  let frontNeckShoulderChartUsesLiveRows = false;
  let frontExec = makePlaceholderNeckShoulderExecution(
    preambleStartRcBeforeFirstShapingRow(frontNecklineStartRC)
  );
  /** First-row center bind-off on front when using gradual scoop (for summary / execution). */
  let frontScoopFirstCenterBindOff: number | undefined;

  let backNeckShoulderTimeline: RowEntry[] | undefined;
  let frontNeckShoulderTimeline: RowEntry[] | undefined;

  /** Timeline drives chart + row-accurate execution (front RC-shift only). */
  if (
    castOnSts > 0 &&
    necklineStitches !== undefined &&
    shoulderStitches !== undefined &&
    necklineStitches > 0 &&
    shoulderStitches > 0
  ) {
    const shoulderSts = shoulderStitches;
    const initialCenterSts = initialCenterNeckStitches(necklineStitches);

    const todoNeedle = (label: string): NeedleRange => ({
      label,
      start: "TODO",
      end: "TODO",
      stitchCount: shoulderSts,
    });

    const center: NeedleRange = {
      label: "center neckline stitches (TODO needle range)",
      start: "TODO L?",
      end: "TODO R?",
      stitchCount: initialCenterSts,
    };

    const frontPatternNumbers: NeckShoulderShapingPatternNumbers =
      frontNeckDepthRows > 0
        ? {
            firstShapingRow: frontNecklineStartRC,
            shoulderStitchesPerSide: shoulderSts,
            centerNeckBindOff: necklineStitches,
            neckDepthRows: frontNeckDepthRows,
            neckProfile: "front",
            stitchesAfterArmhole: stitchesAfterArmhole!,
            shoulderBindoffRows,
          }
        : {
            firstShapingRow: frontNecklineStartRC,
            shoulderStitchesPerSide: shoulderSts,
            centerNeckBindOff: necklineStitches,
            neckDepthRows: backNeckDepthRows,
            neckProfile: "back",
            stitchesAfterArmhole: stitchesAfterArmhole!,
            shoulderBindoffRows,
          };

    const shoulderSchedule = computeShoulderBindoffSchedule(frontPatternNumbers);
    const shoulderTimelineOpts = shoulderSchedule !== null ? { shoulderSchedule } : undefined;

    const patternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: neckStartRC,
      shoulderStitchesPerSide: shoulderStitches,
      centerNeckBindOff: necklineStitches,
      neckDepthRows: backNeckDepthRows,
      neckProfile: "back",
      stitchesAfterArmhole: stitchesAfterArmhole!,
      shoulderBindoffRows,
    };
    const { timeline, chartRows: liveRows } = buildNeckShoulderTimelineAndChartRows(
      patternNumbers,
      shoulderTimelineOpts
    );

    let frontTimeline: RowEntry[] = [];
    let frontLiveRows: NeckShoulderShapingChartRow[] = [];

    const builtFront = buildNeckShoulderTimelineAndChartRows(frontPatternNumbers, shoulderTimelineOpts);
    frontTimeline = builtFront.timeline;
    frontLiveRows = builtFront.chartRows;

    if (liveRows.length > 0) {
      backNeckShoulderTimeline = timeline;
      neckShoulderShapingChart = neckShoulderShapingChartFromRows(liveRows, { timeline });
      neckShoulderChartUsesLiveRows = true;

      const backCenterExec = centerBindOffExecutionTextFromChartRow(timeline, liveRows[0]);
      const backDerived = shapingActionsFromTimeline(timeline, {
        centerBindOffShapingLine: backCenterExec?.shapingAtRcLine,
      });
      neckExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(timeline[0]?.row ?? neckStartRC),
        centerNeck: center,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions: backDerived.neckActions,
        shoulderActions: backDerived.shoulderActions,
        centerBindOffExecutionText: backCenterExec,
      });
    }

    if (frontLiveRows.length > 0) {
      frontNeckShoulderTimeline = frontTimeline;
      frontNeckShoulderShapingChart = neckShoulderShapingChartFromRows(frontLiveRows, {
        timeline: frontTimeline,
      });
      frontNeckShoulderChartUsesLiveRows = true;

      const firstRowCenterBo = centerBindOffAmountFirstTimelineRow(frontTimeline);
      const centerFrontBindOff: NeedleRange = {
        ...center,
        stitchCount: firstRowCenterBo > 0 ? firstRowCenterBo : initialCenterSts,
      };
      const effectiveFrontCenterBo = firstRowCenterBo > 0 ? firstRowCenterBo : initialCenterSts;
      if (effectiveFrontCenterBo > 0 && effectiveFrontCenterBo < necklineStitches!) {
        frontScoopFirstCenterBindOff = effectiveFrontCenterBo;
      }

      const frontCenterExec = centerBindOffExecutionTextFromChartRow(frontTimeline, frontLiveRows[0]);
      const frontDerived = shapingActionsFromTimeline(frontTimeline, {
        centerBindOffShapingLine: frontCenterExec?.shapingAtRcLine,
      });
      frontExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(frontTimeline[0]?.row ?? frontNecklineStartRC),
        centerNeck: centerFrontBindOff,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions: frontDerived.neckActions,
        shoulderActions: frontDerived.shoulderActions,
        centerBindOffExecutionText: frontCenterExec,
      });
    }

    if (liveRows.length === 0) {
      const neckActions: ShapingAction[] =
        sideNeckShapingStitchesPerSide > 0
          ? [
              {
                startRC: neckStartRC,
                endRC: neckStartRC + backNeckDepthRows - 1,
                text: `At neck edge, decrease toward center — ${sideNeckShapingStitchesPerSide} stitch${
                  sideNeckShapingStitchesPerSide === 1 ? "" : "es"
                } per side.`,
              },
            ]
          : [];

      const shoulderActions: ShapingAction[] = [
        {
          startRC: neckStartRC,
          endRC: neckStartRC + backNeckDepthRows - 1,
          text: "At armhole edge, work shoulder slope (short-rows or bind-offs per chart).",
        },
      ];

      neckExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(neckStartRC),
        centerNeck: center,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions,
        shoulderActions,
      });
    }

    if (frontLiveRows.length === 0) {
      const frontNeckSectionRows = frontNeckDepthRows > 0 ? frontNeckDepthRows : backNeckDepthRows;
      frontExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(frontNecklineStartRC),
        centerNeck: center,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions:
          sideNeckShapingStitchesPerSide > 0
            ? [
                {
                  startRC: frontNecklineStartRC,
                  endRC: frontNecklineStartRC + frontNeckSectionRows - 1,
                  text: `At neck edge, decrease toward center — ${sideNeckShapingStitchesPerSide} stitch${
                    sideNeckShapingStitchesPerSide === 1 ? "" : "es"
                  } per side.`,
                },
              ]
            : [],
        shoulderActions: [
          {
            startRC: frontNecklineStartRC,
            endRC: frontNecklineStartRC + frontNeckSectionRows - 1,
            text: "At armhole edge, work shoulder slope (short-rows or bind-offs per chart).",
          },
        ],
      });
    }
  }

  warnings.push(...neckExec.warnings);
  warnings.push(...frontExec.warnings);

  const armholeRowsTotal = armholePlan ? armholePlan.totalRows : 0;
  /** Includes neck shaping rows so the audit equals expectedGarmentRows when length math is valid. */
  const totalCalculatedRows =
    hemRows +
    bodyToArmholeRows +
    armholeRowsTotal +
    upperBackRows +
    evenRowPadRows +
    backNeckDepthRows;

  if (totalGarmentRows > 0) {
    rc = totalGarmentRows;
  }

  const frontChartRowsOut = frontNeckShoulderShapingChart.rows;
  const fb = timelineRcBounds(frontNeckShoulderTimeline);
  const bb = timelineRcBounds(backNeckShoulderTimeline);
  const frontExecRc = parseRcBoundsFromExecutionLines(frontExec.lines);

  /** Final piece RCs derived from the timeline (chart) when present, else from the scheduled span. */
  const backFinalRow =
    bb.last ?? (backNeckDepthRows > 0 ? neckStartRC + backNeckDepthRows - 1 : undefined);
  const frontFinalRow =
    fb.last ??
    (effectiveFrontNeckDepthRows > 0
      ? frontNecklineStartRC + effectiveFrontNeckDepthRows - 1
      : undefined);
  const shoulderStartRow = backNeckShoulderTimeline?.find((entry) =>
    entry.events.some(
      (ev) => ev.edge === "outer" && (ev.kind === "bindOff" || ev.kind === "decrease") && ev.amount > 0
    )
  )?.row;

  const debug: SleevelessBackPatternDebug = {
    finishedBustChest:
      finishedBust > 0 ? finishedBust : undefined,
    stitchesPerInch,
    rowsPerInch,
    backStitches: castOnSts,
    shoulderWidthInches: shoulderWidthIn,
    stitchesAfterArmhole,
    armholeStitchesTotal,
    armholeStitchesEachSide,
    hemRows,
    bodyRows: bodyToArmholeRows,
    armholeRows: armholeRowsTotal,
    necklineShoulderRows: neckShoulderRowsEstimate,
    totalCalculatedRows,
    expectedGarmentRows: totalGarmentRows,
    backNeckToHem,
    armholeDepth: armholeDepthIn,
    bodyInchesToArmhole:
      rowGauge > 0 ? bodyToArmholeRows / rowGauge : undefined,
    reservedNecklineShoulderInches: neckShoulderInches,
    reservedNecklineShoulderRows: neckShoulderRowsEstimate,
    remainingRowsBeforeNeckline: upperBackRows,
    necklineWidthInches: neckWidthIn,
    necklineStitches,
    centerNeckBindOffStitches:
      necklineStitches !== undefined ? initialCenterNeckStitches(necklineStitches) : undefined,
    sideNeckShapingStitchesPerSide,
    shoulderStitches,
    stitchesAfterNeckline,
    frontNeckDepth: frontNeckDepthIn,
    frontNeckDepthRows,
    backNeckDepthRows,
    shoulderBindoffRows: rowGauge > 0 ? shoulderBindoffRows : undefined,
    backNecklineStartRC: neckStartRC,
    frontNecklineStartRC,
    finalRC: rc,
    armholeStartRow: armholeStartRC,
    armholeEndRow: armholeEndRC,
    shoulderStartRow,
    backFinalRow,
    frontFinalRow,
    backNeckShoulderTimelineFirstRC: bb.first,
    backNeckShoulderTimelineLastRC: bb.last,
    frontNeckShoulderTimelineFirstRC: fb.first,
    frontNeckShoulderTimelineLastRC: fb.last,
    frontChartFirstRowRc: frontChartRowsOut[0]?.row,
    frontChartLastRowRc: frontChartRowsOut[frontChartRowsOut.length - 1]?.row,
    frontExecutionRcMin: frontExecRc.min,
    frontExecutionRcMax: frontExecRc.max,
    frontSvgFirstRc: fb.first,
    frontSvgLastRc: fb.last,
    backFirstShapingRowPassedToTimeline: neckStartRC,
    frontFirstShapingRowPassedToTimeline: frontNecklineStartRC,
  };

  /**
   * Validation guard: the front and back must end on the same final RC, and that RC must equal
   * the totalRows budget derived from finished length × row gauge. Mismatches are surfaced as
   * warnings and (in browsers / Node dev consoles) logged with the diagnostic snapshot below.
   */
  if (totalGarmentRows > 0) {
    const issues: string[] = [];
    if (backFinalRow !== undefined && backFinalRow !== totalGarmentRows) {
      issues.push(`backFinalRow ${backFinalRow} ≠ totalRows ${totalGarmentRows}`);
    }
    if (frontFinalRow !== undefined && frontFinalRow !== totalGarmentRows) {
      issues.push(`frontFinalRow ${frontFinalRow} ≠ totalRows ${totalGarmentRows}`);
    }
    if (
      backFinalRow !== undefined &&
      frontFinalRow !== undefined &&
      backFinalRow !== frontFinalRow
    ) {
      issues.push(`backFinalRow ${backFinalRow} ≠ frontFinalRow ${frontFinalRow}`);
    }
    if (issues.length > 0) {
      const snapshot = {
        rowsPerInch,
        finishedLength: backNeckToHem,
        totalRows: totalGarmentRows,
        hemRows,
        bodyRowsBeforeArmhole: bodyToArmholeRows,
        armholeStartRow: armholeStartRC,
        armholeEndRow: armholeEndRC,
        backNeckStartRow: neckStartRC,
        frontNeckStartRow: frontNecklineStartRC,
        shoulderStartRow,
        backFinalRow,
        frontFinalRow,
      };
      const msg = `Sleeveless row schedule mismatch — ${issues.join("; ")}.`;
      warnings.push(msg);
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("[sleevelessPatternOutput]", msg, snapshot);
      }
    }
  }

  const backDisplayRowsRaw = buildSleevelessBackDisplayRows({
    castOnSts,
    hemRows,
    hemRowsValid: hemRows > 0,
    bodyToArmholeRows,
    bodyRowsValid: bodyToArmholeRows > 0,
    armholeMath: armholeMathResult,
    firstArmholeRC: firstArmholeRCNum,
    stitchesAfterArmhole,
    upperBackRows,
    upperStartRc,
    evenRowPadRows,
    padStartRc,
    backNecklineStartRC: neckStartRC,
    neckChartRows: neckShoulderShapingChart.rows,
    useNeckChartRows: neckShoulderChartUsesLiveRows,
    necklineStitches,
    shoulderStitches,
  });
  const displayRows = mergeAdjacentPlainKnitBlocks(backDisplayRowsRaw);
  const frontDisplayRows = mergeAdjacentPlainKnitBlocks(
    buildSleevelessFrontDisplayRows({
      frontNecklineStartRC,
      sharedExecutionRows: backDisplayRowsRaw,
      useNeckChartRows: frontNeckShoulderChartUsesLiveRows,
      neckChartRows: frontNeckShoulderShapingChart.rows,
      necklineStitches,
      shoulderStitches,
      scoopFirstCenterBindOff: frontScoopFirstCenterBindOff,
    })
  );

  const lines = flattenDisplayRowsToLines(displayRows);

  return {
    warnings,
    lines,
    displayRows,
    frontDisplayRows,
    debug,
    neckShoulderShapingChart,
    frontNeckShoulderShapingChart,
    neckShoulderChartUsesLiveRows,
    frontNeckShoulderChartUsesLiveRows,
    backNeckShoulderTimeline,
    frontNeckShoulderTimeline,
  };
}

/**
 * Human-facing instruction line: hide internal TODO markers while keeping the sentence readable.
 */
export function sanitizeSleevelessPatternLineForDisplay(line: string): string {
  let s = line;
  s = s.replace(/\bTODO L\?/gi, "—").replace(/\bTODO R\?/gi, "—");
  s = s.replace(/\bTODO:?\s*/gi, "").replace(/\bTODO\b/gi, "");
  s = s.replace(/\(\s*schedule\s+TBD\s*\)/gi, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Normalize RC display to `RC:000` (no space after colon). */
export function normalizeRcDisplayLine(line: string): string {
  let s = line;
  s = s.replace(/^RC\s+(\d{1,3})\b/, (_, d: string) => `RC:${String(d).padStart(3, "0")}`);
  s = s.replace(/^RC:\s*(\d{1,3})\b/, (_, d: string) => `RC:${String(d).padStart(3, "0")}`);
  return s;
}

/**
 * Demo with simple numbers for manual math checks (5 sts/in, 7 rows/in, 40" bust, etc.).
 */
export function demoSleevelessBackPattern(): SleevelessBackPatternResult {
  const sample: Record<string, unknown> = {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
  return generateSleevelessBackPattern(sample);
}
