/**
 * Drop Shoulder — sleeve measurement overrides (`upperArm`, `sleeveLength`, `wrist`).
 *
 * Chart keys: `upper_arm`, `sleeve_length`, `wrist`. On size change, refresh chart-owned
 * overrides unless the user explicitly edited that field in the review session
 * ({@link readDropShoulderUserEditedSleeveFields}).
 */
import { formatSwatchCountForGaugeInput } from "./gaugeDisplayFormat";
import {
  DROP_SHOULDER_SLEEVE_OVERRIDE_KEY_BY_USER_EDITED_FIELD,
  DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS,
  readDropShoulderUserEditedSleeveFields,
  type DropShoulderUserEditedSleeveFields,
} from "./dropShoulderUserEditedSleeveFields";
import {
  dropShoulderSleeveLengthProportion,
  hasAuthoritativeDropShoulderConstruction,
} from "./patternConstructionIdentity";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import { resolveDropShoulderFinishedUpperArmInches } from "./dropShoulderUpperArmAllowance";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

export const DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS = ["upperArm", "sleeveLength", "wrist"] as const;

export type DropShoulderSleeveOverrideKey = (typeof DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS)[number];

const CHART_KEY_BY_OVERRIDE: Record<DropShoulderSleeveOverrideKey, string> = {
  upperArm: "upper_arm",
  sleeveLength: "sleeve_length",
  wrist: "wrist",
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

/**
 * SINGLE SCALING POINT — the sleeve-length picker choice turned into actual sleeve length inches.
 * The full (long) chart/override length scaled by the picker proportion, rounded to the nearest ¼″.
 * Everything that needs the actual sleeve length (generator, summary, diagram read-only display)
 * must call this so the picker drives one value everywhere with no double-scaling.
 */
export function scaleDropShoulderSleeveLengthInches(
  fullInches: number | undefined,
  sleeveLengthChoice: unknown,
): number | undefined {
  if (fullInches === undefined || !Number.isFinite(fullInches)) return undefined;
  return roundQuarter(fullInches * dropShoulderSleeveLengthProportion(sleeveLengthChoice));
}

function parseOverrideInches(raw: string): number | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return roundQuarter(n);
}

function formatOverrideInches(n: number): string {
  return formatSwatchCountForGaugeInput(roundQuarter(n));
}

function overrideInchesEqual(a: string, b: string): boolean {
  const aIn = parseOverrideInches(a);
  const bIn = parseOverrideInches(b);
  if (aIn === undefined || bIn === undefined) return a.trim() === b.trim();
  return aIn === bIn;
}

/** True when pattern data represents an authored drop-shoulder construction. */
export function isDropShoulderPatternData(patternData: Record<string, unknown>): boolean {
  return hasAuthoritativeDropShoulderConstruction(section(patternData.style));
}

/**
 * Chart row → formatted override strings for the three sleeve diagram fields.
 *
 * When `chartAudience` is supplied, the `upperArm` default is the FINISHED Drop Shoulder upper arm
 * (body upper arm + fit allowance) rather than the raw chart body value. See
 * {@link resolveDropShoulderFinishedUpperArmInches}. Without an audience the raw chart value is
 * used (no allowance), so callers that cannot supply a group are unchanged.
 */
export function dropShoulderSleeveDefaultsFromChartRow(
  row: ChartRow,
  fitPreference: string,
  options?: { bodyShape?: string; chartAudience?: string },
): Partial<Record<DropShoulderSleeveOverrideKey, string>> {
  const computed = computeDefaultMeasurementsFromChartRow(row, fitPreference, {
    bodyShape: options?.bodyShape,
  });
  const out: Partial<Record<DropShoulderSleeveOverrideKey, string>> = {};
  for (const overrideKey of DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS) {
    const chartKey = CHART_KEY_BY_OVERRIDE[overrideKey];
    const val = computed[chartKey as keyof typeof computed];
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      out[overrideKey] = formatOverrideInches(val);
    }
  }

  // Replace the raw body upper arm with the finished (allowance-added) value when the group is known.
  if (options?.chartAudience) {
    const finishedUpperArm = resolveDropShoulderFinishedUpperArmInches({
      chartAudience: options.chartAudience,
      fit: fitPreference,
      bodyUpperArmIn: computed.upper_arm,
    });
    if (finishedUpperArm !== undefined && finishedUpperArm > 0) {
      out.upperArm = formatOverrideInches(finishedUpperArm);
    }
  }

  return out;
}

/** selectedMeasurements snake_case keys → formatted override strings. */
export function dropShoulderSleeveDefaultsFromSelectedMeasurements(
  selectedMeasurements: Record<string, number>,
): Partial<Record<DropShoulderSleeveOverrideKey, string>> {
  const out: Partial<Record<DropShoulderSleeveOverrideKey, string>> = {};
  for (const overrideKey of DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS) {
    const chartKey = CHART_KEY_BY_OVERRIDE[overrideKey];
    const val = selectedMeasurements[chartKey];
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      out[overrideKey] = formatOverrideInches(val);
    }
  }
  return out;
}

/** Generator + review — resolved sleeve inches from chart row and explicit user-edit flags. */
export function resolveDropShoulderSleeveInches(args: {
  overrides: Record<string, string>;
  chartRow: ChartRow | null;
  fitPreference: string;
  selectedMeasurements?: Record<string, unknown> | null;
  bodyShape?: string;
  /** Sizing group identity — enables the finished (allowance-added) Drop Shoulder upper arm. */
  chartAudience?: string;
  userEdited?: DropShoulderUserEditedSleeveFields;
  /**
   * Sleeve-length picker choice ("long" | "three-quarter" | "elbow" | "short"). The picker is the
   * single source of truth for sleeve length: the resolved `sleeveLengthIn` is the full chart/override
   * length scaled by this choice's proportion.
   *
   * SINGLE SCALING POINT: scaling happens here (and only here). The stored override always represents
   * the full (long) length; every consumer that needs the *actual* sleeve length inches — generator,
   * summary, and the measurement-diagram read-only display — calls this function so they all agree
   * and nothing double-scales. `resolveDropShoulderSleeveOverrideStrings` intentionally returns the
   * unscaled full length (it also feeds override persistence, which must stay full).
   */
  sleeveLengthChoice?: unknown;
}): {
  upperArmIn?: number;
  wristIn?: number;
  sleeveLengthIn?: number;
} {
  const strings = resolveDropShoulderSleeveOverrideStrings(args);
  const parse = (raw: string | undefined): number | undefined => {
    if (!raw?.trim()) return undefined;
    return parseOverrideInches(raw);
  };
  const userEdited = args.userEdited ?? readDropShoulderUserEditedSleeveFields();
  const fullSleeveLengthIn = parse(strings.sleeveLength);
  const sleeveLengthIn =
    userEdited.sleeveLength === true
      ? fullSleeveLengthIn
      : scaleDropShoulderSleeveLengthInches(fullSleeveLengthIn, args.sleeveLengthChoice);

  return {
    upperArmIn: parse(strings.upperArm),
    wristIn: parse(strings.wrist),
    sleeveLengthIn,
  };
}

/**
 * Sleeve length shown in the Edit Pattern diagram input: the saved override when user-edited,
 * otherwise the picker-scaled actual length (so the field matches generated sleeve rows).
 */
export function dropShoulderEditWorkspaceSleeveLengthDisplayInches(args: {
  overrideInches: string;
  sleeveLengthChoice: unknown;
  userEditedSleeveLength: boolean;
}): string {
  const trimmed = args.overrideInches.trim();
  if (!trimmed) return "";
  if (args.userEditedSleeveLength) return trimmed;
  const scaled = scaleDropShoulderSleeveLengthInches(
    parseOverrideInches(trimmed),
    args.sleeveLengthChoice,
  );
  return scaled !== undefined ? formatOverrideInches(scaled) : trimmed;
}

/**
 * Resolved sleeve override strings for review diagram, measurement editor, and generator.
 * Non-user-edited fields always come from the current chart row.
 *
 * Returns the FULL (unscaled) sleeve length — this feeds override persistence and the single
 * scaling point in {@link resolveDropShoulderSleeveInches}. Do not scale here.
 */
export function resolveDropShoulderSleeveOverrideStrings(args: {
  overrides: Record<string, string>;
  chartRow: ChartRow | null;
  fitPreference: string;
  selectedMeasurements?: Record<string, unknown> | null;
  bodyShape?: string;
  chartAudience?: string;
  userEdited?: DropShoulderUserEditedSleeveFields;
}): Partial<Record<DropShoulderSleeveOverrideKey, string>> {
  const userEdited = args.userEdited ?? readDropShoulderUserEditedSleeveFields();
  const chartDefaults = args.chartRow
    ? dropShoulderSleeveDefaultsFromChartRow(args.chartRow, args.fitPreference, {
        bodyShape: args.bodyShape,
        chartAudience: args.chartAudience,
      })
    : dropShoulderSleeveDefaultsFromSelectedMeasurements(
        snakeCaseMeasurementsFromUnknown(args.selectedMeasurements),
      );

  const out: Partial<Record<DropShoulderSleeveOverrideKey, string>> = {};
  for (const trackKey of DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS) {
    const overrideKey = DROP_SHOULDER_SLEEVE_OVERRIDE_KEY_BY_USER_EDITED_FIELD[
      trackKey
    ] as DropShoulderSleeveOverrideKey;
    const chartVal = chartDefaults[overrideKey];
    if (userEdited[trackKey] === true) {
      const saved = args.overrides[overrideKey]?.trim();
      if (saved) out[overrideKey] = saved;
      else if (chartVal) out[overrideKey] = chartVal;
    } else if (chartVal) {
      out[overrideKey] = chartVal;
    }
  }
  return out;
}

function snakeCaseMeasurementsFromUnknown(
  sm: Record<string, unknown> | null | undefined,
): Record<string, number> {
  if (!sm || typeof sm !== "object" || Array.isArray(sm)) return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(sm)) {
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n > 0) out[key] = n;
  }
  return out;
}

/**
 * On garment size change: replace chart-owned sleeve overrides from the new row unless the
 * user explicitly edited that field in the current review session.
 */
export function reconcileDropShoulderSleeveOverridesForSizeChange(
  overrides: Record<string, string>,
  chartRow: ChartRow,
  fitPreference: string,
  userEdited: DropShoulderUserEditedSleeveFields = readDropShoulderUserEditedSleeveFields(),
  options?: { bodyShape?: string; chartAudience?: string },
): Record<string, string> {
  const next = { ...overrides };
  const chartDefaults = dropShoulderSleeveDefaultsFromChartRow(chartRow, fitPreference, options);

  for (const trackKey of DROP_SHOULDER_USER_EDITED_SLEEVE_FIELD_KEYS) {
    const overrideKey = DROP_SHOULDER_SLEEVE_OVERRIDE_KEY_BY_USER_EDITED_FIELD[
      trackKey
    ] as DropShoulderSleeveOverrideKey;
    const chartVal = chartDefaults[overrideKey];
    if (userEdited[trackKey] === true) continue;
    if (chartVal) next[overrideKey] = chartVal;
    else delete next[overrideKey];
  }

  return next;
}

/** @deprecated Prefer {@link reconcileDropShoulderSleeveOverridesForSizeChange} with user-edit flags. */
function reconcileDropShoulderSleeveOverridesWithDefaults(
  chartDefaults: Partial<Record<DropShoulderSleeveOverrideKey, string>>,
  overrides: Record<string, string>,
  previousSelectedMeasurements?: Record<string, number> | null,
): Record<string, string> {
  const next = { ...overrides };

  for (const overrideKey of DROP_SHOULDER_SLEEVE_OVERRIDE_KEYS) {
    const chartKey = CHART_KEY_BY_OVERRIDE[overrideKey];
    const newDefault = chartDefaults[overrideKey];
    const current = next[overrideKey]?.trim();

    if (!newDefault) {
      delete next[overrideKey];
      continue;
    }

    if (!current) continue;

    const prevChartVal = previousSelectedMeasurements?.[chartKey];
    const prevDefault =
      typeof prevChartVal === "number" && Number.isFinite(prevChartVal) && prevChartVal > 0
        ? formatOverrideInches(prevChartVal)
        : undefined;

    if (
      !prevDefault ||
      overrideInchesEqual(current, prevDefault) ||
      overrideInchesEqual(current, newDefault)
    ) {
      next[overrideKey] = newDefault;
    }
  }

  return next;
}

/**
 * When the selected chart row changes, refresh sleeve overrides that still match the prior chart
 * (chart-seeded values). Intentional user edits (override ≠ previous chart default) are kept.
 */
export function reconcileDropShoulderSleeveOverridesAfterChartSync(
  chartRow: ChartRow,
  fitPreference: string,
  overrides: Record<string, string>,
  previousSelectedMeasurements?: Record<string, number> | null,
  options?: { bodyShape?: string; chartAudience?: string },
): Record<string, string> {
  const chartDefaults = dropShoulderSleeveDefaultsFromChartRow(chartRow, fitPreference, options);
  return reconcileDropShoulderSleeveOverridesWithDefaults(
    chartDefaults,
    overrides,
    previousSelectedMeasurements,
  );
}

/** Generator path — reconcile from `fit.selectedMeasurements` already on the draft. */
export function reconcileDropShoulderSleeveOverridesFromSelectedMeasurements(
  selectedMeasurements: Record<string, number>,
  overrides: Record<string, string>,
  previousSelectedMeasurements?: Record<string, number> | null,
): Record<string, string> {
  const chartDefaults = dropShoulderSleeveDefaultsFromSelectedMeasurements(selectedMeasurements);
  return reconcileDropShoulderSleeveOverridesWithDefaults(
    chartDefaults,
    overrides,
    previousSelectedMeasurements,
  );
}
