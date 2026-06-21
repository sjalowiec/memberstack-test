/**
 * Plain-text pattern output for DROP SHOULDER sweaters (machine knitting).
 *
 * Adapted from the sleeveless builder. Key differences:
 * - Armhole depth is NOT a user input — it is derived as finished upper arm ÷ 2.
 * - The body is knit straight above the armhole markers: there is NO armhole shaping,
 *   sleeve cap, sleeve head, or shoulder shaping.
 * - Adds a SLEEVE piece (simple tapered trapezoid) that can be written cuff-up or top-down
 *   from the same geometry.
 *
 * The result intentionally matches {@link SleevelessBackPatternResult} (plus `sleeveDisplayRows`
 * and an `isDropShoulder` flag) so the existing pattern-workspace renderer can consume it.
 */

import { calculateBasicPatternNumbers } from "./patternCalculator";
import {
  calculateHemRowsFromInches,
  calculateCuffRowsFromInches,
  roundUpToEvenRows,
} from "./hemDefaults";
import { resolveEffectiveCuffDepthInches } from "./customBuildEffectiveCuffDepth";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { resolveEffectiveShoulderWidthInches } from "./customBuildEffectiveShoulderWidth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { isDropShoulderPatternData } from "./dropShoulderSleeveMeasurementOverrides";
import { resolveDropShoulderSleeveInches } from "./dropShoulderSleeveMeasurementOverrides";
import { findExpressChartRow } from "./sleevelessExpressSizeChartClient";
import { calculateRoundNecklineShaping } from "./legoBlocks/roundNeckline";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import { evenShapingSchedule } from "./evenShapingSchedule";
import {
  castOnMethodQuickTipInnerHtml,
  ribbedHemTipDisplayRow,
  pieceMarkersSeamingTipDisplayRow,
  formatRcColon,
  type SleevelessPatternDisplayRow,
  type SleevelessBackPatternResult,
  type SleevelessBackPatternDebug,
} from "./sleevelessPatternOutput";
import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import {
  DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES,
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleeveNeedsShapingChart,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import { DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT } from "./dropShoulderSleeveConstruction";
import { buildGlossaryTooltipPlaceholderHtml, PLACE_MARKER_GLOSSARY_ID } from "../glossary/glossaryTooltipPrint";
import { SCRAP_OFF_GLOSSARY_ID } from "./neckShoulderActiveIntroCopy";

/** Drop shoulder result reuses the sleeveless contract and adds the sleeve piece. */
export type DropShoulderPatternResult = SleevelessBackPatternResult & {
  /** Structured sleeve instructions (bottom-up or top-down per pattern-view choice). */
  sleeveDisplayRows: SleevelessPatternDisplayRow[];
  /** Marker so the renderer uses the drop-shoulder (sleeved, no-diagram) layout. */
  isDropShoulder: true;
};

export type GenerateDropShoulderPatternOptions = {
  /** Pattern-view sleeve construction; defaults to bottom-up (cuff-up). Not read from builder style. */
  sleeveDirection?: DropShoulderSleeveDirection;
};

export type BuildDropShoulderSleeveRowsArgs = {
  topSts: number;
  wristSts: number;
  cuffRows: number;
  sleeveBodyRows: number;
  sleeveTotalRows: number;
  direction: DropShoulderSleeveDirection;
  valid: boolean;
};

type Block = Extract<SleevelessPatternDisplayRow, { kind: "block" }>;

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

/**
 * Custom-build sleeve override (inches) from `fit.cbMeasurementOverrides`, mirroring the body
 * fields' resolveEffective* pattern. Express / non–custom-build modes always use the chart value,
 * so this returns undefined and the caller falls back to `selectedMeasurements`.
 */
function sleeveOverrideInches(
  patternData: Record<string, unknown>,
  camelKey: string,
): number | undefined {
  const fit = section(patternData.fit);
  const overrides = section(fit.cbMeasurementOverrides);
  const override = positiveMeasurementInches(overrides[camelKey]);
  if (override === undefined) return undefined;
  if (isCustomBuildPatternMode(patternData) || isDropShoulderPatternData(patternData)) {
    return override;
  }
  return undefined;
}

function measurementInches(sm: Record<string, unknown>, key: string): number | undefined {
  const v = sm[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Round to whole stitches and force even (paired edges / balanced shaping). */
function forceEven(n: number): number {
  const r = Math.max(0, Math.round(n));
  return r % 2 === 0 ? r : r + 1;
}

/** Plain-knit instruction line; optionally states the RC the counter will read at the end. */
function knitEvenLine(rows: number, endRc?: number): string {
  if (rows <= 0) return "";
  const base = rows === 1 ? "Knit 1 row even." : `Knit ${rows} rows even.`;
  return endRc !== undefined ? `${base} (Counter reads ${formatRcColon(endRc)} at the end.)` : base;
}

/** Sleeve body remainder after shaping — work in pattern to length. */
function knitInPatternLine(rows: number): string {
  if (rows <= 0) return "";
  return rows === 1 ? "Knit 1 row in pattern." : `Knit ${rows} rows in pattern.`;
}

function glossaryAttrEscape(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function scrapOffGlossaryPlaceholderHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    SCRAP_OFF_GLOSSARY_ID,
    "scrap off",
    glossaryAttrEscape,
    (s) => s,
  );
}

/** Bind-off line with glossary tooltip on “scrap off” (glossary id 311). */
function bindOffLooselyOrScrapOffTrustedParagraph(edgeLabel?: string): string {
  const scrap = scrapOffGlossaryPlaceholderHtml();
  if (edgeLabel) {
    return `Bind off loosely or ${scrap} at the ${edgeLabel}.`;
  }
  return `Bind off loosely or ${scrap}.`;
}

/** No-shaping sleeve note with glossary tooltip on “scrap off”. */
function dropShoulderSleeveNoShapingNoteTrustedParagraphs(): string[] {
  return DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES.map((line) => {
    const scrapIdx = line.indexOf("scrap off");
    if (scrapIdx < 0) return line;
    return (
      line.slice(0, scrapIdx) +
      scrapOffGlossaryPlaceholderHtml() +
      line.slice(scrapIdx + "scrap off".length)
    );
  });
}

function placeMarkerGlossaryPlaceholderHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    PLACE_MARKER_GLOSSARY_ID,
    "Place a marker",
    glossaryAttrEscape,
    (s) => s,
  );
}

/** Inline glossary link on “Place a marker” within a marker-placement instruction line. */
function withPlaceMarkerGlossaryLink(line: string): string {
  const phrase = "Place a marker";
  const idx = line.indexOf(phrase);
  if (idx < 0) return line;
  return line.slice(0, idx) + placeMarkerGlossaryPlaceholderHtml() + line.slice(idx + phrase.length);
}

/** Trusted paragraphs for an armhole-marker block (glossary on “Place a marker” in the first line). */
function armholeMarkerBlockParagraphs(markerLine: string, followUpLines: string[]): {
  paragraphs: string[];
  trustedParagraphs: string[];
} {
  return {
    paragraphs: [markerLine, ...followUpLines],
    trustedParagraphs: [withPlaceMarkerGlossaryLink(markerLine), ...followUpLines],
  };
}

/** "every row" (1) vs "every N rows". */
function intervalPhrase(interval: number): string {
  return interval <= 1 ? "every row" : `every ${interval} rows`;
}

function castOnBlock(sts: number, label?: string): Block {
  const castOnLine =
    sts > 0 && label
      ? `Cast on ${sts} stitches for ${label}.`
      : sts > 0
        ? `Cast on ${sts} stitches.`
        : "Cast-on stitch count could not be calculated from your measurements. Add finished bust or chest and stitch gauge in the builder, then open this tab again.";
  return {
    kind: "block",
    rc: formatRcColon(0),
    paragraphs: [castOnLine],
    ...(sts > 0
      ? {
          tipHtml: castOnMethodQuickTipInnerHtml(),
          tipHtmlIsFull: true,
          tipPresentation: "quick-tip" as const,
          ...(label
            ? { tipId: `drop-shoulder-cast-on-${label.replace(/[^a-z]+/gi, "-").toLowerCase()}` }
            : {}),
        }
      : {}),
    stitchCount: sts > 0 ? sts : undefined,
  };
}

function hemBlocks(piece: "back" | "front", hemRows: number, hemRowsValid: boolean, sts: number): SleevelessPatternDisplayRow[] {
  return [
    { kind: "section", title: "RIBBED HEM" },
    ribbedHemTipDisplayRow(piece),
    {
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: hemRowsValid
        ? [knitEvenLine(hemRows, hemRows)]
        : [
            "Hem rows could not be calculated — check row gauge and sizing chart. Knit your hem to the depth you prefer, then continue.",
          ],
      stitchCount: sts > 0 ? sts : undefined,
    },
  ];
}

/** Round-neck shaping prose for one neck edge (deep/shallow plan reused from the lego block). */
function roundNeckEdgeLines(neckSts: number): { centerBindOff: number; lines: string[] } {
  const plan = calculateRoundNecklineShaping({ necklineStitches: neckSts });
  const lines: string[] = [];
  const stair = plan.left.stairSteps;
  if (stair.length > 0) {
    lines.push(
      `At the neck edge, bind off ${stair.join(", then ")} stitch${stair.length === 1 && stair[0] === 1 ? "" : "es"} on alternate (neck-edge) rows.`,
    );
  }
  if (plan.left.singleDecreaseCount > 0) {
    lines.push(
      `Then decrease 1 stitch at the neck edge every other row ${plan.left.singleDecreaseCount} time${plan.left.singleDecreaseCount === 1 ? "" : "s"}.`,
    );
  }
  return { centerBindOff: plan.centerBindOff, lines };
}

/**
 * BACK piece: cast on → hem → straight body → armhole markers → straight to top →
 * straight shoulder + back-neck bind-off (no shaping).
 */
function buildBackRows(args: {
  bodyWidthSts: number;
  hemRows: number;
  hemRowsValid: boolean;
  bodyToArmholeRows: number;
  bodyRowsValid: boolean;
  armholeDepthRows: number;
  armholeMarkerRc: number;
  totalRows: number;
  shoulderStsEach: number;
  backNeckSts: number;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const { bodyWidthSts: A } = args;
  rows.push({ kind: "piece", title: "BACK" });
  rows.push(pieceMarkersSeamingTipDisplayRow("back"));
  rows.push(castOnBlock(A, "the back"));
  rows.push(...hemBlocks("back", args.hemRows, args.hemRowsValid, A));

  rows.push({ kind: "section", title: "BODY" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.hemRows),
    paragraphs: args.bodyRowsValid
      ? [knitEvenLine(args.bodyToArmholeRows, args.armholeMarkerRc)]
      : [
          "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
        ],
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const backAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at each end of this row to mark the base of the armhole.",
    [
      "This is a drop-shoulder sweater: work straight above the markers. There is no armhole shaping.",
      knitEvenLine(args.armholeDepthRows, args.totalRows),
    ],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: backAboveMarker.paragraphs,
    trustedParagraphs: backAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
  if (args.shoulderStsEach > 0 && args.backNeckSts > 0) {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.totalRows),
      paragraphs: [
        `At ${formatRcColon(args.totalRows)}, bind off all ${A} stitches across the top:`,
        `Bind off ${args.shoulderStsEach} stitches (first shoulder), bind off the center ${args.backNeckSts} stitches (back neck), bind off ${args.shoulderStsEach} stitches (second shoulder).`,
        "Drop-shoulder shoulders are worked straight — there is no shoulder shaping.",
      ],
      stitchCount: 0,
    });
  } else {
    rows.push({
      kind: "block",
      paragraphs: [
        "Set neck opening width and shoulder width in the builder to generate the back neck and shoulder bind-off.",
      ],
    });
  }
  return rows;
}

/** Pullover FRONT (full width): straight body to neck depth, then round or V neckline; straight shoulders. */
function buildPulloverFrontRows(args: {
  bodyWidthSts: number;
  hemRows: number;
  hemRowsValid: boolean;
  bodyToArmholeRows: number;
  bodyRowsValid: boolean;
  armholeDepthRows: number;
  armholeMarkerRc: number;
  totalRows: number;
  shoulderStsEach: number;
  neckSts: number;
  frontNeckDepthRows: number;
  isVNeck: boolean;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const A = args.bodyWidthSts;
  const neckStartRc = Math.max(args.armholeMarkerRc, args.totalRows - args.frontNeckDepthRows);
  const straightAboveMarkerRows = Math.max(0, neckStartRc - args.armholeMarkerRc);

  rows.push({ kind: "piece", title: "FRONT" });
  rows.push(pieceMarkersSeamingTipDisplayRow("front"));
  rows.push(castOnBlock(A, "the front"));
  rows.push(...hemBlocks("front", args.hemRows, args.hemRowsValid, A));

  rows.push({ kind: "section", title: "BODY" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.hemRows),
    paragraphs: args.bodyRowsValid
      ? [knitEvenLine(args.bodyToArmholeRows, args.armholeMarkerRc)]
      : [
          "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
        ],
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const pulloverFrontAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at each end of this row to mark the base of the armhole.",
    [
      "Work straight above the markers (no armhole shaping).",
      knitEvenLine(straightAboveMarkerRows, neckStartRc),
    ],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: pulloverFrontAboveMarker.paragraphs,
    trustedParagraphs: pulloverFrontAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.neckSts > 0 && args.shoulderStsEach > 0) {
    if (args.isVNeck) {
      const perSide = neckDecreaseStitchesPerSideFromOpening(args.neckSts);
      const sched = evenShapingSchedule(perSide, args.frontNeckDepthRows);
      rows.push({
        kind: "block",
        rc: formatRcColon(neckStartRc),
        paragraphs: [
          `At ${formatRcColon(neckStartRc)}, divide for the V-neck at the center. Work each side separately.`,
          sched.count > 0
            ? `At the neck edge, decrease 1 stitch ${intervalPhrase(sched.interval)} ${sched.count} time${sched.count === 1 ? "" : "s"} (${perSide} stitches removed per side).`
            : "Work straight to the shoulder.",
          `When ${args.shoulderStsEach} stitches remain on the side, knit even to ${formatRcColon(args.totalRows)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
          "Work the second side to match, reversing the neck-edge shaping. Shoulders are worked straight.",
        ],
        stitchCount: args.shoulderStsEach,
      });
    } else {
      const { centerBindOff, lines } = roundNeckEdgeLines(args.neckSts);
      rows.push({
        kind: "block",
        rc: formatRcColon(neckStartRc),
        paragraphs: [
          `At ${formatRcColon(neckStartRc)}, bind off the center ${centerBindOff} stitches for the neck. Work each side separately.`,
          ...lines,
          `When ${args.shoulderStsEach} stitches remain on the side, knit even to ${formatRcColon(args.totalRows)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
          "Work the second side to match, reversing the neck-edge shaping. Shoulders are worked straight.",
        ],
        stitchCount: args.shoulderStsEach,
      });
    }
  } else {
    rows.push({
      kind: "block",
      paragraphs: [
        "Set neck opening width and shoulder width in the builder to generate row-by-row front neckline steps.",
      ],
    });
  }
  return rows;
}

/** Cardigan fronts (two half-width pieces): neckline shaped on the center-front edge; straight shoulders. */
function buildCardiganFrontRows(args: {
  frontSts: number;
  hemRows: number;
  hemRowsValid: boolean;
  bodyToArmholeRows: number;
  bodyRowsValid: boolean;
  armholeDepthRows: number;
  armholeMarkerRc: number;
  totalRows: number;
  shoulderStsEach: number;
  neckPerFront: number;
  frontNeckDepthRows: number;
  isVNeck: boolean;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const A = args.frontSts;
  const neckStartRc = Math.max(args.armholeMarkerRc, args.totalRows - args.frontNeckDepthRows);
  const straightAboveMarkerRows = Math.max(0, neckStartRc - args.armholeMarkerRc);

  rows.push({ kind: "piece", title: "LEFT FRONT" });
  rows.push(pieceMarkersSeamingTipDisplayRow("front"));
  rows.push(castOnBlock(A, "the left front"));
  rows.push(...hemBlocks("front", args.hemRows, args.hemRowsValid, A));

  rows.push({ kind: "section", title: "BODY" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.hemRows),
    paragraphs: args.bodyRowsValid
      ? [knitEvenLine(args.bodyToArmholeRows, args.armholeMarkerRc)]
      : [
          "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
        ],
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const cardiganFrontAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at the side edge to mark the base of the armhole.",
    [
      "Work straight above the marker (no armhole shaping).",
      knitEvenLine(straightAboveMarkerRows, neckStartRc),
    ],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: cardiganFrontAboveMarker.paragraphs,
    trustedParagraphs: cardiganFrontAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.neckPerFront > 0 && args.shoulderStsEach > 0) {
    if (args.isVNeck) {
      const sched = evenShapingSchedule(args.neckPerFront, args.frontNeckDepthRows);
      rows.push({
        kind: "block",
        rc: formatRcColon(neckStartRc),
        paragraphs: [
          `At ${formatRcColon(neckStartRc)}, begin the V-neck shaping at the center-front edge.`,
          sched.count > 0
            ? `Decrease 1 stitch at the center-front (neck) edge ${intervalPhrase(sched.interval)} ${sched.count} time${sched.count === 1 ? "" : "s"} (${args.neckPerFront} stitches removed).`
            : "Work straight to the shoulder.",
          `When ${args.shoulderStsEach} stitches remain, knit even to ${formatRcColon(args.totalRows)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
        ],
        stitchCount: args.shoulderStsEach,
      });
    } else {
      const cfBindOff = Math.min(args.neckPerFront, Math.max(2, Math.round(args.neckPerFront / 3)));
      const remaining = Math.max(0, args.neckPerFront - cfBindOff);
      rows.push({
        kind: "block",
        rc: formatRcColon(neckStartRc),
        paragraphs: [
          `At ${formatRcColon(neckStartRc)}, bind off ${cfBindOff} stitches at the center-front (neck) edge.`,
          remaining > 0
            ? `Then decrease 1 stitch at the neck edge every other row ${remaining} time${remaining === 1 ? "" : "s"}.`
            : "Work straight to the shoulder.",
          `When ${args.shoulderStsEach} stitches remain, knit even to ${formatRcColon(args.totalRows)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
        ],
        stitchCount: args.shoulderStsEach,
      });
    }
    rows.push({
      kind: "block",
      paragraphs: [
        "Work the RIGHT FRONT to match, reversing the neckline shaping so it falls at the opposite (center-front) edge. Shoulders are worked straight.",
      ],
    });
  } else {
    rows.push({
      kind: "block",
      paragraphs: [
        "Set neck opening width and shoulder width in the builder to generate row-by-row front neckline steps.",
      ],
    });
  }
  return rows;
}

/** SLEEVE piece (make 2): tapered trapezoid between wrist and upper arm, cuff-up or top-down. */
export function buildDropShoulderSleeveDisplayRows(
  args: BuildDropShoulderSleeveRowsArgs,
): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "SLEEVE" });

  if (!args.valid) {
    rows.push({
      kind: "block",
      paragraphs: [
        "Sleeve could not be calculated. Confirm upper arm, wrist, sleeve length, and gauge in the builder, then open this tab again.",
      ],
    });
    return rows;
  }

  const shapingPlan = dropShoulderSleeveShapingPlanForDirection(
    {
      topSts: args.topSts,
      wristSts: args.wristSts,
      sleeveBodyRows: args.sleeveBodyRows,
    },
    args.direction,
  );
  const chartInput = {
    topSts: args.topSts,
    wristSts: args.wristSts,
    cuffRows: args.cuffRows,
    sleeveBodyRows: args.sleeveBodyRows,
    sleeveTotalRows: args.sleeveTotalRows,
    direction: args.direction,
  };
  const sleeveShapingChartRows = buildDropShoulderSleeveShapingChartRows(chartInput);
  const showSleeveShapingChart = dropShoulderSleeveNeedsShapingChart(chartInput);
  const shapingWrittenLines = formatDropShoulderSleeveShapingWrittenLines(
    shapingPlan.shapingDirection,
    shapingPlan.steps,
  );

  function appendSleeveShapingChartSection(): void {
    rows.push({ kind: "section", title: "SLEEVE SHAPING CHART" });
    if (showSleeveShapingChart) {
      rows.push({
        kind: "block",
        paragraphs: [],
        sleeveShapingChartRows,
      });
    } else {
      rows.push({
        kind: "block",
        trustedParagraphs: dropShoulderSleeveNoShapingNoteTrustedParagraphs(),
      });
    }
  }

  if (args.direction === "top-down") {
    rows.push({
      kind: "block",
      paragraphs: ["Make 2 sleeves."],
    });
    rows.push({
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: [`Cast on or pick up ${args.topSts} stitches.`],
      ...(args.topSts > 0
        ? {
            tipHtml: castOnMethodQuickTipInnerHtml(),
            tipHtmlIsFull: true,
            tipPresentation: "quick-tip" as const,
          }
        : {}),
      stitchCount: args.topSts > 0 ? args.topSts : undefined,
    });
    rows.push({ kind: "section", title: "SLEEVE BODY" });
    rows.push({
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: [
        ...shapingWrittenLines,
        shapingPlan.remainderRows > 0 ? knitInPatternLine(shapingPlan.remainderRows) : "",
      ].filter((p) => p.length > 0),
      stitchCount: args.wristSts > 0 ? args.wristSts : undefined,
    });
    appendSleeveShapingChartSection();
    rows.push({ kind: "section", title: "CUFF" });
    rows.push({
      kind: "block",
      rc: formatRcColon(args.sleeveBodyRows),
      paragraphs: [knitEvenLine(args.cuffRows, args.sleeveTotalRows)],
      trustedParagraphs: [bindOffLooselyOrScrapOffTrustedParagraph("cuff/wrist edge")],
      stitchCount: args.wristSts,
    });
    return rows;
  }

  // cuff-up (bottom-up, default)
  rows.push({
    kind: "block",
    paragraphs: ["Make 2 sleeves."],
  });
  rows.push(castOnBlock(args.wristSts));
  rows.push({ kind: "section", title: "CUFF" });
  rows.push({
    kind: "block",
    rc: formatRcColon(0),
    paragraphs: [knitEvenLine(args.cuffRows, args.cuffRows)],
    stitchCount: args.wristSts,
  });
  rows.push({ kind: "section", title: "SLEEVE BODY" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.cuffRows),
    paragraphs: [
      ...shapingWrittenLines,
      shapingPlan.remainderRows > 0 ? knitInPatternLine(shapingPlan.remainderRows) : "",
    ].filter((p) => p.length > 0),
    stitchCount: args.topSts,
  });
  appendSleeveShapingChartSection();
  rows.push({ kind: "section", title: "BIND OFF" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.sleeveTotalRows),
    trustedParagraphs: [bindOffLooselyOrScrapOffTrustedParagraph("upper-arm/top edge")],
    stitchCount: args.topSts,
  });
  return rows;
}

const EMPTY_CHART = { rows: [] } as unknown as NeckShoulderShapingChart;

/**
 * Generate the full drop-shoulder pattern (back, front, sleeves) for the pattern workspace.
 */
export function generateDropShoulderPattern(
  patternData: Record<string, unknown>,
  options?: GenerateDropShoulderPatternOptions,
): DropShoulderPatternResult {
  const warnings: string[] = [];
  const basic = calculateBasicPatternNumbers(patternData);
  const spi = basic.stitchesPerInch;
  const rpi = basic.rowsPerInch;

  if (!Number.isFinite(spi) || spi <= 0) {
    warnings.push("Stitch gauge is missing or invalid — stitch counts may be wrong.");
  }
  if (!Number.isFinite(rpi) || rpi <= 0) {
    warnings.push("Row gauge is missing or invalid — row counts and RC targets may be wrong.");
  }

  const audience = pickAudience(patternData);
  const style = section(patternData.style);
  const isCardigan = String(style.frontStyle) === "open";
  const isVNeck = String(style.neckline) === "v";
  const sleeveDirection: DropShoulderSleeveDirection =
    options?.sleeveDirection ?? DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT;

  const finishedBust = resolveEffectiveFinishedBustInches(patternData) ?? basic.finishedBustChest;
  const backNeckToHem = resolveEffectiveFinishedLengthInches(patternData);
  const shoulderWidthIn = resolveEffectiveShoulderWidthInches(patternData);
  const neckWidthIn = resolveEffectiveNeckOpeningWidthInches(patternData);
  const backNeckDepthIn = resolveEffectiveBackNeckDepthInches(patternData);
  const frontNeckDepthIn = resolveEffectiveFrontNeckDepthInches(patternData);
  const hemDepthIn = resolveEffectiveHemDepthInches(patternData, audience);
  const cuffDepthIn = resolveEffectiveCuffDepthInches(patternData, audience);

  const sm = selectedMeasurements(patternData);
  const fitSection = section(patternData.fit);
  const overrideMap = section(fitSection.cbMeasurementOverrides);
  const overrideStrings = Object.fromEntries(
    Object.entries(overrideMap).filter(
      ([, v]) => typeof v === "string" && String(v).trim() !== "",
    ) as [string, string][],
  );
  const chartAudience = pickAudience(patternData);
  const selectedSize = String(fitSection.selectedSize ?? "").trim();
  const fitPreference = String(
    fitSection.easeChoice ?? fitSection.fitChoice ?? "standard",
  ).trim();
  const chartRow =
    chartAudience && selectedSize ? findExpressChartRow(chartAudience, selectedSize) : null;
  const sleeveResolved = isDropShoulderPatternData(patternData)
    ? resolveDropShoulderSleeveInches({
        overrides: overrideStrings,
        chartRow,
        fitPreference,
        selectedMeasurements: sm,
        bodyShape: String(style.bodyShape ?? "straight"),
      })
    : {};
  const upperArmIn =
    sleeveResolved.upperArmIn ??
    sleeveOverrideInches(patternData, "upperArm") ??
    measurementInches(sm, "upper_arm");
  const wristIn =
    sleeveResolved.wristIn ??
    sleeveOverrideInches(patternData, "wrist") ??
    measurementInches(sm, "wrist");
  const sleeveLengthIn =
    sleeveResolved.sleeveLengthIn ??
    sleeveOverrideInches(patternData, "sleeveLength") ??
    measurementInches(sm, "sleeve_length");

  // Drop-shoulder armhole depth is derived, not a user input.
  const armholeDepthIn = upperArmIn !== undefined ? upperArmIn / 2 : undefined;

  if (upperArmIn === undefined) {
    warnings.push("Upper arm measurement is missing — armhole depth and sleeve width cannot be calculated.");
  }
  if (wristIn === undefined || sleeveLengthIn === undefined) {
    warnings.push("Wrist and/or sleeve length are missing — sleeve instructions may be incomplete.");
  }

  // ---- Body stitch / row math (half-circumference back; straight body) ----
  const bodyWidthSts = finishedBust > 0 && spi > 0 ? forceEven((finishedBust / 2) * spi) : 0;
  const neckSts = neckWidthIn !== undefined && spi > 0 ? forceEven(neckWidthIn * spi) : 0;
  const shoulderStsEach = bodyWidthSts > 0 ? Math.max(0, Math.round((bodyWidthSts - neckSts) / 2)) : 0;
  // Exact back-neck count so shoulders + neck sum to the body width.
  const backNeckSts = Math.max(0, bodyWidthSts - 2 * shoulderStsEach);

  const totalRows = backNeckToHem && rpi > 0 ? Math.max(2, Math.round(backNeckToHem * rpi)) : 0;
  const hemRows = calculateHemRowsFromInches(rpi, hemDepthIn);
  const armholeDepthRows = armholeDepthIn && rpi > 0 ? Math.max(2, roundUpToEvenRows(armholeDepthIn * rpi)) : 0;
  const bodyToArmholeRows = Math.max(0, totalRows - hemRows - armholeDepthRows);
  const armholeMarkerRc = hemRows + bodyToArmholeRows;
  const frontNeckDepthRows = frontNeckDepthIn && rpi > 0 ? Math.max(1, Math.round(frontNeckDepthIn * rpi)) : 0;
  const backNeckDepthRows = backNeckDepthIn && rpi > 0 ? Math.max(0, Math.round(backNeckDepthIn * rpi)) : 0;

  const hemRowsValid = hemRows > 0;
  const bodyRowsValid = totalRows > 0 && bodyToArmholeRows > 0;

  // ---- Sleeve math (flat piece width = circumference; top edge = upper arm) ----
  const topSts = upperArmIn !== undefined && spi > 0 ? forceEven(upperArmIn * spi) : 0;
  const wristSts = wristIn !== undefined && spi > 0 ? forceEven(wristIn * spi) : 0;
  const cuffRows = calculateCuffRowsFromInches(rpi, cuffDepthIn);
  const sleeveTotalRows = sleeveLengthIn && rpi > 0 ? Math.max(cuffRows + 2, Math.round(sleeveLengthIn * rpi)) : 0;
  const sleeveBodyRows = Math.max(0, sleeveTotalRows - cuffRows);
  const sleeveValid = topSts > 0 && wristSts > 0 && sleeveTotalRows > 0;

  // ---- Build display rows ----
  const displayRows = buildBackRows({
    bodyWidthSts,
    hemRows,
    hemRowsValid,
    bodyToArmholeRows,
    bodyRowsValid,
    armholeDepthRows,
    armholeMarkerRc,
    totalRows,
    shoulderStsEach,
    backNeckSts,
  });

  const frontDisplayRows = isCardigan
    ? buildCardiganFrontRows({
        frontSts: forceEven(bodyWidthSts / 2),
        hemRows,
        hemRowsValid,
        bodyToArmholeRows,
        bodyRowsValid,
        armholeDepthRows,
        armholeMarkerRc,
        totalRows,
        shoulderStsEach: Math.max(0, Math.round(forceEven(bodyWidthSts / 2) - Math.round(neckSts / 2))),
        neckPerFront: Math.round(neckSts / 2),
        frontNeckDepthRows,
        isVNeck,
      })
    : buildPulloverFrontRows({
        bodyWidthSts,
        hemRows,
        hemRowsValid,
        bodyToArmholeRows,
        bodyRowsValid,
        armholeDepthRows,
        armholeMarkerRc,
        totalRows,
        shoulderStsEach,
        neckSts,
        frontNeckDepthRows,
        isVNeck,
      });

  const sleeveDisplayRows = buildDropShoulderSleeveDisplayRows({
    topSts,
    wristSts,
    cuffRows,
    sleeveBodyRows,
    sleeveTotalRows,
    direction: sleeveDirection,
    valid: sleeveValid,
  });

  const rowsFromCastOnToArmholeStart = hemRows + bodyToArmholeRows;

  const debug = {
    finishedBustChest: finishedBust || undefined,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    backStitches: bodyWidthSts,
    bustBodyStitches: bodyWidthSts || undefined,
    hemCastOnStitches: bodyWidthSts || undefined,
    shoulderWidthInches: shoulderWidthIn,
    stitchesAfterArmhole: bodyWidthSts || undefined,
    hemRows,
    bodyRows: bodyToArmholeRows,
    rowsFromCastOnToArmholeStart,
    armholeRows: armholeDepthRows,
    necklineShoulderRows: frontNeckDepthRows,
    reservedNecklineShoulderInches: backNeckDepthIn,
    reservedNecklineShoulderRows: backNeckDepthRows,
    totalCalculatedRows: totalRows,
    expectedGarmentRows: totalRows,
    backNeckToHem,
    armholeDepth: armholeDepthIn,
    necklineWidthInches: neckWidthIn,
    necklineStitches: neckSts || undefined,
    shoulderStitches: shoulderStsEach || undefined,
    frontNeckDepth: frontNeckDepthIn,
    frontNeckDepthRows,
    backNeckDepthRows,
    backNecklineStartRC: totalRows,
    frontNecklineStartRC: Math.max(armholeMarkerRc, totalRows - frontNeckDepthRows),
    finalRC: totalRows,
    isCardigan,
    // Drop-shoulder sleeve schematic (`drop-body-sleeve.svg`) — consumed by buildDropShoulderSleeveDiagramReplacements.
    dropShoulderSleeveTotalRows: sleeveTotalRows > 0 ? sleeveTotalRows : undefined,
    dropShoulderSleeveBodyRows: sleeveBodyRows > 0 ? sleeveBodyRows : undefined,
    dropShoulderSleeveCuffRows: cuffRows > 0 ? cuffRows : undefined,
    dropShoulderSleeveLengthInches: sleeveLengthIn,
    dropShoulderSleeveTopStitches: topSts > 0 ? topSts : undefined,
    dropShoulderSleeveWristStitches: wristSts > 0 ? wristSts : undefined,
    dropShoulderWristInches: wristIn,
    dropShoulderUpperArmInches: upperArmIn,
    dropShoulderUpperArmRows: armholeDepthRows > 0 ? armholeDepthRows : undefined,
    dropShoulderCuffDepthInches: cuffDepthIn,
  } as unknown as SleevelessBackPatternDebug;

  const lines: string[] = [];
  for (const r of [...displayRows, ...frontDisplayRows, ...sleeveDisplayRows]) {
    if (r.kind === "piece") lines.push(`== ${r.title} ==`);
    else if (r.kind === "section") lines.push(`-- ${r.title} --`);
    else if (r.kind === "block") {
      const src = r.trustedParagraphs && r.trustedParagraphs.length > 0 ? r.trustedParagraphs : r.paragraphs;
      for (const p of src) if (String(p).trim()) lines.push(String(p));
    }
  }

  return {
    warnings,
    lines,
    displayRows,
    frontDisplayRows,
    sleeveDisplayRows,
    debug,
    neckShoulderShapingChart: EMPTY_CHART,
    frontNeckShoulderShapingChart: EMPTY_CHART,
    neckShoulderChartUsesLiveRows: false,
    frontNeckShoulderChartUsesLiveRows: false,
    isDropShoulder: true,
  };
}
