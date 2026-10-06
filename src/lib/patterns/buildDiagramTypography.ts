/**
 * Build/Edit measurement diagram typography.
 *
 * Scaling matches the Hat diagram scaler: font user-units grow with the
 * viewBox width so type holds its size when the SVG is `width: 100%`
 * (`screen px = fontSize / viewBoxWidth × art width`).
 *
 * The floors are Build/Edit sizes, chosen so a Sideways body diagram about
 * 750px wide shows a 22px value, an 18px name, and a 14–15px note.
 * Hat's own sizes are not changed.
 */
import {
  HAT_DIAGRAM_FONT_FAMILY,
  HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH,
} from "./hat/hatDiagramTypography";

/** Same reference width the Hat scaler uses. */
export const BUILD_DIAGRAM_REFERENCE_VIEWBOX_WIDTH = HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH;

/**
 * SVG width of the Sideways edit diagram in the two-column desktop workspace
 * (about a 1280px window: measure column minus the chip gutter).
 * Used to turn user-units into approximate on-screen pixels.
 */
export const BUILD_DIAGRAM_DESKTOP_ART_PX = 750;

/**
 * Floor sizes on the 430-wide reference canvas.
 * value is the prominent measurement number.
 * name is the measurement name.
 * support is a construction note.
 * section matches the name so a structural word does not outrank the number.
 */
export const BUILD_DIAGRAM_TYPE_FLOOR = {
  value: 13,
  name: 11,
  support: 8,
  section: 11,
} as const;

export const BUILD_DIAGRAM_TYPE_WEIGHT = {
  value: 700,
  name: 600,
  support: 500,
  section: 600,
} as const;

export type BuildDiagramTypeRole = keyof typeof BUILD_DIAGRAM_TYPE_FLOOR;

export type BuildDiagramTypography = {
  fontFamily: string;
  /** ViewBox width these sizes were resolved against. */
  viewBoxWidth: number;
  /** Measurement value. Larger and heavier than `name`. */
  value: number;
  valueWeight: number;
  /** Measurement name. Readable, smaller than the value. */
  name: number;
  nameWeight: number;
  /** Construction / supporting annotation. Smaller than the name. */
  support: number;
  supportWeight: number;
  /** Section / structural label. Same step as the name. */
  section: number;
  sectionWeight: number;
  /** Baseline offset from a name line down to its measurement value. */
  valueLineGap: number;
};

/** Font size for one Build/Edit role, scaled the same way Hat scales. */
export function buildDiagramFontSize(role: BuildDiagramTypeRole, viewBoxWidth: number): number {
  const floor = BUILD_DIAGRAM_TYPE_FLOOR[role];
  const reference = BUILD_DIAGRAM_REFERENCE_VIEWBOX_WIDTH;
  if (!(viewBoxWidth > 0) || !(reference > 0)) return floor;
  if (viewBoxWidth === reference) return floor;
  return Math.max(1, Math.round(floor * (viewBoxWidth / reference)));
}

/** Resolved Build/Edit sizes for one diagram canvas. Does not change Hat sizes. */
export function buildDiagramTypographyForViewBox(viewBoxWidth: number): BuildDiagramTypography {
  const value = buildDiagramFontSize("value", viewBoxWidth);
  const name = buildDiagramFontSize("name", viewBoxWidth);
  const support = buildDiagramFontSize("support", viewBoxWidth);
  const section = buildDiagramFontSize("section", viewBoxWidth);
  const valueLineGap = Math.max(name + 4, Math.round(value * 1.15));
  return {
    fontFamily: HAT_DIAGRAM_FONT_FAMILY,
    viewBoxWidth,
    value,
    valueWeight: BUILD_DIAGRAM_TYPE_WEIGHT.value,
    name,
    nameWeight: BUILD_DIAGRAM_TYPE_WEIGHT.name,
    support,
    supportWeight: BUILD_DIAGRAM_TYPE_WEIGHT.support,
    section,
    sectionWeight: BUILD_DIAGRAM_TYPE_WEIGHT.section,
    valueLineGap,
  };
}

/** Approximate CSS pixels for a font drawn in an SVG of `artWidthPx`. */
export function buildDiagramOnScreenPx(
  fontUserUnits: number,
  viewBoxWidth: number,
  artWidthPx: number = BUILD_DIAGRAM_DESKTOP_ART_PX,
): number {
  if (!(viewBoxWidth > 0)) return fontUserUnits;
  return (fontUserUnits * artWidthPx) / viewBoxWidth;
}
