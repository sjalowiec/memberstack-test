/**
 * Pattern-level Gauge Sanity Check Lego block.
 *
 * Sweater and Hat builders already evaluate unusual gauge entries through
 * `src/lib/patterns/gaugeSanity.ts` (DIY Blanket 4-inch / 10 cm bounds).
 * This block is the stable entry point for Socks and future Pattern Systems
 * so they share that same rule set without duplicating bounds or copy.
 *
 * Do not change the evaluator here. Do not rewire Sweater or Hat in this pass.
 */

export {
  evaluateGaugeSanity,
  formatGaugeSanityWarningBody,
  gaugeSanityAcknowledgementKey,
  gaugeSanityBlocksProceed,
  GAUGE_SANITY_CONTINUE_LABEL,
  GAUGE_SANITY_MAX_ROWS_PER_INCH,
  GAUGE_SANITY_MAX_STITCHES_PER_INCH,
  GAUGE_SANITY_MIN_ROWS_PER_INCH,
  GAUGE_SANITY_MIN_STITCHES_PER_INCH,
  GAUGE_SANITY_WARNING_HEADING,
  toGaugeSanityUnit,
  type GaugeSanityReason,
  type GaugeSanityResult,
  type GaugeSanityUnit,
} from "../gaugeSanity";
