/**
 * Refresh chart-seeded `cbMeasurementOverrides` when the selected sizing chart row changes.
 *
 * Uses a persisted override-seed sizing identity (audience + size) so reconciliation still
 * works when `fit.selectedMeasurements` was already updated before the review page renders.
 */
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import { getDefaultHemLengthInches, getDefaultCuffLengthInches } from "./hemDefaults";
import { isActiveDropShoulderConstruction } from "./patternConstructionIdentity";
import {
  computeDefaultMeasurementsFromChartRow,
  findExpressChartRow,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS,
  dropShoulderSleeveDefaultsFromChartRow,
  reconcileDropShoulderSleeveOverridesForSizeChange,
} from "./dropShoulderSleeveMeasurementOverrides";
import { readDropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";
import {
  readSavedSizingIdentityBaseline,
  sizingIdentityEquals,
  type SavedCustomPatternSizingIdentity,
} from "./savedCustomPatternSessionIdentity";
import { SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";

/** Diagram override keys reconciled on same-chart size changes (shared body fields). */
export const CUSTOM_BUILD_BODY_DIAGRAM_OVERRIDE_KEYS = [
  "finishedNeckOpeningWidth",
  "neckDepth",
  "shoulderWidth",
  "armholeDepth",
  "chestBust",
  "hip",
  "finishedLength",
  "hemDepth",
] as const;

export type CustomBuildBodyDiagramOverrideKey =
  (typeof CUSTOM_BUILD_BODY_DIAGRAM_OVERRIDE_KEYS)[number];

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function toFinite(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function pickPositive(...candidates: (number | undefined)[]): number | undefined {
  for (const c of candidates) {
    if (c !== undefined && Number.isFinite(c) && c > 0) return c;
  }
  return undefined;
}

function formatOverrideInches(n: number): string {
  return formatSwatchCountForGaugeInput(roundQuarter(n));
}

function overrideInchesEqual(a: string, b: string): boolean {
  const parse = (raw: string): number | undefined => {
    const s = raw.trim();
    if (!s) return undefined;
    const n = parseFloat(s.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return roundQuarter(n);
  };
  const aIn = parse(a);
  const bIn = parse(b);
  if (aIn === undefined || bIn === undefined) return a.trim() === b.trim();
  return aIn === bIn;
}

/** Chart row → diagram override strings (matches review blueprint defaults). */
export function diagramOverrideDefaultsFromChartRow(
  row: ChartRow,
  fitPreference: string,
  audience: string,
  options?: { bodyShape?: string; dropShoulder?: boolean },
): Record<string, string> {
  const computed = computeDefaultMeasurementsFromChartRow(row, fitPreference, {
    bodyShape: options?.bodyShape,
  });
  const out: Record<string, string> = {};

  const set = (key: string, inches: number | undefined): void => {
    if (inches !== undefined) out[key] = formatOverrideInches(inches);
  };

  set(
    "finishedNeckOpeningWidth",
    pickPositive(computed.neck_width, toFinite(row.neck_opening)),
  );
  set(
    "neckDepth",
    pickPositive(computed.front_neck_depth, toFinite(row.front_neck_depth)),
  );
  set(
    "shoulderWidth",
    pickPositive(computed.shoulder_width, toFinite(row.shoulder_width)),
  );
  set(
    "armholeDepth",
    pickPositive(computed.armhole_depth, toFinite(row.armhole_depth)),
  );
  set(
    "chestBust",
    pickPositive(computed.finished_bust_chest, toFinite(row.bust_or_chest)),
  );
  set(
    "hip",
    pickPositive(
      computed.finished_hip,
      toFinite(row.hip),
      computed.finished_bust_chest,
      toFinite(row.bust_or_chest),
    ),
  );
  set(
    "finishedLength",
    pickPositive(computed.back_neck_to_hem, toFinite(row.garment_back_length)),
  );
  set("hemDepth", getDefaultHemLengthInches(audience));

  if (options?.dropShoulder) {
    set("cuffDepth", getDefaultCuffLengthInches(audience));
    Object.assign(
      out,
      dropShoulderSleeveDefaultsFromChartRow(row, fitPreference, {
        bodyShape: options.bodyShape,
        chartAudience: audience,
      }),
    );
  }

  return out;
}

export function reconcileCustomBuildDiagramOverridesAfterSizingChange(args: {
  previousRow: ChartRow;
  previousFit: string;
  currentRow: ChartRow;
  currentFit: string;
  overrides: Record<string, string>;
  audience: string;
  bodyShape?: string;
  dropShoulder?: boolean;
}): Record<string, string> {
  const bodyShape = args.bodyShape ?? "straight";
  const prevDefaults = diagramOverrideDefaultsFromChartRow(
    args.previousRow,
    args.previousFit,
    args.audience,
    { bodyShape, dropShoulder: args.dropShoulder },
  );
  const newDefaults = diagramOverrideDefaultsFromChartRow(
    args.currentRow,
    args.currentFit,
    args.audience,
    { bodyShape, dropShoulder: args.dropShoulder },
  );

  const keys = new Set<string>(CUSTOM_BUILD_BODY_DIAGRAM_OVERRIDE_KEYS);
  if (args.dropShoulder) {
    for (const key of DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS) keys.add(key);
    keys.add("cuffDepth");
  }

  const next = { ...args.overrides };
  for (const key of keys) {
    if (args.dropShoulder && (key === "shoulderWidth" || key === "armholeDepth")) {
      delete next[key];
      continue;
    }

    if (args.dropShoulder && (DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS as readonly string[]).includes(key)) {
      continue;
    }

    const newVal = newDefaults[key];
    const current = next[key]?.trim();

    if (!newVal) {
      delete next[key];
      continue;
    }

    if (!current) continue;

    const prevVal = prevDefaults[key];
    if (!prevVal || overrideInchesEqual(current, prevVal) || overrideInchesEqual(current, newVal)) {
      next[key] = newVal;
    }
  }

  if (args.dropShoulder) {
    return reconcileDropShoulderSleeveOverridesForSizeChange(
      next,
      args.currentRow,
      args.currentFit,
      readDropShoulderUserEditedSleeveFields(),
      { bodyShape: args.bodyShape, chartAudience: args.audience },
    );
  }

  return next;
}

export function readOverrideSeedSizingIdentity(): SavedCustomPatternSizingIdentity | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const nested = (parsed as Record<string, unknown>).cbMeasurementOverridesSizingIdentity;
    if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
    const chartAudience = String((nested as SavedCustomPatternSizingIdentity).chartAudience ?? "").trim();
    const selectedSize = String((nested as SavedCustomPatternSizingIdentity).selectedSize ?? "").trim();
    if (!chartAudience || !selectedSize) return null;
    return { chartAudience, selectedSize };
  } catch {
    return null;
  }
}

export function writeOverrideSeedSizingIdentity(
  identity: SavedCustomPatternSizingIdentity | null,
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    let prev: Record<string, unknown> = {};
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) prev = p as Record<string, unknown>;
    }
    if (!identity) {
      delete prev.cbMeasurementOverridesSizingIdentity;
    } else {
      prev.cbMeasurementOverridesSizingIdentity = identity;
    }
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

/** Resolve the chart row overrides were last seeded from (seed → dirty baseline fallback). */
export function resolvePreviousOverrideSeedSizingIdentity(
  current: SavedCustomPatternSizingIdentity,
): SavedCustomPatternSizingIdentity | null {
  const seed = readOverrideSeedSizingIdentity();
  if (seed && !sizingIdentityEquals(seed, current)) return seed;
  const baseline = readSavedSizingIdentityBaseline();
  if (baseline && !sizingIdentityEquals(baseline, current)) return baseline;
  return seed;
}

export function reconcileCustomBuildOverridesForSizingIdentityChange(args: {
  currentIdentity: SavedCustomPatternSizingIdentity;
  currentRow: ChartRow;
  fitPreference: string;
  overrides: Record<string, string>;
  bodyShape?: string;
  dropShoulder?: boolean;
}): Record<string, string> {
  const previousIdentity = resolvePreviousOverrideSeedSizingIdentity(args.currentIdentity);
  if (!previousIdentity || sizingIdentityEquals(previousIdentity, args.currentIdentity)) {
    return args.overrides;
  }

  const previousRow = findExpressChartRow(
    previousIdentity.chartAudience,
    previousIdentity.selectedSize,
  );
  if (!previousRow) return args.overrides;

  return reconcileCustomBuildDiagramOverridesAfterSizingChange({
    previousRow,
    previousFit: args.fitPreference,
    currentRow: args.currentRow,
    currentFit: args.fitPreference,
    overrides: args.overrides,
    audience: args.currentIdentity.chartAudience,
    bodyShape: args.bodyShape,
    dropShoulder: args.dropShoulder,
  });
}

/** Browser-only: whether diagram overrides should include drop-shoulder sleeve fields. */
export function resolveDropShoulderOverrideReconcileFlag(
  dropShoulderOverride?: boolean,
): boolean {
  if (dropShoulderOverride !== undefined) return dropShoulderOverride;
  try {
    return isActiveDropShoulderConstruction();
  } catch {
    return false;
  }
}
