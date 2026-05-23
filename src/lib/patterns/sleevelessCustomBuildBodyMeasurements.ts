/**
 * Custom Build body + finished measurement layer (`SleevelessPatternRecord.measurements`).
 * Pattern math still reads `fit.selectedMeasurements` — this layer is storage/UI only for phase 1.
 */
import {
  getCurrentPattern,
  saveCurrentPattern,
  savePatternData,
  type SleevelessPatternRecord,
} from "./patternStorage";
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

const EASE_INCHES_BY_FIT: Record<string, number> = {
  close: 1,
  standard: 3,
  relaxed: 5,
};

function toFiniteNumber(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

function easeInchesForFit(fitPreference: string): number {
  const e = EASE_INCHES_BY_FIT[fitPreference];
  return typeof e === "number" ? e : EASE_INCHES_BY_FIT.standard;
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
export function computeCustomBuildBodyFinishedFromChartRow(
  row: ChartRow,
  fitPreference: string,
  options?: { bodyShape?: string },
): SleevelessCustomBuildBodyFinishedMeasurements {
  const ease = easeInchesForFit(fitPreference);
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

  saveCurrentPattern({ measurements: next });
  savePatternData("measurements", next);
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
