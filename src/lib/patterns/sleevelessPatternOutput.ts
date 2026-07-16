/**
 * Plain-text pattern output for sleeveless garments (machine knitting).
 * First slice: BACK piece only — no finishing, pickup, or armhole pickup blocks.
 */

import { calculateArmholeShaping, type ArmholeResult } from "./legoBlocks/armholeBlock";
import { shapingActionRowNumbers } from "./evenShapingSchedule";
import { hemSectionRow } from "./legoBlocks/hem";
import { formatRowCounterResetGarmentRcLabel, RESET_ROW_COUNTER_TEXT } from "./rowCounterReset";
import { parseInlineMarkedLine } from "./inlineRcHeading";
import {
  generateNeckShoulderExecution,
  shapingActionsFromTimeline,
  type CenterBindOffExecutionText,
  type NeedleRange,
  type ShapingAction,
} from "./legoBlocks/neckShoulderExecution";
import { resolveEffectiveArmholeDepthInches } from "./customBuildEffectiveArmholeDepth";
import { resolveDiagramFinishedHipInches } from "./customBuildEffectiveFinishedHip";
import { diagramGuidesForAppliedBodyShaping } from "./sleevelessBodyShapeDiagramGuides";
import { resolveEffectiveFinishedBustInches } from "./customBuildEffectiveFinishedBust";
import {
  buildSleevelessBodyBlockPlan,
  type SleevelessBodyDiagramGuides,
} from "./bodyBlock/sleevelessBodyBlock";
import {
  bodyBlockPlanToAlineShapingPlan,
  formatSleevelessAlineBodyShapingSummaryLine,
  resolveEffectiveSleevelessBodyShapeKind,
  scaleAlineBodyShapingPlanForCardiganHalf,
  sleevelessAlineShapingLineNeedsTrustedHtml,
  type SleevelessAlineShapingEdgeScope,
  resolveBodyBlockHipCircumferenceInches,
  shouldRunSleevelessBodyBlockForPullover,
  type SleevelessAlineBodyShapingPlan,
} from "./sleevelessAlineShaping";
import {
  buildSleevelessBodyShapingChartRows,
  type SleevelessBodyShapingChartRow,
} from "./sleevelessBodyShapingChartHtml";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import { resolveEffectiveShoulderWidthInches } from "./customBuildEffectiveShoulderWidth";
import { calculateBasicPatternNumbers } from "./patternCalculator";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import { calculateHemRowsFromInches } from "./hemDefaults";
import {
  buildRowAccountingInputFromDebug,
  rowsToInches,
  validateRowAccounting,
  warnRowAccountingDriftIfDev,
} from "./sleevelessRowAccounting";
import {
  isSleevelessCardiganFrontNeckShoulderChart,
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
  armholeLocalRcFirstActiveSideNecklineShapingAction,
  armholeLocalRcCenterNecklineSetupRow,
} from "./neckShoulderActiveSideChecklist";
import {
  isSleevelessCardiganGarmentStyle,
  isSleevelessVNeckChoice,
} from "./sleevelessFrontDiagramSrc";
import { resolveCardiganHalfFrontWidths } from "./cardiganFrontBlock";
import {
  cardiganFrontEdgePickupStitchesFromDebug,
  cardiganFrontEdgeRowsFromDebug,
} from "./sleevelessPatternFinishing";
import { buildVNeckFrontFullWidthTimeline } from "./vNeckFrontFullWidthTimeline";
import {
  collectOuterShoulderBindOffPoints,
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import {
  computeShoulderBindoffSchedule,
  alignBackNeckShoulderTimelineFinalCountsToFront,
  type RowEntry,
  type ShoulderBindoffSchedule,
} from "./shapingTimeline";
import {
  initialCenterNeckStitches,
  initialBackCenterNeckStitches,
  backNeckEdgeDecreasesPerSide,
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  neckEdgeDecreasesPerSide,
  normalizeRoundNecklineDepthRows,
} from "./legoBlocks/roundNeckline";
import {
  cardiganFrontInitialNeckBindOffStitches,
} from "./roundNeckNotation";
import {
  roundNeckBackShallowSleevelessSummaryWrittenLines,
  type RoundNecklinePlanResult,
} from "./roundNeckPlanPresentation";
import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import { buildPatternHelpCardInnerHtml } from "./patternHelpCard";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";

/** Visual presentation for structured pattern tips (style only). */
export type PatternTipPresentation = "quick-tip" | "help-card";

function escapePatternTipAttr(s: string): string {
  return String(s).replace(/"/g, "&quot;");
}

/** Trusted pattern-tip wrapper — used by pattern tab and print renderers. */
export function patternTipWrapperHtml(row: {
  tipHtml: string;
  tipHtmlIsFull?: boolean;
  tipId?: string;
  tipPresentation?: PatternTipPresentation;
  /** Extra classes on the outer `.pattern-tip` wrapper (e.g. `no-print`). */
  tipWrapperClass?: string;
}): string {
  const tipIdAttr = row.tipId ? ` data-tip-id="${escapePatternTipAttr(row.tipId)}"` : "";
  const presentationClass =
    row.tipPresentation === "quick-tip"
      ? " pattern-quick-tip"
      : row.tipPresentation === "help-card"
        ? " pattern-help-card"
        : "";
  const wrapperExtraClass = row.tipWrapperClass ? ` ${String(row.tipWrapperClass).trim()}` : "";
  if (row.tipHtmlIsFull) {
    return `<div class="pattern-tip${presentationClass}${wrapperExtraClass}" data-tip${tipIdAttr}>${row.tipHtml}</div>`;
  }
  return `<div class="pattern-tip${wrapperExtraClass}" data-tip${tipIdAttr}><strong>Tip:</strong> ${row.tipHtml}</div>`;
}

/** Glossary entry for e-wrap cast on (cast-on method tip). */
export const EWRAP_CAST_ON_GLOSSARY_ID = 312;

function glossaryPlaceholderAttrEscape(s: string): string {
  return String(s).replace(/"/g, "&quot;");
}

const EWRAP_CAST_ON_GLOSSARY_TOOLTIP_HTML = buildGlossaryTooltipPlaceholderHtml(
  EWRAP_CAST_ON_GLOSSARY_ID,
  "e-wrap cast on",
  glossaryPlaceholderAttrEscape,
  (s) => s,
);

const CAST_ON_METHOD_QUICK_TIP_SUMMARY = "Cast-on method";

/** Quick Tip body for cast-on block (glossary placeholder on “e-wrap cast on”). */
export function castOnMethodQuickTipBodyHtml(): string {
  return (
    `<p>Use the cast-on method of your choice. Many knitters use an ${EWRAP_CAST_ON_GLOSSARY_TOOLTIP_HTML} for simple sweater hems.</p>`
  );
}

/** @deprecated Prefer {@link castOnMethodQuickTipBodyHtml}; body HTML only (no Quick Tip wrapper). */
export const CAST_ON_METHOD_PATTERN_TIP_HTML = castOnMethodQuickTipBodyHtml();

/** Quick Tip inner markup for the cast-on block. */
export function castOnMethodQuickTipInnerHtml(): string {
  return buildPatternQuickTipInnerHtml({
    summaryLabel: CAST_ON_METHOD_QUICK_TIP_SUMMARY,
    bodyHtml: castOnMethodQuickTipBodyHtml(),
  });
}

/** Glossary entry for piece-level seaming marker tip (entire tip opens this entry). */
export const PIECE_MARKERS_SEAMING_TIP_GLOSSARY_ID = 1779219555295;

const PIECE_MARKERS_SEAMING_SUMMARY_LABEL = "Add markers for easier seaming";

/** Expanded Quick Tip body for markers help (glossary placeholder on “marker”). */
export function pieceMarkersSeamingQuickTipBodyHtml(): string {
  const markerPh = buildGlossaryTooltipPlaceholderHtml(
    PIECE_MARKERS_SEAMING_TIP_GLOSSARY_ID,
    "marker",
    glossaryPlaceholderAttrEscape,
    (s) => s,
  );
  return (
    `<p>Add a ${markerPh} to a specific point (for example, every 10&ndash;20 rows) in your knitting so you can easily find that location later. ` +
    "Markers are often used to identify matching points for seams, shaping, or garment sections.</p>"
  );
}

/** First block inside BACK / FRONT — before cast-on, BODY, or other instructions. */
export function pieceMarkersSeamingTipDisplayRow(
  piece: "back" | "front",
): Extract<SleevelessPatternDisplayRow, { kind: "block" }> {
  return {
    kind: "block",
    paragraphs: [],
    tipHtml: buildPatternQuickTipInnerHtml({
      summaryLabel: PIECE_MARKERS_SEAMING_SUMMARY_LABEL,
      bodyHtml: pieceMarkersSeamingQuickTipBodyHtml(),
    }),
    tipHtmlIsFull: true,
    tipPresentation: "quick-tip",
    tipId: `sleeveless-piece-markers-${piece}`,
  };
}

/** Shown once at the armhole reset — RC targets below are from this counter, not the body cast-on RC. */
export const ARMHOLE_RC_FROM_RESET_NOTE =
  "Row counter numbers in this section are counted from the armhole reset.";

/** Catalog `content_id` in `videos-public.json` (Bind Off Trick). */
export const ARMHOLE_BIND_OFF_TRICK_CONTENT_ID = 5002;

/** Registry key in `SLEEVELESS_HELP_VIDEOS` for {@link ARMHOLE_BIND_OFF_TRICK_CONTENT_ID}. */
export const ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY = "bindOffTrick";

const ARMHOLE_ALTERNATE_HELP_CARD_TITLE = "Armhole shaping options";

/** Help Card body for the first armhole shaping block (alternate techniques + bind-off video). */
export function armholeAlternateTechniquesHelpCardBodyHtml(): string {
  return (
    "<p>Some machine knitters prefer to hold stitches or use short-row shaping at the armhole to reduce seam bulk. Feel free to use the technique you are most comfortable with.</p>" +
    '<p class="pattern-finishing-video-help pattern-help-link no-print sleeveless-armhole-tip__bind-off-video">' +
    '<strong class="pattern-finishing-video-help__lead">Cleaner Partial Bind-Off Edge</strong> ' +
    "Binding off just a few stitches at the armhole edge? This quick tip shows an optional transfer trick that can create a smoother-looking shaping line. " +
    '<span class="pattern-help-link"><button type="button" class="pattern-help-link__button" data-sleeveless-help-video="' +
    ARMHOLE_BIND_OFF_TRICK_VIDEO_KEY +
    '" aria-haspopup="dialog"><i class="fa-solid fa-play" aria-hidden="true"></i> Bind Off Trick</button></span>' +
    "</p>"
  );
}

/** @deprecated Prefer {@link armholeAlternateTechniquesHelpCardBodyHtml}; body HTML only. */
export const ARMHOLE_ALTERNATE_TECHNIQUES_TIP_HTML = armholeAlternateTechniquesHelpCardBodyHtml();

/** Help Card inner markup for the first armhole shaping block. */
export function armholeAlternateTechniquesHelpCardInnerHtml(): string {
  return buildPatternHelpCardInnerHtml({
    title: ARMHOLE_ALTERNATE_HELP_CARD_TITLE,
    bodyHtml: armholeAlternateTechniquesHelpCardBodyHtml(),
    icon: false,
  });
}

const NECKLINE_ORIENTATION_HELP_CARD_TITLE = "Understanding Left, Right & Diagram Orientation";

/** Help Card body: left/right vs diagram orientation (BACK and FRONT neckline summary blocks). */
export function necklineShoulderOrientationHelpCardBodyHtml(): string {
  return (
    "<p>The diagrams and shaping instructions are shown as you work at the machine.</p>" +
    '<p>&ldquo;Left&rdquo; and &ldquo;Right&rdquo; in the chart refer to carriage position, not the finished sweater as worn.</p>' +
    "<p>Shaping edges are labeled &ldquo;Neck&rdquo; and &ldquo;Armhole&rdquo; so you can follow the shaping without needing to rotate or reinterpret the garment.</p>" +
    "<p>When working the second shoulder, repeat the shaping on the opposite side.</p>"
  );
}

/** Help Card inner markup for neckline / shoulder diagram orientation. */
export function necklineShoulderOrientationHelpCardInnerHtml(): string {
  return buildPatternHelpCardInnerHtml({
    title: NECKLINE_ORIENTATION_HELP_CARD_TITLE,
    bodyHtml: necklineShoulderOrientationHelpCardBodyHtml(),
    icon: false,
  });
}

const CARRIAGE_POSITION_HELP_CARD_TITLE = "Carriage Position";

/** Help Card body for the active-shoulder checklist Carriage Position column. */
export function carriagePositionHelpCardBodyHtml(): string {
  return (
    "<p>Carriage Position shows where your carriage should be before knitting that row.</p>" +
    '<p><em>Example:</em> If the chart says &ldquo;Right,&rdquo; your carriage should be on the right side before you begin knitting the row.</p>'
  );
}

/** Help Card inner markup before the shaping chart when the Carriage Position column is present. */
export function carriagePositionHelpCardInnerHtml(): string {
  return buildPatternHelpCardInnerHtml({
    title: CARRIAGE_POSITION_HELP_CARD_TITLE,
    bodyHtml: carriagePositionHelpCardBodyHtml(),
    icon: false,
  });
}

/**
 * Wrapped Help Card for chart intro (online only — `no-print` on wrapper).
 * Rendered immediately before the shaping chart table when that column is present.
 */
export function carriagePositionHelpCardHtml(): string {
  return patternTipWrapperHtml({
    tipHtml: carriagePositionHelpCardInnerHtml(),
    tipHtmlIsFull: true,
    tipPresentation: "help-card",
    tipId: "sleeveless-carriage-position",
    tipWrapperClass: "no-print",
  });
}

/** Glossary entry for “lifeline” in neckline/shoulder shaping tip. */
export const LIFELINE_GLOSSARY_ID = 1779296723857;

/** Plain neckline-section lifeline reminder (tooltip target is the word “lifeline” only). */
export const LIFELINE_BEFORE_DIVIDING_NECKLINE_PLAIN =
  "Optional: Add a lifeline before dividing the neckline.";

/** Trusted HTML for the neckline-section lifeline reminder (glossary popup on “lifeline”). */
export function lifelineBeforeDividingNecklineReminderTrustedHtml(): string {
  const lifelinePh = buildGlossaryTooltipPlaceholderHtml(
    LIFELINE_GLOSSARY_ID,
    "lifeline",
    glossaryPlaceholderAttrEscape,
    (s) => s,
  );
  return `Optional: Add a ${lifelinePh} before dividing the neckline.`;
}

/**
 * Pullover / full-width neckline sections that divide the neckline at center.
 * Cardigan half fronts shape at the open center-front edge instead — omit there.
 */
export function lifelineBeforeDividingNecklineReminderApplies(isCardiganHalfFront = false): boolean {
  return !isCardiganHalfFront;
}

/** Insert the lifeline reminder immediately after the section’s opening instruction line. */
export function insertLifelineReminderAfterOpening(
  lines: readonly string[],
  applies = true,
): string[] {
  if (!applies || lines.length === 0) return [...lines];
  return [lines[0]!, lifelineBeforeDividingNecklineReminderTrustedHtml(), ...lines.slice(1)];
}

const LIFELINE_BEFORE_NECK_SHOULDER_QUICK_TIP_SUMMARY = "Lifeline before neckline shaping";

/** Quick Tip body after armhole shaping (glossary placeholder on “lifeline” only). */
export function lifelineBeforeNeckShoulderQuickTipBodyHtml(): string {
  const lifelinePh = buildGlossaryTooltipPlaceholderHtml(
    LIFELINE_GLOSSARY_ID,
    "lifeline",
    glossaryPlaceholderAttrEscape,
    (s) => s,
  );
  return (
    `<p>Before starting the neckline and shoulder shaping, consider adding a ${lifelinePh} or waste yarn row. It gives you a safe place to rip back to if you make a mistake during shaping.</p>`
  );
}

/** @deprecated Prefer {@link lifelineBeforeNeckShoulderQuickTipBodyHtml}; body HTML only. */
export const LIFELINE_BEFORE_NECK_SHOULDER_SHAPING_TIP_HTML =
  lifelineBeforeNeckShoulderQuickTipBodyHtml();

/** Quick Tip inner markup before neckline and shoulder shaping. */
export function lifelineBeforeNeckShoulderQuickTipInnerHtml(): string {
  return buildPatternQuickTipInnerHtml({
    summaryLabel: LIFELINE_BEFORE_NECK_SHOULDER_QUICK_TIP_SUMMARY,
    bodyHtml: lifelineBeforeNeckShoulderQuickTipBodyHtml(),
  });
}

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
  /** Initial center bind-off/hold on the back / full neckline (round-neck formula on full N). */
  centerNeckBindOffStitches: number | undefined;
  /** Round back: always shallow-round; front uses deep-round when depth allows. */
  backNeckRoundNecklineStrategy?: "deep-round" | "shallow-round";
  frontNeckRoundNecklineStrategy?: "deep-round" | "shallow-round";
  /**
   * Round cardigan left front: first CF-edge neckline bind-off (from front chart/timeline),
   * not {@link centerNeckBindOffStitches}.
   */
  cardiganFrontInitialNeckBindOffStitches?: number;
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
  /** First front neckline shaping action RC on the active-shoulder checklist (matches print table). */
  frontNecklineShapingBeginLocalRC?: number;
  /**
   * Armhole RC of the front neckline center divide/setup row exactly as rendered in the Front
   * Neckline chart (the "Scrap off center … to divide" row). Source of truth for the page 8
   * summary + page 9 instruction so the prose can never drift from the chart's divide row.
   */
  frontNecklineCenterDivideLocalRC?: number;
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
  /** Round cardigan left front: bust-width stitches at armhole (half of back bust body when A-line). */
  cardiganHalfLeftBustBodySts?: number;
  /** Stitches on the needle after armhole on that half piece (matches written left front). */
  cardiganHalfLeftStitchesAfterArmhole?: number;
  /** Left front stitches after armhole shaping (armhole math — used for neckline chart). */
  cardiganFrontPostArmholeSts?: number;
  /** Cardigan: rows along one CF edge from hem to front neckline bind-off (for front-band pickup). */
  cardiganFrontEdgeRows?: number;
  /** Cardigan: approximate pickup stitches for one front edge ({@link approximatePickupStitchesFromRows}). */
  cardiganFrontEdgePickupSts?: number;
  /** Bust-width body stitches (diagram `BUST_STS`; may differ from cast-on when A-line). */
  bustBodyStitches?: number;
  /** Hem/hip cast-on when A-line; same as {@link backStitches} for straight fit. */
  hemCastOnStitches?: number;
  /** Rows from hem/cast-on edge to hip line on schematic (`HIP_ROWS`; 0 when hip is at cast-on). */
  hipRowsFromHem?: number;
  /** A-line / shaped side-shaping row RCs (hem → armhole); drives `{{jp-body-shaping}}` notation. */
  alineBodyShapingRowNumbers?: number[];
  /** `decrease-to-bust` | `increase-to-bust` | `straight` from body block when A-line ran. */
  alineBodyShapingType?: "decrease-to-bust" | "increase-to-bust" | "straight";
  /** Body-block diagram overlay hints for A-line side guides on garment schematics. */
  diagramGuides?: SleevelessBodyDiagramGuides;
};

/** Two-column pattern UI: piece banner, section title, or instruction block with optional stitch count. */
export type SleevelessPatternDisplayRow =
  | { kind: "piece"; title: string }
  /** `title` is plain text (slug/id + plain-text lines); `titleHtml` is optional trusted heading markup (e.g. a glossary link). */
  | { kind: "section"; title: string; titleHtml?: string }
  /** Filled client-side with chart table (see pattern tab). */
  | { kind: "neckShoulderChartTableMount" }
  | {
      kind: "block";
      /** e.g. RC:014 — optional when block is prose-only */
      rc?: string;
      paragraphs: string[];
      /**
       * Trusted HTML instruction lines (e.g. glossary placeholders); rendered without escaping, in order.
       * When set, use instead of {@link paragraphs} for that block’s instruction text.
       */
      trustedParagraphs?: string[];
      /** Trusted HTML only (e.g. a Help Card built by {@link buildPatternHelpCardInnerHtml}); rendered as innerHTML in the pattern tab. */
      tipHtml?: string;
      /** When true, {@link tipHtml} is the full `.pattern-tip` inner HTML (no extra “Tip:” prefix). */
      tipHtmlIsFull?: boolean;
      /** Quick Tip / Help Card styling on the `.pattern-tip` wrapper (visual only). */
      tipPresentation?: PatternTipPresentation;
      /** Stable id for per-tip dismiss (`data-tip-id` on the rendered `.pattern-tip` wrapper). */
      tipId?: string;
      /** Extra classes on the rendered `.pattern-tip` wrapper (e.g. `no-print` / `pattern-print-personalization-never-print`). */
      tipWrapperClass?: string;
      /**
       * Required-action marker: render the {@link rowCounterResetBlockHtml} block
       * (before {@link rc} and {@link paragraphs}). Not a tip — see `rowCounterReset.ts`.
       */
      rowCounterReset?: boolean;
      /** Garment RC immediately before the reset; shown above the reset button. */
      rowCounterResetGarmentRc?: number;
      /**
       * Interactive body / A-line shaping chart rows (checkbox · RC · action). Rendered piece-aware
       * (chart id derived from the rendering piece) after this block's paragraphs.
       */
      bodyShapingChartRows?: SleevelessBodyShapingChartRow[];
      /**
       * Drop-shoulder sleeve shaping checklist (Done · RC · Action · Edge · Sts Remaining).
       * Generated from the same schedule as sleeve JP notation.
       */
      sleeveShapingChartRows?: {
        rc: number;
        action: string;
        edge: string;
        stitchesRemaining: number;
      }[];
      /** Total stitches on the piece after this block; shown in the right column when defined */
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
  /** Row-by-row neckline / shoulder chart — source of truth for printed table and shaping notation. */
  neckShoulderShapingChart: NeckShoulderShapingChart;
  /** Front neckline/shoulder chart — same stitch math and row span as back; start RC differs when front neck is deeper. */
  frontNeckShoulderShapingChart: NeckShoulderShapingChart;
  /** True when chart rows were generated from back calculations; false when demo fallback is used. */
  neckShoulderChartUsesLiveRows: boolean;
  frontNeckShoulderChartUsesLiveRows: boolean;
  /** Single source of truth for back chart + garment notation + execution shaping RCs (when live rows). */
  backNeckShoulderTimeline?: RowEntry[];
  /** Single source of truth for front chart + garment notation + execution shaping RCs (when live rows). */
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

/** Row counter heading for pattern blocks: `RC: 000` (space after colon). */
export function formatRcColon(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC: ${String(n).padStart(3, "0")}`;
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
    } else {
      if (r.rowCounterReset) {
        if (r.rowCounterResetGarmentRc !== undefined) {
          out.push(formatRowCounterResetGarmentRcLabel(r.rowCounterResetGarmentRc));
        }
        out.push(RESET_ROW_COUNTER_TEXT);
      }
      if (r.rc) out.push(r.rc);
      const plainParas =
        r.trustedParagraphs && r.trustedParagraphs.length > 0
          ? r.trustedParagraphs
          : r.paragraphs;
      for (const p of plainParas) {
        const marked = parseInlineMarkedLine(String(p));
        if (marked) {
          out.push(marked.text);
          continue;
        }
        const line =
          r.trustedParagraphs && r.trustedParagraphs.length > 0
            ? tipHtmlToPlainLine(p)
            : p;
        if (line.trim()) out.push(line);
      }
      if (r.bodyShapingChartRows && r.bodyShapingChartRows.length > 0) {
        for (const cr of r.bodyShapingChartRows) {
          out.push(`${formatRcColon(cr.rc)} ${cr.action}`);
        }
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

const PLAIN_KNIT_UNTIL_RC_RE = /^Knit in pattern until RC (\d{1,4})\.\s*$/i;

/** Preferred plain-span wording: next instruction row RC (not the last work-even RC). */
const KNIT_TO_RC_RE = /^Knit to (?:Armhole )?RC:?\s*(\d{1,4})\.\s*$/i;

/**
 * Plain-span bridge line: “Knit in pattern to [Armhole ]RC:…”. The RC heading above the block
 * already anchors the start row, so the start prefix is no longer emitted; the optional
 * `At RC:…,` group keeps legacy/persisted rows parseable.
 */
const KNIT_IN_PATTERN_TO_RC_RE =
  /^(?:At RC:?(\d{1,4}),\s*)?knit in pattern to (?:Armhole )?RC:?(\d{1,4})\.\s*$/i;

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
function formatKnitToRcTargetLine(targetRc: number, armholeLocal: boolean): string {
  const n = Math.max(0, Math.floor(targetRc));
  if (armholeLocal) {
    return `Knit to Armhole RC:${String(n).padStart(3, "0")}.`;
  }
  return `Knit to RC ${n}.`;
}

export function formatPlainKnitInPatternSpan(
  rowCount: number,
  startRc?: number,
  options?: { armholeLocal?: boolean }
): string {
  const n = Math.max(0, Math.floor(rowCount));
  if (n <= 0) return "";
  const start =
    startRc !== undefined && Number.isFinite(startRc) ? Math.max(0, Math.floor(startRc)) : undefined;
  if (start === undefined) {
    return n === 1 ? "Knit in pattern for 1 row." : `Knit in pattern for ${n} rows.`;
  }
  const nextAction = plainSpanNextActionRc(start, n);
  return formatKnitToRcTargetLine(nextAction, options?.armholeLocal === true);
}

/** Non-empty paragraph list for a plain span, or `[]` when the span has zero rows. */
function plainKnitSpanParagraphs(
  rowCount: number,
  startRc?: number,
  options?: { armholeLocal?: boolean }
): string[] {
  const line = formatPlainKnitInPatternSpan(rowCount, startRc, options).trim();
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
  const knitInPatternTo = paragraph.trim().match(KNIT_IN_PATTERN_TO_RC_RE);
  if (knitInPatternTo && blockStartRc !== undefined) {
    const startFromLine =
      knitInPatternTo[1] !== undefined ? parseInt(knitInPatternTo[1], 10) : blockStartRc;
    const targetRc = parseInt(knitInPatternTo[2], 10);
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
  let inArmholeSection = false;

  for (const row of rows) {
    if (row.kind === "section" && row.title === "ARMHOLE") {
      inArmholeSection = true;
    }
    if (row.kind !== "block") {
      out.push(row);
      continue;
    }

    if (row.trustedParagraphs && row.trustedParagraphs.length > 0) {
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
        const knitInPatternToMerged = p.trim().match(KNIT_IN_PATTERN_TO_RC_RE);
        if (knitInPatternToMerged) {
          const lastPlainRc = startRc + clamped - 1;
          const toRcLabel = inArmholeSection
            ? `Armhole RC:${String(lastPlainRc).padStart(3, "0")}`
            : `RC:${String(lastPlainRc).padStart(3, "0")}`;
          newParagraphs.push(`Knit in pattern to ${toRcLabel}.`);
          continue;
        }
        const spanLine = formatPlainKnitInPatternSpan(clamped, startRc, {
          armholeLocal: inArmholeSection,
        });
        if (spanLine.trim()) newParagraphs.push(spanLine);
        continue;
      }

      newParagraphs.push(p);
    }

    if (newParagraphs.length === 0) {
      if (row.tipHtml || row.trustedParagraphs?.length) {
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
  frontNecklineShapingBeginLocalRC: number | undefined,
  shoulderShapingBeginLocalRC: number | undefined,
  isVNeck?: boolean,
  frontNecklineCenterDivideLocalRC?: number
): SleevelessPatternDisplayRow[] {
  if (
    frontNecklineShapingBeginLocalRC === undefined ||
    shoulderShapingBeginLocalRC === undefined ||
    !Number.isFinite(frontNecklineShapingBeginLocalRC) ||
    !Number.isFinite(shoulderShapingBeginLocalRC)
  ) {
    return [...rows];
  }

  // Round-neck front begins with the center divide ("Scrap off center … to divide"); anchor the
  // milestone to the chart's divide row RC so the prose matches the chart. The first-shaping-action
  // RC remains the fallback (e.g. V-neck / charts without a center divide row).
  const milestoneNeckLocalRC =
    !isVNeck && Number.isFinite(frontNecklineCenterDivideLocalRC)
      ? (frontNecklineCenterDivideLocalRC as number)
      : frontNecklineShapingBeginLocalRC;
  const neckN = String(Math.max(0, Math.floor(milestoneNeckLocalRC))).padStart(3, "0");
  const shoulderN = String(Math.max(0, Math.floor(shoulderShapingBeginLocalRC))).padStart(3, "0");
  const milestone = isVNeck
    ? `The row counter was reset at the beginning of armhole shaping. Front neckline (V-neck) shaping begins at Armhole RC ${neckN}; shoulder shaping at Armhole RC ${shoulderN}.`
    : `Front neckline shaping begins at Armhole RC ${neckN}. Shoulder shaping begins later at Armhole RC ${shoulderN}.`;

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
  if (row.trustedParagraphs && row.trustedParagraphs.length > 0) return false;
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
  let inArmholeSection = false;
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    if (row.kind === "section") {
      if (row.title === "ARMHOLE") inArmholeSection = true;
      if (
        row.title === "BACK NECKLINE & SHOULDERS" ||
        row.title === "FRONT NECKLINE & SHOULDERS"
      ) {
        inArmholeSection = false;
      }
    }
    if (row.kind === "neckShoulderChartTableMount") {
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
      const mergedLine = formatPlainKnitInPatternSpan(total, parseRcColonLabel(firstRc), {
        armholeLocal: inArmholeSection,
      });
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

/** Center neckline bind-off stitches from chart row 0 center column (pullover / back). */
export function centerBindOffStitchesFromNeckShoulderChart(chart: NeckShoulderShapingChart | undefined): number {
  const r0 = chart?.rows?.[0];
  if (!r0) return 0;
  return parseChartCellDelta(String(r0.centerNeck ?? ""));
}

/**
 * Initial neckline bind-off for notation / intro copy.
 * Pullover/back: chart center column (or timeline center row).
 * Cardigan half front: ~⅓ of **half** neck opening — pass {@link fullNecklineStitches} (full garment N).
 */
export function initialNeckBindOffFromNeckShoulderChart(
  chart: NeckShoulderShapingChart | undefined,
  options?: { fullNecklineStitches?: number },
): number {
  if (!chart) return 0;
  const cardiganFront = isSleevelessCardiganFrontNeckShoulderChart(chart);

  if (cardiganFront) {
    const fullN = options?.fullNecklineStitches;
    if (fullN !== undefined && fullN > 0) {
      return cardiganFrontInitialNeckBindOffStitches(fullN);
    }
    return 0;
  }

  if (chart.timeline && chart.timeline.length > 0) {
    const first = [...chart.timeline].sort((a, b) => a.row - b.row)[0];
    if (first) {
      const centerBo = first.events
        .filter(
          (e) =>
            (e.kind === "bindOff" || e.kind === "hold") &&
            e.side === "center" &&
            e.edge === "center",
        )
        .reduce((s, e) => s + e.amount, 0);
      if (centerBo > 0) return centerBo;
    }
  }

  const r0 = chart.rows[0];
  if (!r0) return 0;
  return parseChartCellDelta(String(r0.centerNeck ?? ""));
}

/** Sum center hold or bind-off stitches on the first timeline row (partial or full neckline width). */
function centerBindOffAmountFirstTimelineRow(timeline: readonly RowEntry[]): number {
  const row0 = timeline[0];
  if (!row0) return 0;
  return row0.events
    .filter(
      (e) =>
        (e.kind === "bindOff" || e.kind === "hold") &&
        e.side === "center" &&
        e.edge === "center",
    )
    .reduce((s, e) => s + e.amount, 0);
}

function timelineCenterUsesHold(timeline: readonly RowEntry[]): boolean {
  const row0 = timeline[0];
  if (!row0) return false;
  return row0.events.some((e) => e.kind === "hold" && e.side === "center" && e.edge === "center");
}

function stitchCountPhrase(n: number): string {
  const k = Math.max(0, Math.floor(n));
  return k === 1 ? "1 stitch" : `${k} stitches`;
}

/**
 * Parenthetical for how the center bind-off spans the bed center — floor/ceil split on L/R needles
 * when N is odd (needle 0 is never a working needle).
 */
export function formatCenterNecklineBindOffAroundZeroPhrase(totalCenterBindOff: number): string {
  const N = Math.max(0, Math.floor(totalCenterBindOff));
  if (N <= 0) return "";
  if (N === 1) return "1 stitch on R1";
  const onLeft = Math.floor(N / 2);
  const onRight = N - onLeft;
  if (onLeft === onRight) {
    const word = onLeft === 1 ? "stitch" : "stitches";
    return `${onLeft} ${word} on L needles and ${onRight} on R needles`;
  }
  const leftWord = onLeft === 1 ? "stitch" : "stitches";
  const rightWord = onRight === 1 ? "stitch" : "stitches";
  return `${onLeft} ${leftWord} on L needles and ${onRight} ${rightWord} on R needles`;
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

/** RC-targeted shallow back hold divide — three-stage workflow (stage 1 setup at neckline row). */
export function formatShallowBackHoldCenterDivideExecution(args: {
  totalCenterHold: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  const N = Math.max(0, Math.floor(args.totalCenterHold));
  const L = Math.max(0, Math.floor(args.stitchesLeftAfter));
  const R = Math.max(0, Math.floor(args.stitchesRightAfter));
  const centerWord = N === 1 ? "stitch" : "stitches";
  const parts = [
    `Place the center ${N} ${centerWord} in hold.`,
    "Place the opposite (left) shoulder stitches in hold.",
    "Place the opposite (left) neckline stitches in hold.",
    `Work the right shoulder (${stitchCountPhrase(R)}) and right neck edge; left shoulder (${stitchCountPhrase(L)}) remains parked.`,
  ];
  return parts.join(" ");
}

/** Preamble-style shallow back hold divide (knit to center before RC-targeted line). */
export function formatShallowBackHoldCenterDividePreamble(args: {
  totalCenterHold: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  return `Knit to center. ${formatShallowBackHoldCenterDivideExecution(args)}`;
}

/** RC-targeted shaping sentence for shallow hold center divide. */
export function formatCenterNecklineHoldShapingExecution(args: {
  totalCenterHold: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  return formatShallowBackHoldCenterDivideExecution(args);
}

/** Preamble-style execution for shallow hold center divide. */
export function formatCenterNecklineHoldPreambleExecution(args: {
  totalCenterHold: number;
  stitchesLeftAfter: number;
  stitchesRightAfter: number;
}): string {
  return formatShallowBackHoldCenterDividePreamble(args);
}

function centerBindOffExecutionTextFromChartRow(
  timeline: readonly RowEntry[],
  chartRow0: NeckShoulderShapingChartRow | undefined
): CenterBindOffExecutionText | undefined {
  if (!timeline.length || !chartRow0) return undefined;
  const nCenter = centerBindOffAmountFirstTimelineRow(timeline);
  if (nCenter <= 0) return undefined;
  const useHold = timelineCenterUsesHold(timeline);
  const args = {
    totalCenterBindOff: nCenter,
    stitchesLeftAfter: chartRow0.leftStitchCount,
    stitchesRightAfter: chartRow0.rightStitchCount,
  };
  if (useHold) {
    return {
      preambleLine: formatCenterNecklineHoldPreambleExecution({
        totalCenterHold: nCenter,
        stitchesLeftAfter: chartRow0.leftStitchCount,
        stitchesRightAfter: chartRow0.rightStitchCount,
      }),
      shapingAtRcLine: formatCenterNecklineHoldShapingExecution({
        totalCenterHold: nCenter,
        stitchesLeftAfter: chartRow0.leftStitchCount,
        stitchesRightAfter: chartRow0.rightStitchCount,
      }),
    };
  }
  return {
    preambleLine: formatCenterNecklineBindOffPreambleExecution(args),
    shapingAtRcLine: formatCenterNecklineBindOffShapingExecution(args),
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
  /** Piece neck opening (half opening on cardigan left front). */
  necklineStitches?: number;
  /** Full garment neck opening N — used for cardigan CF initial bind-off in summary validation. */
  fullNecklineStitches?: number;
  shoulderStitches?: number;
  /** Shoulder-line stitch count B at the neckline row — enables needle-range setup prose. */
  stitchesAfterArmhole?: number;
  /** Shallow back round-neck plan — when set, emits hold setup overview (checklist handles shaping). */
  backRoundNeckPlan?: RoundNecklinePlanResult | null;
  /** Garment RC where back neckline shaping begins (with {@link firstArmholeRC} for Armhole RC label). */
  backNecklineStartRC?: number;
  firstArmholeRC?: number | null;
  /** When false, omit the lifeline reminder (cardigan half fronts). Defaults to true. */
  includeLifelineReminder?: boolean;
}): string[] | null {
  let leftS: number | undefined;
  let rightS: number | undefined;

  const nFit = args.necklineStitches;
  const totalNeck = args.fullNecklineStitches ?? nFit;
  const sFit = args.shoulderStitches;
  if (sFit !== undefined && sFit > 0) {
    leftS = sFit;
    rightS = sFit;
  }

  let bindOffCenter =
    nFit !== undefined && nFit > 0 ? initialBackCenterNeckStitches(nFit) : undefined;

  if (args.neckChartRows.length > 0) {
    const r0 = args.neckChartRows[0];
    const dcCenter = parseChartCellDelta(r0.centerNeck);
    const dcCfEdge = parseChartCellDelta(r0.rightNeck);
    const cardiganCfRow = dcCenter <= 0 && dcCfEdge > 0 && r0.leftStitchCount === 0;
    if (dcCenter > 0) bindOffCenter = dcCenter;
    else if (cardiganCfRow && nFit !== undefined && nFit > 0 && totalNeck !== undefined && totalNeck > 0) {
      bindOffCenter = cardiganFrontInitialNeckBindOffStitches(totalNeck);
    } else if (dcCfEdge > 0) bindOffCenter = dcCfEdge;
    if (leftS === undefined || leftS <= 0) leftS = r0.leftStitchCount;
    if (rightS === undefined || rightS <= 0) rightS = r0.rightStitchCount;
  }

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

  const necklineStartRcLabel =
    args.backNecklineStartRC !== undefined &&
    args.firstArmholeRC !== null &&
    args.firstArmholeRC !== undefined
      ? formatArmholeLocalRc(args.backNecklineStartRC, args.firstArmholeRC)
      : undefined;

  const includeLifeline = args.includeLifelineReminder !== false;
  let lines: string[];
  if (args.backRoundNeckPlan?.strategy === "shallow-round") {
    lines = roundNeckBackShallowSleevelessSummaryWrittenLines(args.backRoundNeckPlan, {
      bodyWidthStitches: args.stitchesAfterArmhole ?? 0,
      necklineStartRcLabel,
    });
  } else {
    lines = ["Use the checklist below for row-by-row neckline and shoulder shaping."];
  }
  return insertLifelineReminderAfterOpening(lines, includeLifeline);
}

/** Routes needle-range HTML lines to {@link trustedParagraphs} for trusted rendering. */
function backNeckSummaryInstructionFields(summary: string[]): {
  paragraphs?: string[];
  trustedParagraphs?: string[];
} {
  if (
    summary.some((line) => line.includes('class="needle-range"')) ||
    summary.some((line) => line.includes("data-glossary-id"))
  ) {
    return { trustedParagraphs: summary };
  }
  return { paragraphs: summary };
}

/**
 * RC heading for the back-neck summary block. Shallow-round summaries previously repeated the
 * neckline start RC inline (“At RC:049, begin …”); the value now lives once, as the block heading.
 */
function backNeckSummaryRcHeading(
  backRoundNeckPlan: RoundNecklinePlanResult | null | undefined,
  backNecklineStartRC: number | undefined,
  firstArmholeRC: number | null | undefined,
): string | undefined {
  if (backRoundNeckPlan?.strategy !== "shallow-round") return undefined;
  if (
    backNecklineStartRC === undefined ||
    firstArmholeRC === null ||
    firstArmholeRC === undefined
  ) {
    return undefined;
  }
  return formatArmholeLocalRc(backNecklineStartRC, firstArmholeRC);
}

export function buildSleevelessBackDisplayRows(args: {
  castOnSts: number;
  /** Stitches on the needle at the armhole (bust width when A-line); defaults to {@link castOnSts}. */
  armholeStartSts?: number;
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
  /** Shallow back round-neck plan for three-stage execution prose in the neckline summary. */
  backRoundNeckPlan?: RoundNecklinePlanResult | null;
  /**
   * Full-width back uses symmetric armhole bind-offs; round cardigan **left** half uses one outer
   * armhole edge only (same bind-off / decrease counts as one side of the back plan).
   */
  armholeInstructionStyle?: "symmetricTwoEdges" | "cardiganHalfLeftFront";
  /** Cast-on sentence only, e.g. `"the back"` or `"the left front"`. */
  castOnForPieceLabel?: string;
  /** When set, body section uses hem→bust side decreases instead of plain knitting. */
  alineBodyShaping?: SleevelessAlineBodyShapingPlan | null;
  /** Cardigan left front: one armhole edge only; back/pullover use both side edges. */
  alineShapingEdgeScope?: SleevelessAlineShapingEdgeScope;
}): SleevelessPatternDisplayRow[] {
  const rows: SleevelessPatternDisplayRow[] = [];
  rows.push({ kind: "piece", title: "BACK" });
  rows.push(pieceMarkersSeamingTipDisplayRow("back"));
  let carriedAfterArmholeSts =
    args.stitchesAfterArmhole !== undefined && args.stitchesAfterArmhole > 0
      ? args.stitchesAfterArmhole
      : undefined;

  const A = args.castOnSts;
  const armholeA = args.armholeStartSts ?? args.castOnSts;
  const armholeStyle = args.armholeInstructionStyle ?? "symmetricTwoEdges";
  const castOnLabel = args.castOnForPieceLabel ?? "the back";
  const ribs = args.hemRows;
  const hemRcLabel = formatRcColon(0);

  const aline = args.alineBodyShaping ?? null;
  const alineEdgeScope = args.alineShapingEdgeScope ?? "symmetricSides";
  rows.push({
    kind: "block",
    rc: hemRcLabel,
    paragraphs:
      A > 0
        ? [
            aline
              ? `Cast on ${A} stitches for ${castOnLabel} (hem/hip width for gentle A-line shaping).`
              : `Cast on ${A} stitches for ${castOnLabel}.`,
          ]
        : [
            "Cast-on stitch count could not be calculated from your measurements. Add finished bust or chest and stitch gauge in the builder, then open this tab again.",
          ],
    ...(A > 0
      ? {
          tipHtml: castOnMethodQuickTipInnerHtml(),
          tipHtmlIsFull: true,
          tipPresentation: "quick-tip",
          tipId: "sleeveless-cast-on-back",
        }
      : {}),
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push(hemSectionRow());
  rows.push({
    kind: "block",
    rc: hemRcLabel,
    paragraphs: args.hemRowsValid
      ? plainKnitSpanParagraphs(ribs, 0)
      : [
          "Hem rows could not be calculated — check row gauge and sizing chart. Knit your hem to the depth you prefer, then continue.",
        ],
    stitchCount: A > 0 ? A : undefined,
  });

  rows.push({ kind: "section", title: "BODY" });
  if (aline && args.bodyRowsValid && args.bodyToArmholeRows > 0) {
    const bodyRows = args.bodyToArmholeRows;
    const bodyStartRc = ribs;
    const armholeEndRc = ribs + bodyRows;
    if (aline.shapingType === "straight") {
      rows.push({
        kind: "block",
        rc: formatRcColon(bodyStartRc),
        paragraphs: plainKnitSpanParagraphs(bodyRows, bodyStartRc),
        stitchCount: aline.bustBodySts > 0 ? aline.bustBodySts : A > 0 ? A : undefined,
      });
    } else {
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
      // Heading + summary sit ABOVE the chart; the per-row counters that were the
      // "Work decreases on: RC:…" sentence are now the interactive chart rows below.
      const beforeChartLines = ["Begin A-line shaping.", summaryLine].filter(
        (p) => p.length > 0,
      );
      const useTrusted = beforeChartLines.some(sleevelessAlineShapingLineNeedsTrustedHtml);
      // Plain-text mirror of the shaping instruction (no glossary HTML). Carries the side/armhole
      // edge scope so cardigan fronts read "at the armhole edge". Renderers prefer
      // trustedParagraphs, so this stays hidden in the normal (glossary) path — present only as
      // machine-readable structured text alongside the rendered glossary summary.
      const plainEdgePhrase =
        alineEdgeScope === "armholeEdgeOnly" ? "at the armhole edge" : "at each side edge";
      const plainShapingVerb =
        aline.shapingType === "decrease-to-bust" ? "Decrease" : "Increase";
      const plainShapingTimes = aline.shapingRowNumbers.length;
      const plainShapingLine = `${plainShapingVerb} 1 stitch ${plainEdgePhrase} ${plainShapingTimes} time${plainShapingTimes === 1 ? "" : "s"}.`;
      rows.push({
        kind: "block",
        rc: formatRcColon(aline.shapingBeginRc),
        ...(useTrusted
          ? { trustedParagraphs: beforeChartLines, paragraphs: [plainShapingLine] }
          : { paragraphs: beforeChartLines }),
        ...(chartRows.length > 0 ? { bodyShapingChartRows: chartRows } : {}),
        stitchCount: A > 0 ? A : undefined,
      });
      // "N sts remain after shaping." stays AFTER the chart (decrease / waist-shaped only).
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
      rows.push({
        kind: "block",
        rc: formatRcColon(aline.armholeBeginRc),
        paragraphs: ["Begin armhole shaping."],
        stitchCount: bustSts,
      });
    }
  } else {
    rows.push({
      kind: "block",
      rc: formatRcColon(ribs),
      paragraphs: args.bodyRowsValid
        ? plainKnitSpanParagraphs(args.bodyToArmholeRows, ribs)
        : [
            "Body length to the armhole could not be calculated. Confirm back neck to hem, armhole depth, and row gauge in Fit, then try again.",
          ],
      stitchCount: A > 0 ? A : undefined,
    });
  }

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
    armholeA > 0 &&
    args.stitchesAfterArmhole !== undefined &&
    args.stitchesAfterArmhole > 0 &&
    args.stitchesAfterArmhole < armholeA
  ) {
    const m = args.armholeMath;
    const first = args.firstArmholeRC;
    const bo = m.bindOffSts;
    const afterBo1 = armholeA - bo;
    const afterBo2 = armholeA - 2 * bo;
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
      rowCounterReset: true,
      rowCounterResetGarmentRc: first,
      paragraphs: [
        `Bind off OR hold ${bo} stitches at the armhole edge (carriage side). Knit across.`,
      ],
      tipHtml: armholeAlternateTechniquesHelpCardInnerHtml(),
      tipHtmlIsFull: true,
      tipPresentation: "help-card",
      tipId: "sleeveless-armhole-alternate",
      stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
    });
    if (armholeStyle === "symmetricTwoEdges") {
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(first + 1, first),
        paragraphs: [
          `Bind off OR hold ${bo} stitches at the remaining armhole edge (carriage side). Knit across.`,
        ],
        stitchCount: afterBo2 > 0 ? afterBo2 : undefined,
      });
    } else {
      rows.push({
        kind: "block",
        rc: formatArmholeLocalRc(first + 1, first),
        paragraphs: [
          "Knit across — center front edge (no bind-off; opening is worked as a separate piece or band later).",
        ],
        stitchCount: afterBo1 > 0 ? afterBo1 : undefined,
      });
    }

    if (m.decreaseSts > 0) {
      const decreaseRowsChecklist = shapingActionRowNumbers(
        Math.max(0, decStart - first),
        m.decreaseSts,
        2,
      ).join(" - ");
      const decreaseSentence =
        armholeStyle === "cardiganHalfLeftFront"
          ? `Decrease 1 stitch at the armhole edge every other row, ${m.decreaseSts} times — ${decreasesTotalCardigan} stitch${decreasesTotalCardigan === 1 ? "" : "es"} removed total.`
          : `Decrease 1 stitch at each armhole edge every other row, ${m.decreaseSts} times — ${decreasesTotalSymmetric} stitches removed total.`;
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
            ? `Knit in pattern to Armhole RC:${String(localNext).padStart(3, "0")}.`
            : `Knit in pattern. ${B} sts remain.`,
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
            paragraphs: [formatKnitToRcTargetLine(localNext, true)],
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
          ? [
              formatKnitToRcTargetLine(
                parseInt(formatArmholeLocalRcNumber(bridgeTargetGarmentRc, args.firstArmholeRC), 10),
                true
              ),
            ]
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
            ? [
                formatKnitToRcTargetLine(
                  parseInt(formatArmholeLocalRcNumber(upperTargetGarmentRc, args.firstArmholeRC), 10),
                  true
                ),
              ]
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
            ? [
                formatKnitToRcTargetLine(
                  parseInt(formatArmholeLocalRcNumber(padTargetGarmentRc, args.firstArmholeRC), 10),
                  true
                ),
              ]
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

  // The standalone "Lifeline before neckline shaping" quick-tip panel was removed; the lifeline
  // reminder is normal neckline-section instruction copy (see insertLifelineReminderAfterOpening).

  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    rows.push({ kind: "section", title: "BACK NECKLINE & SHOULDERS" });
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      shoulderStitches: args.shoulderStitches,
      stitchesAfterArmhole: args.stitchesAfterArmhole,
      backRoundNeckPlan: args.backRoundNeckPlan,
      backNecklineStartRC: args.backNecklineStartRC,
      firstArmholeRC: args.firstArmholeRC,
    });
    if (summary) {
      rows.push({
        kind: "block",
        rc: backNeckSummaryRcHeading(
          args.backRoundNeckPlan,
          args.backNecklineStartRC,
          args.firstArmholeRC,
        ),
        ...backNeckSummaryInstructionFields(summary),
        tipHtml: necklineShoulderOrientationHelpCardInnerHtml(),
        tipHtmlIsFull: true,
        tipPresentation: "help-card",
        tipId: "sleeveless-neckline-orientation",
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
      stitchesAfterArmhole: args.stitchesAfterArmhole,
      backRoundNeckPlan: args.backRoundNeckPlan,
      backNecklineStartRC: args.backNecklineStartRC,
      firstArmholeRC: args.firstArmholeRC,
    });
    rows.push({
      kind: "block",
      ...(summary
        ? {
            rc: backNeckSummaryRcHeading(
              args.backRoundNeckPlan,
              args.backNecklineStartRC,
              args.firstArmholeRC,
            ),
            ...backNeckSummaryInstructionFields(summary),
          }
        : {
            paragraphs: [
              "Neckline summary could not be generated. Confirm neck opening and shoulder width in Fit, then open this tab again.",
            ],
          }),
      ...(summary
        ? {
            tipHtml: necklineShoulderOrientationHelpCardInnerHtml(),
            tipHtmlIsFull: true,
            tipPresentation: "help-card" as const,
            tipId: "sleeveless-neckline-orientation",
          }
        : {}),
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

  return rows;
}

export function buildSleevelessFrontDisplayRows(args: {
  frontNecklineStartRC: number;
  /** Armhole RC where front neckline shaping begins (post armhole reset). */
  frontNecklineStartLocalRC?: number;
  /** Armhole RC of the first generated front neckline shaping action (active-shoulder checklist). */
  frontNecklineShapingBeginLocalRC?: number;
  /** Armhole RC of the Front Neckline chart's center divide/setup row ("Scrap off center … to divide"). */
  frontNecklineCenterDivideLocalRC?: number;
  /** Armhole RC where shoulder shaping begins (same vertical line as back neckline / shoulders). */
  shoulderShapingBeginLocalRC?: number;
  sharedExecutionRows: readonly SleevelessPatternDisplayRow[];
  useNeckChartRows: boolean;
  neckChartRows: readonly NeckShoulderShapingChartRow[];
  necklineStitches?: number;
  /** Full garment neck opening N (cardigan front summary / bind-off uses half of center BO). */
  fullNecklineStitches?: number;
  shoulderStitches?: number;
  /** Piece banner (default `FRONT`; round cardigan uses `LEFT FRONT`). */
  pieceTitle?: string;
  /** When true, intro explains half-body cast-on vs full pullover front. */
  introIsCardiganHalf?: boolean;
  /** Garment RC where armhole shaping begins — required to clamp post-armhole rows without touching BODY. */
  garmentArmholeStartRC?: number;
  /** When true, armhole checkpoint copy names V-neck and the armhole reset explicitly. */
  isVNeck?: boolean;
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
    if (row.kind === "neckShoulderChartTableMount") {
      continue;
    }
    if (row.kind === "section") {
      sharedRows.push(row);
      continue;
    }
    if (row.kind !== "block") {
      sharedRows.push(row);
      continue;
    }
    if (row.tipId?.startsWith("sleeveless-piece-markers-")) {
      continue;
    }
    sharedRows.push({
      ...row,
      paragraphs: row.paragraphs.map((p) =>
        p.replace(/\bfor the back\b/gi, (m) => (m[0] === "f" ? "for the front" : "For the front"))
      ),
      ...(row.tipId === "sleeveless-cast-on-back" ? { tipId: "sleeveless-cast-on-front" } : {}),
    });
  }

  const sharedRowsClamped = clampFrontSharedRowsBeforeNeckStart(
    sharedRows,
    args.frontNecklineStartLocalRC,
    args.garmentArmholeStartRC,
  );
  const sharedRowsFrontMilestones = replaceFrontArmholeCheckpointParagraphs(
    sharedRowsClamped,
    args.frontNecklineShapingBeginLocalRC,
    args.shoulderShapingBeginLocalRC,
    args.isVNeck,
    args.frontNecklineCenterDivideLocalRC
  );

  const rows: SleevelessPatternDisplayRow[] = [];
  const pieceTitle = args.pieceTitle ?? "FRONT";
  rows.push({ kind: "piece", title: pieceTitle });
  rows.push(pieceMarkersSeamingTipDisplayRow("front"));
  // Cardigan half-front keeps its setup note (half body width, cast-on/armhole counts are for the
  // left front only, shaping worked on the armhole edge) — that context is not conveyed elsewhere.
  // The full-width (pullover) front has no introductory paragraph: the headings, row-counter labels,
  // and shaping checklist already provide the needed context, so instructions begin directly.
  if (args.introIsCardiganHalf) {
    rows.push({
      kind: "block",
      paragraphs: [
        "This piece is half the body width (one center-front edge). Cast-on and armhole counts below are for the left front only. Work the front from the top — the cast-on, body, body shaping, and armhole steps are written out in full below, then continue into the front neckline shaping. Body/side shaping on the front is worked only on the armhole edge.",
        "After the armhole reset, use Armhole RC — not the body row counter.",
      ],
    });
  }
  rows.push(...sharedRowsFrontMilestones);

  rows.push({ kind: "section", title: "FRONT NECKLINE & SHOULDERS" });
  if (args.useNeckChartRows && args.neckChartRows.length > 0) {
    const summary = backNecklineShoulderSummaryParagraphs({
      neckChartRows: args.neckChartRows,
      necklineStitches: args.necklineStitches,
      fullNecklineStitches: args.fullNecklineStitches,
      shoulderStitches: args.shoulderStitches,
      includeLifelineReminder: !args.introIsCardiganHalf,
    });
    if (summary) {
      rows.push({
        kind: "block",
        ...backNeckSummaryInstructionFields(summary),
        tipHtml: necklineShoulderOrientationHelpCardInnerHtml(),
        tipHtmlIsFull: true,
        tipPresentation: "help-card",
        tipId: "sleeveless-neckline-orientation",
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
  const isCardigan = isSleevelessCardiganGarmentStyle(patternData);
  /** Half-panel cast-on / body / armhole written rows — all cardigan fronts (round and V-neck). */
  const isCardiganHalfFrontBody = isCardigan;
  /** Half-panel neck/shoulder chart math — round cardigan only (V-neck cardigan uses full-width V timeline). */
  const isCardiganRoundHalfFront = isCardigan && !isSleevelessVNeckChoice(patternData);
  const isFrontVNeck = isSleevelessVNeckChoice(patternData);
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

  const bustBodySts =
    (() => {
      const baseCastOn =
        backStitchesFromPattern(bustChestStitchesForCastOn) ||
        (finishedBust > 0 && stitchesPerInch > 0
          ? Math.round((finishedBust * stitchesPerInch) / 2)
          : 0);
      return baseCastOn > 0 && baseCastOn % 2 !== 0 ? baseCastOn + 1 : baseCastOn;
    })();

  let castOnSts = bustBodySts;

  const hemDepthIn = resolveEffectiveHemDepthInches(patternData, audience);
  const hemRows = calculateHemRowsFromInches(rowsPerInch, hemDepthIn);
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
    bustBodySts > 0 && stitchesAfterArmhole !== undefined
      ? bustBodySts - stitchesAfterArmhole
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
    bustBodySts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole < bustBodySts &&
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
  } else if (bustBodySts > 0 && stitchesAfterArmhole !== undefined && stitchesAfterArmhole >= bustBodySts) {
    warnings.push("stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder vs bust.");
  }

  let sideNeckShapingStitchesPerSide = 0;
  let sideNeckShapingStitchesPerSideFrontPiece = 0;
  if (necklineStitches !== undefined && necklineStitches > 0) {
    sideNeckShapingStitchesPerSide = backNeckEdgeDecreasesPerSide(necklineStitches);
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

  /* --- Body block: hem/hip cast-on → bust at armhole (pullover); infers A-line from hip vs bust when bodyShape is not explicit straight --- */
  let alineBodyShaping: SleevelessAlineBodyShapingPlan | null = null;
  let bodyDiagramGuides: SleevelessBodyDiagramGuides = {
    showBodyShapeGuides: false,
    bodyShapeKind: "straight",
    shapingDirection: "none",
    hemStitches: bustBodySts,
    bustStitches: bustBodySts,
    hemCircumferenceInches: finishedBust > 0 ? finishedBust : 0,
    bustCircumferenceInches: finishedBust > 0 ? finishedBust : 0,
  };
  const finishedHipResolved = resolveDiagramFinishedHipInches(patternData, finishedBust);
  const shouldRunBodyBlock = shouldRunSleevelessBodyBlockForPullover(finishedBust);
  const hipForBodyBlock = shouldRunBodyBlock
    ? resolveBodyBlockHipCircumferenceInches(patternData, finishedBust, finishedHipResolved)
    : undefined;
  if (shouldRunBodyBlock) {
    const bodyBlockPlan = buildSleevelessBodyBlockPlan({
      garmentStyle: "pullover",
      pieceRole: "back",
      bustCircumferenceInches: finishedBust,
      hipCircumferenceInches: hipForBodyBlock!,
      stitchesPerInch,
      rowsPerInch,
      rowsToArmhole: bodyToArmholeRows,
      hemRows,
      mode: "auto",
      precomputedBustStitches: bustBodySts,
    });
    bodyDiagramGuides = bodyBlockPlan.diagramGuides;
    if (bustBodySts > 0) {
      castOnSts =
        bodyBlockPlan.shapingDirection === "none"
          ? bustBodySts
          : bodyBlockPlan.hemStitches > 0
            ? bodyBlockPlan.hemStitches
            : bustBodySts;
      warnings.push(...bodyBlockPlan.warnings);
      if (bodyBlockPlan.shapingDirection !== "none" && !bodyBlockPlan.unsupportedForRelease) {
        alineBodyShaping = bodyBlockPlanToAlineShapingPlan(
          bodyBlockPlan,
          bodyToArmholeRows,
          hemRows,
        );
      }
    }
    bodyDiagramGuides = diagramGuidesForAppliedBodyShaping(
      bodyDiagramGuides,
      alineBodyShaping !== null,
      resolveEffectiveSleevelessBodyShapeKind(patternData, finishedBust, finishedHipResolved) !==
        "straight",
    );
  }
  /* --- end body block --- */

  const cardiganLeftHalfWidths =
    isCardiganHalfFrontBody &&
    castOnSts > 0 &&
    bustBodySts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole > 0
      ? resolveCardiganHalfFrontWidths(
          {
            hemCastOnSts: castOnSts,
            bustBodySts,
            stitchesAfterArmhole,
          },
          "left",
        )
      : null;
  const cardiganHalfLeftCastOnSts = cardiganLeftHalfWidths?.hemCastOnSts;
  const cardiganHalfLeftBustBodySts = cardiganLeftHalfWidths?.bustBodySts;
  const cardiganHalfLeftStitchesAfterArmhole = cardiganLeftHalfWidths?.stitchesAfterArmhole;

  if (
    isCardiganHalfFrontBody &&
    cardiganHalfLeftCastOnSts !== undefined &&
    cardiganHalfLeftStitchesAfterArmhole !== undefined &&
    cardiganHalfLeftCastOnSts <= cardiganHalfLeftStitchesAfterArmhole
  ) {
    warnings.push(
      "Cardigan left front: cast-on must be greater than stitches after armhole — check bust vs shoulder width and gauge."
    );
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

  const stitchesAtArmholeStart = alineBodyShaping ? bustBodySts : castOnSts;

  if (
    stitchesAtArmholeStart > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole > 0 &&
    stitchesAfterArmhole < stitchesAtArmholeStart &&
    armholeDepthRows > 0
  ) {
    try {
      armholeMathResult = calculateArmholeShaping({
        startingStitches: stitchesAtArmholeStart,
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
    } else if (stitchesAfterArmhole >= stitchesAtArmholeStart) {
      warnings.push(
        "stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder width vs bust."
      );
    }
    if (!armholeDepthRows) {
      warnings.push("Armhole depth rows could not be computed.");
    }
  }

  /**
   * Stitches on the left front after one-edge armhole shaping — uses the same per-edge bind-off /
   * decrease counts as the back plan (not a second `calculateArmholeShaping` on half width, which
   * would halve those counts and disagree with the diagram / jp-armhole-bo).
   */
  let cardiganFrontPostArmholeSts: number | undefined;
  if (
    isCardiganHalfFrontBody &&
    cardiganHalfLeftBustBodySts !== undefined &&
    armholeMathResult !== null
  ) {
    cardiganFrontPostArmholeSts = Math.max(
      0,
      cardiganHalfLeftBustBodySts -
        armholeMathResult.bindOffSts -
        armholeMathResult.decreaseSts,
    );
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
      ? normalizeRoundNecklineDepthRows(Math.max(1, Math.round(frontNeckDepthIn * rowGauge)))
      : 0;
  /** Back neckline vertical depth in rows (single budget for unified neck + shoulder timeline). */
  const backNeckDepthRows =
    rowGauge > 0
      ? normalizeRoundNecklineDepthRows(Math.max(1, Math.round((backNeckDepthIn ?? 2.5) * rowGauge)))
      : 0;
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
      ? Math.max(0, armholeStartRC + armholeDepthRows - effectiveFrontNeckDepthRows - 1)
      : shoulderEndRC !== undefined && effectiveFrontNeckDepthRows > 0
        ? Math.max(0, shoulderEndRC - effectiveFrontNeckDepthRows - 1)
        : Math.max(0, rc - Math.max(0, frontNeckDepthRows) + 1);
  /**
   * Front scoop begins one armhole-local row earlier than the naive `shoulderEndRC − F` anchor
   * so the live timeline / text chart align with `rc-neckline-start` on the JP schematic
   * (e.g. rc014). Extend depth so the piece still ends at the same shoulder line.
   */
  const frontNeckTimelineDepthRows = normalizeRoundNecklineDepthRows(
    shoulderEndRC !== undefined
      ? Math.max(effectiveFrontNeckDepthRows, shoulderEndRC - frontNecklineStartRC)
      : effectiveFrontNeckDepthRows,
  );
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

  let backRoundNeckPlan:
    | ReturnType<typeof calculateBackRoundNecklinePlan>
    | null = null;
  let frontRoundNeckPlan:
    | ReturnType<typeof calculateRoundNecklinePlan>
    | null = null;

  /** Timeline drives chart + row-accurate execution (front RC-shift only). */
  if (
    castOnSts > 0 &&
    necklineStitches !== undefined &&
    shoulderStitches !== undefined &&
    necklineStitches > 0 &&
    shoulderStitches > 0
  ) {
    const shoulderSts = shoulderStitches;
    const initialCenterSts = initialBackCenterNeckStitches(necklineStitches);
    const necklineOpeningStsForFrontPiece = isCardiganRoundHalfFront
      ? Math.max(1, Math.round(necklineStitches / 2))
      : necklineStitches;
    const initialCenterStsFrontPiece = initialCenterNeckStitches(necklineOpeningStsForFrontPiece);
    const stitchesAfterArmholeForFrontPiece =
      isCardiganRoundHalfFront
        ? (cardiganFrontPostArmholeSts ??
          cardiganHalfLeftStitchesAfterArmhole ??
          stitchesAfterArmhole!)
        : stitchesAfterArmhole!;

    const shoulderStsForFrontPiece = isCardiganRoundHalfFront
      ? Math.max(1, stitchesAfterArmholeForFrontPiece - necklineOpeningStsForFrontPiece)
      : shoulderSts;

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

    const frontNeckProfile: NeckShoulderShapingPatternNumbers["neckProfile"] =
      isCardiganRoundHalfFront
        ? "cardiganHalfFront"
        : frontNeckDepthRows > 0
          ? "front"
          : "back";

    const frontPatternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: frontNecklineStartRC,
      shoulderStitchesPerSide: shoulderStsForFrontPiece,
      centerNeckBindOff: necklineOpeningStsForFrontPiece,
      ...(isCardiganRoundHalfFront
        ? {
            cardiganCfInitialBindOff: cardiganFrontInitialNeckBindOffStitches(
              necklineStitches,
              effectiveFrontNeckDepthRows,
            ),
          }
        : {}),
      neckDepthRows:
        frontNeckDepthRows > 0 ? frontNeckTimelineDepthRows : backNeckDepthRows,
      neckProfile: frontNeckProfile,
      stitchesAfterArmhole: stitchesAfterArmholeForFrontPiece,
      shoulderBindoffRows,
    };

    backRoundNeckPlan = calculateBackRoundNecklinePlan({
      necklineStitches: necklineStitches,
      necklineDepthRows: backNeckDepthRows,
    });
    if (backRoundNeckPlan.warnings.length > 0) {
      warnings.push(...backRoundNeckPlan.warnings);
    }

    frontRoundNeckPlan =
      !isFrontVNeck && necklineStitches > 0 && effectiveFrontNeckDepthRows > 0
        ? calculateRoundNecklinePlan({
            necklineStitches,
            necklineDepthRows: effectiveFrontNeckDepthRows,
          })
        : null;
    if (frontRoundNeckPlan && frontRoundNeckPlan.warnings.length > 0) {
      warnings.push(...frontRoundNeckPlan.warnings);
    }

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

    /**
     * Provisional back pass (no minFinal) seeds minFinal for the front pass; the front's final
     * per-side remainder is authoritative when rebuilding the aligned back timeline.
     */
    const provisionalBack = buildNeckShoulderTimelineAndChartRows(patternNumbers, {
      ...shoulderTimelineOpts,
    });
    const provisionalMinFinalPerSide = Math.max(
      0,
      Math.min(
        Math.floor(
          Number(
            provisionalBack.chartRows[provisionalBack.chartRows.length - 1]?.leftStitchCount ?? 0,
          ),
        ),
        Math.floor(
          Number(
            provisionalBack.chartRows[provisionalBack.chartRows.length - 1]?.rightStitchCount ?? 0,
          ),
        ),
      ),
    );
    const provisionalMinFinalOpts =
      provisionalMinFinalPerSide > 0
        ? { minFinalStitchesPerSide: provisionalMinFinalPerSide }
        : {};

    /** Full-width closed front reference for back shoulder alignment (cardigan half-front uses pullover-equivalent math). */
    const fullWidthFrontPatternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: frontNecklineStartRC,
      shoulderStitchesPerSide: shoulderStitches,
      centerNeckBindOff: necklineStitches!,
      neckDepthRows:
        frontNeckDepthRows > 0 ? frontNeckTimelineDepthRows : backNeckDepthRows,
      neckProfile: "front",
      stitchesAfterArmhole: stitchesAfterArmhole!,
      shoulderBindoffRows,
    };
    const fullWidthFrontShoulderReference =
      isCardiganRoundHalfFront && !isFrontVNeck
        ? buildNeckShoulderTimelineAndChartRows(fullWidthFrontPatternNumbers, {
            ...shoulderTimelineOpts,
            ...provisionalMinFinalOpts,
          })
        : null;

    let frontTimeline: RowEntry[] = [];
    let frontLiveRows: NeckShoulderShapingChartRow[] = [];

    /** Front first — long neck depth is the authoritative shoulder execution context. */
    const builtFront = isFrontVNeck
      ? (() => {
          const vFront = buildVNeckFrontFullWidthTimeline(frontPatternNumbers, {
            ...shoulderTimelineOpts,
            ...(isCardiganRoundHalfFront ? {} : provisionalMinFinalOpts),
          });
          warnings.push(...vFront.vNeckPlanWarnings);
          return {
            timeline: vFront.timeline,
            chartRows: neckShoulderChartRowsFromTimeline(vFront.timeline),
          };
        })()
      : buildNeckShoulderTimelineAndChartRows(frontPatternNumbers, {
          ...shoulderTimelineOpts,
          ...(isCardiganRoundHalfFront ? {} : provisionalMinFinalOpts),
        });
    frontTimeline = builtFront.timeline;
    frontLiveRows = builtFront.chartRows;

    const shoulderReferenceFrontTimeline =
      fullWidthFrontShoulderReference?.timeline ?? frontTimeline;
    const shoulderReferenceFrontRows =
      fullWidthFrontShoulderReference?.chartRows ?? frontLiveRows;

    const shoulderMinFinalPerSide = isCardiganRoundHalfFront
      ? 0
      : Math.max(
          0,
          Math.min(
            Math.floor(Number(frontLiveRows[frontLiveRows.length - 1]?.leftStitchCount ?? 0)),
            Math.floor(Number(frontLiveRows[frontLiveRows.length - 1]?.rightStitchCount ?? 0)),
          ),
        );
    const shoulderMinFinalPerSideFromReference = Math.max(
      0,
      Math.min(
        Math.floor(
          Number(shoulderReferenceFrontRows[shoulderReferenceFrontRows.length - 1]?.leftStitchCount ?? 0),
        ),
        Math.floor(
          Number(
            shoulderReferenceFrontRows[shoulderReferenceFrontRows.length - 1]?.rightStitchCount ?? 0,
          ),
        ),
      ),
    );
    const effectiveShoulderMinFinalPerSide = isCardiganRoundHalfFront
      ? shoulderMinFinalPerSideFromReference
      : shoulderMinFinalPerSide;
    const shoulderMinFinalOpts =
      effectiveShoulderMinFinalPerSide > 0
        ? { minFinalStitchesPerSide: effectiveShoulderMinFinalPerSide }
        : {};

    /** Align back shoulder chunks to front-executed outer bind-offs (short back row budget overlaps inner neck). */
    let alignedShoulderTimelineOpts = shoulderTimelineOpts;
    if (shoulderSchedule !== null && shoulderReferenceFrontTimeline.length > 0) {
      const frontLeftChunks = collectOuterShoulderBindOffPoints(
        shoulderReferenceFrontTimeline,
        "left",
      ).map((p) => p.amount);
      const frontRightChunks = collectOuterShoulderBindOffPoints(
        shoulderReferenceFrontTimeline,
        "right",
      ).map((p) => p.amount);
      if (frontLeftChunks.length > 0 || frontRightChunks.length > 0) {
        const alignedSchedule: ShoulderBindoffSchedule = {
          leftChunks: frontLeftChunks.length > 0 ? frontLeftChunks : shoulderSchedule.leftChunks,
          rightChunks:
            frontRightChunks.length > 0 ? frontRightChunks : shoulderSchedule.rightChunks,
          placementRows: shoulderSchedule.placementRows,
        };
        alignedShoulderTimelineOpts = { shoulderSchedule: alignedSchedule };
      }
    }

    const { timeline: rawBackTimeline, chartRows: rawLiveRows } = buildNeckShoulderTimelineAndChartRows(
      patternNumbers,
      {
        ...alignedShoulderTimelineOpts,
        ...shoulderMinFinalOpts,
      },
    );
    const timeline =
      shoulderReferenceFrontTimeline.length > 0 && rawBackTimeline.length > 0
        ? alignBackNeckShoulderTimelineFinalCountsToFront(
            rawBackTimeline,
            shoulderReferenceFrontTimeline,
          )
        : rawBackTimeline;
    const liveRows =
      timeline === rawBackTimeline
        ? rawLiveRows
        : neckShoulderChartRowsFromTimeline(timeline);

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

    if (frontLiveRows.length > 0) {
      frontNeckShoulderTimeline = frontTimeline;
      frontNeckShoulderShapingChart = neckShoulderShapingChartFromRows(frontLiveRows, {
        timeline: frontTimeline,
        sleevelessFullWidthVNeckFront: isFrontVNeck,
        ...(isSleevelessCardiganGarmentStyle(patternData) ? { sleevelessCardiganFront: true } : {}),
      });
      frontNeckShoulderChartUsesLiveRows = true;

      const firstRowCenterBo = centerBindOffAmountFirstTimelineRow(frontTimeline);
      const cardiganCfInitialBo =
        isCardiganRoundHalfFront && necklineStitches !== undefined
          ? cardiganFrontInitialNeckBindOffStitches(necklineStitches, effectiveFrontNeckDepthRows)
          : 0;
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
            stitchCount:
              firstRowCenterBo > 0
                ? firstRowCenterBo
                : cardiganCfInitialBo > 0
                  ? cardiganCfInitialBo
                  : initialCenterStsFrontPiece,
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
                text: `At neck edge, decrease toward center every other row — ${sideNeckShapingStitchesPerSide} stitch${
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

    if (
      backNeckShoulderTimeline &&
      frontNeckShoulderTimeline &&
      shoulderStitches !== undefined &&
      shoulderStitches > 0
    ) {
      const shoulderNotationSide = "right" as const;
      const frontShoulderBudget = isCardiganRoundHalfFront
        ? Math.max(
            1,
            (cardiganFrontPostArmholeSts ??
              cardiganHalfLeftStitchesAfterArmhole ??
              stitchesAfterArmhole ??
              0) - (necklineStitches !== undefined ? Math.max(1, Math.round(necklineStitches / 2)) : 0),
          )
        : shoulderStitches;
      const backShoulderLines = shoulderShapingNotationLinesFromTimeline(
        backNeckShoulderTimeline,
        shoulderNotationSide,
        undefined,
        { shoulderStitchesBudget: shoulderStitches },
      );
      const frontShoulderLines = shoulderShapingNotationLinesFromTimeline(
        frontNeckShoulderTimeline,
        shoulderNotationSide,
        undefined,
        { shoulderStitchesBudget: frontShoulderBudget },
      );
      if (backShoulderLines.join("\n") !== frontShoulderLines.join("\n")) {
        warnings.push(
          "Front shoulder shaping notation does not match the back — shoulder bind-off schedule should be identical on both pieces."
        );
      }
      if (totalStitchesFromShapingNotationLines(backShoulderLines) !== shoulderStitches) {
        warnings.push(
          "Back shoulder shaping notation does not total the calculated shoulder stitch count — check neck opening vs shoulder width."
        );
      }
      if (totalStitchesFromShapingNotationLines(frontShoulderLines) !== frontShoulderBudget) {
        warnings.push(
          "Front shoulder shaping notation does not total the calculated shoulder stitch count — check neck opening vs shoulder width."
        );
      }
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
  const frontNecklineShapingBeginLocalRC = frontNeckShoulderChartUsesLiveRows
    ? armholeLocalRcFirstActiveSideNecklineShapingAction(
        frontNeckShoulderShapingChart,
        armholeStartRC,
      )
    : undefined;
  /**
   * Armhole RC of the Front Neckline chart's center divide/setup row ("Scrap off center … to
   * divide"). Derived from the same chart builder + options the rendered chart uses, so the
   * page 8 summary and page 9 instruction stay locked to the chart's divide row.
   */
  const frontNecklineCenterDivideLocalRC = frontNeckShoulderChartUsesLiveRows
    ? armholeLocalRcCenterNecklineSetupRow(frontNeckShoulderShapingChart, armholeStartRC, {
        includeCenterNecklineSetupRow: true,
      })
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

  if (necklineStitches !== undefined && necklineStitches > 0 && backRoundNeckPlan === null) {
    backRoundNeckPlan = calculateBackRoundNecklinePlan({
      necklineStitches,
      necklineDepthRows: backNeckDepthRows,
    });
  }
  if (
    necklineStitches !== undefined &&
    necklineStitches > 0 &&
    frontRoundNeckPlan === null &&
    !isFrontVNeck &&
    effectiveFrontNeckDepthRows > 0
  ) {
    frontRoundNeckPlan = calculateRoundNecklinePlan({
      necklineStitches,
      necklineDepthRows: effectiveFrontNeckDepthRows,
    });
  }

  const debug: SleevelessBackPatternDebug = {
    finishedBustChest:
      finishedBust > 0 ? finishedBust : undefined,
    stitchesPerInch,
    rowsPerInch,
    backStitches: bustBodySts,
    bustBodyStitches: bustBodySts,
    hemCastOnStitches: castOnSts,
    hipRowsFromHem: alineBodyShaping !== null ? alineBodyShaping.hipRowsFromHem : undefined,
    alineBodyShapingRowNumbers:
      alineBodyShaping !== null && alineBodyShaping.shapingType !== "straight"
        ? [...alineBodyShaping.shapingRowNumbers]
        : undefined,
    alineBodyShapingType:
      alineBodyShaping !== null ? alineBodyShaping.shapingType : undefined,
    diagramGuides: bodyDiagramGuides,
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
      rowGauge > 0 ? rowsToInches(bodyToArmholeRows, rowGauge) : undefined,
    reservedNecklineShoulderInches: neckShoulderInches,
    reservedNecklineShoulderRows: neckShoulderRowsEstimate,
    remainingRowsBeforeNeckline: upperBackRows,
    necklineWidthInches: neckWidthIn,
    necklineStitches,
    centerNeckBindOffStitches:
      necklineStitches !== undefined ? initialBackCenterNeckStitches(necklineStitches) : undefined,
    backNeckRoundNecklineStrategy: backRoundNeckPlan?.strategy,
    frontNeckRoundNecklineStrategy: frontRoundNeckPlan?.strategy,
    ...(isCardiganRoundHalfFront &&
    frontNeckShoulderChartUsesLiveRows &&
    necklineStitches !== undefined
      ? {
          cardiganFrontInitialNeckBindOffStitches: cardiganFrontInitialNeckBindOffStitches(
            necklineStitches,
            effectiveFrontNeckDepthRows,
          ),
        }
      : {}),
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
    frontNecklineShapingBeginLocalRC,
    frontNecklineCenterDivideLocalRC,
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
    ...(isCardiganHalfFrontBody && cardiganHalfLeftCastOnSts !== undefined
      ? {
          cardiganHalfLeftCastOnSts: cardiganHalfLeftCastOnSts,
          cardiganHalfLeftBustBodySts: cardiganHalfLeftBustBodySts,
          cardiganHalfLeftStitchesAfterArmhole: cardiganHalfLeftStitchesAfterArmhole,
          ...(cardiganFrontPostArmholeSts !== undefined
            ? { cardiganFrontPostArmholeSts }
            : {}),
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

  const rowAccountingInput = buildRowAccountingInputFromDebug(debug);
  if (rowAccountingInput) {
    warnRowAccountingDriftIfDev(validateRowAccounting(rowAccountingInput), "sleevelessPatternOutput");
  }

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
    armholeStartSts: stitchesAtArmholeStart,
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
    alineBodyShaping,
    backRoundNeckPlan,
  });

  const cardiganFrontAlineShaping =
    isCardiganHalfFrontBody &&
    alineBodyShaping &&
    cardiganHalfLeftCastOnSts !== undefined &&
    cardiganHalfLeftBustBodySts !== undefined
      ? scaleAlineBodyShapingPlanForCardiganHalf(
          alineBodyShaping,
          cardiganHalfLeftCastOnSts,
          cardiganHalfLeftBustBodySts,
        )
      : null;

  const cardiganFrontExecutionRowsRaw =
    isCardiganHalfFrontBody &&
    cardiganHalfLeftCastOnSts !== undefined &&
    cardiganHalfLeftBustBodySts !== undefined &&
    cardiganHalfLeftStitchesAfterArmhole !== undefined &&
    armholeMathResult !== null &&
    firstArmholeRCNum !== null
      ? buildSleevelessBackDisplayRows({
          castOnSts: cardiganHalfLeftCastOnSts,
          armholeStartSts: cardiganHalfLeftBustBodySts,
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
          alineBodyShaping: cardiganFrontAlineShaping,
          alineShapingEdgeScope: "armholeEdgeOnly",
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
      frontNecklineShapingBeginLocalRC,
      frontNecklineCenterDivideLocalRC,
      shoulderShapingBeginLocalRC: backNecklineStartLocalRC,
      sharedExecutionRows: frontSharedExecutionRows,
      useNeckChartRows: frontNeckShoulderChartUsesLiveRows,
      neckChartRows: frontNeckShoulderShapingChart.rows,
      necklineStitches: necklineStitchesForFrontSummary,
      fullNecklineStitches: necklineStitches,
      shoulderStitches: isCardiganRoundHalfFront
        ? Math.max(
            1,
            (cardiganFrontPostArmholeSts ??
              cardiganHalfLeftStitchesAfterArmhole ??
              stitchesAfterArmhole ??
              0) - (necklineStitchesForFrontSummary ?? 0),
          )
        : shoulderStitches,
      pieceTitle: isCardiganHalfFrontBody ? "LEFT FRONT" : undefined,
      introIsCardiganHalf: isCardiganHalfFrontBody,
      garmentArmholeStartRC: armholeStartRC,
      isVNeck: isSleevelessVNeckChoice(patternData),
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

/** Normalize RC display to `RC: 000` (space after colon). */
export function normalizeRcDisplayLine(line: string): string {
  let s = line;
  s = s.replace(/^RC\s+(\d{1,3})\b/, (_, d: string) => `RC: ${String(d).padStart(3, "0")}`);
  s = s.replace(/^RC:\s*(\d{1,3})\b/, (_, d: string) => `RC: ${String(d).padStart(3, "0")}`);
  return s;
}

/**
 * Demo with simple numbers for manual math checks (5 sts/in, 7 rows/in, 40" bust, etc.).
 */
export {
  cardiganFrontInitialNeckBindOffStitches,
  cardiganFrontNeckOpeningStitches,
  roundNeckOneSideNeckEdgeNotationLines,
} from "./roundNeckNotation";

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
