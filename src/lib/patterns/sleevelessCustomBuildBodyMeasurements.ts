/**
 * Custom Build body + finished measurement layer (`SleevelessPatternRecord.measurements`).
 * Pattern math still reads `fit.selectedMeasurements` — this layer is storage/UI only for phase 1.
 */
import { SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES } from "./bodyBlock/sleevelessBodyBlock";
import { positiveMeasurementInches } from "./customBuildEffectiveArmholeDepth";
import { fitEaseInchesForChoice } from "./fitEaseInches";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";
import { sectionPatchWouldChange } from "./patternSectionPatch";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

export const CUSTOM_BUILD_BODY_FINISHED_KEYS = [
  "bodyBustOrChest",
  "bodyWaist",
  "bodyHip",
  "finishedBustOrChest",
  "finishedWaist",
  "finishedHip",
] as const;

export type CustomBuildBodyFinishedKey = (typeof CUSTOM_BUILD_BODY_FINISHED_KEYS)[number];

export type SleevelessCustomBuildBodyFinishedMeasurements = Partial<
  Record<CustomBuildBodyFinishedKey, number>
>;

function toFiniteNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export function readCustomBuildBodyFinishedMeasurements(
  pattern: Pick<SleevelessPatternRecord, "measurements"> = getCurrentPattern(),
): SleevelessCustomBuildBodyFinishedMeasurements {
  const m = pattern.measurements;
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const out: SleevelessCustomBuildBodyFinishedMeasurements = {};
  for (const key of CUSTOM_BUILD_BODY_FINISHED_KEYS) {
    const n = toFiniteNumber(m[key]);
    if (n !== undefined) out[key] = n;
  }
  return out;
}

/** Chart row + fit ease → initial body/finished layer (hip follows bust unless A-line). */
/**
 * Straight torso: chart hip follows finished bust (neckline does not change body width).
 */
export function reconcileStraightTorsoChartMeasurements(
  measurements: Record<string, number>,
): Record<string, number> {
  const bust = measurements.finished_bust_chest;
  if (bust === undefined || bust <= 0) return measurements;
  return {
    ...measurements,
    finished_hip: bust,
    finished_waist:
      measurements.finished_waist !== undefined && measurements.finished_waist > 0
        ? measurements.finished_waist
        : bust,
  };
}

/**
 * When chart bust is refreshed, drop stale review hip overrides from another size/fit
 * (e.g. hip 43″ with Men's Med close bust 37″ → erroneous A-line cast-on 86).
 * Intentional straight + wide hip (hip slightly above bust within tolerance) is kept.
 */
export function reconcileStraightTorsoOverridesAfterChartSync(
  chartBustInches: number,
  overrides: Record<string, string>,
): Record<string, string> {
  const next = { ...overrides };
  const overrideBustIn = positiveMeasurementInches(next.chestBust);
  const bustInches =
    overrideBustIn !== undefined && overrideBustIn > 0 ? overrideBustIn : chartBustInches;
  const bustStr = String(bustInches);

  const hipRaw = next.hip?.trim();
  if (!hipRaw) {
    return { ...next, chestBust: next.chestBust ?? bustStr, hip: bustStr };
  }
  const hipIn = parseFloat(hipRaw.replace(/[^\d.-]/g, ""));
  if (
    !Number.isFinite(hipIn) ||
    hipIn > bustInches + SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES
  ) {
    return {
      ...next,
      chestBust: overrideBustIn !== undefined ? next.chestBust! : bustStr,
      hip: bustStr,
    };
  }
  return next;
}

/**
 * Chart sync reconcile must not drop a diagram hip the user already stored (e.g. 43″ on 40″ bust).
 * Used by {@link syncCustomBuildToPatternStorage} only; generator path still uses strict reconcile.
 */
export function reconcileStraightTorsoOverridesPreservingUserHip(
  chartBustInches: number,
  overrides: Record<string, string>,
): Record<string, string> {
  const userHip = overrides.hip?.trim();
  const reconciled = reconcileStraightTorsoOverridesAfterChartSync(chartBustInches, overrides);
  if (userHip && reconciled.hip?.trim() !== userHip) {
    return { ...reconciled, hip: userHip };
  }
  return reconciled;
}

export function computeCustomBuildBodyFinishedFromChartRow(
  row: ChartRow,
  fitPreference: string,
  options?: { bodyShape?: string },
): SleevelessCustomBuildBodyFinishedMeasurements {
  const ease = fitEaseInchesForChoice(fitPreference);
  const bodyBustOrChest = toFiniteNumber(row.bust_or_chest);
  const bodyWaist = toFiniteNumber(row.waist);
  const bodyHip = toFiniteNumber(row.hip) ?? bodyBustOrChest;
  const finishedBustOrChest =
    bodyBustOrChest !== undefined ? roundQuarter(bodyBustOrChest + ease) : undefined;
  const bodyShape = options?.bodyShape ?? "straight";
  const finishedHip =
    finishedBustOrChest !== undefined
      ? bodyShape === "aline" && bodyHip !== undefined
        ? Math.max(finishedBustOrChest, roundQuarter(bodyHip + ease))
        : finishedBustOrChest
      : undefined;
  return {
    ...(bodyBustOrChest !== undefined ? { bodyBustOrChest } : {}),
    ...(bodyWaist !== undefined ? { bodyWaist } : {}),
    ...(bodyHip !== undefined ? { bodyHip } : {}),
    ...(finishedBustOrChest !== undefined
      ? {
          finishedBustOrChest,
          finishedWaist: finishedBustOrChest,
          finishedHip,
        }
      : {}),
  };
}

export type PersistCustomBuildMeasurementsOptions = {
  /** When true, do not overwrite finished* keys already stored in `measurements`. */
  preserveFinished?: boolean;
  /** When true, always refresh body* from the chart seed. */
  refreshBody?: boolean;
};

export function persistCustomBuildBodyFinishedMeasurements(
  partial: SleevelessCustomBuildBodyFinishedMeasurements,
  options: PersistCustomBuildMeasurementsOptions = {},
): SleevelessPatternRecord {
  const current = getCurrentPattern();
  const prev = readCustomBuildBodyFinishedMeasurements(current);
  const next: Record<string, unknown> = { ...current.measurements };

  const bodyKeys: CustomBuildBodyFinishedKey[] = ["bodyBustOrChest", "bodyWaist", "bodyHip"];
  const finishedKeys: CustomBuildBodyFinishedKey[] = [
    "finishedBustOrChest",
    "finishedWaist",
    "finishedHip",
  ];

  if (options.refreshBody !== false) {
    for (const key of bodyKeys) {
      if (partial[key] !== undefined) next[key] = partial[key];
    }
  }

  for (const key of finishedKeys) {
    const incoming = partial[key];
    if (incoming === undefined) continue;
    if (options.preserveFinished && prev[key] !== undefined) continue;
    next[key] = incoming;
  }

  // Skip redundant writes so a repeat sync (e.g. Customize → review re-seed with the same
  // chart row) does not re-stamp `updatedAt` and churn storage. Keeps the sync idempotent.
  if (sectionPatchWouldChange(current.measurements, next)) {
    saveCurrentPattern({ measurements: next });
  }
  const pbMeasurements = getPatternData().measurements;
  const pbMeasurementsBase =
    pbMeasurements && typeof pbMeasurements === "object" && !Array.isArray(pbMeasurements)
      ? (pbMeasurements as Record<string, unknown>)
      : {};
  if (sectionPatchWouldChange(pbMeasurementsBase, next)) {
    savePatternData("measurements", next);
  }
  return getCurrentPattern();
}

/** Seed `measurements` from a chart row without touching `fit.selectedMeasurements`. */
export function seedCustomBuildBodyFinishedFromChartRow(
  row: ChartRow,
  fitPreference: string,
  options: PersistCustomBuildMeasurementsOptions & { bodyShape?: string } = {
    preserveFinished: true,
  },
): SleevelessCustomBuildBodyFinishedMeasurements {
  const computed = computeCustomBuildBodyFinishedFromChartRow(row, fitPreference, {
    bodyShape: options.bodyShape,
  });
  persistCustomBuildBodyFinishedMeasurements(computed, {
    preserveFinished: options.preserveFinished ?? true,
    refreshBody: true,
  });
  return readCustomBuildBodyFinishedMeasurements();
}
