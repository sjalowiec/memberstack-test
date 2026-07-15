/**
 * Server/client-safe HTML for the neckline / shoulder chart section (yarn-gauge live refresh).
 * Class names must stay aligned with NeckShoulderShapingChart.astro.
 */

import type {
  NeckShoulderShapingChart,
  NeckShoulderShapingChartDisplayRow,
  NeckShoulderShapingChartRow,
} from "./neckShoulderShapingChart";
import {
  chartDisplayRowsOnePerRc,
  collapsePlainKnitChartRowsForDisplay,
  getNeckShoulderChartRowHighlightFromRow,
  isFullWidthVNeckFrontStyleChart,
  NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
  plainKnitSpanCarriageEdgeDisplay,
} from "./neckShoulderShapingChart";
import {
  ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ACTIVE_SHOULDER_DIVIDE_SENTENCE,
  ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE,
  ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS,
  ACTIVE_SHOULDER_REVERSE_NECKLINE_ONLY_EMPHASIS,
  activeShoulderChartIntroSentence,
  activeShoulderReverseShapingEmphasis,
  ACTIVE_VNECK_CENTER_DIVIDE_TAIL,
  activeShoulderCenterDivideIntroApplies,
  activeShoulderIntroIsCardiganFront,
  activeShoulderIntroUsesVNeckDivideCopy,
  CARDIGAN_FRONT_NECKLINE_START_TAIL,
  CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE,
  CARDIGAN_FRONT_NECKLINE_ONLY_SENTENCE,
  CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE,
  BIND_OFF_GLOSSARY_ID,
  SCRAP_OFF_GLOSSARY_ID,
} from "./neckShoulderActiveIntroCopy";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  armholeLocalRcFirstActiveSideNecklineShapingAction,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
  type ActiveSideInstructionTableRow,
} from "./neckShoulderActiveSideChecklist";

export {
  armholeLocalRcActiveShoulderChecklistStart,
  armholeLocalRcFirstActiveSideNecklineShapingAction,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
  type ActiveSideInstructionTableRow,
} from "./neckShoulderActiveSideChecklist";
import { buildGlossaryTooltipPlaceholderHtml } from "../glossary/glossaryTooltipPrint";
import {
  carriagePositionHelpCardHtml,
  centerBindOffStitchesFromNeckShoulderChart,
  formatShoulderBindoffRemainingInstruction,
} from "./sleevelessPatternOutput";
import { isDropShoulderCardiganGarmentStyle } from "./dropShoulderBodyNotationSvg";

/** Registry key in `SLEEVELESS_HELP_VIDEOS` (Vimeo 252565241 — shallow round neck shaping). */
export const NECKLINE_SHAPING_HELP_VIDEO_KEY = "shallowBackNeck";

export {
  ACTIVE_SHOULDER_CHART_INTRO_SENTENCE,
  ACTIVE_SHOULDER_DIVIDE_SENTENCE,
  SCRAP_OFF_GLOSSARY_ID,
} from "./neckShoulderActiveIntroCopy";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape `text` for HTML, wrapping the first occurrence of `phrase` (if present) in `<strong>`. */
function escapeHtmlWithEmphasis(text: string, phrase: string): string {
  const idx = phrase ? text.indexOf(phrase) : -1;
  if (idx < 0) return escapeHtml(text);
  const before = text.slice(0, idx);
  const after = text.slice(idx + phrase.length);
  return `${escapeHtml(before)}<strong>${escapeHtml(phrase)}</strong>${escapeHtml(after)}`;
}

/**
 * Escaped intro sentence with the reverse-shaping phrase emphasized in `<strong>`.
 * The plain-text constant is unchanged for print/non-HTML consumers. Drop shoulder
 * (`shouldersShaped: false`) reverses only the neckline shaping (straight shoulders).
 */
function activeShoulderChartIntroSentenceHtml(shouldersShaped = true): string {
  return escapeHtmlWithEmphasis(
    activeShoulderChartIntroSentence(shouldersShaped),
    activeShoulderReverseShapingEmphasis(shouldersShaped),
  );
}

/**
 * Wrap-safe HTML for a checklist **Action** cell in the narrow print/online column.
 *
 * The Action column has no fixed width and wraps freely, so a bare `Decrease 1 st` /
 * `Bind off OR hold 3 sts` can break between the count and its unit — leaving a lone `1`
 * (which thin-glyph rendering and OCR misread as `Il`, or drop entirely → `Decrease  st`)
 * or a stranded `sts` on its own line. Gluing the count to its unit and keeping the
 * multi-word verb phrase intact with non-breaking spaces removes those artifacts. Natural
 * breaks are still allowed (e.g. before the count), so the column never forces the page wider.
 *
 * Display-only: the underlying {@link ActiveSideInstructionTableRow.action} keeps plain spaces
 * so row IDs, aria labels, and tests stay stable.
 */
export function formatActionCellHtml(action: string): string {
  const NBSP = "\u00A0";
  let html = escapeHtml(String(action ?? ""));
  // Glue the stitch count to its unit: "1 st" / "12 sts" → never split across lines.
  html = html.replace(/(\d+)[ \t]+(sts?)\b/g, `$1${NBSP}$2`);
  // Keep the multi-word verb phrases together so "OR hold"/"off" never strand.
  html = html.replace(/Bind off OR hold/g, `Bind${NBSP}off${NBSP}OR${NBSP}hold`);
  html = html.replace(/Bind off/g, `Bind${NBSP}off`);
  return html;
}

function chartProgressRcAttrFromActiveRow(r: ActiveSideInstructionTableRow): string {
  const start = Math.max(0, Math.floor(Number(r.rc)));
  const endRaw = r.rcEnd !== undefined ? Math.max(0, Math.floor(Number(r.rcEnd))) : start;
  return endRaw !== start ? `${start}-${endRaw}` : String(start);
}

function chartProgressRcAttrFromGarmentRow(r: NeckShoulderShapingChartRow): string {
  const lo = Math.max(0, Math.floor(Number(r.row)));
  const hi =
    r.chartRowSpanLast !== undefined && Number.isFinite(r.chartRowSpanLast)
      ? Math.max(0, Math.floor(Number(r.chartRowSpanLast)))
      : lo;
  return hi !== lo ? `${lo}-${hi}` : String(lo);
}

/** Stable checklist row identity for persistence (paired with [`data-chart-id`](/)). */
function buildActiveSideStableRowId(chartProgressId: string, r: ActiveSideInstructionTableRow): string {
  const start = Math.max(0, Math.floor(Number(r.rc)));
  const endRaw =
    r.rcEnd !== undefined && Number.isFinite(Number(r.rcEnd))
      ? Math.max(0, Math.floor(Number(r.rcEnd)))
      : start;
  return `${chartProgressId}|arc|${start}|${endRaw}|${Number(r.stitchesRemaining)}|${
    r.carriagePosition
  }|${r.action}|${r.edge}`;
}

function buildFullChartStableRowId(
  chartProgressId: string,
  displayRow: NeckShoulderShapingChartDisplayRow,
): string {
  const r = displayRow.sourceRow;
  const lo = Math.max(0, Math.floor(Number(r.row)));
  const hi =
    r.chartRowSpanLast !== undefined && Number.isFinite(r.chartRowSpanLast)
      ? Math.max(0, Math.floor(Number(r.chartRowSpanLast)))
      : lo;
  const center = String(r.centerNeck ?? "").trim();
  return `${chartProgressId}|full|${lo}|${hi}|${displayRow.rowLabel}|${displayRow.actionLabel}|${center}|${
    r.leftStitchCount
  }|${r.rightStitchCount}`;
}

function renderNsChartProgressToolbarHtml(): string {
  return `<div class="ns-shaping-chart__progress-toolbar no-print">
    <div class="ns-shaping-chart__progress-toolbar-main" role="toolbar" aria-label="Chart checklist tracking">
      <button type="button" role="switch" aria-checked="true" class="pattern-tips-switch ns-shaping-chart__progress-show-completed" data-chart-progress-show-completed>
        <span class="pattern-tips-switch__label">Show Completed Rows</span>
        <span class="pattern-tips-switch__track" aria-hidden="true"><span class="pattern-tips-switch__thumb"></span></span>
        <span class="pattern-tips-switch__state" data-chart-progress-show-state>Rows visible</span>
      </button>
      <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-reset" data-chart-progress-reset>Reset Checklist</button>
    </div>
  </div>`;
}

function rowClassFromHighlight(hi: ReturnType<typeof getNeckShoulderChartRowHighlightFromRow>): string {
  if (hi === "neckBothSides") return "ns-shaping-chart__tr ns-shaping-chart__tr--neck-both";
  if (hi === "shoulderAndNeck") return "ns-shaping-chart__tr ns-shaping-chart__tr--shoulder-neck";
  if (hi === "shoulderBothSides") return "ns-shaping-chart__tr ns-shaping-chart__tr--shoulder-both";
  return "ns-shaping-chart__tr";
}

function parseDecreaseCell(cell: string): number {
  const text = String(cell ?? "").trim();
  if (!text || text === "-") return 0;
  const normalized = text.replace(/[^\d-]/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(Math.trunc(n));
}


function sideColumnLabelFromAction(actionLabel: string): "Armhole" | "Shoulder" {
  return /shoulder/i.test(String(actionLabel ?? "")) ? "Shoulder" : "Armhole";
}

function buildLeftShapingText(r: NeckShoulderShapingChart["rows"][number], actionLabel: string): string {
  const sideValue = parseDecreaseCell(r.leftSide);
  const neckValue = parseDecreaseCell(r.leftNeck);
  const sideLabel = sideColumnLabelFromAction(actionLabel) === "Shoulder" ? "Shoulder" : "Armhole";
  const parts: string[] = [];
  if (sideValue > 0) parts.push(`${sideLabel} -${sideValue}`);
  if (neckValue > 0) parts.push(`Neck -${neckValue}`);
  return parts.join(", ") || "—";
}

function buildRightShapingText(r: NeckShoulderShapingChart["rows"][number], actionLabel: string): string {
  const sideValue = parseDecreaseCell(r.rightSide);
  const neckValue = parseDecreaseCell(r.rightNeck);
  const sideLabel = sideColumnLabelFromAction(actionLabel) === "Shoulder" ? "Shoulder" : "Armhole";
  const parts: string[] = [];
  if (neckValue > 0) parts.push(`Neck -${neckValue}`);
  if (sideValue > 0) parts.push(`${sideLabel} -${sideValue}`);
  return parts.join(", ") || "—";
}

function centerBindOffCompact(centerCell: string): string {
  const value = parseDecreaseCell(centerCell);
  return value > 0 ? `Center BO ${value}` : "";
}

function stitchRemainingCompact(left: number, right: number): string {
  if (left === right) return `${left} each`;
  return `L ${left} / R ${right}`;
}

const SECOND_SIDE_INSTRUCTION_SUFFIX =
  `Work the second shoulder, ${ACTIVE_SHOULDER_REVERSE_SHAPING_EMPHASIS} so that neckline shaping remains on the neck edge and shoulder shaping remains on the shoulder edge.`;
/** Drop-shoulder variant (straight shoulders): reverse only the neckline shaping. */
const SECOND_SIDE_INSTRUCTION_SUFFIX_NECKLINE_ONLY =
  `Work the second shoulder, ${ACTIVE_SHOULDER_REVERSE_NECKLINE_ONLY_EMPHASIS} so it remains on the neck edge.`;
const SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX = "Follow the second shoulder checklist below.";

export type ActiveShoulderChartIntroLayout = "compact" | "labeled";

export type ActiveShoulderChartIntroOptions = {
  /** Armhole RC at center bind-off (same value as pattern debug `*NecklineStartLocalRC`), e.g. `RC:117`. */
  localStartRcLabel?: string | undefined;
  /** Whole-stitch center bind-off count from chart row 0; omit tail when unknown. */
  centerBindOffStitches?: number | undefined;
  /** When set, V-neck front charts use divide-at-center copy instead of round-neck center scrap-off. */
  chart?: NeckShoulderShapingChart | undefined;
  /** When true (or chart flag), intro uses cardigan front wording instead of pullover divide language. */
  isCardiganFront?: boolean | undefined;
  /**
   * When false, the shoulders are worked straight (drop shoulder) so the reverse-shaping copy
   * mentions only the neckline shaping. Defaults to true (sleeveless: neckline + shoulder shaping).
   */
  shouldersShaped?: boolean | undefined;
  /** Host-specific wrapper class (`print-chart-intro` vs `pattern-shaping-intro`). */
  wrapperClass: string;
  /** Reserved for callers (online vs print); intro wording is the same for both layouts. */
  layout: ActiveShoulderChartIntroLayout;
  /**
   * Online only. When true (round-neck center scrap-off charts), the intro presents the
   * construction workflow as labeled "Before Shaping" and "Divide the Neckline" step lists
   * instead of the compact "Center Neckline" / "Divide" paragraphs. Print and the default
   * rendering are unchanged (no calculations, row/stitch counts, or table behavior change).
   */
  includeWorkflowSteps?: boolean;
  /**
   * Online front/back chart only. When set to `"front"` or `"back"`, a quiet "Japanese Notation
   * Quick Reference" preview card is placed beside the intro instructions. Clicking it opens that
   * piece's existing Shaping Notation diagram modal (handled in the page script). Off by default so
   * print/PDF are unchanged.
   */
  notationPreview?: NotationPreviewPiece;
  /** Which garment construction's static preview assets to use. Defaults to sleeveless. */
  notationPreviewConstruction?: NotationPreviewConstruction;
};

export type NotationPreviewPiece = "front" | "back";

export type NotationPreviewConstruction = "sleeveless" | "drop-shoulder";

/** Static, token-free cropped teaser — sleeveless shaping notation (decorative preview only). */
export const SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC = {
  front: "/images/patterns/sleeveless/diagrams/diagram-jp-front-preview.svg",
  back: "/images/patterns/sleeveless/diagrams/diagram-jp-back-preview.svg",
} as const;

/** Static, token-free cropped teaser — drop-shoulder body shaping notation. */
export const DROP_SHOULDER_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC = {
  front: "/images/patterns/drop-shoulder/jp-drop-body-front-preview.svg",
  back: "/images/patterns/drop-shoulder/jp-drop-body-back-preview.svg",
} as const;

/** Cardigan front teaser — uses pullover preview until a dedicated cardigan crop exists. */
export const DROP_SHOULDER_JP_NOTATION_CARDIGAN_QUICK_REFERENCE_PREVIEW_SRC =
  "/images/patterns/drop-shoulder/jp-drop-body-front-preview.svg";

/** @deprecated Use {@link SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC} or {@link resolveJapaneseNotationQuickReferencePreviewSrc}. */
export const JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC = SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC;

export function resolveJapaneseNotationQuickReferencePreviewSrc(
  piece: NotationPreviewPiece,
  construction: NotationPreviewConstruction = "sleeveless",
  patternData?: unknown,
): string {
  if (construction === "drop-shoulder") {
    if (piece === "front" && isDropShoulderCardiganGarmentStyle(patternData)) {
      return DROP_SHOULDER_JP_NOTATION_CARDIGAN_QUICK_REFERENCE_PREVIEW_SRC;
    }
    return DROP_SHOULDER_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC[piece];
  }
  return SLEEVELESS_JP_NOTATION_QUICK_REFERENCE_PREVIEW_SRC[piece];
}

/**
 * Quiet, keyboard-accessible preview card. Carries `data-neckline-notation-preview-trigger="<piece>"`
 * so the page script opens that piece's existing Shaping Notation diagram modal (no second modal
 * system).
 */
function necklineNotationPreviewCardHtml(
  piece: NotationPreviewPiece,
  construction: NotationPreviewConstruction = "sleeveless",
  patternData?: unknown,
): string {
  const previewSrc = resolveJapaneseNotationQuickReferencePreviewSrc(
    piece,
    construction,
    patternData,
  );
  return `<aside class="ns-jp-preview no-print">
  <button type="button" class="ns-jp-preview__btn" data-neckline-notation-preview-trigger="${escapeHtml(piece)}" aria-label="Open Japanese notation quick reference">
    <span class="ns-jp-preview__title">Japanese Notation Quick Reference</span>
    <span class="ns-jp-preview__crop">
      <img class="ns-jp-preview__img" src="${escapeHtml(previewSrc)}" alt="" loading="lazy" aria-hidden="true" />
      <span class="ns-jp-preview__zoom" aria-hidden="true"><i class="fa-solid fa-magnifying-glass"></i></span>
    </span>
    <span class="ns-jp-preview__caption">Click to enlarge</span>
  </button>
</aside>`;
}

/** Wraps the intro content, adding the right-side notation preview for the given piece when set. */
function wrapActiveShoulderChartIntroHtml(
  wrappedClass: string,
  innerHtml: string,
  notationPreview: NotationPreviewPiece | undefined,
  notationPreviewConstruction: NotationPreviewConstruction = "sleeveless",
  notationPreviewPatternData?: unknown,
): string {
  if (notationPreview === "front" || notationPreview === "back") {
    return `<div class="${escapeHtml(wrappedClass)} ns-shaping-intro--with-preview">
  <div class="ns-shaping-intro__main">
  ${innerHtml}
  </div>
  ${necklineNotationPreviewCardHtml(
    notationPreview,
    notationPreviewConstruction,
    notationPreviewPatternData,
  )}
</div>`;
  }
  return `<div class="${escapeHtml(wrappedClass)}">
  ${innerHtml}
</div>`;
}

/**
 * Drop-shoulder neckline sections: instructions in the left column, preview card in the right
 * sidebar column (same grid shell as the garment diagram split — not inside the intro flex wrapper).
 */
export function renderNecklineInstructionsWithNotationPreviewHtml(
  innerHtml: string,
  piece: NotationPreviewPiece,
  construction: NotationPreviewConstruction = "drop-shoulder",
  patternData?: unknown,
): string {
  const previewAside = necklineNotationPreviewCardHtml(piece, construction, patternData);
  return `<div class="pattern-layout pattern-layout--garment-columns sleeveless-neckline-preview-split">
  <div class="pattern-layout__content">
    <div class="sleeveless-pattern-instructions">
  ${innerHtml}
    </div>
  </div>
  <aside class="pattern-layout__sidebar sleeveless-neckline-preview-split__aside" aria-label="Japanese notation quick reference">
  ${previewAside}
  </aside>
</div>`;
}

function scrapOffGlossaryPlaceholderHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    SCRAP_OFF_GLOSSARY_ID,
    "Scrap off",
    (s) => s.replace(/"/g, "&quot;"),
    (s) => s,
  );
}

function bindOffGlossaryPlaceholderHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    BIND_OFF_GLOSSARY_ID,
    "bind off",
    (s) => s.replace(/"/g, "&quot;"),
    (s) => s,
  );
}

/**
 * Padded Armhole RC number from a `RC:NNN` label (e.g. `RC:050` → `050`). Empty when the label is
 * not in that form. Pure display formatting — no shaping math or row-counter values are derived here.
 */
function divideRcDisplayLabel(localStartRcLabel?: string | undefined): string {
  const localStartLabel = String(localStartRcLabel ?? "").trim();
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    return String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
  }
  return localStartLabel;
}

/** HTML shallow back hold divide at the neckline row (three-stage workflow setup). */
function formatActiveShoulderShallowHoldBackCenterNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
  centerHoldStitches?: number | undefined;
  atRcPrefix?: boolean | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const centerCount = Number(args.centerHoldStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const centerPhrase = centerCountLabel
    ? `place the center ${escapeHtml(centerCountLabel)} neckline stitches in hold`
    : "place the center neckline stitches in hold";
  const tail = `${centerPhrase}. Place the opposite shoulder stitches in hold. Place the opposite neckline stitches in hold. Work the right shoulder and right neck edge first.`;
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    if (args.atRcPrefix) {
      return `At RC ${escapeHtml(n)}, ${tail}`;
    }
    return `When Armhole RC reaches ${escapeHtml(n)}, ${tail}.`;
  }
  if (localStartLabel) {
    return `At ${escapeHtml(localStartLabel)}, ${tail}.`;
  }
  return `${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}

function chartTimelineUsesHoldCenter(chart?: NeckShoulderShapingChart): boolean {
  const first = chart?.timeline?.[0];
  if (!first) return false;
  return first.events.some(
    (e) => e.kind === "hold" && e.side === "center" && e.edge === "center" && e.amount > 0,
  );
}

/** HTML center-neckline divide line with glossary on “Scrap off” and “bind off” (plain-text twin in intro copy module). */
function formatActiveShoulderCenterNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
  /** When true, the milestone reads “At RC NNN, …” (online workflow steps) instead of “When Armhole RC reaches NNN, …”. */
  atRcPrefix?: boolean | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const centerCount = Number(args.centerBindOffStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const scrapOff = scrapOffGlossaryPlaceholderHtml();
  const bindOff = bindOffGlossaryPlaceholderHtml();
  const divideTail = centerCountLabel
    ? `divide the neckline by removing the center ${escapeHtml(centerCountLabel)} neckline stitches from work. ${scrapOff}, ${bindOff}, or place these stitches on hold according to your preferred method`
    : `divide the neckline by removing the center neckline stitches from work. ${scrapOff}, ${bindOff}, or place these stitches on hold according to your preferred method`;
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    if (args.atRcPrefix) {
      return `At RC ${escapeHtml(n)}, ${divideTail}.`;
    }
    return `When Armhole RC reaches ${escapeHtml(n)}, ${divideTail}.`;
  }
  if (localStartLabel) {
    return `At ${escapeHtml(localStartLabel)}, ${divideTail}.`;
  }
  return `${divideTail.charAt(0).toUpperCase()}${divideTail.slice(1)}.`;
}

/** HTML V-neck center divide line (no scrap-off / bind-off wording). */
function formatActiveShoulderVNeckCenterNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
  /** When true, the milestone reads “At RC NNN, …” (online workflow steps) instead of “When Armhole RC reaches NNN, …”. */
  atRcPrefix?: boolean | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const tail = escapeHtml(ACTIVE_VNECK_CENTER_DIVIDE_TAIL);
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    if (args.atRcPrefix) {
      return `At RC ${escapeHtml(n)}, ${tail}.`;
    }
    return `When Armhole RC reaches ${escapeHtml(n)}, ${tail}.`;
  }
  if (localStartLabel) {
    return `At ${escapeHtml(localStartLabel)}, ${tail}.`;
  }
  return `${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}

/** HTML cardigan front neckline start line (center-front edge — no scrap-off / divide language). */
function formatActiveShoulderCardiganFrontNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const tail = escapeHtml(CARDIGAN_FRONT_NECKLINE_START_TAIL);
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    return `When Armhole RC reaches ${escapeHtml(n)}, ${tail}.`;
  }
  if (localStartLabel) {
    return `At ${escapeHtml(localStartLabel)}, ${tail}.`;
  }
  return `${tail.charAt(0).toUpperCase()}${tail.slice(1)}.`;
}

/**
 * Shared HTML intro placed above the active-shoulder shaping checklist (online pattern tab + print/PDF).
 * Round-neck center scrap-off copy is omitted when {@link centerBindOffStitches} is 0; V-neck front
 * charts use divide-at-center copy via {@link activeShoulderIntroUsesVNeckDivideCopy}.
 */
export function renderActiveShoulderChartIntroHtml(options: ActiveShoulderChartIntroOptions): string {
  const wrappedClass = String(options.wrapperClass ?? "").trim() || "active-shoulder-chart-intro";
  const isCardiganFront = activeShoulderIntroIsCardiganFront(options);

  if (isCardiganFront) {
    const innerParts: string[] = [];
    if (activeShoulderCenterDivideIntroApplies(options.centerBindOffStitches, options.chart)) {
      innerParts.push(
        `<p><strong>Center-front edge:</strong><br>${formatActiveShoulderCardiganFrontNecklineHtml({
          localStartRcLabel: options.localStartRcLabel,
        })}</p>`,
      );
    }
    innerParts.push(
      `<p>${escapeHtml(options.shouldersShaped === false ? CARDIGAN_FRONT_NECKLINE_ONLY_SENTENCE : CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE)}</p>`,
    );
    return wrapActiveShoulderChartIntroHtml(
      wrappedClass,
      innerParts.join("\n  "),
      options.notationPreview,
      options.notationPreviewConstruction,
    );
  }

  const vNeckDivide = activeShoulderIntroUsesVNeckDivideCopy(options.chart);
  const roundCenterDivide =
    !vNeckDivide &&
    activeShoulderCenterDivideIntroApplies(options.centerBindOffStitches, options.chart);
  const shallowHoldBackDivide = roundCenterDivide && chartTimelineUsesHoldCenter(options.chart);
  const showCenterDivide = vNeckDivide || roundCenterDivide;
  // Online workflow steps anchor the divide milestone as “At RC NNN, …”; print/default keep
  // “When Armhole RC reaches NNN, …”. Only the prefix wording changes — the calculated RC is the same.
  const useAtRcPrefix = options.includeWorkflowSteps === true;
  const centerHtml = vNeckDivide
    ? formatActiveShoulderVNeckCenterNecklineHtml({
        localStartRcLabel: options.localStartRcLabel,
        atRcPrefix: useAtRcPrefix,
      })
    : shallowHoldBackDivide
      ? formatActiveShoulderShallowHoldBackCenterNecklineHtml({
          localStartRcLabel: options.localStartRcLabel,
          centerHoldStitches: options.centerBindOffStitches,
          atRcPrefix: useAtRcPrefix,
        })
      : roundCenterDivide
        ? formatActiveShoulderCenterNecklineHtml({
            localStartRcLabel: options.localStartRcLabel,
            centerBindOffStitches: options.centerBindOffStitches,
            atRcPrefix: useAtRcPrefix,
          })
        : "";
  const innerParts: string[] = [];
  if (options.includeWorkflowSteps === true && showCenterDivide && centerHtml) {
    const divideRc = divideRcDisplayLabel(options.localStartRcLabel);
    const knitUntilBullet = divideRc
      ? `Knit until Armhole RC reaches ${escapeHtml(divideRc)}.`
      : `Knit to the neckline shaping row.`;
    const afterDivideBullets = shallowHoldBackDivide
      ? `<li>Stage 1 — work the right shoulder and right neck edge (checklist below). Stage 2 — return held stitches and mirror for the left side.</li><li>Stage 3 — scrap off or bind off all held neckline stitches when both sides are complete.</li>`
      : `<li>${escapeHtml(ACTIVE_SHOULDER_PARK_NONWORKING_SIDE_SENTENCE)}</li><li>Work one shoulder at a time.</li>`;
    innerParts.push(
      `<p class="pattern-shaping-step-title"><strong>Before Shaping</strong></p>`,
      `<ul class="pattern-shaping-step-list"><li>${knitUntilBullet}</li></ul>`,
      `<p class="pattern-shaping-step-title"><strong>Divide the Neckline</strong></p>`,
      `<ul class="pattern-shaping-step-list"><li>${centerHtml}</li>${afterDivideBullets}</ul>`,
    );
  } else if (showCenterDivide && centerHtml) {
    if (shallowHoldBackDivide) {
      innerParts.push(`<p><strong>Back neck (three stages):</strong><br>${centerHtml}</p>`);
      innerParts.push(
        `<p>Stage 1 — right shoulder and right neck edge. Stage 2 — left side (mirror). Stage 3 — scrap or bind off held neckline stitches.</p>`,
      );
    } else {
      innerParts.push(`<p><strong>Center Neckline:</strong><br>${centerHtml}</p>`);
      innerParts.push(
        `<p><strong>Divide:</strong><br>${escapeHtml(ACTIVE_SHOULDER_DIVIDE_SENTENCE)}</p>`,
      );
    }
  }
  innerParts.push(`<p>${activeShoulderChartIntroSentenceHtml(options.shouldersShaped !== false)}</p>`);
  const inner = innerParts.join("\n  ");

  return wrapActiveShoulderChartIntroHtml(
    wrappedClass,
    inner,
    options.notationPreview,
    options.notationPreviewConstruction,
  );
}

/**
 * True when the optional neckline shaping video helper should appear (division and/or shaping chart).
 * Omits empty charts and plain sections with no shaping rows.
 */
export function activeShoulderNecklineShapingHelpApplies(
  chart: NeckShoulderShapingChart | undefined,
  centerBindOffStitches?: number | undefined,
): boolean {
  if (!chart?.rows?.length) return false;
  const center =
    centerBindOffStitches !== undefined
      ? centerBindOffStitches
      : centerBindOffStitchesFromNeckShoulderChart(chart);
  if (activeShoulderCenterDivideIntroApplies(center, chart)) return true;
  if (isFullWidthVNeckFrontStyleChart(chart)) return true;
  return chart.rows.length > 1;
}

/** Compact “New to shaping necklines?” helper — online only; uses existing sleeveless video modal. */
export function renderActiveShoulderNecklineShapingHelpHtml(): string {
  return `<aside class="sleeveless-neck-shoulder-help sleeveless-neck-shoulder-help--compact no-print" aria-label="Neckline shaping video help">
  <p class="sleeveless-neck-shoulder-help__text"><strong>New to shaping necklines?</strong> This video walks through the process of dividing and shaping a neckline on the knitting machine. <span class="pattern-help-link"><button type="button" class="pattern-help-link__button" data-sleeveless-help-video="${NECKLINE_SHAPING_HELP_VIDEO_KEY}" aria-haspopup="dialog"><i class="fa-solid fa-play" aria-hidden="true"></i> Shallow round neck shaping</button></span></p>
</aside>`;
}

/**
 * Optional shaping help (when applicable) + chart intro copy. Help renders immediately before intro.
 */
export function renderNeckShoulderChartIntroBlockHtml(
  options: ActiveShoulderChartIntroOptions & { chart?: NeckShoulderShapingChart | undefined },
): string {
  const center =
    options.centerBindOffStitches !== undefined
      ? options.centerBindOffStitches
      : centerBindOffStitchesFromNeckShoulderChart(options.chart);
  const introOpts: ActiveShoulderChartIntroOptions = {
    ...options,
    chart: options.chart,
    centerBindOffStitches: center,
  };
  const help =
    options.chart && activeShoulderNecklineShapingHelpApplies(options.chart, center)
      ? renderActiveShoulderNecklineShapingHelpHtml()
      : "";
  return `${help}${renderActiveShoulderChartIntroHtml(introOpts)}`;
}

function instructionWithHeldStitches(
  heldShoulderStitches: number,
  showChecklist: boolean,
  isCardiganFront: boolean,
  shouldersShaped = true,
): string {
  if (isCardiganFront) {
    return CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE;
  }
  const held = Math.max(0, Math.floor(heldShoulderStitches));
  const suffix = showChecklist
    ? SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX
    : shouldersShaped
      ? SECOND_SIDE_INSTRUCTION_SUFFIX
      : SECOND_SIDE_INSTRUCTION_SUFFIX_NECKLINE_ONLY;
  const cutPhrase = shouldersShaped ? "cut yarn" : "cut the yarn";
  return `Once this side is complete, ${cutPhrase} and return the ${held} held stitches for the second shoulder to working position. ${suffix}`;
}

/**
 * HTML form of {@link instructionWithHeldStitches}: escaped, with the reverse-shaping phrase
 * emphasized in `<strong>` when the second-shoulder (non-checklist) suffix is used. Cardigan and
 * checklist variants contain no emphasis phrase, so they escape unchanged. Drop shoulder
 * (`shouldersShaped: false`) emphasizes the neckline-only reverse-shaping phrase.
 */
function instructionWithHeldStitchesHtml(
  heldShoulderStitches: number,
  showChecklist: boolean,
  isCardiganFront: boolean,
  shouldersShaped = true,
): string {
  return escapeHtmlWithEmphasis(
    instructionWithHeldStitches(heldShoulderStitches, showChecklist, isCardiganFront, shouldersShaped),
    activeShoulderReverseShapingEmphasis(shouldersShaped),
  );
}

/**
 * Final shoulder bind-off paragraph rendered IMMEDIATELY after the one-shoulder checklist table
 * and BEFORE any second-shoulder prompt/toggle/copy. Stitch count is read from the last rendered
 * checklist row (`stitchesRemaining`) so the line stays aligned with the visible final RC and
 * Sts Remaining cell. Returns an empty string when no row is present or no stitches remain.
 */
function renderActiveSideBindoffRemainingHtml(
  rows: readonly { stitchesRemaining: number }[],
  className = "ns-shaping-chart__active-side-bindoff",
): string {
  const last = rows.length > 0 ? rows[rows.length - 1] : undefined;
  const remaining = last ? Math.max(0, Math.floor(Number(last.stitchesRemaining ?? 0))) : 0;
  const sentence = formatShoulderBindoffRemainingInstruction(remaining);
  if (!sentence) return "";
  return `<p class="${escapeHtml(className)}" data-active-side-bindoff>${escapeHtml(sentence)}</p>`;
}

function formatActiveSideRc(rc: number): string {
  return String(Math.max(0, Math.floor(rc))).padStart(3, "0");
}

/**
 * Sts Remaining cell text for a checklist row — uses the optional divide/transition display string
 * (e.g. `50 total / 20 active`) when present, otherwise the numeric active-shoulder count.
 */
function activeSideStsRemainingCellHtml(r: ActiveSideInstructionTableRow): string {
  const override =
    typeof r.stitchesRemainingDisplay === "string" ? r.stitchesRemainingDisplay.trim() : "";
  return override ? escapeHtml(override) : String(r.stitchesRemaining);
}

/**
 * Merge consecutive “Knit in pattern” active-shoulder checklist rows when stitch counts stay the same and RCs are consecutive.
 * Used for on-screen pattern (`activeSideOnly`) and print mini-table except sleeveless-style V-neck charts (see {@link isFullWidthVNeckFrontStyleChart}).
 * Uses `plainKnitSpanCarriageEdgeDisplay` for alternating Side / Section labels.
 */
export function compactActiveSideInstructionRowsForPrint(
  rows: readonly ActiveSideInstructionTableRow[],
  options?: { invertCarriageParity?: boolean },
): ActiveSideInstructionTableRow[] {
  const out: ActiveSideInstructionTableRow[] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (row.action !== NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL) {
      out.push(row);
      i += 1;
      continue;
    }
    let j = i;
    while (
      j + 1 < rows.length &&
      rows[j + 1]!.action === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
      rows[j + 1]!.stitchesRemaining === row.stitchesRemaining &&
      rows[j + 1]!.rc === rows[j]!.rc + 1
    ) {
      j += 1;
    }
    const firstRc = row.rc;
    const lastRc = rows[j]!.rc;
    const { carriage, edge } = plainKnitSpanCarriageEdgeDisplay(firstRc, lastRc, {
      invertCarriageParity: options?.invertCarriageParity === true,
    });
    if (j > i) {
      out.push({
        rc: firstRc,
        rcEnd: lastRc,
        carriagePosition: carriage,
        action: NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL,
        edge,
        stitchesRemaining: row.stitchesRemaining,
      });
    } else {
      out.push({
        ...row,
        carriagePosition: carriage,
        edge,
      });
    }
    i = j + 1;
  }
  return out;
}

function formatActiveSideRcDisplay(r: ActiveSideInstructionTableRow): string {
  if (r.rcEnd !== undefined && r.rcEnd !== r.rc) {
    return `${formatActiveSideRc(r.rc)}\u2013${formatActiveSideRc(r.rcEnd)}`;
  }
  return formatActiveSideRc(r.rc);
}

function renderActiveSideInstructionRowsTrHtml(
  rows: readonly ActiveSideInstructionTableRow[],
  chartProgressId: string,
): string {
  return rows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      const rowId = buildActiveSideStableRowId(chartProgressId, r);
      const rcAttr = chartProgressRcAttrFromActiveRow(r);
      const doneCell = `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row RC ${escapeHtml(
        rcDisp
      )} complete" /></label></td>`;
      const carriage = String(r.carriagePosition ?? "").trim();
      // Row counter number stays prominent; the carriage side is rendered as a smaller, muted
      // parenthetical (styled in ns-shaping-chart.css). Full words only — never abbreviated to L/R.
      const rcNumberHtml = `<span class="ns-shaping-chart__row-counter-number">${escapeHtml(rcDisp)}</span>`;
      const rcSideHtml = carriage
        ? ` <span class="ns-shaping-chart__row-counter-side">(${escapeHtml(carriage)})</span>`
        : "";
      return `<tr class="ns-shaping-chart__tr" data-row-id="${escapeHtml(rowId)}" data-rc="${escapeHtml(rcAttr)}">${doneCell}<td class="ns-shaping-chart__td-rc">${rcNumberHtml}${rcSideHtml}</td><td>${formatActionCellHtml(
        r.action
      )}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-chart__td-num">${activeSideStsRemainingCellHtml(r)}</td></tr>`;
    })
    .join("");
}

function renderFullChartActionCellHtml(displayRow: NeckShoulderShapingChartDisplayRow): string {
  const action = escapeHtml(String(displayRow.actionLabel ?? ""));
  if (!displayRow.plainKnitCarriageLabel || !displayRow.plainKnitEdgeLabel) {
    return action;
  }
  return `${action}<div class="ns-shaping-chart__plain-knit-meta"><span class="ns-shaping-chart__plain-knit-side">${escapeHtml(
    displayRow.plainKnitCarriageLabel,
  )}</span><span class="ns-shaping-chart__plain-knit-meta-sep"> · </span><span class="ns-shaping-chart__plain-knit-section">${escapeHtml(
    displayRow.plainKnitEdgeLabel,
  )}</span></div>`;
}

export type NeckShoulderChartRenderOptions = {
  includeDoneColumn?: boolean;
  tableClassName?: string;
  activeSideOnly?: boolean;
  activeSideRcStart?: number;
  /**
   * Full grid chart: plain “Knit in pattern” spans are always condensed when safe (same shared logic as print).
   * When true, row labels use `RC:` prefixes and merged spans show “stitch count unchanged” in stitch columns.
   */
  compactPlainKnitSpansForPrint?: boolean;
  /**
   * When true (e.g. temporary QA), logs to the browser console if active-side plain-knit compaction merged rows.
   */
  debugLogActiveSideCompaction?: boolean;
  /**
   * When false, sleeveless-style V-neck charts keep plain-knit RC span merging (full grid + active checklist).
   * Default: one row per RC for those charts (no en-dash RC labels).
   */
  fullWidthChartOneRowPerRc?: boolean;
  /** When true (or chart flag), completion copy uses cardigan front wording and hides second-shoulder UI. */
  isCardiganFront?: boolean;
  /**
   * When false, shoulders are worked straight (drop shoulder), so the second-shoulder completion
   * copy reverses only the neckline shaping. Defaults to true (sleeveless: neckline + shoulder shaping).
   */
  shouldersShaped?: boolean;
  /** Back neckline only: prepend center divide/setup row at the timeline center-bind-off RC. */
  includeCenterNecklineSetupRow?: boolean;
  /**
   * Online only. When true, the center neckline divide/setup row is dropped from the rendered
   * checklist (it is shown instead in the "Divide the Neckline" intro section), so the table
   * begins with the first actual shaping/knit row. The row is still built with
   * {@link includeCenterNecklineSetupRow} so every other row keeps its exact RC / carriage /
   * stitch count — only the display is filtered, never the shaping math.
   */
  hideCenterNecklineSetupRow?: boolean;
  /** Heading text for the chart section (online uses "First Shoulder Checklist"). */
  tableHeading?: string;
  /**
   * When true, the whole checklist renders as a collapsible `<details>` disclosure: a full-width
   * clickable `<summary>` header bar (chevron on the left, {@link tableHeading} as the label, and a
   * `[data-chart-print-slot]` on the right for the print button) with the intro, controls, and table
   * beneath it. Collapsed shows only the header; expanded shows everything. Defaults to collapsible
   * for active-shoulder {@link tableHeading} values that include “Shoulder Checklist”; pass
   * `collapsible: false` to keep a plain `<section>` with a standalone `<h2>` heading.
   */
  collapsible?: boolean;
  /** When {@link collapsible} is true, render the disclosure initially expanded. Defaults to collapsed. */
  collapsibleDefaultOpen?: boolean;
  /**
   * Optional extra HTML inserted at the TOP of the Second Shoulder Checklist block (just under its
   * heading). Used to place the second-shoulder Shaping Map (opposite orientation from the first
   * shoulder) inside its own disclosure, so the two maps never silently swap a shared element.
   * Caller-built, already-escaped/trusted markup.
   */
  secondShoulderExtraHtml?: string;
  /**
   * When true, the collapsible Carriage Position pattern tip is NOT emitted inside the chart
   * section. Used by the sleeveless front, where that tip is relocated with the other written
   * instructions above the Visual Guides block (the carriage-position help still renders once —
   * just outside this table). Never affects the chart rows or shaping math.
   */
  suppressCarriagePositionTip?: boolean;
};

const SECOND_SHOULDER_CHECKLIST_HEADING = "Second Shoulder Checklist";

function isShoulderChecklistHeading(heading: string): boolean {
  return /shoulder checklist/i.test(heading.trim());
}

/** Centered readable column inside a full-width collapsible checklist body. */
function checklistInnerOpenHtml(): string {
  return `<div class="ns-shaping-chart__checklist-inner">`;
}

function checklistInnerCloseHtml(): string {
  return `</div>`;
}

/**
 * Print-only anchor: in-flow checklist heading immediately before table content. The on-screen
 * `<summary>` header stays for accordion behavior; print CSS hides it and shows this heading
 * inside the disclosure body so pagination cannot orphan the title from the table start.
 */
function wrapChecklistPrintLeadHtml(
  title: string,
  headingId: string,
  innerHtml: string,
): string {
  const printHeadingId = `${headingId}-print`;
  return `<div class="ns-shaping-chart__print-lead" data-checklist-print-lead aria-labelledby="${escapeHtml(printHeadingId)}">
    <h4 id="${escapeHtml(printHeadingId)}" class="ns-shaping-chart__print-lead-heading">${escapeHtml(title)}</h4>
    ${innerHtml}
  </div>`;
}

function collapsibleChecklistShellHtml(
  sectionClass: string,
  headingId: string,
  title: string,
  options?: {
    open?: boolean;
    hidden?: boolean;
    includePrintSlot?: boolean;
    extraClass?: string;
    dataSecondShoulderContent?: boolean;
  },
): { open: string; close: string } {
  const extraClass = options?.extraClass ? ` ${options.extraClass}` : "";
  const hiddenAttr = options?.hidden ? " hidden" : "";
  const openAttr = options?.open ? " open" : "";
  const dataAttr = options?.dataSecondShoulderContent ? " data-second-shoulder-content" : "";
  const printSlot = options?.includePrintSlot !== false
    ? `<span class="ns-shaping-chart__disclosure-actions" data-chart-print-slot></span>`
    : "";
  return {
    open: `<details class="${escapeHtml(`${sectionClass} ns-shaping-chart--collapsible${extraClass}`)}"${dataAttr}${hiddenAttr}${openAttr}>
  <summary class="ns-shaping-chart__disclosure-header">
    <span class="ns-shaping-chart__disclosure-chevron" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
    <span id="${escapeHtml(headingId)}" class="ns-shaping-chart__title ns-shaping-chart__disclosure-title">${escapeHtml(title)}</span>
    ${printSlot}
  </summary>
  <div class="ns-shaping-chart__disclosure-body">
  ${checklistInnerOpenHtml()}`,
    close: `${checklistInnerCloseHtml()}
</div>
</details>`,
  };
}

function activeShoulderChecklistOptions(
  options?: NeckShoulderChartRenderOptions,
): { includeCenterNecklineSetupRow?: boolean } | undefined {
  return options?.includeCenterNecklineSetupRow === true
    ? { includeCenterNecklineSetupRow: true }
    : undefined;
}

function chartBodyRowsHtml(
  chart: NeckShoulderShapingChart,
  chartProgressId: string,
  options?: NeckShoulderChartRenderOptions,
): string {
  const activeSideOnly = options?.activeSideOnly === true;
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const includeDoneColumn = activeSideOnly ? true : options?.includeDoneColumn !== false;
  const compactPrint = options?.compactPlainKnitSpansForPrint === true;
  const rowLabelStyle = compactPrint ? "print" : "online";
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  if (activeSideOnly) {
    let activeRows = buildActiveSideInstructionTableRows(
      chart,
      activeSideRcStart,
      activeShoulderChecklistOptions(options),
    );
    if (options?.hideCenterNecklineSetupRow === true) {
      activeRows = activeRows.filter((r) => !isCenterNecklineSetupChecklistRow(r));
    }
    const activeRowsBeforeCompact = activeRows.length;
    /** Plain-knit merge matches full-chart rules except sleeveless V-neck (one RC per row). */
    if (!vNeckStyleOneRowPerRc) {
      activeRows = compactActiveSideInstructionRowsForPrint(activeRows);
    }
    if (
      import.meta.env.DEV &&
      options?.debugLogActiveSideCompaction === true &&
      activeRowsBeforeCompact > activeRows.length
    ) {
      console.debug("[kbm neck-shoulder] Active-side plain-knit compaction applied", {
        rowsBefore: activeRowsBeforeCompact,
        rowsAfter: activeRows.length,
      });
    }
    return renderActiveSideInstructionRowsTrHtml(activeRows, chartProgressId);
  }
  const displayRows = vNeckStyleOneRowPerRc
    ? chartDisplayRowsOnePerRc(chart.rows, { rowLabelStyle })
    : collapsePlainKnitChartRowsForDisplay(chart.rows, { rowLabelStyle });
  return displayRows
    .map((displayRow) => {
      const r = displayRow.sourceRow;
      const hi = getNeckShoulderChartRowHighlightFromRow(r);
      const trClass = rowClassFromHighlight(hi);
      const rowNum = Math.max(0, Math.floor(r.row));
      const rowStableId = buildFullChartStableRowId(chartProgressId, displayRow);
      const rcAttr = chartProgressRcAttrFromGarmentRow(r);
      const doneCell = includeDoneColumn
        ? `<td class="ns-shaping-chart__td-complete"><label class="ns-shaping-chart__row-check-label"><input type="checkbox" class="ns-shaping-chart__row-check" aria-label="Mark chart row ${rowNum} complete" /></label></td>`
        : "";
      const mergedPlainSpan =
        compactPrint &&
        displayRow.actionLabel === NECK_SHOULDER_PRINT_KNIT_EVEN_LABEL &&
        displayRow.rowLabel.includes("\u2013");
      const stitchLeft = mergedPlainSpan ? "stitch count unchanged" : String(r.leftStitchCount);
      const stitchRight = mergedPlainSpan ? "stitch count unchanged" : String(r.rightStitchCount);
      const dataAttrs = ` data-row-id="${escapeHtml(rowStableId)}" data-rc="${escapeHtml(rcAttr)}"`;
      return `<tr class="${trClass}"${dataAttrs}>${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(displayRow.rowLabel)}</td><td>${renderFullChartActionCellHtml(
        displayRow,
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.leftSide)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.leftNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.centerNeck)}</td><td class="ns-shaping-chart__td-center">${escapeHtml(
        r.rightNeck
      )}</td><td class="ns-shaping-chart__td-center">${escapeHtml(r.rightSide)}</td><td class="ns-shaping-chart__td-num">${escapeHtml(
        stitchLeft
      )}</td><td class="ns-shaping-chart__td-num">${escapeHtml(stitchRight)}</td></tr>`;
    })
    .join("");
}

/** True when the rendered chart table includes a dedicated Carriage Position column. */
export function neckShoulderChartHasCarriagePositionColumn(
  options?: NeckShoulderChartRenderOptions,
): boolean {
  return options?.activeSideOnly === true;
}

/** Collapsible Pattern Tip for the Carriage Position column; empty when the column is absent. */
export function renderCarriagePositionPatternTipHtml(options?: NeckShoulderChartRenderOptions): string {
  return neckShoulderChartHasCarriagePositionColumn(options) ? carriagePositionHelpCardHtml() : "";
}

/** Chart title and table only (no neckline/shoulder diagram block). */
export function renderNeckShoulderShapingChartTableOnlyHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart",
  introHtml?: string,
  options?: NeckShoulderChartRenderOptions
): string {
  const headingId = `${idPrefix}-heading`;
  const introParts = [
    typeof introHtml === "string" && introHtml.trim() ? introHtml : "",
    options?.suppressCarriagePositionTip === true ? "" : renderCarriagePositionPatternTipHtml(options),
  ].filter((part) => part.trim());
  const intro = introParts.join("\n");
  const includeDoneColumnOption = options?.includeDoneColumn !== false;
  const activeSideOnly = options?.activeSideOnly === true;
  const progressChartIdPrimary = activeSideOnly ? `${idPrefix}-primary` : idPrefix;
  const progressChartIdSecondary = `${idPrefix}-secondary`;
  const rowsHtml = chartBodyRowsHtml(chart, progressChartIdPrimary, options);

  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  const activeRowsBuilt = activeSideOnly
    ? buildActiveSideInstructionTableRows(chart, activeSideRcStart, activeShoulderChecklistOptions(options))
    : [];
  const activeRowsRaw =
    options?.hideCenterNecklineSetupRow === true
      ? activeRowsBuilt.filter((r) => !isCenterNecklineSetupChecklistRow(r))
      : activeRowsBuilt;
  const oppositeRowsPrep = buildSecondShoulderInstructionTableRows(activeRowsRaw);
  const oppositeRowsHtml = activeSideOnly
    ? renderActiveSideInstructionRowsTrHtml(
        vNeckStyleOneRowPerRc
          ? oppositeRowsPrep
          : compactActiveSideInstructionRowsForPrint(oppositeRowsPrep, { invertCarriageParity: true }),
        progressChartIdSecondary,
      )
    : "";
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const isCardiganFront = activeShoulderIntroIsCardiganFront({
    chart,
    isCardiganFront: options?.isCardiganFront,
  });
  const shouldersShaped = options?.shouldersShaped !== false;
  const showDoneColumn = activeSideOnly ? true : includeDoneColumnOption;
  const tableClassName = String(options?.tableClassName ?? "").trim();
  const sectionClass = tableClassName ? `ns-shaping-chart ${tableClassName}` : "ns-shaping-chart";
  // Online First/Second Shoulder checklists get zebra striping + checklist-specific column
  // alignment (see ns-shaping-chart.css). The full-grid chart keeps its own row highlight colors.
  const tableElementClass = activeSideOnly
    ? "ns-shaping-chart__table ns-shaping-chart__table--checklist"
    : "ns-shaping-chart__table";
  const doneHeaderFullGrid = `<th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>`;
  const doneHeaderActiveSide = `<th scope="col" rowspan="1" class="ns-shaping-chart__th-complete" aria-label="Completion status">Done</th>`;
  /** Active-shoulder neckline checklist only — not used on body/sleeve shaping charts. */
  const activeSideRcHeader = `<th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC <span class="ns-shaping-chart__row-counter-side">(carriage side)</span></th>`;
  const doneLeadingCell = activeSideOnly
    ? showDoneColumn
      ? doneHeaderActiveSide
      : ""
    : showDoneColumn
      ? doneHeaderFullGrid
      : "";

  const progressToolbarHtml = renderNsChartProgressToolbarHtml();

  const tableHeading =
    typeof options?.tableHeading === "string" && options.tableHeading.trim()
      ? options.tableHeading.trim()
      : "Neckline / Shoulder Shaping Chart";
  const shoulderChecklist = activeSideOnly && isShoulderChecklistHeading(tableHeading);
  const collapsible =
    options?.collapsible === true ||
    (options?.collapsible !== false && shoulderChecklist);
  const collapsibleOpen = options?.collapsibleDefaultOpen === true;

  const primaryTableHtml = `<div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdPrimary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="${tableElementClass}">
      <thead>
        <tr>
          ${doneLeadingCell}
          ${
            activeSideOnly
              ? `${activeSideRcHeader}
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-num">Sts Remaining</th>`
              : `<th scope="col" rowspan="2" class="ns-shaping-chart__th-row">Row</th>
          <th scope="col" rowspan="2" class="ns-shaping-chart__th-action">Action</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Left</th>
          <th scope="colgroup" colspan="1" class="ns-shaping-chart__th-group">Center</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Right</th>
          <th scope="colgroup" colspan="2" class="ns-shaping-chart__th-group">Stitch count</th>`
          }
        </tr>
        ${
          activeSideOnly
            ? ""
            : `<tr>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck center</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Neck</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Armhole</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Left</th>
          <th scope="col" class="ns-shaping-chart__th-sub">Right</th>
        </tr>`
        }
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    </div>
    </div>
  </div>`;

  const secondShoulderTableHtml = `<div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdSecondary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="${tableElementClass}">
      <thead>
        <tr>
          ${doneHeaderActiveSide}
          ${activeSideRcHeader}
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-num">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${oppositeRowsHtml}</tbody>
    </table>
    </div>
    </div>
  </div>`;

  const secondShoulderToggleHtml = `<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--collapsed" data-second-shoulder-default-instruction>${instructionWithHeldStitchesHtml(
    heldShoulderStitches,
    false,
    false,
    shouldersShaped,
  )}</p>
<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--expanded" data-second-shoulder-checked-instruction hidden>${instructionWithHeldStitchesHtml(
    heldShoulderStitches,
    true,
    false,
    shouldersShaped,
  )}</p>
<div class="ns-shaping-chart__second-shoulder-toggle no-print">
  <p class="ns-shaping-chart__second-shoulder-toggle-copy">Want less mental reversing? Show a ready-made checklist for the second shoulder.</p>
  <label class="ns-shaping-chart__second-shoulder-label">
    <input type="checkbox" class="ns-shaping-chart__second-shoulder-input" data-second-shoulder-toggle />
    Show second shoulder checklist
  </label>
</div>`;

  const secondShoulderHeadingId = `${idPrefix}-second-heading`;
  const secondShoulderExtra =
    typeof options?.secondShoulderExtraHtml === "string" ? options.secondShoulderExtraHtml : "";

  const secondShoulderCollapsibleHtml = collapsible
    ? (() => {
        const shell = collapsibleChecklistShellHtml(
          sectionClass,
          secondShoulderHeadingId,
          SECOND_SHOULDER_CHECKLIST_HEADING,
          {
            open: true,
            hidden: true,
            includePrintSlot: false,
            extraClass: "ns-shaping-chart--second-shoulder",
            dataSecondShoulderContent: true,
          },
        );
        return `${shell.open}
  ${wrapChecklistPrintLeadHtml(
    SECOND_SHOULDER_CHECKLIST_HEADING,
    secondShoulderHeadingId,
    `${secondShoulderExtra}
  ${secondShoulderTableHtml}`,
  )}
${shell.close}`;
      })()
    : "";

  const secondShoulderLegacyHtml = !collapsible
    ? `<div class="ns-shaping-chart__second-shoulder-block" data-second-shoulder-content hidden>
  <h3 class="ns-shaping-chart__preview-title">${SECOND_SHOULDER_CHECKLIST_HEADING}</h3>
  ${secondShoulderExtra}
  ${secondShoulderTableHtml}
</div>`
    : "";

  const activeSideTailHtml =
    activeSideOnly && !isCardiganFront
      ? `${secondShoulderToggleHtml}
${collapsible ? secondShoulderCollapsibleHtml : secondShoulderLegacyHtml}`
      : activeSideOnly && isCardiganFront
        ? `<p class="ns-shaping-chart__active-side-note">${instructionWithHeldStitchesHtml(
            heldShoulderStitches,
            false,
            true,
            shouldersShaped,
          )}</p>`
        : "";

  const primaryTableForBody = collapsible
    ? wrapChecklistPrintLeadHtml(tableHeading, headingId, primaryTableHtml)
    : primaryTableHtml;

  const checklistBodyHtml = `${intro}
  ${primaryTableForBody}
  ${activeSideOnly ? renderActiveSideBindoffRemainingHtml(activeRowsRaw) : ""}
  ${activeSideTailHtml}`;

  if (collapsible) {
    const shell = collapsibleChecklistShellHtml(sectionClass, headingId, tableHeading, {
      open: collapsibleOpen,
      includePrintSlot: true,
    });
    return `${shell.open}
  ${checklistBodyHtml}
${shell.close}`;
  }

  const innerWrap = shoulderChecklist
    ? { open: checklistInnerOpenHtml(), close: checklistInnerCloseHtml() }
    : { open: "", close: "" };

  return `<section class="${escapeHtml(sectionClass)}" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">${escapeHtml(tableHeading)}</h2>
  ${innerWrap.open}
  ${checklistBodyHtml}
  ${innerWrap.close}
</section>`;
}

/**
 * Print-only compact written shaping rows for ink-efficient printouts.
 * Pass `options.activeSideRcStart` as the Armhole RC at the first checklist row (continuous with
 * the armhole counter after the sole armhole RC reset). Defaults to 0 when unknown.
 */
export function renderNeckShoulderShapingPrintInstructionTableHtml(
  chart: NeckShoulderShapingChart,
  idPrefix = "ns-shaping-chart-print",
  introHtml?: string,
  options?: {
    showSecondShoulderChecklist?: boolean;
    activeSideRcStart?: number;
    fullWidthChartOneRowPerRc?: boolean;
    isCardiganFront?: boolean;
    includeCenterNecklineSetupRow?: boolean;
  },
): string {
  const headingId = `${idPrefix}-heading`;
  const intro = typeof introHtml === "string" && introHtml.trim() ? introHtml : "";
  const activeSideRcStart = Math.max(0, Math.floor(Number(options?.activeSideRcStart ?? 0)));
  const isCardiganFront = activeShoulderIntroIsCardiganFront({
    chart,
    isCardiganFront: options?.isCardiganFront,
  });
  const printRowsRaw = buildActiveSideInstructionTableRows(
    chart,
    activeSideRcStart,
    options?.includeCenterNecklineSetupRow === true ? { includeCenterNecklineSetupRow: true } : undefined,
  );
  const vNeckStyleOneRowPerRc =
    isFullWidthVNeckFrontStyleChart(chart) && options?.fullWidthChartOneRowPerRc !== false;
  const printRows = vNeckStyleOneRowPerRc
    ? printRowsRaw
    : compactActiveSideInstructionRowsForPrint(printRowsRaw);
  const showSecondShoulderChecklist =
    !isCardiganFront && options?.showSecondShoulderChecklist === true;
  const oppositePrintRowsRaw = buildSecondShoulderInstructionTableRows(printRowsRaw);
  const oppositePrintRows = vNeckStyleOneRowPerRc
    ? oppositePrintRowsRaw
    : compactActiveSideInstructionRowsForPrint(oppositePrintRowsRaw, { invertCarriageParity: true });
  const heldShoulderStitches = Math.max(0, Math.floor(Number(chart.rows[0]?.leftStitchCount ?? 0)));
  const rowsHtml = printRows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${formatActionCellHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${activeSideStsRemainingCellHtml(r)}</td></tr>`;
    })
    .join("");
  const oppositeRowsHtml = oppositePrintRows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${formatActionCellHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${activeSideStsRemainingCellHtml(r)}</td></tr>`;
    })
    .join("");
  return `<section class="ns-shaping-mini" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-mini__title">Neckline / Shoulder Shaping</h2>
  ${intro}
  <div class="ns-shaping-mini__wrap">
    <table class="ns-shaping-mini__table">
      <thead>
        <tr>
          <th scope="col">RC</th>
          <th scope="col">Carriage Position</th>
          <th scope="col">Action</th>
          <th scope="col">Edge</th>
          <th scope="col">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  ${renderActiveSideBindoffRemainingHtml(printRowsRaw, "ns-shaping-mini__bindoff-remaining")}
  <p class="ns-shaping-mini__sts-note">Sts Remaining is for this side only.</p>
  <p class="ns-shaping-mini__sts-note">${instructionWithHeldStitchesHtml(heldShoulderStitches, false, isCardiganFront)}</p>
  ${
    showSecondShoulderChecklist
      ? `<section class="ns-shaping-mini__second-shoulder">
    <h3 class="ns-shaping-mini__title">Second Shoulder Checklist</h3>
    <div class="ns-shaping-mini__wrap">
      <table class="ns-shaping-mini__table">
        <thead>
          <tr>
            <th scope="col">RC</th>
            <th scope="col">Carriage Position</th>
            <th scope="col">Action</th>
            <th scope="col">Edge</th>
            <th scope="col">Sts Remaining</th>
          </tr>
        </thead>
        <tbody>${oppositeRowsHtml}</tbody>
      </table>
    </div>
    <p class="ns-shaping-mini__sts-note">${instructionWithHeldStitchesHtml(heldShoulderStitches, true, isCardiganFront)}</p>
  </section>`
      : ""
  }
</section>`;
}
