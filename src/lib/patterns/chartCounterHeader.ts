/**
 * Chart-header sentences that name which row counter a checklist uses.
 * Row numbers and shaping stay where they are; only the header copy changes.
 */

export const ARMHOLE_RC_CHART_COUNTER_NOTE =
  "Continue using Armhole RC, reset to 000 at the start of the armhole. Do not reset the counter again for this chart.";

export const CONTINUOUS_PIECE_CHART_COUNTER_NOTE =
  "RC continues from the start of this piece. Do not reset the counter for this chart.";

export const CUFF_UP_SLEEVE_BODY_CHART_COUNTER_NOTE =
  "Row counter was reset to RC: 000 after the cuff. Readings use that counter.";

export const CUFF_UP_SLEEVE_CAP_CHART_COUNTER_NOTE =
  "Continue using the sleeve row counter, reset to RC: 000 after the cuff. Do not reset the counter again for this chart.";

export const SLEEVE_FROM_CAST_ON_CHART_COUNTER_NOTE =
  "RC starts at 000 with this sleeve. Readings use that counter.";

export const SLEEVE_CAP_FROM_CAST_ON_CHART_COUNTER_NOTE =
  "Continue using the sleeve row counter from RC: 000. Do not reset the counter again for this chart.";

export const CHART_COUNTER_RESET_BEFORE_THIS_CHART =
  "Row counter was reset to RC: 000 before this chart. Readings use that counter.";

export const CHART_COUNTER_PIECE_ROW_COUNTER = "RC is the row counter for this piece.";

export function chartUsesArmholeRowCounter(args: {
  necklineStartLocalRc?: number | null;
  continuousGarmentRc?: boolean;
}): boolean {
  if (args.continuousGarmentRc === true) return false;
  const local = args.necklineStartLocalRc;
  if (typeof local === "number" && Number.isFinite(local) && local < 0) return false;
  return true;
}

export function setInNecklineChartCounterNote(args: {
  necklineStartLocalRc?: number | null;
  continuousGarmentRc?: boolean;
}): string {
  return chartUsesArmholeRowCounter(args)
    ? ARMHOLE_RC_CHART_COUNTER_NOTE
    : CONTINUOUS_PIECE_CHART_COUNTER_NOTE;
}

export function cuffUpSleeveShapingChartCounterNote(cuffWasReset: boolean): string {
  return cuffWasReset ? CUFF_UP_SLEEVE_BODY_CHART_COUNTER_NOTE : SLEEVE_FROM_CAST_ON_CHART_COUNTER_NOTE;
}

export function cuffUpSleeveCapChartCounterNote(cuffWasReset: boolean): string {
  return cuffWasReset ? CUFF_UP_SLEEVE_CAP_CHART_COUNTER_NOTE : SLEEVE_CAP_FROM_CAST_ON_CHART_COUNTER_NOTE;
}

/** Print banners use an explicit chart note when the chart names its own counter. */
export function resolveChartCounterHeader(args: {
  explicitNote?: string | null;
  resetBeforeChart: boolean;
}): string {
  const explicit = String(args.explicitNote ?? "").replace(/\s+/g, " ").trim();
  if (explicit) return explicit;
  return args.resetBeforeChart ? CHART_COUNTER_RESET_BEFORE_THIS_CHART : CHART_COUNTER_PIECE_ROW_COUNTER;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Visible chart header, screen summary, or the copy that prints when the summary is hidden. */
export function chartCounterNoteHtml(
  note: string | undefined,
  kind: "visible" | "summary" | "print" = "visible",
): string {
  const text = String(note ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const classes =
    kind === "summary"
      ? "ns-shaping-chart__counter-note ns-shaping-chart__counter-note--summary no-print"
      : kind === "print"
        ? "ns-shaping-chart__counter-note ns-shaping-chart__counter-note--print"
        : "ns-shaping-chart__counter-note";
  return `<p class="${classes}" data-chart-counter-note>${escapeHtml(text)}</p>`;
}
