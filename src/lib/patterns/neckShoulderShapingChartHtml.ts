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
  ACTIVE_VNECK_CENTER_DIVIDE_TAIL,
  activeShoulderCenterDivideIntroApplies,
  activeShoulderIntroIsCardiganFront,
  activeShoulderIntroUsesVNeckDivideCopy,
  CARDIGAN_FRONT_NECKLINE_START_TAIL,
  CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE,
  CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE,
  SCRAP_OFF_GLOSSARY_ID,
} from "./neckShoulderActiveIntroCopy";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  armholeLocalRcFirstActiveSideNecklineShapingAction,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
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
      <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-toggle-hide" data-chart-progress-toggle-hide aria-pressed="false">Hide completed rows</button>
      <button type="button" class="ns-shaping-chart__progress-btn ns-shaping-chart__progress-reset" data-chart-progress-reset>Reset checklist</button>
    </div>
    <p class="ns-shaping-chart__progress-hide-status" data-chart-progress-hide-status role="status" aria-live="polite"><span class="ns-shaping-chart__progress-hide-status-mark" aria-hidden="true"></span><span data-chart-progress-hide-status-text>Completed rows are visible.</span></p>
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
  "Repeat the table and shaping diagram logic for the second side, reversing the edge landmarks.";
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
  /** Host-specific wrapper class (`print-chart-intro` vs `pattern-shaping-intro`). */
  wrapperClass: string;
  /** Reserved for callers (online vs print); intro wording is the same for both layouts. */
  layout: ActiveShoulderChartIntroLayout;
};

function scrapOffGlossaryPlaceholderHtml(): string {
  return buildGlossaryTooltipPlaceholderHtml(
    SCRAP_OFF_GLOSSARY_ID,
    "Scrap off",
    (s) => s.replace(/"/g, "&quot;"),
    (s) => s,
  );
}

/** HTML center-neckline divide line with glossary on “Scrap off” (plain-text twin in intro copy module). */
function formatActiveShoulderCenterNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
  centerBindOffStitches?: number | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const centerCount = Number(args.centerBindOffStitches);
  const centerCountLabel =
    Number.isFinite(centerCount) && centerCount > 0 ? String(Math.round(centerCount)) : "";
  const scrapOff = scrapOffGlossaryPlaceholderHtml();
  const scrapOffTail = centerCountLabel
    ? `${scrapOff} the center ${escapeHtml(centerCountLabel)} neckline stitches to divide the neckline`
    : `${scrapOff} the center neckline stitches to divide the neckline`;
  const rcColon = localStartLabel.match(/^RC:(\d{1,4})$/i);
  if (rcColon) {
    const n = String(Math.max(0, parseInt(rcColon[1], 10))).padStart(3, "0");
    return `When Armhole RC reaches ${escapeHtml(n)}, ${scrapOffTail}.`;
  }
  if (localStartLabel) {
    return `At ${escapeHtml(localStartLabel)}, ${scrapOffTail}.`;
  }
  return `${scrapOffTail.charAt(0).toUpperCase()}${scrapOffTail.slice(1)}.`;
}

/** HTML V-neck center divide line (no scrap-off / bind-off wording). */
function formatActiveShoulderVNeckCenterNecklineHtml(args: {
  localStartRcLabel?: string | undefined;
}): string {
  const localStartLabel = String(args.localStartRcLabel ?? "").trim();
  const tail = escapeHtml(ACTIVE_VNECK_CENTER_DIVIDE_TAIL);
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
    innerParts.push(`<p>${escapeHtml(CARDIGAN_FRONT_SHAPING_TOGETHER_SENTENCE)}</p>`);
    return `<div class="${escapeHtml(wrappedClass)}">
  ${innerParts.join("\n  ")}
</div>`;
  }

  const vNeckDivide = activeShoulderIntroUsesVNeckDivideCopy(options.chart);
  const roundCenterDivide =
    !vNeckDivide &&
    activeShoulderCenterDivideIntroApplies(options.centerBindOffStitches, options.chart);
  const showCenterDivide = vNeckDivide || roundCenterDivide;
  const centerHtml = vNeckDivide
    ? formatActiveShoulderVNeckCenterNecklineHtml({ localStartRcLabel: options.localStartRcLabel })
    : roundCenterDivide
      ? formatActiveShoulderCenterNecklineHtml({
          localStartRcLabel: options.localStartRcLabel,
          centerBindOffStitches: options.centerBindOffStitches,
        })
      : "";
  const innerParts: string[] = [];
  if (showCenterDivide && centerHtml) {
    innerParts.push(`<p><strong>Center Neckline:</strong><br>${centerHtml}</p>`);
    innerParts.push(
      `<p><strong>Divide:</strong><br>${escapeHtml(ACTIVE_SHOULDER_DIVIDE_SENTENCE)}</p>`,
    );
  }
  innerParts.push(`<p>${escapeHtml(ACTIVE_SHOULDER_CHART_INTRO_SENTENCE)}</p>`);
  const inner = innerParts.join("\n  ");

  return `<div class="${escapeHtml(wrappedClass)}">
  ${inner}
</div>`;
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
): string {
  if (isCardiganFront) {
    return CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE;
  }
  const held = Math.max(0, Math.floor(heldShoulderStitches));
  const suffix = showChecklist ? SECOND_SIDE_CHECKLIST_INSTRUCTION_SUFFIX : SECOND_SIDE_INSTRUCTION_SUFFIX;
  return `Once this side is complete, cut yarn and rehang the remaining ${held} stitches. ${suffix}`;
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
      return `<tr class="ns-shaping-chart__tr" data-row-id="${escapeHtml(rowId)}" data-rc="${escapeHtml(rcAttr)}">${doneCell}<td class="ns-shaping-chart__td-num">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-chart__td-num">${r.stitchesRemaining}</td></tr>`;
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
  /** Back neckline only: prepend center divide/setup row at the timeline center-bind-off RC. */
  includeCenterNecklineSetupRow?: boolean;
};

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
    renderCarriagePositionPatternTipHtml(options),
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
  const activeRowsRaw = activeSideOnly
    ? buildActiveSideInstructionTableRows(chart, activeSideRcStart, activeShoulderChecklistOptions(options))
    : [];
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
  const showDoneColumn = activeSideOnly ? true : includeDoneColumnOption;
  const tableClassName = String(options?.tableClassName ?? "").trim();
  const sectionClass = tableClassName ? `ns-shaping-chart ${tableClassName}` : "ns-shaping-chart";
  const doneHeaderFullGrid = `<th scope="col" rowspan="2" class="ns-shaping-chart__th-complete" aria-label="Completion status">
            Done
          </th>`;
  const doneHeaderActiveSide = `<th scope="col" rowspan="1" class="ns-shaping-chart__th-complete" aria-label="Completion status">Done</th>`;
  const doneLeadingCell = activeSideOnly
    ? showDoneColumn
      ? doneHeaderActiveSide
      : ""
    : showDoneColumn
      ? doneHeaderFullGrid
      : "";

  const progressToolbarHtml = renderNsChartProgressToolbarHtml();

  return `<section class="${escapeHtml(sectionClass)}" aria-labelledby="${escapeHtml(headingId)}">
  <h2 id="${escapeHtml(headingId)}" class="ns-shaping-chart__title">Neckline / Shoulder Shaping Chart</h2>
  ${intro}
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdPrimary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneLeadingCell}
          ${
            activeSideOnly
              ? `<th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Carriage Position</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Sts Remaining</th>`
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
  </div>
  ${activeSideOnly ? renderActiveSideBindoffRemainingHtml(activeRowsRaw) : ""}
  ${
    activeSideOnly
      ? isCardiganFront
        ? `<p class="ns-shaping-chart__active-side-note">${escapeHtml(
            instructionWithHeldStitches(heldShoulderStitches, false, true),
          )}</p>`
        : `<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--collapsed" data-second-shoulder-default-instruction>${escapeHtml(
          instructionWithHeldStitches(heldShoulderStitches, false, false)
        )}</p>
<p class="ns-shaping-chart__active-side-note ns-shaping-chart__active-side-note--expanded" data-second-shoulder-checked-instruction hidden>${escapeHtml(
          instructionWithHeldStitches(heldShoulderStitches, true, false)
        )}</p>
<div class="ns-shaping-chart__second-shoulder-toggle no-print">
  <p class="ns-shaping-chart__second-shoulder-toggle-copy">Want less mental reversing? Show a second checklist for the opposite shoulder.</p>
  <label class="ns-shaping-chart__second-shoulder-label">
    <input type="checkbox" class="ns-shaping-chart__second-shoulder-input" data-second-shoulder-toggle />
    Show second shoulder checklist
  </label>
</div>
<div class="ns-shaping-chart__second-shoulder-block" data-second-shoulder-content hidden>
  <h3 class="ns-shaping-chart__preview-title">Second Shoulder Checklist</h3>
  <div class="ns-shaping-chart__progress-section" data-chart-id="${escapeHtml(progressChartIdSecondary)}">
    ${progressToolbarHtml}
    <div class="ns-shaping-chart__table-wrap">
    <div class="ns-shaping-chart__table-scroll">
    <table class="ns-shaping-chart__table">
      <thead>
        <tr>
          ${doneHeaderActiveSide}
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-row">RC</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Carriage Position</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-action">Action</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Edge</th>
          <th scope="col" rowspan="1" class="ns-shaping-chart__th-group">Sts Remaining</th>
        </tr>
      </thead>
      <tbody>${oppositeRowsHtml}</tbody>
    </table>
    </div>
    </div>
  </div>
</div>`
      : ""
  }
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
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${r.stitchesRemaining}</td></tr>`;
    })
    .join("");
  const oppositeRowsHtml = oppositePrintRows
    .map((r) => {
      const rcDisp = formatActiveSideRcDisplay(r);
      return `<tr class="ns-shaping-mini__row"><td class="ns-shaping-mini__rc">${escapeHtml(
        rcDisp
      )}</td><td>${escapeHtml(r.carriagePosition)}</td><td>${escapeHtml(r.action)}</td><td>${escapeHtml(
        r.edge
      )}</td><td class="ns-shaping-mini__sts">${r.stitchesRemaining}</td></tr>`;
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
  <p class="ns-shaping-mini__sts-note">${escapeHtml(instructionWithHeldStitches(heldShoulderStitches, false, isCardiganFront))}</p>
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
    <p class="ns-shaping-mini__sts-note">${escapeHtml(instructionWithHeldStitches(heldShoulderStitches, true, isCardiganFront))}</p>
  </section>`
      : ""
  }
</section>`;
}
