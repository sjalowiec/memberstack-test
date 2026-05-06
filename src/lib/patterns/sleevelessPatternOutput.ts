/**
 * Plain-text pattern output for sleeveless garments (machine knitting).
 * First slice: BACK piece only — no finishing, pickup, or armhole pickup blocks.
 */

import { calculateArmholeShaping, type ArmholeResult } from "./legoBlocks/armholeBlock";
import {
  generateNeckShoulderExecution,
  shapingActionsFromTimeline,
  type NeedleRange,
  type ShapingAction,
} from "./legoBlocks/neckShoulderExecution";
import { calculateBasicPatternNumbers } from "./patternCalculator";
import { calculateHemRows } from "./hemDefaults";
import {
  DEMO_NECK_SHOULDER_SHAPING_CHART,
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
  type NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderTimelineAndChartRows,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";
import { type RowEntry } from "./shapingTimeline";
import { calculateRoundFrontNeckline } from "./legoBlocks/roundFrontNeckline";
import {
  initialCenterNeckStitches,
  neckEdgeDecreasesPerSide,
} from "./legoBlocks/roundNeckline";

/**
 * Trusted HTML for ribbed-hem helper (mock ribbing / hung hem tooltips).
 * Same wording as hat brim tip — render only via innerHTML from pattern output, never user input.
 */
export const RIBBED_HEM_PATTERN_TIP_HTML =
  'Work even in your chosen brim treatment — for example 1x1 or 2x2 ribbing or <span class="pattern-term" data-tooltip="Stitch pattern that copies knit and purl ribbing by having needles out of work. A favorite for knitters without a ribber.">mock ribbing</span>, a rolled stockinette edge, a fold-up band, or a <span class="pattern-term" data-tooltip="A folded, double-layer hem formed by hanging the cast-on stitches back onto the needles.">hung hem</span> — for the depth shown.';

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

/** List of row numbers for inline copy: `(82, 85, 87)` — no RC prefix, no leading zeroes. */
function formatRowNumbersParen(nums: readonly number[]): string {
  return `(${nums
    .map((n) => String(Math.max(0, Math.floor(n))))
    .join(", ")})`;
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
      if (r.stitchCount !== undefined) out.push(`${r.stitchCount} sts`);
      out.push("");
    }
  }
  return out;
}

/** Plain continuation only — single paragraph, no stitch-count column (presentation merge). */
const PLAIN_KNIT_PATTERN_FOR_ROWS_RE = /^Knit in pattern for (\d+) rows?\.?$/i;

function extractPlainKnitPatternRowCount(paragraph: string): number | undefined {
  const m = paragraph.trim().match(PLAIN_KNIT_PATTERN_FOR_ROWS_RE);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function isMergeablePlainKnitBlock(
  row: SleevelessPatternDisplayRow
): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> & { paragraphs: [string] } {
  if (row.kind !== "block") return false;
  if (row.tipHtml) return false;
  if (row.stitchCount !== undefined) return false;
  if (row.paragraphs.length !== 1) return false;
  return extractPlainKnitPatternRowCount(row.paragraphs[0]) !== undefined;
}

/**
 * Merge consecutive plain “Knit in pattern for N rows” blocks into one line with summed rows and the first RC.
 * Sections/pieces break adjacency automatically. Blocks with shaping or a stitch count are unchanged.
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

    let total = extractPlainKnitPatternRowCount(row.paragraphs[0])!;
    const firstRc = row.rc;
    let j = i + 1;
    while (j < rows.length) {
      const candidate = rows[j];
      if (!isMergeablePlainKnitBlock(candidate)) break;
      total += extractPlainKnitPatternRowCount(candidate.paragraphs[0])!;
      j++;
    }

    if (j > i + 1) {
      out.push({
        kind: "block",
        rc: firstRc,
        paragraphs: [`Knit in pattern for ${total} rows.`],
      });
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
  "Follow the chart row by row for neckline shaping. Stitch counts shown are the stitches remaining after the action on that row.",
  "When neckline shaping is complete, bind off the remaining shoulder stitches. Repeat for the second side.",
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
      ? [`Knit in pattern for ${ribs} rows.`]
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
      ? [`Knit in pattern for ${args.bodyToArmholeRows} rows.`]
      : [
          "Body length to the armhole could not be calculated. Confirm back neck to hem, armhole depth, and row gauge in Fit, then try again.",
        ],
    stitchCount: A > 0 ? A : undefined,
  });

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
    const decRowNumbers = Array.from({ length: m.decreaseSts }, (_, i) => decStart + 2 * i);
    const decRowListParen = formatRowNumbersParen(decRowNumbers);

    rows.push({
      kind: "block",
      rc: formatRcColon(first),
      paragraphs: [
        "Begin armhole shaping.",
        `Bind off ${bo} stitches on the carriage side (armhole edge).`,
        "Knit in pattern across.",
      ],
      // Display stitches at row start; row action applies after this row.
      stitchCount: A,
    });
    rows.push({
      kind: "block",
      rc: formatRcColon(first + 1),
      paragraphs: [
        `Bind off ${bo} stitches on the carriage side (armhole edge).`,
        "Knit in pattern across.",
      ],
      stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
    });

    if (m.decreaseSts > 0) {
      rows.push({
        kind: "block",
        rc: formatRcColon(decStart),
        paragraphs: [
          `At each armhole edge, decrease 1 stitch every other row, ${m.decreaseSts} times total (${m.decreaseRows} shaping rows).`,
          `Work decreases on rows ${decRowListParen}.`,
        ],
        stitchCount: afterBo2 > 0 ? afterBo2 : undefined,
      });
    }

    if (m.evenRows > 0) {
      const evStart = first + 2 + m.decreaseRows;
      rows.push({
        kind: "block",
        rc: formatRcColon(evStart),
        paragraphs: [`Knit in pattern for ${m.evenRows} rows.`],
        stitchCount: B > 0 ? B : undefined,
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

  if (args.upperBackRows > 0) {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.upperStartRc),
      paragraphs: [`Knit in pattern for ${args.upperBackRows} rows.`],
      stitchCount:
        carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
          ? carriedAfterArmholeSts
          : undefined,
    });
  }
  if (args.evenRowPadRows > 0) {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.padStartRc),
      paragraphs: [
        args.evenRowPadRows > 1
          ? `Knit in pattern for ${args.evenRowPadRows} rows.`
          : "Knit in pattern for 1 row.",
      ],
      stitchCount:
        carriedAfterArmholeSts !== undefined && carriedAfterArmholeSts > 0
          ? carriedAfterArmholeSts
          : undefined,
    });
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
  useNeckChartRows: boolean;
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  shoulderStitches?: number;
  /** When set and less than {@link necklineStitches}, summary describes partial first bind-off + gradual scoop. */
  scoopFirstCenterBindOff?: number;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "FRONT" });
  rows.push({
    kind: "block",
    paragraphs: [`Work as for Back to RC ${Math.max(0, Math.floor(args.frontNecklineStartRC))}.`],
  });

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
  const { stitchesPerInch, rowsPerInch, bustChestStitches, stitchesAfterArmhole } = basic;

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
    backStitchesFromPattern(bustChestStitches) ||
    (finishedBust > 0 && stitchesPerInch > 0
      ? Math.round((finishedBust * stitchesPerInch) / 2)
      : 0);

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
      N = Math.round(neckWidthIn! * stitchesPerInch);
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

  /**
   * Reach expected garment length: upper back absorbs rows that were previously
   * subtracted as "reserved" neckline rows but never knitted. Neckline start RC
   * must be even (carriage right); choose upper-back rows + optional parity pad
   * so the last RC before the neckline block matches the length budget.
   */
  function solveUpperBackAndPad(
    baseRc: number,
    targetFinalRc: number
  ): { upperRows: number; padRows: number } {
    if (!Number.isFinite(targetFinalRc) || targetFinalRc <= baseRc) {
      return { upperRows: 0, padRows: 0 };
    }
    for (let t = Math.floor(targetFinalRc); t >= baseRc; t--) {
      const need = t - baseRc;
      for (let pad = 0; pad <= 1; pad++) {
        const upperRows = need - pad;
        if (upperRows < 0) continue;
        if (baseRc + upperRows + pad !== t) continue;
        const neckStart = t + 1;
        if (neckStart % 2 === 0) {
          return { upperRows, padRows: pad };
        }
      }
    }
    return { upperRows: Math.max(0, targetFinalRc - baseRc), padRows: 0 };
  }

  let upperBackRows = 0;
  let evenRowPadRows = 0;
  if (totalGarmentRows > 0) {
    const solved = solveUpperBackAndPad(baseThroughArmhole, totalGarmentRows);
    upperBackRows = solved.upperRows;
    evenRowPadRows = solved.padRows;
    if (totalGarmentRows < baseThroughArmhole) {
      warnings.push(
        "Row budget is tight: hem + body + armhole exceed total garment rows — verify lengths."
      );
    }
  }

  let upperStartRc = 0;
  if (upperBackRows > 0) {
    upperStartRc = rc + 1;
    rc += upperBackRows;
  } else if (totalGarmentRows === 0) {
    warnings.push("Upper-back row count not derived — check total length vs hem, body, armhole, and neck reserve.");
  }

  let padStartRc = 0;
  let neckStartRC = rc + 1;
  if (evenRowPadRows > 0) {
    padStartRc = rc + 1;
    rc += evenRowPadRows;
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

  const frontNeckDepthRows =
    rowGauge > 0 && frontNeckDepthIn !== undefined
      ? Math.max(1, Math.round(frontNeckDepthIn * rowGauge))
      : 0;
  /** Back neckline vertical depth in rows (single budget for unified neck + shoulder timeline). */
  const backNeckDepthRows =
    rowGauge > 0 ? Math.max(1, Math.round((backNeckDepthIn ?? 2.5) * rowGauge)) : 0;
  const shoulderBindoffRows =
    rowGauge > 0 ? Math.max(1, Math.round(rowGauge * 1)) : 1;
  const frontNecklineStartRC = Math.max(0, rc - Math.max(0, frontNeckDepthRows) + 1);

  let neckShoulderShapingChart: NeckShoulderShapingChart = DEMO_NECK_SHOULDER_SHAPING_CHART;
  let neckShoulderChartUsesLiveRows = false;
  let frontNeckShoulderShapingChart: NeckShoulderShapingChart = DEMO_NECK_SHOULDER_SHAPING_CHART;
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

    const patternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: neckStartRC,
      shoulderStitchesPerSide: shoulderStitches,
      centerNeckBindOff: necklineStitches,
      neckDepthRows: backNeckDepthRows,
      neckProfile: "back",
      stitchesAfterArmhole: stitchesAfterArmhole!,
      shoulderBindoffRows,
    };
    const { timeline, chartRows: liveRows } = buildNeckShoulderTimelineAndChartRows(patternNumbers);

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

    let frontTimeline: RowEntry[] = [];
    let frontLiveRows: NeckShoulderShapingChartRow[] = [];
    let roundFrontNeckResult: ReturnType<typeof calculateRoundFrontNeckline> | undefined;

    if (frontNeckDepthRows > 0) {
      roundFrontNeckResult = calculateRoundFrontNeckline({
        necklineStitches,
        neckDepthRows: frontNeckDepthRows,
        startRC: frontNecklineStartRC,
        shoulderStitchesPerSide: shoulderSts,
      });
      warnings.push(...roundFrontNeckResult.warnings);
    }

    const builtFront = buildNeckShoulderTimelineAndChartRows(frontPatternNumbers);
    frontTimeline = builtFront.timeline;
    frontLiveRows = builtFront.chartRows;

    if (liveRows.length > 0) {
      backNeckShoulderTimeline = timeline;
      neckShoulderShapingChart = neckShoulderShapingChartFromRows(liveRows, { timeline });
      neckShoulderChartUsesLiveRows = true;

      const backDerived = shapingActionsFromTimeline(timeline);
      neckExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(timeline[0]?.row ?? neckStartRC),
        centerNeck: center,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions: backDerived.neckActions,
        shoulderActions: backDerived.shoulderActions,
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
        stitchCount:
          roundFrontNeckResult !== undefined
            ? roundFrontNeckResult.centerBindOff
            : firstRowCenterBo > 0
              ? firstRowCenterBo
              : initialCenterSts,
      };
      const effectiveFrontCenterBo =
        roundFrontNeckResult !== undefined ? roundFrontNeckResult.centerBindOff : firstRowCenterBo;
      if (effectiveFrontCenterBo > 0 && effectiveFrontCenterBo < necklineStitches!) {
        frontScoopFirstCenterBindOff = effectiveFrontCenterBo;
      }

      const frontDerived = shapingActionsFromTimeline(frontTimeline);
      frontExec = generateNeckShoulderExecution({
        startRC: preambleStartRcBeforeFirstShapingRow(frontTimeline[0]?.row ?? frontNecklineStartRC),
        centerNeck: centerFrontBindOff,
        leftShoulder: todoNeedle("left shoulder stitches"),
        rightShoulder: todoNeedle("right shoulder stitches"),
        neckActions: frontDerived.neckActions,
        shoulderActions: frontDerived.shoulderActions,
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
  const totalCalculatedRows =
    hemRows + bodyToArmholeRows + armholeRowsTotal + upperBackRows + evenRowPadRows;

  if (totalGarmentRows > 0) {
    rc = totalGarmentRows;
  }

  const frontChartRowsOut = frontNeckShoulderShapingChart.rows;
  const fb = timelineRcBounds(frontNeckShoulderTimeline);
  const bb = timelineRcBounds(backNeckShoulderTimeline);
  const frontExecRc = parseRcBoundsFromExecutionLines(frontExec.lines);

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

  const displayRows = mergeAdjacentPlainKnitBlocks(
    buildSleevelessBackDisplayRows({
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
      neckChartRows: neckShoulderShapingChart.rows,
      useNeckChartRows: neckShoulderChartUsesLiveRows,
      necklineStitches,
      shoulderStitches,
    })
  );
  const frontDisplayRows = mergeAdjacentPlainKnitBlocks(
    buildSleevelessFrontDisplayRows({
      frontNecklineStartRC,
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
