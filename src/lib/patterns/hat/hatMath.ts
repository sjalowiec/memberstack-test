/**
 * Hat pattern math (pure calculation layer).
 *
 * This module is the intended home for hat sizing and shaping math, kept separate
 * from the hat builder UI in `src/pages/patterns/hat.astro`. Wiring the page to
 * these functions is a later step; for now this file only defines types and a
 * placeholder implementation.
 */

/** Inputs used by the hat builder for math (mirrors current UI fields; some optional for forward compatibility). */
export type HatMathInput = {
  headCircumference: number;
  stitchGauge: number;
  rowGauge: number;
  finishedLength: number;
  negativeEase: number;
  crownStyle: string;
  crownDepth: number;
  castOnMultiple?: number;
};

/** Derived values produced by hat math (stitch counts, row counts, notes). */
export type HatMathResult = {
  finishedCircumference: number;
  castOnStitches: number;
  totalRows: number;
  crownStartRow: number;
  crownRows: number;
  finalTopStitches: number;
  notes: string[];
};

/** Outcome of validating a `HatMathResult` (hard errors vs softer warnings). */
export type HatMathValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Placeholder only: returns simple derived values so callers have a stable shape.
 * Real hat logic will replace this in a future change.
 */
export function calculateHatMath(inputs: HatMathInput): HatMathResult {
  const finishedCircumference = inputs.headCircumference - inputs.negativeEase;

  const rawStitches = finishedCircumference * inputs.stitchGauge;
  const roundedStitches = Math.round(rawStitches);

  let castOnStitches: number;
  const castOnMultiple = inputs.castOnMultiple;
  if (castOnMultiple !== undefined && castOnMultiple > 0) {
    // Snap stitch count to nearest multiple of the pattern repeat (ties go up)
    const lower = Math.floor(roundedStitches / castOnMultiple) * castOnMultiple;
    const upper = Math.ceil(roundedStitches / castOnMultiple) * castOnMultiple;
    const distToLower = Math.abs(roundedStitches - lower);
    const distToUpper = Math.abs(upper - roundedStitches);
    if (distToLower < distToUpper) {
      castOnStitches = lower;
    } else if (distToUpper < distToLower) {
      castOnStitches = upper;
    } else {
      castOnStitches = upper;
    }
  } else {
    castOnStitches = roundedStitches;
  }

  const totalRows = Math.round(inputs.finishedLength * inputs.rowGauge);
  const rawCrownRows = inputs.crownDepth * inputs.rowGauge;
  const crownRows = Math.max(0, Math.round(rawCrownRows)); // converts crown depth to rows
  const crownStartRow = Math.max(0, totalRows - crownRows); // marks where crown shaping begins

  const finalTopStitches =
    inputs.crownStyle === 'gathered'
      ? castOnStitches // gathered crown draws the remaining top stitches together
      : 0;

  return {
    finishedCircumference,
    castOnStitches,
    totalRows,
    crownStartRow,
    crownRows,
    finalTopStitches,
    notes: ['Placeholder calculation only'],
  };
}

/**
 * Basic structural checks on calculated hat values. Extend when real math is ported here.
 */
export function validateHatMath(result: HatMathResult): HatMathValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(result.finishedCircumference > 0)) {
    errors.push('Finished circumference must be greater than 0.');
  }
  if (!(result.castOnStitches > 0)) {
    errors.push('Cast-on stitches must be greater than 0.');
  }
  if (!(result.totalRows > 0)) {
    errors.push('Total rows must be greater than 0.');
  }
  if (result.crownRows < 0) {
    errors.push('Crown rows must be 0 or greater.');
  }
  if (result.crownStartRow < 0) {
    errors.push('Crown start row must be 0 or greater.');
  }
  if (result.crownStartRow > result.totalRows) {
    errors.push('Crown start row must not be greater than total rows.');
  }
  if (result.finalTopStitches < 0) {
    errors.push('Final top stitches must be 0 or greater.');
  }

  if (result.crownRows > result.totalRows) {
    warnings.push('Crown rows are greater than total rows.');
  }
  if (result.crownRows === 0) {
    warnings.push('Crown rows are zero. Check crown depth and row gauge.');
  }
  if (result.crownStartRow === result.totalRows) {
    warnings.push('Crown starts at the end of the hat. Check crown depth.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Later: validate against real hat outputs once the full hat math from the UI
 * is implemented here, including crown shaping and stitch multiples.
 */
