/**
 * Socks Builder unit helpers (gauge swatch + finished-measurement display).
 * Gauge 4"/10 cm factors match Hat `hatBuilderGaugeUnits` without importing Hat.
 */

import type { SockDraftUnit, SockGaugeSlot } from "./sockDraft";
import { emptySockGaugeSlots } from "./sockDraft";

const IN_TO_CM = 2.54;

/** Stitches/rows per 4" ↔ per 10 cm (same fabric density). */
export const SOCK_GAUGE_IN_TO_CM_FACTOR = 10 / (4 * IN_TO_CM);
export const SOCK_GAUGE_CM_TO_IN_FACTOR = (4 * IN_TO_CM) / 10;

export type SockGaugeSlots = {
  inches: SockGaugeSlot;
  cm: SockGaugeSlot;
};

export function draftUnitFromToggleDetail(unit: unknown): SockDraftUnit {
  return unit === "cm" ? "cm" : "inches";
}

export function formatSockMeasurementDisplay(inches: number, unit: SockDraftUnit): string {
  if (!(inches > 0) || !Number.isFinite(inches)) return "";
  const value = unit === "cm" ? inches * IN_TO_CM : inches;
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

/** Convert a filled display-unit measurement string; leave blank/invalid values unchanged. */
export function convertSockMeasurementDisplay(
  raw: string,
  fromUnit: SockDraftUnit,
  toUnit: SockDraftUnit,
): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || fromUnit === toUnit) return trimmed;
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n) || n <= 0) return trimmed;
  const inches = fromUnit === "cm" ? n / IN_TO_CM : n;
  return formatSockMeasurementDisplay(inches, toUnit);
}

export function displayMeasurementToInches(raw: string, unit: SockDraftUnit): number | null {
  const n = parseFloat(String(raw ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "cm" ? n / IN_TO_CM : n;
}

/** Fill an empty target unit gauge slot by converting from the other unit (no overwrite). */
export function maybeFillSockGaugeSlotFromOtherUnit(
  slots: SockGaugeSlots,
  fromU: SockDraftUnit,
  toU: SockDraftUnit,
): SockGaugeSlots {
  const next: SockGaugeSlots = {
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
    if (Number.isFinite(fs)) to.stitch = (fs * SOCK_GAUGE_IN_TO_CM_FACTOR).toFixed(1);
    if (Number.isFinite(fr)) to.row = (fr * SOCK_GAUGE_IN_TO_CM_FACTOR).toFixed(1);
  } else if (fromU === "cm" && toU === "inches") {
    if (Number.isFinite(fs)) to.stitch = (fs * SOCK_GAUGE_CM_TO_IN_FACTOR).toFixed(1);
    if (Number.isFinite(fr)) to.row = (fr * SOCK_GAUGE_CM_TO_IN_FACTOR).toFixed(1);
  }
  return next;
}

export function cloneEmptySockGaugeSlots(): SockGaugeSlots {
  return emptySockGaugeSlots();
}
