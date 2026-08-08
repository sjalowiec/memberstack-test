/**
 * Required Swirl Top TRANSFER STEP markers (NOT pattern tips).
 *
 * One full callout before decrease rows explains the technique and icon.
 * After each applicable decrease row, only the same transfer icon repeats.
 */

/** Public asset path for the supplied transfer-step icon. */
export const HAT_TRANSFER_STEP_ICON_SRC = "/icons/patterns/transfer-step.svg";

export const HAT_TRANSFER_STEP_LABEL = "TRANSFER STEP";

export const HAT_TRANSFER_STEP_CALLOUT_BODY =
  "Using a garter bar or your preferred method, transfer all stitches to fill the empty needles, then knit across the row.";

export const HAT_TRANSFER_STEP_ICON_EXPLAIN =
  "Work this transfer step whenever you see this icon.";

/** Accessible meaning for each repeated row icon. */
export const HAT_TRANSFER_STEP_MARKER_ARIA_LABEL =
  "Transfer stitches to fill empty needles, then knit across";

/** Semantic instruction type for the full introductory callout. */
export const HAT_TRANSFER_STEP_INSTRUCTION_TYPE = "transfer-step";

/** Semantic instruction type for the per-row icon-only marker. */
export const HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE = "transfer-step-reminder";

/** Grammar helper: `1 needle` vs `N needles` for any positive integer count. */
export function formatHatNeedleCountPhrase(count: number): string {
  const n = Math.max(0, Math.floor(Number(count)));
  return n === 1 ? "1 needle" : `${n} needles`;
}

/** Decrease-row lead-in: `Count 1 needle` / `Count 13 needles`. */
export function formatHatSpiralCountNeedlesPhrase(spacing: number): string {
  return `Count ${formatHatNeedleCountPhrase(spacing)}`;
}

function escapeHtmlAttr(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Decorative img using the shared transfer-step.svg asset. */
export function buildHatTransferStepIconImgHtml(
  sizeClass: "hat-transfer-step-icon--callout" | "hat-transfer-step-icon--row",
): string {
  return (
    `<img class="hat-transfer-step-icon ${sizeClass}"` +
    ` src="${HAT_TRANSFER_STEP_ICON_SRC}"` +
    ` alt=""` +
    ` width="24" height="24"` +
    ` decoding="async"` +
    ` aria-hidden="true" />`
  );
}

/** Full required-instruction callout shown once before Swirl Top decrease rows. */
export function buildHatTransferStepCalloutHtml(): string {
  return (
    `<div class="hat-transfer-step-callout pattern-print-keep-together"` +
    ` role="note"` +
    ` data-instruction-type="${HAT_TRANSFER_STEP_INSTRUCTION_TYPE}"` +
    ` aria-label="${escapeHtmlAttr(HAT_TRANSFER_STEP_LABEL)}. Required knitting instruction.">` +
    `<div class="hat-transfer-step-callout__header">` +
    buildHatTransferStepIconImgHtml("hat-transfer-step-icon--callout") +
    `<span class="hat-transfer-step-callout__heading">${HAT_TRANSFER_STEP_LABEL}</span>` +
    `</div>` +
    `<p class="hat-transfer-step-callout__body">${HAT_TRANSFER_STEP_CALLOUT_BODY}</p>` +
    `<p class="hat-transfer-step-callout__icon-explain">${HAT_TRANSFER_STEP_ICON_EXPLAIN}</p>` +
    `</div>`
  );
}

/**
 * Icon-only marker after each applicable Swirl Top decrease row.
 * Keeps semantic `transfer-step-reminder` type; no repeated badge text or sentence.
 */
export function buildHatTransferStepReminderHtml(): string {
  return (
    `<span class="hat-transfer-step-marker"` +
    ` data-instruction-type="${HAT_TRANSFER_STEP_REMINDER_INSTRUCTION_TYPE}"` +
    ` role="img"` +
    ` aria-label="${escapeHtmlAttr(HAT_TRANSFER_STEP_MARKER_ARIA_LABEL)}">` +
    buildHatTransferStepIconImgHtml("hat-transfer-step-icon--row") +
    `</span>`
  );
}
