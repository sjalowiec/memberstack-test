/**
 * Screen + print HTML for the Front Optional Bust Dart customization slot.
 * Does not own dart math — only presents generator output and controls.
 *
 * Inactive prompt participates in {@link refreshPatternTipDismiss}; Show Tips OFF→ON
 * restores individually dismissed tips via a stable `data-tip-id`. Active dart
 * instructions are never tip-dismissable.
 */

import { formatBustDartPlacementDistanceLabel } from "./legoBlocks/bustDart";
import { renderBustDartInactivePromptHelpHtml } from "../tools/dartFormulaHelpVideo";
import type { MeasurementDisplayUnit } from "./patternMeasurementDisplayUnit";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stable tip id for the inactive Optional Bust Dart Front prompt (Sleeveless + Drop Shoulder). */
export const OPTIONAL_BUST_DART_TIP_ID = "optional-bust-dart-front";

/** Stable scroll / focus target for the Front bust-dart slot (active or optional). */
export const BUST_DART_FRONT_SLOT_ID = "bust-dart-front-slot";

export type BustDartCustomizationDisplayRow = {
  kind: "bustDartCustomization";
  active: boolean;
  cupSize: string | null;
  customized?: boolean;
  dartWidthInches?: number | null;
  dartDepthInches?: number | null;
  dartStartGarmentRc: number;
  armholeOpeningGarmentRc: number;
  placementOffsetRows: number;
  rowsFromHemToDartStart: number;
  rowsFromDartToArmhole: number;
  instructionParagraphs: string[];
  measurementDisplayUnit?: MeasurementDisplayUnit;
  placementDistanceLabel?: string;
  errors: string[];
};

function cupSubtitle(row: BustDartCustomizationDisplayRow): string | null {
  const customized = row.customized === true;
  if (row.cupSize && customized) return `Cup ${escapeHtml(row.cupSize)} · Customized`;
  if (row.cupSize) return `Cup ${escapeHtml(row.cupSize)}`;
  if (customized) return "Customized";
  return null;
}

function placementLabelForRow(row: BustDartCustomizationDisplayRow): string {
  if (row.placementDistanceLabel) return row.placementDistanceLabel;
  return formatBustDartPlacementDistanceLabel(row.measurementDisplayUnit === "cm" ? "cm" : "in");
}

function instructionListHtml(paragraphs: string[], lineClass: string): string {
  const items = paragraphs
    .map((p) => String(p).trim())
    .filter(Boolean)
    .map((p) => `<li class="${lineClass}">${escapeHtml(p)}</li>`)
    .join("");
  return items ? `<ol class="bust-dart-front-slot__steps">${items}</ol>` : "";
}

/** Screen: heading, cup, ordered steps when active, Update/Remove or Add control. */
export function renderBustDartCustomizationScreenHtml(
  row: BustDartCustomizationDisplayRow,
): string {
  const errors =
    row.errors.length > 0
      ? `<p class="bust-dart-front-slot__error no-print" role="alert">${escapeHtml(row.errors[0]!)}</p>`
      : "";

  if (row.active) {
    const cup = cupSubtitle(row);
    const cupHtml = cup
      ? `<p class="bust-dart-front-slot__cup">${cup}</p>`
      : "";
    const instructions =
      row.instructionParagraphs.length > 0
        ? `<div class="bust-dart-front-slot__instructions">${instructionListHtml(
            row.instructionParagraphs,
            "sleeveless-pattern-line",
          )}</div>`
        : "";
    const controls = `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-update-bust-dart" aria-haspopup="dialog">Update Bust Dart</button>
        <button type="button" class="sleeveless-pattern-edit-action sleeveless-pattern-edit-action--remove" data-bust-dart-pattern-remove data-testid="button-remove-bust-dart">Remove Bust Dart</button>
      </div>`;

    // Active instructions are pattern content — not a dismissable tip. No help-video note here.
    return `<div id="${BUST_DART_FRONT_SLOT_ID}" class="bust-dart-front-slot sleeveless-pattern-row sleeveless-pattern-row--full" data-bust-dart-front-slot data-bust-dart-active="true" data-bust-dart-scroll-target="active">
  <div class="sleeveless-pattern-left">
    <h4 class="bust-dart-front-slot__title">Bust Dart</h4>
    ${cupHtml}
    ${errors}
    ${instructions}
    ${controls}
  </div>
</div>`;
  }

  const distance = escapeHtml(placementLabelForRow(row));
  const hint = `<p class="bust-dart-front-slot__hint no-print">Short-row bust darts on the front only, starting here (${distance} / ${row.placementOffsetRows} rows before the armhole).</p>`;
  const help = renderBustDartInactivePromptHelpHtml();
  const controls = `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-optional-bust-dart" aria-haspopup="dialog" aria-label="Add bust dart">Add Bust Dart</button>
      </div>`;

  // Inactive prompt: standard `.pattern-tip[data-tip-id]` so Hide and Show Tips OFF→ON restore apply
  // (help note + Watch live inside the same tip wrapper).
  // `pattern-print-personalization-never-print` keeps it out of browser print; print-route HTML already omits inactive slots.
  return `<div id="${BUST_DART_FRONT_SLOT_ID}" class="pattern-tip bust-dart-front-slot bust-dart-front-slot--optional pattern-print-personalization-never-print no-print sleeveless-pattern-row sleeveless-pattern-row--full" data-tip data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}" data-bust-dart-front-slot data-bust-dart-active="false" data-bust-dart-scroll-target="optional">
  <div class="sleeveless-pattern-left">
    <h4 class="bust-dart-front-slot__title">Optional Bust Dart</h4>
    ${hint}
    ${help}
    ${errors}
    ${controls}
  </div>
</div>`;
}

/**
 * Print: only when a dart is active — heading + cup + ordered knitting directions.
 * Inactive optional slots return "" so nothing prints.
 */
export function renderBustDartCustomizationPrintHtml(
  row: BustDartCustomizationDisplayRow,
): string {
  if (!row.active || row.instructionParagraphs.length === 0) return "";
  const cup = cupSubtitle(row);
  const cupHtml = cup ? `<p class="print-line bust-dart-print-cup"><strong>${cup}</strong></p>` : "";
  const steps = instructionListHtml(row.instructionParagraphs, "print-line");
  if (!steps) return "";
  return `<div class="print-inst-row print-inst-row--full bust-dart-print-block">
  <div class="print-inst-left">
    <p class="print-subhead">Bust Dart</p>
    ${cupHtml}
    ${steps}
  </div>
</div>`;
}
