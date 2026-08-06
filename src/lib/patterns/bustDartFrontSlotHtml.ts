/**
 * Screen + print HTML for the Front Optional Bust Dart customization slot.
 * Does not own dart math — only presents generator output and controls.
 *
 * Inactive prompt participates in {@link refreshPatternTipDismiss} / “Restore hidden tips”
 * via a stable `data-tip-id`. Active dart instructions are never tip-dismissable.
 */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stable tip id for the inactive Optional Bust Dart Front prompt (Sleeveless + Drop Shoulder). */
export const OPTIONAL_BUST_DART_TIP_ID = "optional-bust-dart-front";

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
  errors: string[];
};

function activeDartTitle(row: BustDartCustomizationDisplayRow): string {
  const customized = row.customized === true;
  if (row.cupSize && customized) return `Bust Dart (Cup ${escapeHtml(row.cupSize)} · Customized)`;
  if (row.cupSize) return `Bust Dart (Cup ${escapeHtml(row.cupSize)})`;
  if (customized) return "Bust Dart (Customized)";
  return "Bust Dart";
}

/** Screen: heading, optional errors, dart instructions when active, Update/Remove or Add control. */
export function renderBustDartCustomizationScreenHtml(
  row: BustDartCustomizationDisplayRow,
): string {
  const errors =
    row.errors.length > 0
      ? `<p class="bust-dart-front-slot__error no-print" role="alert">${escapeHtml(row.errors[0]!)}</p>`
      : "";

  if (row.active) {
    const title = activeDartTitle(row);
    const instructions =
      row.instructionParagraphs.length > 0
        ? `<div class="bust-dart-front-slot__instructions">${row.instructionParagraphs
            .map((p) => `<p class="sleeveless-pattern-line">${escapeHtml(p)}</p>`)
            .join("")}</div>`
        : "";
    const controls = `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-update-bust-dart" aria-haspopup="dialog">Update Bust Dart</button>
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-remove data-testid="button-remove-bust-dart">Remove Bust Dart</button>
      </div>`;

    // Active instructions are pattern content — not a dismissable tip.
    return `<div class="bust-dart-front-slot sleeveless-pattern-row sleeveless-pattern-row--full" data-bust-dart-front-slot data-bust-dart-active="true">
  <div class="sleeveless-pattern-left">
    <h4 class="bust-dart-front-slot__title">${title}</h4>
    ${errors}
    ${instructions}
    ${controls}
  </div>
</div>`;
  }

  const hint = `<p class="bust-dart-front-slot__hint no-print">Short-row bust darts on the front only, starting here (1″ / ${row.placementOffsetRows} rows before the armhole).</p>`;
  const controls = `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-optional-bust-dart" aria-haspopup="dialog" aria-label="Add bust dart">Add Bust Dart</button>
      </div>`;

  // Inactive prompt: standard `.pattern-tip[data-tip-id]` so Hide / Restore hidden tips apply.
  // `pattern-print-personalization-never-print` keeps it out of browser print; print-route HTML already omits inactive slots.
  return `<div class="pattern-tip bust-dart-front-slot bust-dart-front-slot--optional pattern-print-personalization-never-print no-print sleeveless-pattern-row sleeveless-pattern-row--full" data-tip data-tip-id="${OPTIONAL_BUST_DART_TIP_ID}" data-bust-dart-front-slot data-bust-dart-active="false">
  <div class="sleeveless-pattern-left">
    <h4 class="bust-dart-front-slot__title">Optional Bust Dart</h4>
    ${hint}
    ${errors}
    ${controls}
  </div>
</div>`;
}

/**
 * Print: only when a dart is active — heading + knitting directions as normal pattern content.
 * Inactive optional slots return "" so nothing prints.
 */
export function renderBustDartCustomizationPrintHtml(
  row: BustDartCustomizationDisplayRow,
): string {
  if (!row.active || row.instructionParagraphs.length === 0) return "";
  const title = activeDartTitle(row);
  const lines = row.instructionParagraphs
    .map((p) => {
      const t = String(p).trim();
      return t ? `<p class="print-line">${escapeHtml(t)}</p>` : "";
    })
    .filter(Boolean)
    .join("");
  if (!lines) return "";
  return `<div class="print-inst-row print-inst-row--full bust-dart-print-block">
  <div class="print-inst-left">
    <p class="print-subhead">${title}</p>
    ${lines}
  </div>
</div>`;
}
