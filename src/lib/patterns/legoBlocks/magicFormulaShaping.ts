/**
 * Pattern-level Magic Formula paired-shaping Lego block.
 *
 * Wraps {@link computeMagicFormulaPairedShaping}, which calls the shared
 * {@link magicFormulaIntervals} primitive. Always Magic Formula for this
 * use case: never slope, never silent event clamping.
 *
 * Do not rewire Sweater or Hat in this pass.
 */

export {
  computeMagicFormulaPairedShaping,
  type MagicFormulaPairedDirection,
  type MagicFormulaPairedEvent,
  type MagicFormulaPairedFailure,
  type MagicFormulaPairedFailureReason,
  type MagicFormulaPairedInput,
  type MagicFormulaPairedResult,
  type MagicFormulaPairedSuccess,
} from "../../shaping/magicFormulaPaired";
