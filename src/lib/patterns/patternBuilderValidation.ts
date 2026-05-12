import { getPatternData, normalizeSleevelessAudience } from "./patternStorage";

/** Stable id per required check; extend when adding new rules. */
export type PatternBuilderRequiredCheckId =
  | "design_choices"
  | "selected_size"
  | "fit_ease"
  | "finished_bust_chest"
  | "gaugeStitchesPerInch"
  | "gaugeRowsPerInch"
  | "availableNeedles";

export type PatternBuilderMissingItem = {
  id: PatternBuilderRequiredCheckId;
  /** User-facing text; may differ from the raw storage field (e.g. size selection vs. a measurement cell). */
  label: string;
  /** Page + fragment to fix this item (optional yarn fields are never listed). */
  href?: string;
};

export type PatternBuilderRequiredValidation = {
  ok: boolean;
  missingItems: PatternBuilderMissingItem[];
};

/** Deep link to the size selection block (unified builder, Fit step). */
export const PATTERN_BUILDER_SIZE_SELECTION_HREF =
  "/patterns/sleeveless/pattern?buildStep=fit#pattern-builder-size-selection";

/** Fine-tune measurements (unified builder, Fit step). */
export const PATTERN_BUILDER_FINE_TUNE_HREF = "/patterns/sleeveless/pattern?buildStep=fit#fine-tune";

/** Garment design step (unified builder, Design step). */
export const PATTERN_BUILDER_DESIGN_HREF =
  "/patterns/sleeveless/pattern?buildStep=design#sleeveless-garment-builder";

/** Fit / ease choice section (unified builder, Fit step). */
export const PATTERN_BUILDER_FIT_EASE_HREF =
  "/patterns/sleeveless/pattern?buildStep=fit#sg-fit-choice-heading";

/** Stitch & row gauge section (unified builder; `yarn` and legacy `gauge` both resolve to the yarn panel). */
export const PATTERN_BUILDER_YARN_GAUGE_SECTION_HREF =
  "/patterns/sleeveless/pattern?buildStep=yarn#sg-yarn-gauge-heading";

/** Available needles (unified builder, yarn step). */
export const PATTERN_BUILDER_YARN_NEEDLES_HREF =
  "/patterns/sleeveless/pattern?buildStep=yarn#sg-yarn-needles-heading";

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

function nonEmptyTrimmed(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function yarnGaugeSection(data: Record<string, unknown>): Record<string, unknown> {
  const y = data.yarnGauge;
  if (y && typeof y === "object" && !Array.isArray(y)) {
    return y as Record<string, unknown>;
  }
  return {};
}

/** Stitch gauge from yarn step and/or wizard mirror (`yarnGauge` / `yarnGaugeMachine`). */
export function patternBuilderStitchGaugeRaw(patternData: Record<string, unknown>): unknown {
  const y = yarnGaugeSection(patternData);
  const ygm = yarnGaugeMachineSection(patternData);
  return y.stitchGauge ?? ygm.gaugeStitchesPerInch;
}

/** Row gauge from yarn step and/or wizard mirror. */
export function patternBuilderRowGaugeRaw(patternData: Record<string, unknown>): unknown {
  const y = yarnGaugeSection(patternData);
  const ygm = yarnGaugeMachineSection(patternData);
  return y.rowGauge ?? ygm.gaugeRowsPerInch;
}

function isFitEaseChoiceComplete(fit: Record<string, unknown>): boolean {
  if (nonEmptyTrimmed(fit.selectedFit)) return true;
  const ease = fit.easeChoice ?? fit.fitChoice;
  return ease === "close" || ease === "standard" || ease === "relaxed";
}

/**
 * Quick Build (`/patterns/sleeveless-express`) sets `style.patternMode` to `"express"` and chart-derived
 * measurements. Used to recognize a complete generator session without requiring every unified
 * Custom Build design field in {@link isSleevelessBuilderNavStyleComplete}.
 */
export function isSleevelessExpressQuickBuildComplete(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): boolean {
  const style = styleSection(patternData);
  if (style.patternMode !== "express") return false;

  const fit = fitSection(patternData);
  const sm = selectedMeasurements(fit);
  const audience =
    normalizeSleevelessAudience(style.recipientCategory) ||
    normalizeSleevelessAudience(fit.sizingChart);
  if (!audience) return false;
  if (!nonEmptyTrimmed(fit.selectedSize)) return false;
  if (!isFitEaseChoiceComplete(fit)) return false;
  if (!isPositiveNumericMeasurement(sm.finished_bust_chest)) return false;

  const stitchRaw = patternBuilderStitchGaugeRaw(patternData);
  const rowRaw = patternBuilderRowGaugeRaw(patternData);
  if (!isPositiveNumericMeasurement(stitchRaw) || !isPositiveNumericMeasurement(rowRaw)) return false;

  const ygm = yarnGaugeMachineSection(patternData);
  if (!isPositiveNumericMeasurement(ygm.availableNeedles)) return false;

  return true;
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
 * Required fields for building / running pattern math (design, fit, gauge, needles).
 * Optional yarn notes / weight are never listed as missing.
 */
export function validatePatternBuilderRequired(
  patternData: Record<string, unknown> = typeof localStorage !== "undefined" ? getPatternData() : {},
): PatternBuilderRequiredValidation {
  const fit = fitSection(patternData);
  const sm = selectedMeasurements(fit);
  const ygm = yarnGaugeMachineSection(patternData);
  const stitchRaw = patternBuilderStitchGaugeRaw(patternData);
  const rowRaw = patternBuilderRowGaugeRaw(patternData);

  const checks: {
    id: PatternBuilderRequiredCheckId;
    label: string;
    href: string;
    complete: boolean;
  }[] = [
    {
      id: "design_choices",
      label: "Complete required design choices",
      href: PATTERN_BUILDER_DESIGN_HREF,
      complete:
        isSleevelessBuilderNavStyleComplete(patternData) ||
        isSleevelessExpressQuickBuildComplete(patternData),
    },
    {
      id: "selected_size",
      label: "Choose a size",
      href: PATTERN_BUILDER_SIZE_SELECTION_HREF,
      complete: nonEmptyTrimmed(fit.selectedSize),
    },
    {
      id: "fit_ease",
      label: "Choose a fit",
      href: PATTERN_BUILDER_FIT_EASE_HREF,
      complete: !nonEmptyTrimmed(fit.selectedSize) || isFitEaseChoiceComplete(fit),
    },
    {
      id: "finished_bust_chest",
      label: "Confirm your bust/chest measurement",
      href: PATTERN_BUILDER_FINE_TUNE_HREF,
      complete: isPositiveNumericMeasurement(sm.finished_bust_chest),
    },
    {
      id: "gaugeStitchesPerInch",
      label: "Enter stitch gauge",
      href: PATTERN_BUILDER_YARN_GAUGE_SECTION_HREF,
      complete: isPositiveNumericMeasurement(stitchRaw),
    },
    {
      id: "gaugeRowsPerInch",
      label: "Enter row gauge",
      href: PATTERN_BUILDER_YARN_GAUGE_SECTION_HREF,
      complete: isPositiveNumericMeasurement(rowRaw),
    },
    {
      id: "availableNeedles",
      label: "Enter available needles",
      href: PATTERN_BUILDER_YARN_NEEDLES_HREF,
      complete: isPositiveNumericMeasurement(ygm.availableNeedles),
    },
  ];

  const missingItems: PatternBuilderMissingItem[] = checks
    .filter((c) => !c.complete)
    .map(({ id, label, href }) => ({ id, label, href }));

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
 * (subset of {@link validatePatternBuilderRequired} — design + yarn checks excluded).
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

function yarnGaugeMachineRaw(data: Record<string, unknown>): Record<string, unknown> {
  const ygm = data.yarnGaugeMachine;
  if (ygm && typeof ygm === "object" && !Array.isArray(ygm)) {
    return ygm as Record<string, unknown>;
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

/**
 * Scroll to the element targeted by a builder deep link (`/path#element-id`).
 * Only the hash is used (`document.querySelector` cannot take a full URL). No-op if there is no `#`,
 * no matching element in the current document, or not in a browser.
 */
export function scrollToPatternBuilderDeepLink(href: string | undefined): void {
  if (typeof document === "undefined" || typeof window === "undefined" || !href) return;
  const idx = href.indexOf("#");
  if (idx === -1) return;
  const id = href.slice(idx + 1).trim();
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
