/**
 * Sleeveless A-line hip guardrails — add product-approved inch/stitch limits here.
 *
 * Validation and shaping both read these constants. No hip min/max rules existed in the
 * codebase before A-line; adjust values after design sign-off.
 */

/** Maximum finished hip circumference above finished bust (inches) before validation warns. */
export const SLEEVELESS_ALINE_HIP_MAX_INCHES_ABOVE_BUST = 4;

/**
 * Maximum side-seam stitch change (per back/half piece) as a fraction of bust body stitches.
 * Prevents extreme decrease counts when hip is very wide for the available body rows.
 */
export const SLEEVELESS_ALINE_MAX_SIDE_STITCH_CHANGE_RATIO = 0.35;
