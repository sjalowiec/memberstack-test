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
import { resolveDiagramFinishedHipInches } from "./customBuildEffectiveFinishedHip";
import {
  resolveBodyBlockHipCircumferenceInches,
  shouldRunSleevelessBodyBlockForPullover,
  bodyBlockPlanToAlineShapingPlan,
  computeSleevelessAlineBodyShaping,
  formatSleevelessAlineBodyShapingSummaryLine,
  scaleAlineBodyShapingPlanForCardiganHalf,
  sleevelessAlineShapingLineNeedsTrustedHtml,
  type SleevelessAlineBodyShapingPlan,
  type SleevelessAlineShapingEdgeScope,
} from "./sleevelessAlineShaping";
import { buildSleevelessBodyBlockPlan } from "./bodyBlock/sleevelessBodyBlock";
import { buildSleevelessBodyShapingChartRows } from "./sleevelessBodyShapingChartHtml";
import { sleevelessBackHalfStitchesFromCircumference } from "./sleevelessBodyStitchMath";
import {
  isCustomBuildPatternMode,
  positiveMeasurementInches,
} from "./customBuildEffectiveArmholeDepth";
import { isDropShoulderPatternData } from "./dropShoulderSleeveMeasurementOverrides";
import { resolveDropShoulderSleeveInches } from "./dropShoulderSleeveMeasurementOverrides";
import { readEffectiveDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";
import { findExpressChartRow } from "./sleevelessExpressSizeChartClient";
import {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  normalizeRoundNecklineDepthRows,
  type RoundNecklinePlanResult,
} from "./legoBlocks/roundNeckline";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import { evenShapingSchedule } from "./evenShapingSchedule";
import {
  roundNeckBackShallowExecutionWrittenLines,
  roundNeckCardiganCfEdgeWrittenLines,
  roundNeckPlanCenterWrittenLine,
  roundNeckPlanFinishHeldStitchesLine,
  roundNeckPlanOneSideNeckEdgeWrittenLines,
  isShallowSinglesOnlyPlan,
  appendEvenShapingRowListToInstruction,
} from "./roundNeckPlanPresentation";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import { dropShoulderShoulderBindOffVideoRow } from "./dropShoulderShoulderBindOffVideo";
import { roundBackNecklineShapingVideoRow } from "./roundBackNecklineShapingVideoTip";
import {
  castOnMethodQuickTipInnerHtml,
  pieceMarkersSeamingTipDisplayRow,
  formatRcColon,
  insertLifelineReminderAfterOpening,
  type SleevelessPatternDisplayRow,
  type SleevelessBackPatternResult,
  type SleevelessBackPatternDebug,
} from "./sleevelessPatternOutput";
import { hemSectionRow } from "./legoBlocks/hem";
import {
  insertBustDartIntoFrontBodyDisplayRows,
  resolveBustDartForSweaterFront,
} from "./legoBlocks/bustDart";
import type { NeckShoulderShapingChart } from "./neckShoulderShapingChart";
import {
  buildDropShoulderBackNeckShapingTimeline,
  buildDropShoulderFrontNeckShapingChart,
  dropShoulderFrontNeckShapingChartInputsReady,
  dropShoulderFrontNecklineWorkingRows,
  dropShoulderFrontShoulderCompletionLocalRc,
} from "./dropShoulderFrontNeckShapingChart";
import { resolveCardiganHalfFrontWidths } from "./cardiganFrontBlock";
import {
  DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
  DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_LINES,
  buildDropShoulderSleeveShapingChartRows,
  dropShoulderSleeveNeedsShapingChart,
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import type { DropShoulderSleeveDirection } from "./dropShoulderSleeveConstruction";
import { DROP_SHOULDER_SLEEVE_DIRECTION_DEFAULT } from "./dropShoulderSleeveConstruction";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import { buildGlossaryTooltipPlaceholderHtml, PLACE_MARKER_GLOSSARY_ID } from "../glossary/glossaryTooltipPrint";
import { SCRAP_OFF_GLOSSARY_ID } from "./neckShoulderActiveIntroCopy";
import { inlineRcHeadingLine, parseInlineMarkedLine } from "./inlineRcHeading";

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

/** Shared Row Counter Reset marker immediately before drop-shoulder neckline shaping. */
function dropShoulderNecklineRowCounterResetBlock(garmentRc: number): Block {
  return {
    kind: "block",
    rowCounterReset: true,
    rowCounterResetGarmentRc: garmentRc,
    paragraphs: [],
  };
}

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

/** Plain-knit instruction line for drop-shoulder even-row spans (RC shown in block headings). */
function knitEvenLine(rows: number): string {
  if (rows <= 0) return "";
  return rows === 1 ? "Knit 1 row even." : `Knit ${rows} rows even.`;
}

/** Sleeve body remainder after shaping — work in pattern to length. */
function knitInPatternLine(rows: number): string {
  if (rows <= 0) return "";
  return rows === 1 ? "Knit 1 row in pattern." : `Knit ${rows} rows in pattern.`;
}

/** Cuff-up sleeve: even rows after the last side shaping action, then bind off at total RC. */
function knitEvenAfterFinalShapingLine(
  remainderRows: number,
  bindOffRc: number,
  shapingVerb: "increase" | "decrease",
): string {
  if (remainderRows <= 0) return "";
  const rowWord = remainderRows === 1 ? "1 row even" : `${remainderRows} rows even`;
  const noun = shapingVerb === "decrease" ? "decrease" : "increase";
  return `After the final ${noun}, knit ${rowWord} in pattern, then bind off at ${formatRcColon(bindOffRc)}.`;
}

function sleeveBodyRemainderLine(
  plan: { remainderRows: number; steps: readonly { times: number }[] },
  direction: DropShoulderSleeveDirection,
  sleeveTotalRows: number,
  shapingVerb: "increase" | "decrease" = "increase",
): string {
  if (plan.remainderRows <= 0) return "";
  const hadShaping = plan.steps.some((s) => s.times > 0);
  if (hadShaping && direction === "cuff-up") {
    return knitEvenAfterFinalShapingLine(plan.remainderRows, sleeveTotalRows, shapingVerb);
  }
  return knitInPatternLine(plan.remainderRows);
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

function castOnBlock(sts: number, label?: string, alineHipNote = false): Block {
  const castOnLine =
    sts > 0 && label && alineHipNote
      ? `Cast on ${sts} stitches for ${label} (hem/hip width for gentle A-line shaping).`
      : sts > 0 && label
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

function hemBlocks(hemRows: number, hemRowsValid: boolean, sts: number): SleevelessPatternDisplayRow[] {
  return [
    hemSectionRow(),
    {
      kind: "block",
      rc: formatRcColon(0),
      paragraphs: hemRowsValid
        ? [knitEvenLine(hemRows)]
        : [
            "Hem rows could not be calculated — check row gauge and sizing chart. Knit your hem to the depth you prefer, then continue.",
          ],
      stitchCount: sts > 0 ? sts : undefined,
    },
  ];
}

/** Round-neck shaping prose for one neck edge (deep or shallow plan from the lego block). */
function roundNeckEdgeLines(
  neckSts: number,
  neckDepthRows: number,
  necklineStartRc?: number,
): { centerBindOff: number; lines: string[]; plan: RoundNecklinePlanResult } {
  const plan = calculateRoundNecklinePlan({
    necklineStitches: neckSts,
    necklineDepthRows: neckDepthRows,
  });
  return {
    centerBindOff: plan.centerBindOff,
    lines: roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right", { necklineStartRc }),
    plan,
  };
}

/** Pullover front (round or V-neck): park the non-working shoulder before shaping one side. */
function dropShoulderPulloverFrontShoulderDivideParagraphs(): string[] {
  return ["Place the opposite shoulder stitches on hold. Work one shoulder at a time."];
}

const DROP_SHOULDER_PULLOVER_ROUND_NECK_SECOND_SHOULDER_SENTENCE =
  "Return the held shoulder stitches to the needles and repeat the neckline shaping for the second shoulder, matching the first side.";

const DROP_SHOULDER_PULLOVER_V_NECK_SECOND_SHOULDER_SENTENCE =
  "Return the held shoulder stitches to the needles and repeat the V-neck shaping for the second shoulder, mirroring the first side.";

const DROP_SHOULDER_SHOULDER_COMPLETE_RE = /^The (first|second) shoulder is complete\.?$/i;

/** Plain text from a trusted instruction line (markers and HTML stripped). */
function trustedLinePlainText(line: string): string {
  const marked = parseInlineMarkedLine(line);
  if (marked) return marked.text.trim();
  return String(line)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDropShoulderShoulderCompleteLine(line: string): boolean {
  return DROP_SHOULDER_SHOULDER_COMPLETE_RE.test(trustedLinePlainText(line));
}

/**
 * Split neckline trusted paragraphs into display blocks. Shoulder-completion sentences become
 * their own blocks with {@link shoulderStsEach} in the right column; all other blocks omit it.
 */
function splitTrustedParagraphsAtShoulderCompletion(
  lines: readonly string[],
  shoulderStsEach: number,
): Block[] {
  const blocks: Block[] = [];
  let buffer: string[] = [];
  let pendingInlineRc: string | undefined;

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    blocks.push({
      kind: "block",
      trustedParagraphs: [...buffer],
      paragraphs: [],
    });
    buffer = [];
  };

  for (const line of lines) {
    const marked = parseInlineMarkedLine(line);
    if (marked?.kind === "rc-heading") {
      pendingInlineRc = marked.text;
      continue;
    }

    if (isDropShoulderShoulderCompleteLine(line)) {
      flushBuffer();
      blocks.push({
        kind: "block",
        ...(pendingInlineRc ? { rc: pendingInlineRc } : {}),
        trustedParagraphs: [line],
        paragraphs: [],
        stitchCount: shoulderStsEach > 0 ? shoulderStsEach : undefined,
      });
      pendingInlineRc = undefined;
      continue;
    }

    if (pendingInlineRc) {
      buffer.push(inlineRcHeadingLine(pendingInlineRc));
      pendingInlineRc = undefined;
    }
    buffer.push(line);
  }

  flushBuffer();
  return blocks;
}

/** Local neckline RC after the row-counter reset (matches chart/map/checklist RC 000). */
const DROP_SHOULDER_NECKLINE_LOCAL_RC_START = 0;

function dropShoulderNecklineLocalRowsFromGarment(
  neckGarmentStartRc: number,
  totalGarmentRows: number,
): number {
  return dropShoulderFrontShoulderCompletionLocalRc(neckGarmentStartRc, totalGarmentRows);
}

function dropShoulderNecklineFirstBlockRc(
  useLocalNecklineRc: boolean,
  neckGarmentStartRc: number,
): string {
  return formatRcColon(
    useLocalNecklineRc ? DROP_SHOULDER_NECKLINE_LOCAL_RC_START : neckGarmentStartRc,
  );
}

function dropShoulderNecklineWrittenStartRc(
  useLocalNecklineRc: boolean,
  neckGarmentStartRc: number,
): number | undefined {
  return useLocalNecklineRc ? DROP_SHOULDER_NECKLINE_LOCAL_RC_START : neckGarmentStartRc;
}

/** Pullover front: knit even to shoulder bind-off RC, bind off, then repeat for the held shoulder. */
function dropShoulderPulloverShoulderFinishParagraphs(
  shoulderStsEach: number,
  shoulderFinishRc: number,
  orderLabel: "first" | "second",
): string[] {
  return [
    `The ${orderLabel} shoulder is complete.`,
    `When neckline shaping is complete and ${shoulderStsEach} stitches remain on the working shoulder, knit even to ${formatRcColon(shoulderFinishRc)} (no further neck-edge decreases).`,
    `Bind off the ${shoulderStsEach} shoulder stitches.`,
  ];
}

function dropShoulderPulloverBothShouldersFinishParagraphs(
  shoulderStsEach: number,
  shoulderFinishRc: number,
  secondShoulderSentence: string,
): string[] {
  return [
    ...dropShoulderPulloverShoulderFinishParagraphs(shoulderStsEach, shoulderFinishRc, "first"),
    secondShoulderSentence,
    ...dropShoulderPulloverShoulderFinishParagraphs(shoulderStsEach, shoulderFinishRc, "second"),
  ];
}

/** Hem → bust side shaping in the BODY section (drop shoulder: no armhole bind-offs after this). */
function appendDropShoulderAlineBodyRows(
  rows: SleevelessPatternDisplayRow[],
  args: {
    aline: SleevelessAlineBodyShapingPlan;
    bodyRowsValid: boolean;
    bodyToArmholeRows: number;
    castOnSts: number;
    alineEdgeScope?: SleevelessAlineShapingEdgeScope;
  },
): void {
  const { aline, castOnSts } = args;
  const alineEdgeScope = args.alineEdgeScope ?? "symmetricSides";

  if (!args.bodyRowsValid || args.bodyToArmholeRows <= 0) {
    rows.push({
      kind: "block",
      rc: formatRcColon(aline.shapingBeginRc),
      paragraphs: [
        "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
      ],
    });
    return;
  }

  if (aline.shapingType === "straight") {
    rows.push({
      kind: "block",
      rc: formatRcColon(aline.shapingBeginRc),
      paragraphs: [knitEvenLine(args.bodyToArmholeRows)],
      stitchCount: aline.bustBodySts > 0 ? aline.bustBodySts : castOnSts > 0 ? castOnSts : undefined,
    });
    return;
  }

  const summaryLine = formatSleevelessAlineBodyShapingSummaryLine(
    aline.shapingType,
    aline.shapingRowNumbers.length,
    aline.availableShapingRows,
    alineEdgeScope,
  );
  const chartRows = buildSleevelessBodyShapingChartRows(
    aline.shapingType,
    aline.shapingRowNumbers,
    alineEdgeScope,
    aline.hemCastOnSts,
  );
  const bustSts = aline.bustBodySts > 0 ? aline.bustBodySts : undefined;
  const beforeChartLines = ["Begin A-line shaping.", summaryLine].filter((p) => p.length > 0);
  const useTrusted = beforeChartLines.some(sleevelessAlineShapingLineNeedsTrustedHtml);
  const plainEdgePhrase =
    alineEdgeScope === "armholeEdgeOnly" ? "at the armhole edge" : "at each side edge";
  const plainShapingVerb = aline.shapingType === "decrease-to-bust" ? "Decrease" : "Increase";
  const plainShapingTimes = aline.shapingRowNumbers.length;
  const plainShapingLine = `${plainShapingVerb} 1 stitch ${plainEdgePhrase} ${plainShapingTimes} time${plainShapingTimes === 1 ? "" : "s"}.`;

  rows.push({
    kind: "block",
    rc: formatRcColon(aline.shapingBeginRc),
    ...(useTrusted
      ? { trustedParagraphs: beforeChartLines, paragraphs: [plainShapingLine] }
      : { paragraphs: beforeChartLines }),
    ...(chartRows.length > 0 ? { bodyShapingChartRows: chartRows } : {}),
    stitchCount: castOnSts > 0 ? castOnSts : undefined,
  });

  if (aline.shapingType !== "increase-to-bust" && bustSts !== undefined) {
    rows.push({
      kind: "block",
      paragraphs: [`${bustSts} sts remain after shaping.`],
      stitchCount: bustSts,
    });
  }

  const straightRows = aline.straightRowsBeforeArmhole;
  if (straightRows > 0) {
    rows.push({
      kind: "block",
      rc: formatRcColon(aline.straightBeforeArmholeBeginRc),
      paragraphs: [`Knit ${straightRows} row${straightRows === 1 ? "" : "s"} straight.`],
      stitchCount: bustSts,
    });
  }
}

/**
 * BACK piece: cast on → hem → straight body → armhole markers → straight to neck →
 * documented shallow back-neck shaping + separate shoulder bind-offs.
 */
function buildBackRows(args: {
  castOnSts: number;
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
  backNeckDepthRows: number;
  backRoundNeckPlan: RoundNecklinePlanResult | null;
  alineBodyShaping?: SleevelessAlineBodyShapingPlan | null;
  alineShapingEdgeScope?: SleevelessAlineShapingEdgeScope;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const { bodyWidthSts: A, castOnSts } = args;
  const aline = args.alineBodyShaping ?? null;
  const useAlineBody = aline !== null && aline.shapingType !== "straight";
  rows.push({ kind: "piece", title: "BACK" });
  rows.push(pieceMarkersSeamingTipDisplayRow("back"));
  rows.push(castOnBlock(castOnSts, "the back", useAlineBody));
  rows.push(...hemBlocks(args.hemRows, args.hemRowsValid, castOnSts));

  rows.push({ kind: "section", title: "BODY" });
  if (useAlineBody && aline) {
    appendDropShoulderAlineBodyRows(rows, {
      aline,
      bodyRowsValid: args.bodyRowsValid,
      bodyToArmholeRows: args.bodyToArmholeRows,
      castOnSts,
      alineEdgeScope: args.alineShapingEdgeScope,
    });
  } else {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.hemRows),
      paragraphs: args.bodyRowsValid
        ? [knitEvenLine(args.bodyToArmholeRows)]
        : [
            "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
          ],
      stitchCount: castOnSts > 0 ? castOnSts : undefined,
    });
  }

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const hasBackNeckPlan = args.backRoundNeckPlan !== null && args.backNeckSts > 0;
  const neckStartRc =
    hasBackNeckPlan && args.backNeckDepthRows > 0
      ? Math.max(args.armholeMarkerRc, args.totalRows - args.backNeckDepthRows)
      : args.totalRows;
  const straightAboveMarkerRows = Math.max(0, neckStartRc - args.armholeMarkerRc);

  const garmentRcBeforeNecklineReset = hasBackNeckPlan ? neckStartRc : args.totalRows;
  const backAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at each end of this row to mark the base of the armhole.",
    [knitEvenLine(straightAboveMarkerRows)],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: backAboveMarker.paragraphs,
    trustedParagraphs: backAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  const hasBackNeckShaping =
    args.shoulderStsEach > 0 && args.backNeckSts > 0 && args.backRoundNeckPlan !== null;
  if (hasBackNeckShaping) {
    rows.push(dropShoulderNecklineRowCounterResetBlock(garmentRcBeforeNecklineReset));
  }

  rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
  if (args.shoulderStsEach > 0 && args.backNeckSts > 0 && args.backRoundNeckPlan) {
    const plan = args.backRoundNeckPlan;
    const necklineLocalTotalRows = dropShoulderNecklineLocalRowsFromGarment(
      neckStartRc,
      args.totalRows,
    );
    const necklineWrittenStartRc = dropShoulderNecklineWrittenStartRc(true, neckStartRc)!;
    const executionLines = roundNeckBackShallowExecutionWrittenLines(plan, {
      bodyWidthStitches: args.bodyWidthSts,
      rc: {
        necklineStartRc: necklineWrittenStartRc,
        shoulderCompleteRc: necklineLocalTotalRows,
      },
    });
    // Isolated, hardcoded explainer video shown immediately before the shoulder
    // bind-off instructions. See `dropShoulderShoulderBindOffVideo.ts`.
    rows.push(dropShoulderShoulderBindOffVideoRow());
    // Round-back divide video: attach to the intro instruction block (same Quick Tip
    // pattern as cast-on) so it renders after begin/lifeline/straight-shoulder copy and
    // immediately before the next block (RIGHT SIDE). A tip-only row here was easy to
    // miss relative to the surrounding instruction blocks.
    const roundBackNeckVideoTip = roundBackNecklineShapingVideoRow();
    rows.push({
      kind: "block",
      rc: dropShoulderNecklineFirstBlockRc(true, neckStartRc),
      trustedParagraphs: insertLifelineReminderAfterOpening([
        "Begin back neckline shaping.",
        "Drop-shoulder shoulders are worked straight — there is no shoulder shaping.",
      ]),
      paragraphs: [],
      tipHtml: roundBackNeckVideoTip.tipHtml,
      tipHtmlIsFull: true,
      tipPresentation: "quick-tip",
      tipId: roundBackNeckVideoTip.tipId,
    });
    rows.push(...splitTrustedParagraphsAtShoulderCompletion(executionLines, args.shoulderStsEach));
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
  castOnSts: number;
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
  alineBodyShaping?: SleevelessAlineBodyShapingPlan | null;
  alineShapingEdgeScope?: SleevelessAlineShapingEdgeScope;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const A = args.bodyWidthSts;
  const castOnSts = args.castOnSts;
  const aline = args.alineBodyShaping ?? null;
  const useAlineBody = aline !== null && aline.shapingType !== "straight";
  const neckStartRc = Math.max(args.armholeMarkerRc, args.totalRows - args.frontNeckDepthRows);
  const straightAboveMarkerRows = Math.max(0, neckStartRc - args.armholeMarkerRc);

  rows.push({ kind: "piece", title: "FRONT" });
  rows.push(pieceMarkersSeamingTipDisplayRow("front"));
  rows.push(castOnBlock(castOnSts, "the front", useAlineBody));
  rows.push(...hemBlocks(args.hemRows, args.hemRowsValid, castOnSts));

  rows.push({ kind: "section", title: "BODY" });
  if (useAlineBody && aline) {
    appendDropShoulderAlineBodyRows(rows, {
      aline,
      bodyRowsValid: args.bodyRowsValid,
      bodyToArmholeRows: args.bodyToArmholeRows,
      castOnSts,
      alineEdgeScope: args.alineShapingEdgeScope,
    });
  } else {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.hemRows),
      paragraphs: args.bodyRowsValid
        ? [knitEvenLine(args.bodyToArmholeRows)]
        : [
            "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
          ],
      stitchCount: castOnSts > 0 ? castOnSts : undefined,
    });
  }

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const pulloverFrontAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at each end of this row to mark the base of the armhole.",
    [knitEvenLine(straightAboveMarkerRows)],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: pulloverFrontAboveMarker.paragraphs,
    trustedParagraphs: pulloverFrontAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  const hasPulloverFrontNeckShaping = args.neckSts > 0 && args.shoulderStsEach > 0;
  if (hasPulloverFrontNeckShaping) {
    rows.push(dropShoulderNecklineRowCounterResetBlock(neckStartRc));
  }

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.neckSts > 0 && args.shoulderStsEach > 0) {
    const necklineLocalTotalRows = dropShoulderNecklineLocalRowsFromGarment(
      neckStartRc,
      args.totalRows,
    );
    const necklineWrittenStartRc = dropShoulderNecklineWrittenStartRc(true, neckStartRc);
    const vNeckRowBudget = dropShoulderFrontNecklineWorkingRows(
      neckStartRc,
      args.totalRows,
      args.frontNeckDepthRows,
    );
    if (args.isVNeck) {
      const perSide = neckDecreaseStitchesPerSideFromOpening(args.neckSts);
      const sched = evenShapingSchedule(perSide, vNeckRowBudget);
      const introTrusted = insertLifelineReminderAfterOpening([
        "Divide for the V-neck at the center.",
        ...dropShoulderPulloverFrontShoulderDivideParagraphs(),
        sched.count > 0
          ? appendEvenShapingRowListToInstruction(
              `At the neck edge, decrease 1 stitch ${intervalPhrase(sched.interval)} ${sched.count} time${sched.count === 1 ? "" : "s"}`,
              sched,
              necklineWrittenStartRc,
              `(${perSide} stitches removed per side)`,
            )
          : "Work straight to the shoulder.",
      ]);
      const finishTrusted = dropShoulderPulloverBothShouldersFinishParagraphs(
        args.shoulderStsEach,
        necklineLocalTotalRows,
        DROP_SHOULDER_PULLOVER_V_NECK_SECOND_SHOULDER_SENTENCE,
      );
      rows.push({
        kind: "block",
        rc: dropShoulderNecklineFirstBlockRc(true, neckStartRc),
        trustedParagraphs: introTrusted,
        paragraphs: [],
      });
      rows.push(...splitTrustedParagraphsAtShoulderCompletion(finishTrusted, args.shoulderStsEach));
    } else {
      const { lines, plan } = roundNeckEdgeLines(
        args.neckSts,
        args.frontNeckDepthRows,
        necklineWrittenStartRc,
      );
      const centerLine = roundNeckPlanCenterWrittenLine(plan);
      const introTrusted = insertLifelineReminderAfterOpening([
        centerLine ? `${centerLine} for the neck.` : "Shape the neck.",
        ...dropShoulderPulloverFrontShoulderDivideParagraphs(),
        ...lines,
        ...(isShallowSinglesOnlyPlan(plan) ? [roundNeckPlanFinishHeldStitchesLine()] : []),
      ]);
      const finishTrusted = dropShoulderPulloverBothShouldersFinishParagraphs(
        args.shoulderStsEach,
        necklineLocalTotalRows,
        DROP_SHOULDER_PULLOVER_ROUND_NECK_SECOND_SHOULDER_SENTENCE,
      );
      rows.push({
        kind: "block",
        rc: dropShoulderNecklineFirstBlockRc(true, neckStartRc),
        trustedParagraphs: introTrusted,
        paragraphs: [],
      });
      rows.push(...splitTrustedParagraphsAtShoulderCompletion(finishTrusted, args.shoulderStsEach));
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
  frontCastOnSts: number;
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
  alineBodyShaping?: SleevelessAlineBodyShapingPlan | null;
  alineShapingEdgeScope?: SleevelessAlineShapingEdgeScope;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  const A = args.frontSts;
  const castOnSts = args.frontCastOnSts;
  const aline = args.alineBodyShaping ?? null;
  const useAlineBody = aline !== null && aline.shapingType !== "straight";
  const neckStartRc = Math.max(args.armholeMarkerRc, args.totalRows - args.frontNeckDepthRows);
  const straightAboveMarkerRows = Math.max(0, neckStartRc - args.armholeMarkerRc);

  rows.push({ kind: "piece", title: "LEFT FRONT" });
  rows.push(pieceMarkersSeamingTipDisplayRow("front"));
  rows.push(castOnBlock(castOnSts, "the left front", useAlineBody));
  rows.push(...hemBlocks(args.hemRows, args.hemRowsValid, castOnSts));

  rows.push({ kind: "section", title: "BODY" });
  if (useAlineBody && aline) {
    appendDropShoulderAlineBodyRows(rows, {
      aline,
      bodyRowsValid: args.bodyRowsValid,
      bodyToArmholeRows: args.bodyToArmholeRows,
      castOnSts,
      alineEdgeScope: args.alineShapingEdgeScope ?? "armholeEdgeOnly",
    });
  } else {
    rows.push({
      kind: "block",
      rc: formatRcColon(args.hemRows),
      paragraphs: args.bodyRowsValid
        ? [knitEvenLine(args.bodyToArmholeRows)]
        : [
            "Body length to the armhole could not be calculated. Confirm back neck to hem, upper arm, and row gauge, then try again.",
          ],
      stitchCount: castOnSts > 0 ? castOnSts : undefined,
    });
  }

  rows.push({ kind: "section", title: "ABOVE ARMHOLE MARKERS" });
  const cardiganFrontAboveMarker = armholeMarkerBlockParagraphs(
    "Place a marker at the side edge to mark the base of the armhole.",
    [knitEvenLine(straightAboveMarkerRows)],
  );
  rows.push({
    kind: "block",
    rc: formatRcColon(args.armholeMarkerRc),
    paragraphs: cardiganFrontAboveMarker.paragraphs,
    trustedParagraphs: cardiganFrontAboveMarker.trustedParagraphs,
    stitchCount: A > 0 ? A : undefined,
  });

  const cardiganNeckChartAtRc000 = dropShoulderFrontNeckShapingChartInputsReady({
    neckSts: args.neckPerFront * 2,
    shoulderStsEach: args.shoulderStsEach,
    frontNeckDepthRows: args.frontNeckDepthRows,
    totalRows: args.totalRows,
    bustBodySts: args.frontSts * 2,
  });
  if (cardiganNeckChartAtRc000) {
    rows.push(dropShoulderNecklineRowCounterResetBlock(neckStartRc));
  }

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.neckPerFront > 0 && args.shoulderStsEach > 0) {
    const useLocalNecklineRc = cardiganNeckChartAtRc000;
    const necklineLocalTotalRows = dropShoulderNecklineLocalRowsFromGarment(
      neckStartRc,
      args.totalRows,
    );
    const necklineWrittenStartRc = dropShoulderNecklineWrittenStartRc(useLocalNecklineRc, neckStartRc);
    const shoulderFinishRc = useLocalNecklineRc ? necklineLocalTotalRows : args.totalRows;
    const vNeckRowBudget = dropShoulderFrontNecklineWorkingRows(
      neckStartRc,
      args.totalRows,
      args.frontNeckDepthRows,
    );
    if (args.isVNeck) {
      const sched = evenShapingSchedule(args.neckPerFront, vNeckRowBudget);
      const introTrusted = [
        "Begin the V-neck shaping at the center-front edge.",
        sched.count > 0
          ? appendEvenShapingRowListToInstruction(
              `Decrease 1 stitch at the center-front (neck) edge ${intervalPhrase(sched.interval)} ${sched.count} time${sched.count === 1 ? "" : "s"}`,
              sched,
              necklineWrittenStartRc,
              `(${args.neckPerFront} stitches removed)`,
            )
          : "Work straight to the shoulder.",
      ];
      const finishTrusted = [
        "The first shoulder is complete.",
        `When ${args.shoulderStsEach} stitches remain, knit even to ${formatRcColon(shoulderFinishRc)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
      ];
      rows.push({
        kind: "block",
        rc: dropShoulderNecklineFirstBlockRc(useLocalNecklineRc, neckStartRc),
        trustedParagraphs: introTrusted,
        paragraphs: [],
      });
      rows.push(...splitTrustedParagraphsAtShoulderCompletion(finishTrusted, args.shoulderStsEach));
    } else {
      const fullNeck = args.neckPerFront * 2;
      const plan = calculateRoundNecklinePlan({
        necklineStitches: fullNeck,
        necklineDepthRows: args.frontNeckDepthRows,
      });
      const cfBindOff = cardiganFrontInitialNeckBindOffStitches(fullNeck, args.frontNeckDepthRows);
      const introTrusted = [
        `Bind off ${cfBindOff} stitches at the center-front (neck) edge.`,
        ...roundNeckCardiganCfEdgeWrittenLines(plan, { necklineStartRc: necklineWrittenStartRc }),
      ];
      const finishTrusted = [
        "The first shoulder is complete.",
        `When ${args.shoulderStsEach} stitches remain, knit even to ${formatRcColon(shoulderFinishRc)}, then bind off ${args.shoulderStsEach} stitches for the shoulder.`,
      ];
      rows.push({
        kind: "block",
        rc: dropShoulderNecklineFirstBlockRc(useLocalNecklineRc, neckStartRc),
        trustedParagraphs: introTrusted,
        paragraphs: [],
      });
      rows.push(...splitTrustedParagraphsAtShoulderCompletion(finishTrusted, args.shoulderStsEach));
    }
    rows.push({
      kind: "block",
      paragraphs: [
        "Work the RIGHT FRONT to match, reversing the neckline shaping so it falls at the opposite (center-front) edge.",
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
  const shapingRcSequence = dropShoulderSleeveShapingRcSequence(chartInput);
  const shapingWrittenLines = formatDropShoulderSleeveShapingWrittenLines(
    shapingPlan.shapingDirection,
    shapingPlan.steps,
    shapingRcSequence,
  );
  const sleeveBodyTailLines = [
    sleeveBodyRemainderLine(shapingPlan, args.direction, args.sleeveTotalRows, shapingPlan.shapingDirection),
  ].filter((p) => p.length > 0);
  const preShaping = dropShoulderSleevePreShapingSpan(chartInput);
  const hasSleeveShaping = shapingWrittenLines.length > 0;
  /**
   * Stitches actually on the needles at sleeve-body start (post-cuff cuff-up, or
   * upper-arm cast-on top-down) — never the eventual opposite-edge / final count.
   */
  const stitchesOnNeedlesAtBodyStart =
    args.direction === "top-down" ? args.topSts : args.wristSts;
  /** Stitches after all sleeve-body shaping (upper arm cuff-up, wrist top-down). */
  const stitchesAfterSleeveBodyShaping =
    args.direction === "top-down" ? args.wristSts : args.topSts;

  function appendSleeveBodyBlocks(currentStitchesOnNeedles: number | undefined): void {
    rows.push({ kind: "section", title: "SLEEVE BODY" });
    if (!hasSleeveShaping) {
      rows.push({
        kind: "block",
        rc: formatRcColon(preShaping.bodyStartRc),
        paragraphs: sleeveBodyTailLines,
        stitchCount: currentStitchesOnNeedles,
      });
      return;
    }
    const shapingRc = preShaping.firstShapingRc!;
    if (preShaping.straightRows > 0) {
      rows.push({
        kind: "block",
        rc: formatRcColon(preShaping.bodyStartRc),
        paragraphs: [knitEvenLine(preShaping.straightRows)],
        stitchCount: currentStitchesOnNeedles,
      });
    }
    rows.push({
      kind: "block",
      rc: formatRcColon(shapingRc),
      paragraphs: [DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE, ...sleeveBodyTailLines],
      trustedParagraphs: [
        DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
        ...shapingWrittenLines,
        ...sleeveBodyTailLines,
      ],
      // Still the pre-shaping count: increases/decreases have not been worked yet at this RC.
      stitchCount: currentStitchesOnNeedles,
    });
  }

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
            tipId: "drop-shoulder-cast-on-sleeve-top",
          }
        : {}),
      stitchCount: args.topSts > 0 ? args.topSts : undefined,
    });
    appendSleeveBodyBlocks(
      stitchesOnNeedlesAtBodyStart > 0 ? stitchesOnNeedlesAtBodyStart : undefined,
    );
    appendSleeveShapingChartSection();
    rows.push({ kind: "section", title: "CUFF" });
    rows.push({
      kind: "block",
      rc: formatRcColon(args.sleeveBodyRows),
      paragraphs: [knitEvenLine(args.cuffRows)],
      trustedParagraphs: [bindOffLooselyOrScrapOffTrustedParagraph("cuff/wrist edge")],
      stitchCount: stitchesAfterSleeveBodyShaping > 0 ? stitchesAfterSleeveBodyShaping : undefined,
    });
    return rows;
  }

  // cuff-up (bottom-up, default)
  rows.push({
    kind: "block",
    paragraphs: ["Make 2 sleeves."],
  });
  rows.push(castOnBlock(args.wristSts, "the sleeve cuff"));
  rows.push({ kind: "section", title: "CUFF" });
  rows.push({
    kind: "block",
    rc: formatRcColon(0),
    paragraphs: [knitEvenLine(args.cuffRows)],
    stitchCount: args.wristSts > 0 ? args.wristSts : undefined,
  });
  appendSleeveBodyBlocks(
    stitchesOnNeedlesAtBodyStart > 0 ? stitchesOnNeedlesAtBodyStart : undefined,
  );
  appendSleeveShapingChartSection();
  rows.push({ kind: "section", title: "BIND OFF" });
  rows.push({
    kind: "block",
    rc: formatRcColon(args.sleeveTotalRows),
    trustedParagraphs: [bindOffLooselyOrScrapOffTrustedParagraph("upper-arm/top edge")],
    stitchCount: stitchesAfterSleeveBodyShaping > 0 ? stitchesAfterSleeveBodyShaping : undefined,
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
  const isVNeck = isSleevelessVNeckChoice(patternData);
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
        chartAudience,
        sleeveLengthChoice: style.sleeveLength,
        userEdited: readEffectiveDropShoulderUserEditedSleeveFields(fitSection),
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
  let bustBodySts = bodyWidthSts;
  const finishedHipResolved = resolveDiagramFinishedHipInches(patternData, finishedBust);
  const hipCircForBody =
    finishedBust > 0 && shouldRunSleevelessBodyBlockForPullover(finishedBust)
      ? resolveBodyBlockHipCircumferenceInches(patternData, finishedBust, finishedHipResolved)
      : finishedBust;
  let hemCastOnSts =
    spi > 0 && hipCircForBody > 0
      ? sleevelessBackHalfStitchesFromCircumference(hipCircForBody, spi)
      : bustBodySts;

  const totalRows = backNeckToHem && rpi > 0 ? Math.max(2, Math.round(backNeckToHem * rpi)) : 0;
  const hemRows = calculateHemRowsFromInches(rpi, hemDepthIn);
  const armholeDepthRows = armholeDepthIn && rpi > 0 ? Math.max(2, roundUpToEvenRows(armholeDepthIn * rpi)) : 0;
  const bodyToArmholeRows = Math.max(0, totalRows - hemRows - armholeDepthRows);
  const armholeMarkerRc = hemRows + bodyToArmholeRows;
  const frontNeckDepthRows =
    frontNeckDepthIn && rpi > 0
      ? normalizeRoundNecklineDepthRows(Math.max(1, Math.round(frontNeckDepthIn * rpi)))
      : 0;
  const backNeckDepthRows =
    backNeckDepthIn && rpi > 0 ? normalizeRoundNecklineDepthRows(Math.round(backNeckDepthIn * rpi)) : 0;

  const hemRowsValid = hemRows > 0;
  const bodyRowsValid = totalRows > 0 && bodyToArmholeRows > 0;

  let alineBodyShaping: SleevelessAlineBodyShapingPlan | null = null;
  if (finishedBust > 0 && shouldRunSleevelessBodyBlockForPullover(finishedBust) && hipCircForBody > 0) {
    // Full back body math always uses pullover garmentStyle (same as sleeveless generator).
    // Cardigan fronts get half-panel shaping via scaleAlineBodyShapingPlanForCardiganHalf below.
    const bodyBlockPlan = buildSleevelessBodyBlockPlan({
      garmentStyle: "pullover",
      pieceRole: "back",
      bustCircumferenceInches: finishedBust,
      hipCircumferenceInches: hipCircForBody,
      stitchesPerInch: spi,
      rowsPerInch: rpi,
      rowsToArmhole: bodyToArmholeRows,
      hemRows,
      mode: "auto",
      precomputedBustStitches: bustBodySts,
    });
    warnings.push(...bodyBlockPlan.warnings);
    if (bodyBlockPlan.shapingDirection !== "none" && !bodyBlockPlan.unsupportedForRelease) {
      alineBodyShaping = bodyBlockPlanToAlineShapingPlan(bodyBlockPlan, bodyToArmholeRows, hemRows);
      if (bodyBlockPlan.hemStitches > 0) hemCastOnSts = bodyBlockPlan.hemStitches;
      if (bodyBlockPlan.bustStitches > 0) bustBodySts = bodyBlockPlan.bustStitches;
    } else {
      hemCastOnSts = bustBodySts;
    }
  }

  if (
    !alineBodyShaping &&
    hemCastOnSts !== bustBodySts &&
    bodyRowsValid &&
    bodyToArmholeRows > 0 &&
    spi > 0 &&
    rpi > 0
  ) {
    alineBodyShaping = computeSleevelessAlineBodyShaping({
      bustBodySts,
      finishedHipInches: hipCircForBody,
      finishedBustInches: finishedBust,
      stitchesPerInch: spi,
      rowsPerInch: rpi,
      bodyToArmholeRows,
      hemRows,
    });
    if (alineBodyShaping && alineBodyShaping.shapingType !== "straight") {
      hemCastOnSts = alineBodyShaping.hemCastOnSts;
      bustBodySts = alineBodyShaping.bustBodySts;
    }
  }

  const cardiganLeftHalfWidths =
    isCardigan && hemCastOnSts > 0 && bustBodySts > 0
      ? resolveCardiganHalfFrontWidths(
          {
            hemCastOnSts: hemCastOnSts,
            bustBodySts: bustBodySts,
            stitchesAfterArmhole: bustBodySts,
          },
          "left",
        )
      : null;
  const cardiganHalfLeftCastOnSts = cardiganLeftHalfWidths?.hemCastOnSts;
  const cardiganHalfLeftBustBodySts = cardiganLeftHalfWidths?.bustBodySts;
  const cardiganHalfLeftStitchesAfterArmhole = cardiganLeftHalfWidths?.stitchesAfterArmhole;

  const cardiganFrontAlineShaping =
    isCardigan && alineBodyShaping && cardiganLeftHalfWidths
      ? scaleAlineBodyShapingPlanForCardiganHalf(
          alineBodyShaping,
          cardiganLeftHalfWidths.hemCastOnSts,
          cardiganLeftHalfWidths.bustBodySts,
        )
      : null;

  const neckSts = neckWidthIn !== undefined && spi > 0 ? forceEven(neckWidthIn * spi) : 0;
  const shoulderStsEach = bustBodySts > 0 ? Math.max(0, Math.round((bustBodySts - neckSts) / 2)) : 0;
  // Exact back-neck count so shoulders + neck sum to the body width.
  const backNeckSts = Math.max(0, bustBodySts - 2 * shoulderStsEach);

  // ---- Sleeve math (flat piece width = circumference; top edge = upper arm) ----
  const topSts = upperArmIn !== undefined && spi > 0 ? forceEven(upperArmIn * spi) : 0;
  const wristSts = wristIn !== undefined && spi > 0 ? forceEven(wristIn * spi) : 0;
  const cuffRows = calculateCuffRowsFromInches(rpi, cuffDepthIn);
  const sleeveTotalRows = sleeveLengthIn && rpi > 0 ? Math.max(cuffRows + 2, Math.round(sleeveLengthIn * rpi)) : 0;
  const sleeveBodyRows = Math.max(0, sleeveTotalRows - cuffRows);
  const sleeveValid = topSts > 0 && wristSts > 0 && sleeveTotalRows > 0;

  const backRoundNeckPlan =
    backNeckSts > 0
      ? calculateBackRoundNecklinePlan({
          necklineStitches: backNeckSts,
          necklineDepthRows: Math.max(1, backNeckDepthRows),
        })
      : null;
  if (backRoundNeckPlan && backRoundNeckPlan.warnings.length > 0) {
    warnings.push(...backRoundNeckPlan.warnings);
  }

  const frontRoundNeckPlan =
    neckSts > 0 && frontNeckDepthRows > 0 && !isVNeck
      ? calculateRoundNecklinePlan({
          necklineStitches: neckSts,
          necklineDepthRows: frontNeckDepthRows,
        })
      : null;
  if (frontRoundNeckPlan && frontRoundNeckPlan.warnings.length > 0) {
    warnings.push(...frontRoundNeckPlan.warnings);
  }

  const backNecklineStartRC =
    backRoundNeckPlan && backNeckDepthRows > 0
      ? Math.max(armholeMarkerRc, totalRows - backNeckDepthRows)
      : totalRows;

  const frontNecklineStartRC = Math.max(armholeMarkerRc, totalRows - frontNeckDepthRows);
  const frontNecklineWorkingRows = dropShoulderFrontNecklineWorkingRows(
    frontNecklineStartRC,
    totalRows,
    frontNeckDepthRows,
  );

  // ---- Build display rows ----
  const displayRows = buildBackRows({
    castOnSts: hemCastOnSts,
    bodyWidthSts: bustBodySts,
    hemRows,
    hemRowsValid,
    bodyToArmholeRows,
    bodyRowsValid,
    armholeDepthRows,
    armholeMarkerRc,
    totalRows,
    shoulderStsEach,
    backNeckSts,
    backNeckDepthRows,
    backRoundNeckPlan,
    alineBodyShaping,
  });

  const cardiganFrontShoulderSts =
    cardiganHalfLeftBustBodySts !== undefined
      ? Math.max(0, Math.round(cardiganHalfLeftBustBodySts - Math.round(neckSts / 2)))
      : 0;

  let frontDisplayRows = isCardigan
    ? buildCardiganFrontRows({
        frontCastOnSts: cardiganHalfLeftCastOnSts ?? 0,
        frontSts: cardiganHalfLeftBustBodySts ?? 0,
        hemRows,
        hemRowsValid,
        bodyToArmholeRows,
        bodyRowsValid,
        armholeDepthRows,
        armholeMarkerRc,
        totalRows,
        shoulderStsEach: cardiganFrontShoulderSts,
        neckPerFront: Math.round(neckSts / 2),
        frontNeckDepthRows,
        isVNeck,
        alineBodyShaping: cardiganFrontAlineShaping,
        alineShapingEdgeScope: "armholeEdgeOnly",
      })
    : buildPulloverFrontRows({
        castOnSts: hemCastOnSts,
        bodyWidthSts: bustBodySts,
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
        alineBodyShaping,
      });

  const frontNeckChartBuilt = buildDropShoulderFrontNeckShapingChart({
    isCardigan,
    isVNeck,
    neckSts,
    shoulderStsEach: isCardigan ? cardiganFrontShoulderSts : shoulderStsEach,
    frontNeckDepthRows,
    frontNecklineStartRC,
    totalRows,
    bustBodySts,
    rowsPerInch: rpi,
  });
  if (frontNeckChartBuilt) {
    frontDisplayRows = [...frontDisplayRows, { kind: "neckShoulderChartTableMount" }];
  }

  const bustDartFrontStitchCount = isCardigan
    ? (cardiganHalfLeftBustBodySts ?? bustBodySts)
    : bustBodySts;
  const bustDart = resolveBustDartForSweaterFront({
    patternData,
    frontConstruction: isCardigan ? "cardigan" : "pullover",
    frontStitchCount: bustDartFrontStitchCount,
    armholeOpeningGarmentRc: armholeMarkerRc,
    hemRows,
    bodyToArmholeRows,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
  });
  if (bustDart.errors.length) {
    warnings.push(...bustDart.errors.map((e) => `Bust darts: ${e}`));
  }
  if (bustDart.warnings.length) {
    warnings.push(...bustDart.warnings);
  }
  frontDisplayRows = insertBustDartIntoFrontBodyDisplayRows(frontDisplayRows, bustDart, {
    formatRc: formatRcColon,
    knitToRcLine: (targetRc) => `Knit to RC ${Math.max(0, Math.floor(targetRc))}.`,
    knitRowsToRcLine: (rows, targetRc) =>
      rows === 1
        ? `Knit 1 row to RC ${Math.max(0, Math.floor(targetRc))}.`
        : `Knit ${rows} rows to RC ${Math.max(0, Math.floor(targetRc))}.`,
    knitRowsEvenToRcLine: (rows, targetRc) =>
      rows === 1
        ? `Knit 1 row even to RC ${Math.max(0, Math.floor(targetRc))}.`
        : `Knit ${rows} rows even to RC ${Math.max(0, Math.floor(targetRc))}.`,
  });

  // Back timeline feeds the Visual Guides Shaping Map only (no back checklist chart mount).
  const backNeckShoulderTimeline =
    !isVNeck
      ? buildDropShoulderBackNeckShapingTimeline({
          backNeckSts,
          shoulderStsEach,
          backNeckDepthRows: Math.max(1, backNeckDepthRows),
          backNecklineStartRC,
          totalRows,
          bustBodySts,
          rowsPerInch: rpi,
        }) ?? undefined
      : undefined;

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
    backStitches: bustBodySts,
    bustBodyStitches: bustBodySts || undefined,
    hemCastOnStitches: hemCastOnSts || undefined,
    hipRowsFromHem: alineBodyShaping !== null ? alineBodyShaping.hipRowsFromHem : undefined,
    alineBodyShapingRowNumbers:
      alineBodyShaping !== null && alineBodyShaping.shapingType !== "straight"
        ? [...alineBodyShaping.shapingRowNumbers]
        : undefined,
    alineBodyShapingType:
      alineBodyShaping !== null ? alineBodyShaping.shapingType : undefined,
    shoulderWidthInches: shoulderWidthIn,
    stitchesAfterArmhole: bustBodySts || undefined,
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
    centerNeckBindOffStitches: backRoundNeckPlan?.centerBindOff,
    ...(frontRoundNeckPlan
      ? { frontCenterNeckBindOffStitches: frontRoundNeckPlan.centerBindOff }
      : {}),
    backNeckRoundNecklineStrategy: backRoundNeckPlan?.strategy,
    frontNeckRoundNecklineStrategy: frontRoundNeckPlan?.strategy,
    frontNeckDepth: frontNeckDepthIn,
    frontNeckDepthRows,
    frontNecklineWorkingRows,
    backNeckDepthRows,
    backNecklineStartRC: backNecklineStartRC,
    frontNecklineStartRC,
    armholeStartRow: armholeMarkerRc,
    finalRC: totalRows,
    isCardigan,
    ...(isCardigan && !isVNeck && neckSts > 0
      ? {
          cardiganFrontInitialNeckBindOffStitches: cardiganFrontInitialNeckBindOffStitches(
            neckSts,
            Math.max(1, frontNeckDepthRows),
          ),
        }
      : {}),
    ...(isCardigan && cardiganHalfLeftCastOnSts !== undefined
      ? {
          cardiganHalfLeftCastOnSts,
          cardiganHalfLeftStitchesAfterArmhole,
        }
      : {}),
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
    frontNeckShoulderShapingChart: frontNeckChartBuilt?.chart ?? EMPTY_CHART,
    neckShoulderChartUsesLiveRows: false,
    frontNeckShoulderChartUsesLiveRows: frontNeckChartBuilt?.usesLiveRows ?? false,
    backNeckShoulderTimeline,
    frontNeckShoulderTimeline: frontNeckChartBuilt?.timeline,
    isDropShoulder: true,
  };
}
