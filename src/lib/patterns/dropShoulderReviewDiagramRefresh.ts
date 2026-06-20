/**
 * Drop Shoulder — workspace measurement summary diagram refresh when garment size changes.
 *
 * Tracks a display identity separate from override-seed identity so reconciliation still
 * knows the previous chart row after sync updates `fit.selectedMeasurements`. A dirty flag
 * forces the Edit Pattern → Measurements pane to discard stale DOM/SVG and rebuild from chart data.
 */
import { DROP_SHOULDER_CONSTRUCTION } from "./patternConstructionIdentity";
import {
  diagramOverrideDefaultsFromChartRow,
  reconcileCustomBuildOverridesForSizingIdentityChange,
  readOverrideSeedSizingIdentity,
  writeOverrideSeedSizingIdentity,
} from "./customBuildMeasurementOverrideReconcile";
import {
  resolveDropShoulderSleeveInches,
  resolveDropShoulderSleeveOverrideStrings,
} from "./dropShoulderSleeveMeasurementOverrides";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
  CUSTOM_BUILD_DIAGRAM_OVERRIDE_KEYS,
} from "./sleevelessCustomMeasurementStorage";
import {
  expressWhoToChartAudience,
  findExpressChartRow,
  normalizeChartRowSize,
} from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { getCurrentPattern, getPatternData, SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY } from "./patternStorage";
import { overrideRecordsEqual } from "./patternSectionPatch";
import { sizingIdentityEquals } from "./savedCustomPatternSessionIdentity";

export const DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY = "dropShoulderReviewDiagramDirty";
export const DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY = "dropShoulderReviewDisplayIdentity";
export const DROP_SHOULDER_REVIEW_STALE_EVENT = "kbm:drop-shoulder-review-stale";

export type DropShoulderReviewDisplayIdentity = {
  construction: typeof DROP_SHOULDER_CONSTRUCTION;
  chartAudience: string;
  selectedSize: string;
  fit: string;
};

export type MarkDropShoulderReviewDiagramDirtyOptions = {
  /** When true, notify an open workspace measurement summary pane (never from sync/hydrate paths). */
  notify?: boolean;
};

function readExpressBlob(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeExpressBlobPatch(patch: Record<string, unknown>): void {
  if (typeof localStorage === "undefined") return;
  try {
    const prev = readExpressBlob();
    localStorage.setItem(
      SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
      JSON.stringify({ ...prev, ...patch }),
    );
  } catch {
    /* ignore */
  }
}

function normalizeFitLabel(fit: unknown): string {
  const raw = String(fit ?? "").trim().toLowerCase();
  if (raw === "close" || raw === "standard" || raw === "relaxed") return raw;
  return "standard";
}

/** Canonical identity for compare/commit (trim strings, chart row size, fit label). */
export function normalizeDropShoulderReviewDisplayIdentity(
  identity: DropShoulderReviewDisplayIdentity,
): DropShoulderReviewDisplayIdentity {
  const chartAudience = String(identity.chartAudience ?? "").trim();
  let selectedSize = String(identity.selectedSize ?? "").trim();
  if (chartAudience && selectedSize) {
    const row = findExpressChartRow(chartAudience, selectedSize);
    if (row) {
      const normalized = normalizeChartRowSize(row);
      if (normalized) selectedSize = normalized;
    }
  }
  return {
    construction: DROP_SHOULDER_CONSTRUCTION,
    chartAudience,
    selectedSize,
    fit: normalizeFitLabel(identity.fit),
  };
}

export function buildDropShoulderReviewDisplayIdentity(
  chartAudience: string,
  selectedSize: string,
  fit: string,
): DropShoulderReviewDisplayIdentity {
  return normalizeDropShoulderReviewDisplayIdentity({
    construction: DROP_SHOULDER_CONSTRUCTION,
    chartAudience,
    selectedSize,
    fit,
  });
}

export function dropShoulderReviewDisplayIdentityEquals(
  a: DropShoulderReviewDisplayIdentity,
  b: DropShoulderReviewDisplayIdentity,
): boolean {
  const left = normalizeDropShoulderReviewDisplayIdentity(a);
  const right = normalizeDropShoulderReviewDisplayIdentity(b);
  return (
    left.construction === right.construction &&
    left.chartAudience === right.chartAudience &&
    left.selectedSize === right.selectedSize &&
    left.fit === right.fit
  );
}

export function readDropShoulderReviewDisplayIdentity(): DropShoulderReviewDisplayIdentity | null {
  const nested = readExpressBlob()[DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY];
  if (!nested || typeof nested !== "object" || Array.isArray(nested)) return null;
  const chartAudience = String((nested as DropShoulderReviewDisplayIdentity).chartAudience ?? "").trim();
  const selectedSize = String((nested as DropShoulderReviewDisplayIdentity).selectedSize ?? "").trim();
  const fit = normalizeFitLabel((nested as DropShoulderReviewDisplayIdentity).fit);
  if (!chartAudience || !selectedSize) return null;
  return normalizeDropShoulderReviewDisplayIdentity({
    construction: DROP_SHOULDER_CONSTRUCTION,
    chartAudience,
    selectedSize,
    fit,
  });
}

export function writeDropShoulderReviewDisplayIdentity(
  identity: DropShoulderReviewDisplayIdentity | null,
): void {
  if (!identity) {
    const prev = readExpressBlob();
    delete prev[DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY];
    try {
      localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(prev));
    } catch {
      /* ignore */
    }
    return;
  }
  writeExpressBlobPatch({
    [DROP_SHOULDER_REVIEW_DISPLAY_IDENTITY_KEY]: normalizeDropShoulderReviewDisplayIdentity(identity),
  });
}

export function readDropShoulderReviewDiagramDirty(): boolean {
  return readExpressBlob()[DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY] === true;
}

export function markDropShoulderReviewDiagramDirty(
  options: MarkDropShoulderReviewDiagramDirtyOptions = {},
): void {
  if (readDropShoulderReviewDiagramDirty()) {
    return;
  }
  writeExpressBlobPatch({ [DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY]: true });
  if (options.notify === true && typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent(DROP_SHOULDER_REVIEW_STALE_EVENT));
  }
}

export function clearDropShoulderReviewDiagramDirty(): void {
  const prev = readExpressBlob();
  if (prev[DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY] !== true) return;
  delete prev[DROP_SHOULDER_REVIEW_DIAGRAM_DIRTY_KEY];
  try {
    localStorage.setItem(SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY, JSON.stringify(prev));
  } catch {
    /* ignore */
  }
}

/**
 * Mark dirty when Drop Shoulder garment size (or audience/fit) changes during builder sync.
 * Does not mark when the workspace summary has never hydrated (no stored identity) — nothing to invalidate yet.
 * Never dispatches stale events (sync must not re-enter hydration).
 */
export function markDropShoulderReviewDiagramDirtyIfDisplayIdentityChanged(
  current: DropShoulderReviewDisplayIdentity,
): void {
  const stored = readDropShoulderReviewDisplayIdentity();
  if (!stored) {
    return;
  }
  const normalizedCurrent = normalizeDropShoulderReviewDisplayIdentity(current);
  const normalizedStored = normalizeDropShoulderReviewDisplayIdentity(stored);
  if (!dropShoulderReviewDisplayIdentityEquals(normalizedStored, normalizedCurrent)) {
    markDropShoulderReviewDiagramDirty();
  }
}

export function isDropShoulderReviewDiagramStale(
  current: DropShoulderReviewDisplayIdentity,
): boolean {
  const normalizedCurrent = normalizeDropShoulderReviewDisplayIdentity(current);
  if (readDropShoulderReviewDiagramDirty()) return true;
  const stored = readDropShoulderReviewDisplayIdentity();
  if (!stored) return false;
  return !dropShoulderReviewDisplayIdentityEquals(stored, normalizedCurrent);
}

/**
 * Reconcile overrides against the previous chart row, persist, and return merged diagram inches
 * (chart defaults + reconciled user edits). Does not read DOM.
 */
export function buildDropShoulderReviewMergedInches(args: {
  row: ChartRow;
  selectedSize: string;
  fitPreference: string;
  audience: string;
  bodyShape?: string;
}): Record<string, string> {
  const currentIdentity = {
    chartAudience: args.audience,
    selectedSize: normalizeChartRowSize(args.row) || args.selectedSize.trim(),
  };
  const overrides = loadMeasurementOverrides();
  const reconciled = reconcileCustomBuildOverridesForSizingIdentityChange({
    currentIdentity,
    currentRow: args.row,
    fitPreference: args.fitPreference,
    overrides,
    bodyShape: args.bodyShape,
    dropShoulder: true,
  });

  if (!overrideRecordsEqual(reconciled, overrides)) {
    persistMeasurementOverrides(reconciled);
  }

  const defaults = diagramOverrideDefaultsFromChartRow(args.row, args.fitPreference, args.audience, {
    bodyShape: args.bodyShape,
    dropShoulder: true,
  });

  const merged: Record<string, string> = { ...defaults };
  for (const [key, val] of Object.entries(reconciled)) {
    const trimmed = val?.trim();
    if (trimmed) merged[key] = trimmed;
  }

  const sleeveResolved = resolveDropShoulderSleeveOverrideStrings({
    overrides: reconciled,
    chartRow: args.row,
    fitPreference: args.fitPreference,
    bodyShape: args.bodyShape,
  });
  Object.assign(merged, sleeveResolved);

  delete merged.shoulderWidth;
  delete merged.armholeDepth;

  return merged;
}

/** Call after a successful Drop Shoulder review diagram render. */
export function commitDropShoulderReviewDiagramHydration(
  identity: DropShoulderReviewDisplayIdentity,
): void {
  const normalized = normalizeDropShoulderReviewDisplayIdentity(identity);
  writeDropShoulderReviewDisplayIdentity(normalized);
  writeOverrideSeedSizingIdentity({
    chartAudience: normalized.chartAudience,
    selectedSize: normalized.selectedSize,
  });
  clearDropShoulderReviewDiagramDirty();
}

/** True when override seed differs from current size — chart-seeded overrides may be stale. */
export function dropShoulderOverrideSeedDiffersFromCurrent(
  chartAudience: string,
  selectedSize: string,
): boolean {
  const seed = readOverrideSeedSizingIdentity();
  if (!seed) return false;
  return !sizingIdentityEquals(seed, { chartAudience, selectedSize });
}

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

/** Authoritative sizing for Drop Shoulder summary — canonical pattern fit (same as generator). */
export function resolveDropShoulderSummarySizingFromPattern(): {
  audience: string;
  selectedSize: string;
  fitPreference: string;
  bodyShape: string;
  overrides: Record<string, string>;
  selectedMeasurements: Record<string, unknown>;
} | null {
  const pattern = getCurrentPattern();
  const pb = getPatternData();
  const fit = { ...section(pb.fit), ...section(pattern.fit) };
  const style = { ...section(pb.style), ...section(pattern.style) };

  const audience =
    expressWhoToChartAudience(String(fit.sizingChart ?? "")) ||
    expressWhoToChartAudience(String(style.recipientCategory ?? "")) ||
    "";
  const selectedSize = String(fit.selectedSize ?? "").trim();
  if (!audience || !selectedSize) return null;

  const fitPreference = normalizeFitLabel(fit.easeChoice ?? fit.fitChoice);
  const bodyShape = String(style.bodyShape ?? "straight").trim() || "straight";

  const canonOverrides = Object.fromEntries(
    Object.entries(section(fit.cbMeasurementOverrides)).filter(
      ([, v]) => typeof v === "string" && String(v).trim() !== "",
    ) as [string, string][],
  );
  const overrides = { ...loadMeasurementOverrides(), ...canonOverrides };
  const selectedMeasurements = section(fit.selectedMeasurements);

  return {
    audience,
    selectedSize,
    fitPreference,
    bodyShape,
    overrides,
    selectedMeasurements,
  };
}

export type ForceRefreshDropShoulderSummaryResult = {
  merged: Record<string, string>;
  audience: string;
  selectedSize: string;
  fitPreference: string;
  chartRowFound: boolean;
  storageUpdated: boolean;
  resolvedUpperArmIn?: number;
  resolvedSleeveLengthIn?: number;
  resolvedWristIn?: number;
};

/** Quick-edit sizing from Edit Pattern → Measurements (Size select + Fit). */
export type DropShoulderQuickEditSizing = {
  audience: string;
  selectedSize: string;
  fitPreference: string;
};

type DropShoulderSummaryRefreshContext = {
  audience: string;
  selectedSize: string;
  fitPreference: string;
  bodyShape: string;
  selectedMeasurements: Record<string, unknown>;
};

function forceRefreshDropShoulderSummaryFromContext(
  ctx: DropShoulderSummaryRefreshContext,
): ForceRefreshDropShoulderSummaryResult | null {
  const row = findExpressChartRow(ctx.audience, ctx.selectedSize);
  if (!row) {
    return null;
  }

  const merged = buildDropShoulderReviewMergedInches({
    row,
    selectedSize: ctx.selectedSize,
    fitPreference: ctx.fitPreference,
    audience: ctx.audience,
    bodyShape: ctx.bodyShape,
  });

  const toPersist: Record<string, string> = {};
  for (const key of CUSTOM_BUILD_DIAGRAM_OVERRIDE_KEYS) {
    const val = merged[key]?.trim();
    if (val) toPersist[key] = val;
  }
  const hadPersisted = !overrideRecordsEqual(toPersist, loadMeasurementOverrides());
  if (Object.keys(toPersist).length > 0) {
    persistMeasurementOverrides(toPersist);
  }

  const sleeveInches = resolveDropShoulderSleeveInches({
    overrides: toPersist,
    chartRow: row,
    fitPreference: ctx.fitPreference,
    selectedMeasurements: ctx.selectedMeasurements,
    bodyShape: ctx.bodyShape,
  });

  const normalizedSize = normalizeChartRowSize(row) || ctx.selectedSize;
  const identity = buildDropShoulderReviewDisplayIdentity(
    ctx.audience,
    normalizedSize,
    ctx.fitPreference,
  );
  commitDropShoulderReviewDiagramHydration(identity);

  return {
    merged,
    audience: ctx.audience,
    selectedSize: normalizedSize,
    fitPreference: ctx.fitPreference,
    chartRowFound: true,
    storageUpdated: hadPersisted || Object.keys(toPersist).length > 0,
    resolvedUpperArmIn: sleeveInches.upperArmIn,
    resolvedSleeveLengthIn: sleeveInches.sleeveLengthIn,
    resolvedWristIn: sleeveInches.wristIn,
  };
}

/**
 * Reload workspace summary measurements from canonical pattern + chart row (generator parity).
 * Does not read DOM. Persists overrides and commits display identity.
 */
export function forceRefreshDropShoulderSummaryMeasurements(): ForceRefreshDropShoulderSummaryResult | null {
  const ctx = resolveDropShoulderSummarySizingFromPattern();
  if (!ctx) {
    return null;
  }
  return forceRefreshDropShoulderSummaryFromContext(ctx);
}

/**
 * Reload the visible workspace diagram from Quick edits Size (before Update Pattern).
 * Uses the size select value, not stale canonical pattern fit.
 */
export function forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing(
  args: DropShoulderQuickEditSizing,
): ForceRefreshDropShoulderSummaryResult | null {
  const audience = String(args.audience ?? "").trim();
  const selectedSize = String(args.selectedSize ?? "").trim();
  const fitPreference = normalizeFitLabel(args.fitPreference);
  if (!audience || !selectedSize) {
    return null;
  }

  const pattern = getCurrentPattern();
  const bodyShape = String(pattern.style?.bodyShape ?? "straight").trim() || "straight";
  const selectedMeasurements = section(getCurrentPattern().fit?.selectedMeasurements);

  return forceRefreshDropShoulderSummaryFromContext({
    audience,
    selectedSize,
    fitPreference,
    bodyShape,
    selectedMeasurements,
  });
}
