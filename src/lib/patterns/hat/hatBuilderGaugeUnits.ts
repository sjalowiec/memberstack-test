/**
 * Gauge swatch unit conversion helpers for the hat builder.
 * Matches factors used in `src/pages/patterns/hat.astro` Create tab.
 */

import type { HatDraftUnit, HatGaugeSlot } from "./hatDraft";
import { emptyHatGaugeSlots } from "./hatDraft";

const IN_TO_CM_GAUGE = 2.54;

/** Stitches/rows per 4" ↔ per 10 cm (same fabric density). */
export const HAT_GAUGE_IN_TO_CM_FACTOR = 10 / (4 * IN_TO_CM_GAUGE);
export const HAT_GAUGE_CM_TO_IN_FACTOR = (4 * IN_TO_CM_GAUGE) / 10;

export type HatGaugeSlots = {
  inches: HatGaugeSlot;
  cm: HatGaugeSlot;
};

/** Fill an empty target unit slot by converting from the other unit (no overwrite). */
export function maybeFillHatGaugeSlotFromOtherUnit(
  slots: HatGaugeSlots,
  fromU: HatDraftUnit,
  toU: HatDraftUnit,
): HatGaugeSlots {
  const next: HatGaugeSlots = {
    inches: { ...slots.inches },
    cm: { ...slots.cm },
  };
  const to = next[toU];
  if (to.stitch.trim() || to.row.trim()) return next;
  const from = next[fromU];
  if (!from.stitch.trim() && !from.row.trim()) return next;
  const fs = parseFloat(from.stitch);
  const fr = parseFloat(from.row);
  if (fromU === "inches" && toU === "cm") {
    if (Number.isFinite(fs)) to.stitch = (fs * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1);
    if (Number.isFinite(fr)) to.row = (fr * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1);
  } else if (fromU === "cm" && toU === "inches") {
    if (Number.isFinite(fs)) to.stitch = (fs * HAT_GAUGE_CM_TO_IN_FACTOR).toFixed(1);
    if (Number.isFinite(fr)) to.row = (fr * HAT_GAUGE_CM_TO_IN_FACTOR).toFixed(1);
  }
  return next;
}

export function cloneEmptyHatGaugeSlots(): HatGaugeSlots {
  return emptyHatGaugeSlots();
}

export function normalizeUiUnit(raw: unknown): HatDraftUnit {
  if (raw === "cm") return "cm";
  if (raw === "in" || raw === "inches") return "inches";
  return "inches";
}

/** Map UnitToggle detail.unit (`in` | `cm`) to draft unit. */
export function draftUnitFromToggleDetail(unit: unknown): HatDraftUnit {
  return unit === "cm" ? "cm" : "inches";
}
