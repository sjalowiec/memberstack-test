/**
 * Shaping Utilities
 * 
 * Reusable "lego block" utilities for generating and displaying
 * knitting shaping instructions across the Knit it Now site.
 */

export {
  generateRowByRow,
  generateDecreaseBreakdown,
  generateIncreaseBreakdown,
  type ShapingStep,
  type RowEntry,
  type GenerateRowByRowOptions,
} from './generateRowByRow';

export {
  computeAutoShaping,
  magicFormulaIntervals,
  type AutoShapingInput,
  type AutoShapingResult,
  type ShapingMethod,
  type ShapingDirection,
  type StructuredShapingStep,
} from './autoShaping';

export {
  computeMagicFormulaPairedShaping,
  type MagicFormulaPairedDirection,
  type MagicFormulaPairedEvent,
  type MagicFormulaPairedFailure,
  type MagicFormulaPairedFailureReason,
  type MagicFormulaPairedInput,
  type MagicFormulaPairedResult,
  type MagicFormulaPairedSuccess,
} from './magicFormulaPaired';
