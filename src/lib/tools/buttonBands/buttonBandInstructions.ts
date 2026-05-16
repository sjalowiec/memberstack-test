import type { ButtonBandMathSuccess, ButtonholeSegment } from "./buttonBandTypes";

export const TURNING_ROW_TOOLTIP_TEXT =
  "A turning row creates a clean fold line so the band can fold neatly to the inside.";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Inline tooltip markup matching site Tooltip component structure. */
export function turningRowTooltipMarkup(triggerLabel = "turning row"): string {
  return `<span class="tooltip tooltip-term tooltip--top" tabindex="0"><span class="tooltip-trigger">${escapeHtml(triggerLabel)}</span><span class="tooltip-text" role="tooltip">${escapeHtml(TURNING_ROW_TOOLTIP_TEXT)}</span></span>`;
}

function segmentInstructionLine(segment: ButtonholeSegment): string {
  if (segment.type === "knit") {
    if (segment.label === "Start offset") {
      return `Knit ${segment.stitches} stitch${segment.stitches === 1 ? "" : "es"} for the start offset.`;
    }
    if (segment.label === "End offset") {
      return `Knit ${segment.stitches} stitch${segment.stitches === 1 ? "" : "es"} for the end offset.`;
    }
    return `Knit ${segment.stitches} stitch${segment.stitches === 1 ? "" : "es"} between buttonholes.`;
  }
  return `Make ${segment.label.toLowerCase()} over ${segment.stitches} stitch${segment.stitches === 1 ? "" : "es"} using your preferred buttonhole method.`;
}

function buttonholeDetailLines(result: ButtonBandMathSuccess): string[] {
  return result.buttonholeSegments.map(
    (segment) => `  - ${segmentInstructionLine(segment)}`,
  );
}

/**
 * Turns a successful math result into numbered, knitter-friendly instructions
 * for a folded (doubled) button band.
 */
export function formatButtonBandInstructions(result: ButtonBandMathSuccess): string[] {
  const buttonholeLines = buttonholeDetailLines(result);

  return [
    `Pick up or cast on ${result.castOnStitches} stitch${result.castOnStitches === 1 ? "" : "es"} along the cardigan edge.`,
    `Knit to RC ${result.firstButtonholeRow}.`,
    "Work the first set of buttonholes across the row:",
    ...buttonholeLines,
    `Continue knitting to RC ${result.turningRow}.`,
    "Knit 1 turning row.",
    "Knit the second side of the band.",
    `At RC ${result.secondButtonholeRow}, work the matching set of buttonholes again:`,
    ...buttonholeLines,
    `Continue knitting to RC ${result.finalRow}.`,
    "Bind off.",
    "Fold the band on the turning row and stitch it down.",
  ];
}

/** HTML list for tool results panel (includes turning-row tooltip markup). */
export function formatButtonBandInstructionsHtml(result: ButtonBandMathSuccess): string {
  const buttonholeLines = buttonholeDetailLines(result);
  const steps: Array<string | string[]> = [
    `Pick up or cast on ${result.castOnStitches} stitch${result.castOnStitches === 1 ? "" : "es"} along the cardigan edge.`,
    `Knit to RC ${result.firstButtonholeRow}.`,
    "Work the first set of buttonholes across the row:",
    buttonholeLines,
    `Continue knitting to RC ${result.turningRow}.`,
    `Knit 1 ${turningRowTooltipMarkup()}.`,
    "Knit the second side of the band.",
    `At RC ${result.secondButtonholeRow}, work the matching set of buttonholes again:`,
    buttonholeLines,
    `Continue knitting to RC ${result.finalRow}.`,
    "Bind off.",
    `Fold the band on the ${turningRowTooltipMarkup()} and stitch it down.`,
  ];

  const items = steps
    .flatMap((step) => (Array.isArray(step) ? step : [step]))
    .map((step) => {
      if (step.startsWith("  - ")) {
        return `<li class="bb-instruction-sub">${escapeHtml(step.slice(4))}</li>`;
      }
      return `<li>${step}</li>`;
    })
    .join("");

  return `<ol class="bb-instructions-list">${items}</ol>`;
}
