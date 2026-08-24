/**
 * Sleeveless Edit Pattern — Size-change measurement refresh (value/state only).
 *
 * Size change is not Round/V/Cardigan art-only refresh: the measurement values themselves
 * change. Recompute chart defaults + reconcile `cbMeasurementOverrides` with the existing
 * Custom Build sizing-identity rules, then the workspace writes those values into the
 * existing chip inputs and refreshes generated art.
 */
import {
  diagramOverrideDefaultsFromChartRow,
  reconcileCustomBuildOverridesForSizingIdentityChange,
  readOverrideSeedSizingIdentity,
  writeOverrideSeedSizingIdentity,
} from "./customBuildMeasurementOverrideReconcile";
import { overrideRecordsEqual } from "./patternSectionPatch";
import { persistMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import { normalizeChartRowSize } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessMeasurementGarmentInput } from "./sleevelessFrontGarmentGeometry";

/** Body chips whose values come from the size-chart row (plus audience hem default). */
export const SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "shoulderWidth",
  "armholeDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "hemDepth",
] as const;

export type SleevelessEditSizeDependentChipKey =
  (typeof SLEEVELESS_EDIT_SIZE_DEPENDENT_CHIP_KEYS)[number];

export type SleevelessEditSizeChangeMergedResult = {
  defaults: Record<string, string>;
  reconciled: Record<string, string>;
  merged: Record<string, string>;
};

function parseMergedInches(value: string | undefined, fallback: number): number {
  const raw = value?.trim() ?? "";
  if (!raw) return fallback;
  const n = parseFloat(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Same measurement adapter the generated Edit SVG uses (`sleevelessMeasurementInputFromMerged`). */
export function sleevelessEditMeasurementInputFromMerged(
  merged: Record<string, string>,
): SleevelessMeasurementGarmentInput {
  return {
    bustInches: parseMergedInches(merged.chestBust, 40),
    hipInches: parseMergedInches(merged.hip, 40),
    garmentLengthInches: parseMergedInches(merged.finishedLength, 22),
    armholeDepthInches: parseMergedInches(merged.armholeDepth, 8),
    neckOpeningInches: parseMergedInches(merged.finishedNeckOpeningWidth, 7),
    neckDepthInches: parseMergedInches(merged.neckDepth, 3),
    shoulderWidthInches: parseMergedInches(merged.shoulderWidth, 4.5),
    hemDepthInches: parseMergedInches(merged.hemDepth, 2),
  };
}

/**
 * If the override-seed identity is missing, record the previous Size so the existing
 * reconcile function can treat this as a sizing-identity change (same mechanism the
 * builder uses — not a new override rule).
 */
export function ensureSleevelessSizeChangeOverrideSeed(args: {
  audience: string;
  oldSize?: string;
  currentSize: string;
}): void {
  const oldSize = args.oldSize?.trim() ?? "";
  const currentSize = args.currentSize.trim();
  if (!oldSize || !currentSize || oldSize === currentSize) return;
  if (readOverrideSeedSizingIdentity()) return;
  writeOverrideSeedSizingIdentity({
    chartAudience: args.audience,
    selectedSize: oldSize,
  });
}

/**
 * Resolve Size-change measurements from the new chart row using existing Custom Build
 * override reconcile (chart-seeded values refresh; deliberate edits that differ from the
 * previous size defaults are kept). Overrides are global to the current Custom Build
 * state, not keyed per size.
 */
export function buildSleevelessEditSizeChangeMergedInches(args: {
  row: ChartRow;
  selectedSize: string;
  fitPreference: string;
  audience: string;
  bodyShape?: string;
  oldSize?: string;
  overrides: Record<string, string>;
  persist?: boolean;
}): SleevelessEditSizeChangeMergedResult {
  const selectedSize = normalizeChartRowSize(args.row) || args.selectedSize.trim();
  ensureSleevelessSizeChangeOverrideSeed({
    audience: args.audience,
    oldSize: args.oldSize,
    currentSize: selectedSize,
  });

  const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
    currentIdentity: { chartAudience: args.audience, selectedSize },
    currentRow: args.row,
    fitPreference: args.fitPreference,
    overrides: args.overrides,
    bodyShape: args.bodyShape,
    dropShoulder: false,
  });

  if (args.persist && !overrideRecordsEqual(reconciled, args.overrides)) {
    persistMeasurementOverrides(reconciled);
  }

  const defaults = diagramOverrideDefaultsFromChartRow(
    args.row,
    args.fitPreference,
    args.audience,
    { bodyShape: args.bodyShape, dropShoulder: false },
  );

  const merged: Record<string, string> = { ...defaults };
  for (const [key, val] of Object.entries(reconciled)) {
    const trimmed = val?.trim();
    if (trimmed) merged[key] = trimmed;
  }

  return { defaults, reconciled, merged };
}

/** Write chip input values in place — never rebuild overlay nodes. */
export function applySleevelessEditSizeChangeChipValues(
  chips: Iterable<{ key: string; value: string }>,
  merged: Record<string, string>,
): number {
  let updated = 0;
  for (const chip of chips) {
    const next = merged[chip.key];
    if (next === undefined) continue;
    chip.value = next;
    updated += 1;
  }
  return updated;
}
