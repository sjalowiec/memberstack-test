/**
 * Gauge display-unit conversion for the Edit Pattern workspace's Inches/Centimeters control.
 *
 * Gauge is shown as swatch counts (stitches / rows over 4" or over 10 cm). Switching the display
 * unit must preserve the SAME PHYSICAL gauge, so the visible count is routed through per-inch
 * (the canonical basis the pattern engine consumes) and re-expressed in the new basis — never a
 * relabel of the same number. Because the round-trip goes through per-inch, repeated switching is
 * idempotent and does not change the resulting stitch/row calculations.
 */
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";
import {
  swatchCountFromPerInchForDisplay,
  type GaugeSwatchBasis,
} from "./gaugeDisplayFormat";

export type EditWorkspaceGaugeKind = "stitch" | "row";

/** Short field title above the gauge input (unit-agnostic). */
export function editWorkspaceGaugeFieldTitle(kind: EditWorkspaceGaugeKind): string {
  return kind === "stitch" ? "Stitch gauge" : "Row gauge";
}

/**
 * Unit description shown under the gauge input. Follows the site swatch convention
 * (stitches/rows over 4" or over 10 cm) — never hardcode only centimeters.
 */
export function editWorkspaceGaugeUnitDescription(
  kind: EditWorkspaceGaugeKind,
  basis: GaugeSwatchBasis,
): string {
  if (basis === "cm") {
    return kind === "stitch" ? "stitches per 10 cm" : "rows per 10 cm";
  }
  return kind === "stitch" ? 'stitches per 4"' : 'rows per 4"';
}

/**
 * Re-express a visible gauge swatch count in `toUnit` while preserving the physical gauge.
 * An empty, whitespace, or unparseable value is returned unchanged so an in-progress / invalid
 * edit is neither discarded nor misconverted (handled like the field's existing validation).
 */
export function convertGaugeSwatchDisplayBetweenUnits(
  value: string,
  fromUnit: GaugeSwatchBasis,
  toUnit: GaugeSwatchBasis,
): string {
  const trimmed = value.trim();
  if (!trimmed || fromUnit === toUnit) return trimmed;
  const { gaugeStitchesPerInch } = rawSwatchToPerInch(trimmed, "", fromUnit);
  const perInch = parseFloat(gaugeStitchesPerInch);
  if (!Number.isFinite(perInch) || perInch <= 0) return trimmed;
  return swatchCountFromPerInchForDisplay(perInch, toUnit);
}
