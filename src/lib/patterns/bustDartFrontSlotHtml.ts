/**
 * Screen + print HTML for the Front Optional Bust Dart customization slot.
 * Does not own dart math — only presents generator output and controls.
 */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type BustDartCustomizationDisplayRow = {
  kind: "bustDartCustomization";
  active: boolean;
  cupSize: string | null;
  dartStartGarmentRc: number;
  armholeOpeningGarmentRc: number;
  placementOffsetRows: number;
  rowsFromHemToDartStart: number;
  rowsFromDartToArmhole: number;
  instructionParagraphs: string[];
  errors: string[];
};

/** Screen: heading, optional errors, dart instructions when active, Update/Remove or Add control. */
export function renderBustDartCustomizationScreenHtml(
  row: BustDartCustomizationDisplayRow,
): string {
  const title = row.active && row.cupSize
    ? `Bust Dart (Cup ${escapeHtml(row.cupSize)})`
    : "Optional Bust Dart";
  const errors =
    row.errors.length > 0
      ? `<p class="bust-dart-front-slot__error no-print" role="alert">${escapeHtml(row.errors[0]!)}</p>`
      : "";
  const instructions =
    row.active && row.instructionParagraphs.length > 0
      ? `<div class="bust-dart-front-slot__instructions">${row.instructionParagraphs
          .map((p) => `<p class="sleeveless-pattern-line">${escapeHtml(p)}</p>`)
          .join("")}</div>`
      : "";
  const controls = row.active
    ? `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-update-bust-dart" aria-haspopup="dialog">Update Bust Dart</button>
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-remove data-testid="button-remove-bust-dart">Remove Bust Dart</button>
      </div>`
    : `<div class="bust-dart-front-slot__actions no-print">
        <button type="button" class="sleeveless-pattern-edit-action" data-bust-dart-pattern-open data-testid="button-optional-bust-dart" aria-haspopup="dialog" aria-label="Add optional bust dart">Optional Bust Dart</button>
      </div>`;
  const hint = row.active
    ? ""
    : `<p class="bust-dart-front-slot__hint no-print">Short-row bust darts on the front only, starting here (1″ / ${row.placementOffsetRows} rows before the armhole).</p>`;

  return `<div class="bust-dart-front-slot sleeveless-pattern-row sleeveless-pattern-row--full" data-bust-dart-front-slot data-bust-dart-active="${row.active ? "true" : "false"}">
  <div class="sleeveless-pattern-left">
    <h4 class="bust-dart-front-slot__title">${title}</h4>
    ${hint}
    ${errors}
    ${instructions}
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
  const title = row.cupSize ? `Bust Dart (Cup ${escapeHtml(row.cupSize)})` : "Bust Dart";
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
