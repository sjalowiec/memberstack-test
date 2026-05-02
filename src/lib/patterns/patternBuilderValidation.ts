import { getPatternData, normalizeSleevelessAudience } from "./patternStorage";

/** Stable id per required check; extend when adding new rules. */
export type PatternBuilderRequiredCheckId =
  | "finished_bust_chest"
  | "gaugeStitchesPerInch"
  | "gaugeRowsPerInch"
  | "availableNeedles";

export type PatternBuilderMissingItem = {
  id: PatternBuilderRequiredCheckId;
  /** User-facing text; may differ from the raw storage field (e.g. size selection vs. a measurement cell). */
  label: string;
};

export type PatternBuilderRequiredValidation = {
  ok: boolean;
  missingItems: PatternBuilderMissingItem[];
};

/** Deep link to the size selection block on the fit page. */
export const PATTERN_BUILDER_SIZE_SELECTION_HREF = "/patterns/sleeveless-fit#pattern-builder-size-selection";

/** Fine-tune measurements (finished bust/chest, etc.) on the fit page. */
export const PATTERN_BUILDER_FINE_TUNE_HREF = "/patterns/sleeveless-fit#fine-tune";

/**
 * True if `value` is a positive finite number, or a string that parses to one (e.g. `42"`, ` 36 `).
 * Blank, zero, negative, non-numeric, and placeholder text are incomplete.
 */
export function isPositiveNumericMeasurement(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0;
  }
  const s = String(value).trim();
  if (!s) return false;
  if (/not\s+set/i.test(s)) return false;
  const direct = Number(s);
  if (Number.isFinite(direct) && direct > 0) return true;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return false;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0;
}

function yarnGaugeMachineSection(data: Record<string, unknown>): Record<string, unknown> {
  const ygm = data.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    return ygm as Record<string, unknown>;
  }
  return {};
}

function fitSection(data: Record<string, unknown>): Record<string, unknown> {
  const fit = data.fit;
  if (fit && typeof fit === "object" && !Array.isArray(fit)) {
    return fit as Record<string, unknown>;
  }
  return {};
}

function selectedMeasurements(fit: Record<string, unknown>): Record<string, unknown> {
  const sm = fit.selectedMeasurements;
  if (sm && typeof sm === "object" && !Array.isArray(sm)) {
    return sm as Record<string, unknown>;
  }
  return {};
}

/**
 * Required fields for building / running pattern math. Extend the checks array when adding rules.
 */
export function validatePatternBuilderRequired(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): PatternBuilderRequiredValidation {
  const fit = fitSection(patternData);
  const sm = selectedMeasurements(fit);
  const ygm = yarnGaugeMachineSection(patternData);

  const checks: { id: PatternBuilderRequiredCheckId; label: string; complete: boolean }[] = [
    {
      id: "finished_bust_chest",
      label: "Finished bust/chest (Fine-tune the fit)",
      complete: isPositiveNumericMeasurement(sm.finished_bust_chest),
    },
    {
      id: "gaugeStitchesPerInch",
      label: "Stitch gauge",
      complete: isPositiveNumericMeasurement(ygm.gaugeStitchesPerInch),
    },
    {
      id: "gaugeRowsPerInch",
      label: "Row gauge",
      complete: isPositiveNumericMeasurement(ygm.gaugeRowsPerInch),
    },
    {
      id: "availableNeedles",
      label: "Available needles",
      complete: isPositiveNumericMeasurement(ygm.availableNeedles),
    },
  ];

  const missingItems: PatternBuilderMissingItem[] = checks
    .filter((c) => !c.complete)
    .map(({ id, label }) => ({ id, label }));

  return {
    ok: missingItems.length === 0,
    missingItems,
  };
}

function styleSection(data: Record<string, unknown>): Record<string, unknown> {
  const st = data.style;
  if (st && typeof st === "object" && !Array.isArray(st)) {
    return st as Record<string, unknown>;
  }
  return {};
}

/**
 * True when the style step has a saved audience (who you are knitting for),
 * or a mirrored sizing chart from the legacy fit mirror write.
 */
export function isPatternBuilderStyleComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const style = styleSection(patternData);
  const cat = style.recipientCategory;
  if (typeof cat === "string" && cat.trim() !== "") return true;
  const fit = fitSection(patternData);
  const chart = fit.sizingChart;
  return typeof chart === "string" && chart.trim() !== "";
}

/**
 * True when the fit step has a size, ease choice, and a positive finished bust/chest
 * (matches the fit portion of {@link validatePatternBuilderRequired}).
 */
export function isPatternBuilderFitComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const fit = fitSection(patternData);
  if (!fit.selectedSize || String(fit.selectedSize).trim() === "") return false;
  const ease = fit.easeChoice ?? fit.fitChoice;
  if (ease !== "close" && ease !== "standard" && ease !== "relaxed") return false;
  const sm = selectedMeasurements(fit);
  return isPositiveNumericMeasurement(sm.finished_bust_chest);
}

function nonEmptyTrimmed(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function yarnGaugeMachineRaw(data: Record<string, unknown>): Record<string, unknown> {
  const ygm = data.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    return ygm as Record<string, unknown>;
  }
  return {};
}

function yarnGaugeSection(data: Record<string, unknown>): Record<string, unknown> {
  const y = data.yarnGauge;
  if (y && typeof y === "object" && !Array.isArray(y)) {
    return y as Record<string, unknown>;
  }
  return {};
}

/**
 * Sleeveless builder nav: style step has audience, shape, front, length, and neckline
 * (see `patternBuilderData.style`; audience may also be implied from `fit.sizingChart` when mirrored from garment).
 */
export function isSleevelessBuilderNavStyleComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const style = styleSection(patternData);
  const fit = fitSection(patternData);
  const audience =
    normalizeSleevelessAudience(style.recipientCategory) ||
    normalizeSleevelessAudience(fit.sizingChart);
  if (!audience) return false;
  if (!nonEmptyTrimmed(style.bodyShape)) return false;
  if (!nonEmptyTrimmed(style.frontStyle)) return false;
  if (!nonEmptyTrimmed(style.length)) return false;
  if (!nonEmptyTrimmed(style.neckline)) return false;
  return true;
}

/**
 * Nav fit step: size plus a fit/ease selection. Persisted as `selectedFit` or `easeChoice` / `fitChoice`.
 */
export function isSleevelessBuilderNavFitComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const fit = fitSection(patternData);
  if (!nonEmptyTrimmed(fit.selectedSize)) return false;
  if (nonEmptyTrimmed(fit.selectedFit)) return true;
  const ease = fit.easeChoice ?? fit.fitChoice;
  return ease === "close" || ease === "standard" || ease === "relaxed";
}

/**
 * Nav yarn step: stitch and row gauge from `yarnGauge` and/or `yarnGaugeMachine` mirror.
 */
export function isSleevelessBuilderNavYarnComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const y = yarnGaugeSection(patternData);
  const ygm = yarnGaugeMachineRaw(patternData);
  const stitch = y.stitchGauge ?? ygm.gaugeStitchesPerInch;
  const row = y.rowGauge ?? ygm.gaugeRowsPerInch;
  return isPositiveNumericMeasurement(stitch) && isPositiveNumericMeasurement(row);
}
