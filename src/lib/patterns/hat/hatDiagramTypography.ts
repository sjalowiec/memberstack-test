/**
 * Shared hat diagram typography.
 *
 * Stitches & Rows (`viewBox` width 430) is the visual source of truth. When both
 * SVGs render at `width: 100%` in the same panel, CSS pixel size scales as
 * `fontSize / viewBoxWidth`. Shaping Notation (width 400) therefore uses scaled
 * numeric sizes so labels match Stitches & Rows on screen — not the same raw
 * numbers copied across different viewBoxes.
 */

export const HAT_DIAGRAM_FONT_FAMILY = "Poppins, system-ui, Arial, sans-serif";

/** Body / Brim / crown titles */
export const HAT_DIAGRAM_SECTION_WEIGHT = 600;

/** Stitches & Rows canvas width — reference for visual font scaling. */
export const HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH = 430;

/**
 * Canonical font sizes in Stitches & Rows user units (reference viewBox).
 * Roles map to equivalent labels across both diagrams.
 */
export const HAT_DIAGRAM_TYPE = {
  /** Body, Brim / Single Layer / Folded Hem / Rolled Brim */
  section: 23,
  /** Gather, Crown · 4 gores, Crown · Swirl, Crown */
  crownTitle: 21,
  /** Row counts, lengths, RC, CO, shaping instruction lines */
  measure: 21,
  /** Cast-on primary (Stitches & Rows) */
  stitch: 23,
  /** Width under cast-on */
  stitchSecondary: 21,
  /** Per-gore stitch counts, decrease-point callouts */
  detail: 18,
  /** Gore numbers #1–#4 */
  gore: 20,
  /** fold, gather, minor annotations */
  small: 18,
  /** Total caption */
  support: 20,
} as const;

export type HatDiagramTypeRole = keyof typeof HAT_DIAGRAM_TYPE;

/**
 * Font size for a diagram viewBox that matches the Stitches & Rows visual size
 * when both SVGs are `width: 100%` in the same container.
 */
export function hatDiagramFontSize(
  role: HatDiagramTypeRole,
  viewBoxWidth: number,
  referenceViewBoxWidth: number = HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH,
): number {
  const canonical = HAT_DIAGRAM_TYPE[role];
  if (!(viewBoxWidth > 0) || !(referenceViewBoxWidth > 0)) return canonical;
  if (viewBoxWidth === referenceViewBoxWidth) return canonical;
  return Math.max(1, Math.round(canonical * (viewBoxWidth / referenceViewBoxWidth)));
}

export type HatDiagramTypography = {
  fontFamily: string;
  sectionWeight: number;
  section: number;
  crownTitle: number;
  measure: number;
  stitch: number;
  stitchSecondary: number;
  detail: number;
  gore: number;
  small: number;
  support: number;
};

/** Resolved sizes for one diagram canvas. */
export function hatDiagramTypographyForViewBox(viewBoxWidth: number): HatDiagramTypography {
  return {
    fontFamily: HAT_DIAGRAM_FONT_FAMILY,
    sectionWeight: HAT_DIAGRAM_SECTION_WEIGHT,
    section: hatDiagramFontSize("section", viewBoxWidth),
    crownTitle: hatDiagramFontSize("crownTitle", viewBoxWidth),
    measure: hatDiagramFontSize("measure", viewBoxWidth),
    stitch: hatDiagramFontSize("stitch", viewBoxWidth),
    stitchSecondary: hatDiagramFontSize("stitchSecondary", viewBoxWidth),
    detail: hatDiagramFontSize("detail", viewBoxWidth),
    gore: hatDiagramFontSize("gore", viewBoxWidth),
    small: hatDiagramFontSize("small", viewBoxWidth),
    support: hatDiagramFontSize("support", viewBoxWidth),
  };
}
