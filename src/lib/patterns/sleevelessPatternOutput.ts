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
import { resolveEffectiveArmholeDepthInches } from "./customBuildEffectiveArmholeDepth";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import { resolveEffectiveShoulderWidthInches } from "./customBuildEffectiveShoulderWidth";
import { calculateBasicPatternNumbers } from "./patternCalculator";
import { calculateHemRows } from "./hemDefaults";
import {
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderTimelineAndChartRows,
  neckShoulderChartRowsFromTimeline,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { cardiganHalfFrontBodySts, splitBodyBackCastOnToSymmetricCardiganHalves } from "./cardiganFrontBlock";
import {
  cardiganFrontEdgePickupStitchesFromDebug,
  cardiganFrontEdgeRowsFromDebug,
} from "./sleevelessPatternFinishing";
import { buildVNeckFrontFullWidthTimeline } from "./vNeckFrontFullWidthTimeline";
import { computeShoulderBindoffSchedule, type RowEntry } from "./shapingTimeline";
import {
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
} from "./legoBlocks/roundNeckline";

/**
 * Trusted HTML for ribbed-hem helper — glossary placeholders hydrated client-side (mock rib 291, hung hem 284).
 * Render only via innerHTML from pattern output, never user input.
 */
export const RIBBED_HEM_PATTERN_TIP_HTML =
  'Work even in your chosen hem treatment — for example 1x1 or 2x2 ribbing or <span class="glossary-tooltip-placeholder" data-glossary-id="291">mock ribbing</span>, a rolled stockinette edge, a fold-up band, or a <span class="glossary-tooltip-placeholder" data-glossary-id="284">hung hem</span> — for the depth shown.<br><br>Fold-up and hung hems typically require double the hem depth before rehanging.';

/** Trusted HTML for collapsible body-shaping marker tip (glossary id 310). */
export const BODY_MARKER_TIP_DETAILS_HTML =
  '<details class="pattern-tip sleeveless-shaping-help-toggle"><summary>Tip: Use markers to track shaping</summary><p>Many machine knitters place small removable <span class="pattern-term" data-glossary-id="310" data-tooltip="Hang a contrasting loop on the edge needle to locate a specific row or checkpoint later.">markers</span> directly into the edge of the fabric at shaping rows or length checkpoints. This makes it easier to verify your progress while the garment is still on the machine.</p></details>';

/**
 * Trusted HTML: carriage left/right vs diagram orientation (BACK and FRONT neckline blocks, before chart mount).
 * {@link sleevelessPatternPrintRender} forces `<details open>` so printouts show the body text.
 */
export const NECKLINE_SHOULDER_ORIENTATION_HELP_DETAILS_HTML =
  '<details class="pattern-tip sleeveless-shaping-help-toggle"><summary>Understanding Left, Right &amp; Diagram Orientation</summary>' +
  "<p>The diagrams and shaping instructions are shown as you work at the machine.</p>" +
  '<p>&ldquo;Left&rdquo; and &ldquo;Right&rdquo; in the chart refer to carriage position, not the finished sweater as worn.</p>' +
  "<p>Shaping edges are labeled &ldquo;Neck&rdquo; and &ldquo;Armhole&rdquo; so you can follow the shaping without needing to rotate or reinterpret the garment.</p>" +
  "<p>When working the second shoulder, repeat the shaping on the opposite side.</p>" +
  "</details>";

/**
 * Trusted HTML for inline tip after armhole shaping, before neckline and shoulder shaping (`tipHtml` block).
 * Rendered after `<strong>Tip:</strong>` — opening “Tip:” omitted here to avoid duplication.
 */
export const LIFELINE_BEFORE_NECK_SHOULDER_SHAPING_TIP_HTML =
  'Before starting the neckline and shoulder shaping, consider adding a <span class="glossary-link" data-glossary-id="343">lifeline</span>. It gives you a safe place to rip back to if you make a mistake during shaping.';

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
  /** Armhole depth rows from first armhole bind-off RC to shoulder shaping start RC. */
  armholeRows: number;
  /** Internal armhole-shaping rows consumed before neckline/shoulder scheduling. */
  armholeShapingRows: number;
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
  /**
   * Row budget passed to {@link buildTimeline} for the front (may be one row longer than
   * {@link frontNeckDepthRows} so the chart ends on the same shoulder line as the back).
   */
  frontNeckTimelineDepthRows: number;
  /** Back neck depth in rows — unified timeline row budget with shoulder shaping. */
  backNeckDepthRows: number;
  /** RC rows for shoulder bind-off placement span (1" at row gauge). */
  shoulderBindoffRows: number | undefined;
  /** RC where back neckline / shoulder block begins (same total stitches as front; front may start earlier). */
  backNecklineStartRC: number;
  frontNecklineStartRC: number;
  /** Neckline bind-off milestone as Armhole RC (intro + chart wiring). */
  backNecklineStartLocalRC?: number;
  frontNecklineStartLocalRC?: number;
  finalRC: number;
  /** Hem rows + body rows — identical on back, pullover front, and cardigan half front (canonical). */
  rowsFromCastOnToArmholeStart: number;
  /** First RC of armhole shaping (bind-off row); `undefined` when armhole math is unavailable. */
  armholeStartRow?: number;
  /** Last RC of the armhole block (after decreases + work-even rows). */
  armholeEndRow?: number;
  /** First shoulder shaping RC by rule: armholeStartRow + armholeRows. */
  armholeDepthEndRow?: number;
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
  /** Round cardigan left front: cast-on stitches (half body, default left receives odd +1). */
  cardiganHalfLeftCastOnSts?: number;
  /** Stitches on the needle after armhole on that half piece (matches written left front). */
  cardiganHalfLeftStitchesAfterArmhole?: number;
  /** Cardigan: rows along one CF edge from hem to front neckline bind-off (for front-band pickup). */
  cardiganFrontEdgeRows?: number;
  /** Cardigan: approximate pickup stitches for one front edge ({@link approximatePickupStitchesFromRows}). */
  cardiganFrontEdgePickupSts?: number;
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

function formatArmholeLocalRc(garmentRc: number, firstArmholeRC: number): string {
  return formatRcColon(Math.max(0, Math.floor(garmentRc - firstArmholeRC)));
}

function formatArmholeLocalRcNumber(garmentRc: number, firstArmholeRC: number): string {
  return String(Math.max(0, Math.floor(garmentRc - firstArmholeRC))).padStart(3, "0");
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
const KNIT_TO_RC_RE = /^Knit to RC:?\s*(\d{1,4})\.\s*$/i;

/** Armhole bridge line: “At RC:…, knit in pattern to RC:…”. */
const AT_RC_KNIT_IN_PATTERN_TO_RC_RE =
  /^At RC:?(\d{1,4}),\s*knit in pattern to RC:?(\d{1,4})\.\s*$/i;

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
  const atRcKnitTo = paragraph.trim().match(AT_RC_KNIT_IN_PATTERN_TO_RC_RE);
  if (atRcKnitTo && blockStartRc !== undefined) {
    const startFromLine = parseInt(atRcKnitTo[1], 10);
    const targetRc = parseInt(atRcKnitTo[2], 10);
    if (
      Number.isFinite(startFromLine) &&
      Number.isFinite(targetRc) &&
      startFromLine === blockStartRc &&
      targetRc > startFromLine
    ) {
      const rows = targetRc - startFromLine;
      return { rows, endRc: targetRc - 1 };
    }
  }
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
 *
 * `frontNecklineStartLocalRC` is measured from **armhole start** (rows into the armhole depth).
 * Block headers before the armhole use **garment** RC (from cast-on). Comparing those two
 * coordinate systems incorrectly dropped or shortened the BODY section — never clamp when the
 * block begins before {@link garmentArmholeStartRC}.
 */
function clampFrontSharedRowsBeforeNeckStart(
  rows: readonly SleevelessPatternDisplayRow[],
  frontNecklineStartLocalRC: number | undefined,
  garmentArmholeStartRC: number | undefined,
): SleevelessPatternDisplayRow[] {
  if (
    frontNecklineStartLocalRC === undefined ||
    !Number.isFinite(frontNecklineStartLocalRC) ||
    frontNecklineStartLocalRC <= 0
  ) {
    return [...rows];
  }

  const neckFirst = Math.max(0, Math.floor(frontNecklineStartLocalRC));

  const out: SleevelessPatternDisplayRow[] = [];

  for (const row of rows) {
    if (row.kind !== "block") {
      out.push(row);
      continue;
    }

    const startRc = parseRcColonLabel(row.rc);
    if (
      garmentArmholeStartRC !== undefined &&
      startRc !== undefined &&
      startRc < garmentArmholeStartRC
    ) {
      out.push(row);
      continue;
    }

    const armholeLocalStart =
      startRc !== undefined && garmentArmholeStartRC !== undefined
        ? startRc - garmentArmholeStartRC
        : undefined;

    if (armholeLocalStart !== undefined && armholeLocalStart >= neckFirst) {
      continue;
    }

    const maxPlainRows =
      armholeLocalStart !== undefined
        ? Math.max(0, neckFirst - armholeLocalStart)
        : startRc !== undefined
          ? Math.max(0, neckFirst - startRc)
          : Number.POSITIVE_INFINITY;

    const newParagraphs: string[] = [];
    for (const p of row.paragraphs) {
      const span = extractPlainSpanRowsAndEndRc(p, startRc);
      if (span !== undefined && startRc !== undefined) {
        const clamped =
          maxPlainRows === Number.POSITIVE_INFINITY ? span.rows : Math.min(span.rows, maxPlainRows);
        if (clamped <= 0) continue;
        const atRcMerged = p.trim().match(AT_RC_KNIT_IN_PATTERN_TO_RC_RE);
        if (atRcMerged) {
          const lastPlainRc = startRc + clamped - 1;
          newParagraphs.push(
            `At RC:${String(startRc).padStart(3, "0")}, knit in pattern to RC:${String(lastPlainRc).padStart(3, "0")}.`
          );
          continue;
        }
        const spanLine = formatPlainKnitInPatternSpan(clamped, startRc);
        if (spanLine.trim()) newParagraphs.push(spanLine);
        continue;
      }

      newParagraphs.push(p);
    }

    if (newParagraphs.length === 0) {
      if (row.tipHtml || row.collapsibleTipHtml) {
        out.push({ ...row, paragraphs: [] });
      }
      continue;
    }

    out.push({
      ...row,
      paragraphs: newParagraphs,
    });
  }

  return out;
}

/** FRONT-only: replace shared BACK armhole checkpoint with neckline / shoulder milestones (Armhole RC). */
function replaceFrontArmholeCheckpointParagraphs(
  rows: readonly SleevelessPatternDisplayRow[],
  frontNecklineStartLocalRC: number | undefined,
  shoulderShapingBeginLocalRC: number | undefined
): SleevelessPatternDisplayRow[] {
  if (
    frontNecklineStartLocalRC === undefined ||
    shoulderShapingBeginLocalRC === undefined ||
    !Number.isFinite(frontNecklineStartLocalRC) ||
    !Number.isFinite(shoulderShapingBeginLocalRC)
  ) {
    return [...rows];
  }

  const neckN = String(Math.max(0, Math.floor(frontNecklineStartLocalRC))).padStart(3, "0");
  const shoulderN = String(Math.max(0, Math.floor(shoulderShapingBeginLocalRC))).padStart(3, "0");
  const milestone = `Front neckline shaping begins at Armhole RC ${neckN}. Shoulder shaping begins later at Armhole RC ${shoulderN}.`;

  return rows.map((row) => {
    if (row.kind !== "block") return row;
    const hasCheckpoint = row.paragraphs.some((p) =>
      /Armhole depth checkpoint:/i.test(p)
    );
    if (!hasCheckpoint) return row;
    return {
      ...row,
      paragraphs: [milestone],
    };
  });
}

function isMergeablePlainKnitBlock(
  row: SleevelessPatternDisplayRow
): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> & { paragraphs: [string] } {
  if (row.kind !== "block") return false;
  if (row.tipHtml) return false;
  if (row.collapsibleTipHtml) return false;
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
    const firstStartRc = parseRcColonLabel(firstRc);
    let mergedStitchCount = row.stitchCount;
    let j = i + 1;
    while (j < rows.length) {
      const candidate = rows[j];
      if (!isMergeablePlainKnitBlock(candidate)) break;
      const candidateStartRc = parseRcColonLabel(candidate.rc);
      const expectedCandidateStart =
        firstStartRc !== undefined ? plainSpanNextActionRc(firstStartRc, total) : undefined;
      // Only merge truly adjacent plain spans with no hidden RC gap.
      if (
        firstStartRc !== undefined &&
        expectedCandidateStart !== undefined &&
        candidateStartRc !== expectedCandidateStart
      ) {
        break;
      }
      // Stitch count is visible in the right column; preserve split if counts differ.
      if (
        mergedStitchCount !== undefined &&
        candidate.stitchCount !== undefined &&
        candidate.stitchCount !== mergedStitchCount
      ) {
        break;
      }
      if (mergedStitchCount === undefined && candidate.stitchCount !== undefined) {
        mergedStitchCount = candidate.stitchCount;
      }
      total += plainSpanRowCountFromParagraph(candidate.paragraphs[0], candidateStartRc)!;
      j++;
    }

    if (j > i + 1) {
      const mergedLine = formatPlainKnitInPatternSpan(total, parseRcColonLabel(firstRc));
      if (mergedLine.trim()) {
        out.push({
          kind: "block",
          rc: firstRc,
          paragraphs: [mergedLine],
          stitchCount: mergedStitchCount,
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

/** Center neckline bind-off stitches from chart row 0 (intro/bind-off sentences; same logic as print + pattern tab). */
export function centerBindOffStitchesFromNeckShoulderChart(chart: NeckShoulderShapingChart | undefined): number {
  const r0 = chart?.rows?.[0];
  if (!r0) return 0;
  return parseChartCellDelta(String(r0.centerNeck ?? ""));
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

/**
 * Pre-table neckline/shoulder prose (placed before the one-shoulder shaping table).
 * The "repeat for the second shoulder" wording is rendered inside the one-shoulder checklist
 * HTML (see {@link renderNeckShoulderShapingChartTableOnlyHtml}) AFTER the final bind-off
 * line, so it is intentionally absent here.
 */
const NECKLINE_SHOULDER_INSTRUCTION_PARAGRAPHS: readonly string[] = [
  "Use the checklist below to work the neckline and shoulder shaping.",
];

/**
 * Final shoulder bind-off instruction sentence. Returns `null` when no stitches remain
 * (so callers can omit the line entirely instead of emitting "Bind off remaining 0 stitches.").
 * Uses singular wording for exactly one stitch.
 *
 * Consumed by `renderNeckShoulderShapingChartTableOnlyHtml` (and the print equivalent), which
 * derives the stitch count from the FINAL rendered checklist row's `stitchesRemaining` and
 * places the line immediately after the table and before any second-shoulder prompt/toggle.
 */
export function formatShoulderBindoffRemainingInstruction(
  remainingStitches: number
): string | null {
  const n = Math.max(0, Math.floor(remainingStitches));
  if (n <= 0) return null;
  if (n === 1) return "Bind off remaining 1 stitch.";
  return `Bind off remaining ${n} stitches.`;
}

/**
 * Validates neckline numbers for BACK / FRONT NECKLINE & SHOULDERS; emits a short bridge line before the chart.
 * Center bind-off RC and stitch count appear only in the chart intro HTML (`renderActiveShoulderChartIntroHtml`).
 */
function backNecklineShoulderSummaryParagraphs(args: {
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  shoulderStitches?: number;
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
  /**
   * Full-width back uses symmetric armhole bind-offs; round cardigan **left** half uses one outer
   * armhole edge only (same bind-off / decrease counts as one side of the back plan).
   */
  armholeInstructionStyle?: "symmetricTwoEdges" | "cardiganHalfLeftFront";
  /** Cast-on sentence only, e.g. `"the back"` or `"the left front"`. */
  castOnForPieceLabel?: string;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "BACK" });
  let carriedAfterArmholeSts =
    args.stitchesAfterArmhole !== undefined && args.stitchesAfterArmhole > 0
      ? args.stitchesAfterArmhole
      : undefined;

  const A = args.castOnSts;
  const armholeStyle = args.armholeInstructionStyle ?? "symmetricTwoEdges";
  const castOnLabel = args.castOnForPieceLabel ?? "the back";
  const ribs = args.hemRows;
  const hemRcLabel = formatRcColon(0);

  rows.push({
    kind: "block",
    rc: hemRcLabel,
    paragraphs:
      A > 0
        ? [`Cast on ${A} stitches for ${castOnLabel}.`]
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
    tipHtml: RIBBED_HEM_PATTERN_TIP_HTML,
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
    const decreasesTotalSymmetric = 2 * Math.max(0, m.decreaseSts);
    const decreasesTotalCardigan = Math.max(0, m.decreaseSts);
    const B =
      armholeStyle === "cardiganHalfLeftFront"
        ? Math.max(0, afterBo1 - m.decreaseSts)
        : Math.max(0, afterBo2 - decreasesTotalSymmetric);
    const decStart = first + 2;
    const lastDecreaseRc = decStart + 2 * (m.decreaseSts - 1);
    const armholeDepthLocalRc =
      backNeckFirstRc !== undefined ? Math.max(0, backNeckFirstRc - first) : undefined;

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
      rc: formatArmholeLocalRc(first, first),
      paragraphs: [
        "Reset Armhole RC to RC:000.",
        `At RC:000, bind off ${bo} stitches at the armhole edge (carriage side). Knit across.`,
      ],
      stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
    });
    if (armholeStyle === "symmetricTwoEdges") {
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(first + 1, first),
        paragraphs: [
          `At RC:001, bind off ${bo} stitches at the remaining armhole edge (carriage side). Knit across.`,
        ],
        stitchCount: afterBo2 > 0 ? afterBo2 : undefined,
      });
    } else {
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(first + 1, first),
        paragraphs: [
          "At RC:001, knit across — center front edge (no bind-off; opening is worked as a separate piece or band later).",
        ],
        stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
      });
    }

    if (m.decreaseSts > 0) {
      const decreaseRowsChecklist = Array.from(
        { length: Math.max(0, m.decreaseSts) },
        (_, i) => String(Math.max(0, decStart - first + i * 2))
      ).join(" - ");
      const decreaseSentence =
        armholeStyle === "cardiganHalfLeftFront"
          ? `At RC:${formatArmholeLocalRcNumber(decStart, first)}, decrease 1 stitch at the armhole edge every other row, ${m.decreaseSts} times — ${decreasesTotalCardigan} stitch${decreasesTotalCardigan === 1 ? "" : "es"} removed total.`
          : `At RC:${formatArmholeLocalRcNumber(decStart, first)}, decrease 1 stitch at each armhole edge every other row, ${m.decreaseSts} times — ${decreasesTotalSymmetric} stitches removed total.`;
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(decStart, first),
        paragraphs: [decreaseSentence, `Decrease on rows: ${decreaseRowsChecklist}`],
        stitchCount: B > 0 ? B : undefined,
      });
    }

    const armholeBridgeRc =
      m.decreaseSts > 0 &&
      postArmholeInstructionRc !== undefined &&
      lastDecreaseRc < postArmholeInstructionRc - 1
        ? postArmholeInstructionRc - 1
        : undefined;
    if (armholeBridgeRc !== undefined) {
      const evStart = m.evenRows > 0 ? first + 2 + m.decreaseRows : undefined;
      const localNextRaw =
        evStart !== undefined ? Math.max(0, evStart - first) + Math.max(0, m.evenRows) : undefined;
      const necklineLocalRc =
        backNeckFirstRc !== undefined ? Math.max(0, backNeckFirstRc - first) : undefined;
      const localNext =
        localNextRaw !== undefined
          ? necklineLocalRc !== undefined
            ? Math.min(localNextRaw, necklineLocalRc)
            : localNextRaw
          : undefined;
      const canMergeBridgeWithEvenSpan =
        evStart !== undefined &&
        localNext !== undefined &&
        localNext > Math.max(0, armholeBridgeRc - first) &&
        armholeBridgeRc + 1 === evStart;
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(armholeBridgeRc, first),
        paragraphs: [
          canMergeBridgeWithEvenSpan
            ? `At RC:${formatArmholeLocalRcNumber(armholeBridgeRc, first)}, knit in pattern to RC:${String(localNext).padStart(3, "0")}.`
            : `At RC:${formatArmholeLocalRcNumber(armholeBridgeRc, first)}, knit in pattern. ${B} sts remain.`,
        ],
        stitchCount: B > 0 ? B : undefined,
      });
    }

    if (m.evenRows > 0) {
      const evStart = first + 2 + m.decreaseRows;
      const evParas = plainKnitSpanParagraphs(m.evenRows, evStart);
      if (evParas.length > 0) {
        const localStart = Math.max(0, evStart - first);
        const localNextRaw = localStart + Math.max(0, m.evenRows);
        const necklineLocalRc =
          backNeckFirstRc !== undefined ? Math.max(0, backNeckFirstRc - first) : undefined;
        const localNext =
          necklineLocalRc !== undefined ? Math.min(localNextRaw, necklineLocalRc) : localNextRaw;
        const bridgeAlreadyMerged =
          armholeBridgeRc !== undefined && armholeBridgeRc + 1 === evStart && localNext > localStart;
        if (localNext > localStart && !bridgeAlreadyMerged) {
          rows.push({
            kind: "block",
            rc: formatArmholeLocalRc(evStart, first),
            paragraphs: [`Knit to RC:${String(localNext).padStart(3, "0")}.`],
            stitchCount: B > 0 ? B : undefined,
          });
        }
      }
    }
    if (armholeDepthLocalRc !== undefined) {
      rows.push({
        kind: "block",
        paragraphs: [
          `Armhole depth checkpoint: shoulder shaping begins at RC:${String(armholeDepthLocalRc).padStart(3, "0")}.`,
        ],
      });
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
      const bridgeTargetGarmentRc = bridgeStartRc + n;
      const bridgeParagraphs =
        args.firstArmholeRC !== null
          ? [`Knit to RC:${formatArmholeLocalRcNumber(bridgeTargetGarmentRc, args.firstArmholeRC)}.`]
          : bridgeParas;
      rows.push({
        kind: "block",
        rc:
          args.firstArmholeRC !== null
            ? formatArmholeLocalRc(bridgeStartRc, args.firstArmholeRC)
            : formatRcColon(bridgeStartRc),
        paragraphs: bridgeParagraphs,
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
        const upperTargetGarmentRc = args.upperStartRc + args.upperBackRows;
        const upperParagraphs =
          args.firstArmholeRC !== null
            ? [`Knit to RC:${formatArmholeLocalRcNumber(upperTargetGarmentRc, args.firstArmholeRC)}.`]
            : upperParas;
        rows.push({
          kind: "block",
          rc:
            args.firstArmholeRC !== null
              ? formatArmholeLocalRc(args.upperStartRc, args.firstArmholeRC)
              : formatRcColon(args.upperStartRc),
          paragraphs: upperParagraphs,
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
        const padTargetGarmentRc = args.padStartRc + args.evenRowPadRows;
        const padParagraphs =
          args.firstArmholeRC !== null
            ? [`Knit to RC:${formatArmholeLocalRcNumber(padTargetGarmentRc, args.firstArmholeRC)}.`]
            : padParas;
        rows.push({
          kind: "block",
          rc:
            args.firstArmholeRC !== null
              ? formatArmholeLocalRc(args.padStartRc, args.firstArmholeRC)
              : formatRcColon(args.padStartRc),
          paragraphs: padParagraphs,
          stitchCount:
            carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
              ? carriedAfterArmholeSts
              : undefined,
        });
      }
    }
  }

  rows.push({
    kind: "block",
    paragraphs: [],
    tipHtml: LIFELINE_BEFORE_NECK_SHOULDER_SHAPING_TIP_HTML,
  });

  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
    });
    if (summary) {
      rows.push({
        kind: "block",
        paragraphs: summary,
        collapsibleTipHtml: NECKLINE_SHOULDER_ORIENTATION_HELP_DETAILS_HTML,
      });
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
      ...(summary ? { collapsibleTipHtml: NECKLINE_SHOULDER_ORIENTATION_HELP_DETAILS_HTML } : {}),
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
  /** Armhole RC where front neckline shaping begins (post armhole reset). */
  frontNecklineStartLocalRC?: number;
  /** Armhole RC where shoulder shaping begins (same vertical line as back neckline / shoulders). */
  shoulderShapingBeginLocalRC?: number;
  sharedExecutionRows: readonly SleevelessPatternDisplayRow[];
  useNeckChartRows: boolean;
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  shoulderStitches?: number;
  /** Piece banner (default `FRONT`; round cardigan uses `LEFT FRONT`). */
  pieceTitle?: string;
  /** When true, intro explains half-body cast-on vs full pullover front. */
  introIsCardiganHalf?: boolean;
  /** Garment RC where armhole shaping begins — required to clamp post-armhole rows without touching BODY. */
  garmentArmholeStartRC?: number;
}): SleevelessPatternDisplayRow[] {
  const sharedRows: SleevelessPatternDisplayRow[] = [];
  let inBackNecklineSection = false;
  for (const row of args.sharedExecutionRows) {
    if (row.kind === "piece") continue;
    if (row.kind === "section" && row.title === "BACK NECKLINE & SHOULDERS") {
      inBackNecklineSection = true;
      continue;
    }
    if (inBackNecklineSection) continue;
    if (row.kind === "neckShoulderChartTableMount" || row.kind === "neckShoulderChartPreviewMount") {
      continue;
    }
    if (row.kind !== "block") {
      sharedRows.push(row);
      continue;
    }
    sharedRows.push({
      ...row,
      paragraphs: row.paragraphs.map((p) =>
        p.replace(/\bfor the back\b/gi, (m) => (m[0] === "f" ? "for the front" : "For the front"))
      ),
    });
  }

  const sharedRowsClamped = clampFrontSharedRowsBeforeNeckStart(
    sharedRows,
    args.frontNecklineStartLocalRC,
    args.garmentArmholeStartRC,
  );
  const sharedRowsFrontMilestones = replaceFrontArmholeCheckpointParagraphs(
    sharedRowsClamped,
    args.frontNecklineStartLocalRC,
    args.shoulderShapingBeginLocalRC
  );

  const rows: SleevelessPatternDisplayRow[] = [];
  const pieceTitle = args.pieceTitle ?? "FRONT";
  rows.push({ kind: "piece", title: pieceTitle });
  rows.push({
    kind: "block",
    paragraphs: args.introIsCardiganHalf
      ? [
          "This piece is half the body width (one center-front edge). Cast-on and armhole counts below are for the left front only; total rows, armhole depth, and shoulder stitch counts follow the same schedule as the back.",
        ]
      : ["Front follows the same sequence as the back until neckline shaping begins."],
  });
  rows.push(...sharedRowsFrontMilestones);

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
    });
    if (summary) {
      rows.push({
        kind: "block",
        paragraphs: summary,
        collapsibleTipHtml: NECKLINE_SHOULDER_ORIENTATION_HELP_DETAILS_HTML,
      });
    }
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
  const isCardiganRoundHalfFront =
    isSleevelessCardiganGarmentStyle(patternData) && !isSleevelessVNeckChoice(patternData);
  const {
    stitchesPerInch,
    rowsPerInch,
    bustChestStitches,
    stitchesAfterArmhole: rawStitchesAfterArmholeFromChart,
  } = basic;
  const shoulderWidthIn = resolveEffectiveShoulderWidthInches(patternData);
  const rawStitchesAfterArmhole =
    shoulderWidthIn !== undefined && shoulderWidthIn > 0 && stitchesPerInch > 0
      ? Math.round(shoulderWidthIn * stitchesPerInch)
      : rawStitchesAfterArmholeFromChart;
  // Keep left/right shaping balanced by normalizing the post-armhole total to an even count.
  const stitchesAfterArmhole =
    rawStitchesAfterArmhole !== undefined && rawStitchesAfterArmhole > 0
      ? rawStitchesAfterArmhole % 2 === 0
        ? rawStitchesAfterArmhole
        : rawStitchesAfterArmhole + 1
      : rawStitchesAfterArmhole;

  const cardiganHalfLeftStitchesAfterArmhole =
    isCardiganRoundHalfFront && stitchesAfterArmhole !== undefined
      ? Math.max(1, stitchesAfterArmhole / 2)
      : undefined;

  if (!Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    warnings.push("Row gauge is missing or invalid — row counts and RC targets may be wrong.");
  }
  if (!Number.isFinite(stitchesPerInch) || stitchesPerInch <= 0) {
    warnings.push("Stitch gauge is missing or invalid — stitch counts may be wrong.");
  }

  const audience = pickAudience(patternData);
  const sm = selectedMeasurements(patternData);

  const finishedBust = resolveEffectiveFinishedBustInches(patternData) ?? basic.finishedBustChest;
  const bustChestStitchesForCastOn =
    finishedBust > 0 && stitchesPerInch > 0
      ? Math.round(finishedBust * stitchesPerInch)
      : bustChestStitches;
  // Custom Build may override chart measurements via fit.cbMeasurementOverrides.
  const backNeckToHem = resolveEffectiveFinishedLengthInches(patternData);
  const armholeDepthIn = resolveEffectiveArmholeDepthInches(patternData);
  const backNeckDepthIn = resolveEffectiveBackNeckDepthInches(patternData);
  const frontNeckDepthIn = resolveEffectiveFrontNeckDepthInches(patternData);
  const neckWidthIn = resolveEffectiveNeckOpeningWidthInches(patternData);

  const castOnSts =
    (() => {
      const baseCastOn =
        backStitchesFromPattern(bustChestStitchesForCastOn) ||
        (finishedBust > 0 && stitchesPerInch > 0
          ? Math.round((finishedBust * stitchesPerInch) / 2)
          : 0);
      // Keep the pattern symmetrical by using an even cast-on stitch count.
      return baseCastOn > 0 && baseCastOn % 2 !== 0 ? baseCastOn + 1 : baseCastOn;
    })();

  const cardiganBodySplit =
    isCardiganRoundHalfFront && castOnSts > 0
      ? splitBodyBackCastOnToSymmetricCardiganHalves(castOnSts)
      : null;
  const cardiganHalfLeftCastOnSts =
    cardiganBodySplit !== null ? cardiganHalfFrontBodySts(cardiganBodySplit, "left") : undefined;

  if (
    isCardiganRoundHalfFront &&
    cardiganHalfLeftCastOnSts !== undefined &&
    cardiganHalfLeftStitchesAfterArmhole !== undefined &&
    cardiganHalfLeftCastOnSts <= cardiganHalfLeftStitchesAfterArmhole
  ) {
    warnings.push(
      "Cardigan left front: cast-on must be greater than stitches after armhole — check bust vs shoulder width and gauge."
    );
  }

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
  let sideNeckShapingStitchesPerSideFrontPiece = 0;
  if (necklineStitches !== undefined && necklineStitches > 0) {
    sideNeckShapingStitchesPerSide = neckEdgeDecreasesPerSide(necklineStitches);
    const neckOpeningForFrontPiece =
      isCardiganRoundHalfFront ? Math.max(1, Math.round(necklineStitches / 2)) : necklineStitches;
    sideNeckShapingStitchesPerSideFrontPiece = neckEdgeDecreasesPerSide(neckOpeningForFrontPiece);
  }

  /**
   * Rows from hem to first armhole row: full-width knitting below the armhole curve,
   * excluding armhole depth and an allowance for neck + shoulder (so total length is not double-counted).
   * **Canonical** for back, pullover front, and cardigan half front — always pass this same value into
   * {@link buildSleevelessBackDisplayRows} (see {@link SleevelessBackPatternDebug.rowsFromCastOnToArmholeStart}).
   */
  let bodyToArmholeRows = 0;
  if (totalGarmentRows > 0 && armholeDepthRows > 0 && rowGauge > 0) {
    const derivedBodyRows = totalGarmentRows - armholeDepthRows - hemRows;
    if (derivedBodyRows <= 0) {
      warnings.push(
        "Body rows to armhole are non-positive after enforcing hem + body + armhole <= total rows. Verify length and armhole depth."
      );
    }
    bodyToArmholeRows = Math.max(0, derivedBodyRows);
  }

  const canonicalRowsFromCastOnToArmholeStart = hemRows + bodyToArmholeRows;

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

  const armholeTotalForBudget = armholeDepthRows > 0 ? armholeDepthRows : armholePlan ? armholePlan.totalRows : 0;
  const baseThroughArmhole = hemRows + bodyToArmholeRows + armholeTotalForBudget;
  const armholeStartRC =
    armholePlan && firstArmholeRCNum !== null ? firstArmholeRCNum : undefined;
  const armholeEndRC = armholePlan ? armholePlan.endRC : undefined;
  const armholeDepthEndRC =
    armholeStartRC !== undefined && armholeDepthRows > 0
      ? armholeStartRC + armholeDepthRows
      : undefined;

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
   * Armhole depth is the upper-body master budget: neckline depth and shoulder shaping
   * are scheduled INSIDE the armhole rows instead of being added afterward.
   */
  let upperBackRows = 0;
  /** Kept for downstream display compatibility; the new schedule no longer emits parity pads. */
  let evenRowPadRows = 0;
  let upperStartRc = 0;
  let padStartRc = 0;
  const shoulderEndRC =
    armholeStartRC !== undefined && armholeDepthRows > 0
      ? armholeStartRC + armholeDepthRows + 1
      : totalGarmentRows > 0
        ? totalGarmentRows + 1
        : undefined;
  let neckStartRC =
    shoulderEndRC !== undefined && backNeckDepthRows > 0
      ? shoulderEndRC - backNeckDepthRows
      : rc + 1;

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
   * Front neckline also starts from the same shoulder endpoint, independently from shoulder shaping.
   * Begins after (armhole depth − front neck depth) rows from the armhole bind-off so neckline depth
   * stays inside the armhole depth budget (not stacked as extra garment length).
   */
  const effectiveFrontNeckDepthRows =
    frontNeckDepthRows > 0 ? frontNeckDepthRows : backNeckDepthRows;
  const frontNecklineStartRC =
    armholeStartRC !== undefined && armholeDepthRows > 0 && effectiveFrontNeckDepthRows > 0
      ? Math.max(0, armholeStartRC + armholeDepthRows - effectiveFrontNeckDepthRows)
      : shoulderEndRC !== undefined && effectiveFrontNeckDepthRows > 0
        ? Math.max(0, shoulderEndRC - effectiveFrontNeckDepthRows)
        : Math.max(0, rc - Math.max(0, frontNeckDepthRows) + 1);
  /**
   * Front scoop starts one row earlier than `shoulderEndRC − F` but must still end at the same
   * shoulder line; extend the timeline by the extra RC so chart / execution hit `shoulderEndRC − 1`.
   */
  const frontNeckTimelineDepthRows =
    shoulderEndRC !== undefined
      ? Math.max(effectiveFrontNeckDepthRows, shoulderEndRC - frontNecklineStartRC)
      : effectiveFrontNeckDepthRows;
  const shoulderStartRC =
    shoulderEndRC !== undefined && shoulderBindoffRows > 0
      ? Math.max(0, shoulderEndRC - shoulderBindoffRows)
      : undefined;

  if (totalGarmentRows > 0 && baseThroughArmhole > totalGarmentRows) {
    const rowBudgetDiagnostic = [
      "Pattern length check failed.",
      "",
      `Total garment rows available: ${totalGarmentRows}`,
      "",
      "Rows being counted:",
      `- Hem rows: ${hemRows}`,
      `- Body rows: ${bodyToArmholeRows}`,
      `- Armhole rows: ${armholeTotalForBudget}`,
      "",
      `Total used rows: ${baseThroughArmhole}`,
      `Difference: +${baseThroughArmhole - totalGarmentRows} rows over budget`,
      "",
      "Formula check:",
      "hemRows + bodyRows + armholeRows > totalGarmentRows",
      `${hemRows} + ${bodyToArmholeRows} + ${armholeTotalForBudget} > ${totalGarmentRows}`,
    ].join("\n");
    warnings.push(rowBudgetDiagnostic);
    console.warn(rowBudgetDiagnostic);
  }
  if (armholeDepthRows > 0 && backNeckDepthRows > armholeDepthRows) {
    warnings.push(
      `Back neck depth rows exceed armhole rows: backNeckDepthRows=${backNeckDepthRows}, armholeRows=${armholeDepthRows}.`
    );
  }
  if (armholeDepthRows > 0 && effectiveFrontNeckDepthRows > armholeDepthRows) {
    warnings.push(
      `Front neck depth rows exceed armhole rows: frontNeckDepthRows=${effectiveFrontNeckDepthRows}, armholeRows=${armholeDepthRows}.`
    );
  }
  if (armholeDepthRows > 0 && shoulderBindoffRows > armholeDepthRows) {
    warnings.push(
      `Shoulder shaping rows exceed armhole rows: shoulderShapingRows=${shoulderBindoffRows}, armholeRows=${armholeDepthRows}.`
    );
  }

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
  let   frontExec = makePlaceholderNeckShoulderExecution(
    preambleStartRcBeforeFirstShapingRow(frontNecklineStartRC)
  );

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
    const necklineOpeningStsForFrontPiece = isCardiganRoundHalfFront
      ? Math.max(1, Math.round(necklineStitches / 2))
      : necklineStitches;
    const initialCenterStsFrontPiece = initialCenterNeckStitches(necklineOpeningStsForFrontPiece);
    const stitchesAfterArmholeForFrontPiece =
      isCardiganRoundHalfFront && cardiganHalfLeftStitchesAfterArmhole !== undefined
        ? cardiganHalfLeftStitchesAfterArmhole
        : stitchesAfterArmhole!;

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
            centerNeckBindOff: necklineOpeningStsForFrontPiece,
            neckDepthRows: frontNeckTimelineDepthRows,
            neckProfile: "front",
            stitchesAfterArmhole: stitchesAfterArmholeForFrontPiece,
            shoulderBindoffRows,
          }
        : {
            firstShapingRow: frontNecklineStartRC,
            shoulderStitchesPerSide: shoulderSts,
            centerNeckBindOff: necklineOpeningStsForFrontPiece,
            neckDepthRows: backNeckDepthRows,
            neckProfile: "back",
            stitchesAfterArmhole: stitchesAfterArmholeForFrontPiece,
            shoulderBindoffRows,
          };

    const isFrontVNeck = isSleevelessVNeckChoice(patternData);

    const patternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: neckStartRC,
      shoulderStitchesPerSide: shoulderStitches,
      centerNeckBindOff: necklineStitches,
      neckDepthRows: backNeckDepthRows,
      neckProfile: "back",
      stitchesAfterArmhole: stitchesAfterArmhole!,
      shoulderBindoffRows,
    };
    /** Shoulder bind-off chunks from **back** neck depth / opening math only — never from the front neckline choice. */
    const shoulderSchedule = computeShoulderBindoffSchedule(patternNumbers);
    const shoulderTimelineOpts = shoulderSchedule !== null ? { shoulderSchedule } : undefined;
    const { timeline, chartRows: liveRows } = buildNeckShoulderTimelineAndChartRows(
      patternNumbers,
      {
        ...shoulderTimelineOpts,
      }
    );

    let frontTimeline: RowEntry[] = [];
    let frontLiveRows: NeckShoulderShapingChartRow[] = [];

    if (liveRows.length > 0) {
      backNeckShoulderTimeline = timeline;
      neckShoulderShapingChart = neckShoulderShapingChartFromRows(liveRows, {
        timeline,
        sleevelessFullWidthVNeckFront: false,
      });
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

    const backFinalShoulderRemainderPerSide = Math.max(
      0,
      Math.min(
        Math.floor(Number(liveRows[liveRows.length - 1]?.leftStitchCount ?? 0)),
        Math.floor(Number(liveRows[liveRows.length - 1]?.rightStitchCount ?? 0))
      )
    );

    const builtFront = isFrontVNeck
      ? (() => {
          const vFront = buildVNeckFrontFullWidthTimeline(frontPatternNumbers, {
            ...shoulderTimelineOpts,
            minFinalStitchesPerSide: backFinalShoulderRemainderPerSide,
          });
          warnings.push(...vFront.vNeckPlanWarnings);
          return {
            timeline: vFront.timeline,
            chartRows: neckShoulderChartRowsFromTimeline(vFront.timeline),
          };
        })()
      : buildNeckShoulderTimelineAndChartRows(frontPatternNumbers, {
          ...shoulderTimelineOpts,
          minFinalStitchesPerSide: backFinalShoulderRemainderPerSide,
        });
    frontTimeline = builtFront.timeline;
    frontLiveRows = builtFront.chartRows;

    if (frontLiveRows.length > 0) {
      frontNeckShoulderTimeline = frontTimeline;
      frontNeckShoulderShapingChart = neckShoulderShapingChartFromRows(frontLiveRows, {
        timeline: frontTimeline,
        sleevelessFullWidthVNeckFront: isFrontVNeck,
      });
      frontNeckShoulderChartUsesLiveRows = true;

      const firstRowCenterBo = centerBindOffAmountFirstTimelineRow(frontTimeline);
      const frontVNeckCenterPreamble: CenterBindOffExecutionText = {
        preambleLine:
          "V-neck: there is no center neckline bind-off. Work inner-neck decreases toward center per chart from the V point (first neckline RC) through the shoulder shaping rows.",
        shapingAtRcLine: "",
      };

      const centerFrontBindOff: NeedleRange = isFrontVNeck
        ? {
            label: "center neckline (V-neck — no bind-off)",
            start: "—",
            end: "—",
            stitchCount: 0,
          }
        : {
            ...center,
            stitchCount: firstRowCenterBo > 0 ? firstRowCenterBo : initialCenterStsFrontPiece,
          };

      const frontCenterExec = isFrontVNeck
        ? undefined
        : centerBindOffExecutionTextFromChartRow(frontTimeline, frontLiveRows[0]);
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
        centerBindOffExecutionText: isFrontVNeck ? frontVNeckCenterPreamble : frontCenterExec,
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
      const frontNeckSectionRows =
        frontNeckDepthRows > 0 ? frontNeckTimelineDepthRows : backNeckDepthRows;
      const centerNeckPlaceholder: NeedleRange = {
        ...center,
        stitchCount: isCardiganRoundHalfFront ? initialCenterStsFrontPiece : initialCenterSts,
      };
      frontExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(frontNecklineStartRC),
        centerNeck: centerNeckPlaceholder,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions:
          sideNeckShapingStitchesPerSideFrontPiece > 0
            ? [
                {
                  startRC: frontNecklineStartRC,
                  endRC: frontNecklineStartRC + frontNeckSectionRows - 1,
                  text: `At neck edge, decrease toward center — ${sideNeckShapingStitchesPerSideFrontPiece} stitch${
                    sideNeckShapingStitchesPerSideFrontPiece === 1 ? "" : "es"
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
  const armholeDepthRowsOut = armholeDepthRows > 0 ? armholeDepthRows : armholeRowsTotal;
  /** Armhole is the master upper-body span; neckline + shoulder rows are inside it. */
  const totalCalculatedRows = hemRows + bodyToArmholeRows + armholeRowsTotal;

  if (totalGarmentRows > 0) {
    rc = totalGarmentRows;
  }

  const frontChartRowsOut = frontNeckShoulderShapingChart.rows;
  const fb = timelineRcBounds(frontNeckShoulderTimeline);
  const bb = timelineRcBounds(backNeckShoulderTimeline);
  const frontExecRc = parseRcBoundsFromExecutionLines(frontExec.lines);
  const backNecklineStartLocalRC =
    armholeStartRC !== undefined ? Math.max(0, Math.floor(neckStartRC - armholeStartRC)) : undefined;
  const frontNecklineStartLocalRC =
    armholeStartRC !== undefined
      ? Math.max(0, Math.floor(frontNecklineStartRC - armholeStartRC))
      : undefined;

  /** Final piece RCs derived from the timeline (chart) when present, else from the scheduled span. */
  const backFinalRow =
    bb.last ??
    (shoulderEndRC !== undefined
      ? shoulderEndRC - 1
      : backNeckDepthRows > 0
        ? neckStartRC + backNeckDepthRows - 1
        : undefined);
  /** Same shoulder-line garment RC as the back — front scoop starts earlier but ends at the same piece length. */
  const frontFinalRow =
    shoulderEndRC !== undefined
      ? shoulderEndRC - 1
      : fb.last ??
        (effectiveFrontNeckDepthRows > 0
          ? frontNecklineStartRC + frontNeckTimelineDepthRows - 1
          : undefined);
  const timelineShoulderStartRow = backNeckShoulderTimeline?.find((entry) =>
    entry.events.some(
      (ev) => ev.edge === "outer" && (ev.kind === "bindOff" || ev.kind === "decrease") && ev.amount > 0
    )
  )?.row;
  const shoulderStartRow = timelineShoulderStartRow ?? shoulderStartRC;

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
    armholeRows: armholeDepthRowsOut,
    armholeShapingRows: armholeRowsTotal,
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
    frontNeckTimelineDepthRows,
    backNeckDepthRows,
    shoulderBindoffRows: rowGauge > 0 ? shoulderBindoffRows : undefined,
    backNecklineStartRC: neckStartRC,
    frontNecklineStartRC,
    backNecklineStartLocalRC,
    frontNecklineStartLocalRC,
    rowsFromCastOnToArmholeStart: canonicalRowsFromCastOnToArmholeStart,
    finalRC: rc,
    armholeStartRow: armholeStartRC,
    armholeEndRow: armholeEndRC,
    armholeDepthEndRow: armholeDepthEndRC,
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
    ...(isCardiganRoundHalfFront && cardiganHalfLeftCastOnSts !== undefined
      ? {
          cardiganHalfLeftCastOnSts: cardiganHalfLeftCastOnSts,
          cardiganHalfLeftStitchesAfterArmhole: cardiganHalfLeftStitchesAfterArmhole,
        }
      : {}),
    ...(isSleevelessCardiganGarmentStyle(patternData)
      ? {
          cardiganFrontEdgeRows: cardiganFrontEdgeRowsFromDebug({ frontNecklineStartRC }),
          cardiganFrontEdgePickupSts: cardiganFrontEdgePickupStitchesFromDebug({
            frontNecklineStartRC,
          }),
        }
      : {}),
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

  const cardiganFrontExecutionRowsRaw =
    isCardiganRoundHalfFront &&
    cardiganHalfLeftCastOnSts !== undefined &&
    cardiganHalfLeftStitchesAfterArmhole !== undefined &&
    armholeMathResult !== null &&
    firstArmholeRCNum !== null
      ? buildSleevelessBackDisplayRows({
          castOnSts: cardiganHalfLeftCastOnSts,
          hemRows,
          hemRowsValid: hemRows > 0,
          bodyToArmholeRows,
          bodyRowsValid: bodyToArmholeRows > 0,
          armholeMath: armholeMathResult,
          firstArmholeRC: firstArmholeRCNum,
          stitchesAfterArmhole: cardiganHalfLeftStitchesAfterArmhole,
          upperBackRows,
          upperStartRc,
          evenRowPadRows,
          padStartRc,
          backNecklineStartRC: neckStartRC,
          neckChartRows: neckShoulderShapingChart.rows,
          useNeckChartRows: neckShoulderChartUsesLiveRows,
          necklineStitches,
          shoulderStitches,
          armholeInstructionStyle: "cardiganHalfLeftFront",
          castOnForPieceLabel: "the left front",
        })
      : null;

  const frontSharedExecutionRows = cardiganFrontExecutionRowsRaw ?? backDisplayRowsRaw;

  const necklineStitchesForFrontSummary =
    necklineStitches === undefined
      ? undefined
      : isCardiganRoundHalfFront
        ? Math.max(1, Math.round(necklineStitches / 2))
        : necklineStitches;

  const displayRows = mergeAdjacentPlainKnitBlocks(backDisplayRowsRaw);
  const frontDisplayRows = mergeAdjacentPlainKnitBlocks(
    buildSleevelessFrontDisplayRows({
      frontNecklineStartRC,
      frontNecklineStartLocalRC,
      shoulderShapingBeginLocalRC: backNecklineStartLocalRC,
      sharedExecutionRows: frontSharedExecutionRows,
      useNeckChartRows: frontNeckShoulderChartUsesLiveRows,
      neckChartRows: frontNeckShoulderShapingChart.rows,
      necklineStitches: necklineStitchesForFrontSummary,
      shoulderStitches,
      pieceTitle: isCardiganRoundHalfFront ? "LEFT FRONT" : undefined,
      introIsCardiganHalf: isCardiganRoundHalfFront,
      garmentArmholeStartRC: armholeStartRC,
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
