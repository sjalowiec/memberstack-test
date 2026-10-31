/**
 * Laid-open set-in sleeve, shared by the edit diagram, Stitches & Rows, and
 * Shaping Notation.
 *
 * The drawing is the whole sleeve piece before seaming. Widths are full
 * circumferences. One finished inch is the same distance on both axes.
 * A stitch position is stitches ÷ stitch gauge. A row position is rows ÷ row
 * gauge. Those inches then use the shared scale. A stitch and a row are not
 * the same distance unless the two gauges match.
 */

export const SET_IN_SLEEVE_PX_PER_INCH = 20;

/** Marker published with the schematic so a deploy can be checked in the page source. */
export const SET_IN_SLEEVE_SCHEMATIC_ID = "laid-open-gauge-v1";

/** Full circumference. This schematic does not fold the sleeve in half. */
export function setInSleeveFlatWidthInches(circumferenceInches: number): number {
  if (!Number.isFinite(circumferenceInches) || circumferenceInches <= 0) return 0;
  return circumferenceInches;
}

export function setInSleeveInchesFromStitches(stitches: number, stitchesPerInch: number): number {
  if (!Number.isFinite(stitches) || !(stitchesPerInch > 0)) return 0;
  return stitches / stitchesPerInch;
}

export function setInSleeveInchesFromRows(rows: number, rowsPerInch: number): number {
  if (!Number.isFinite(rows) || !(rowsPerInch > 0)) return 0;
  return rows / rowsPerInch;
}

export type SetInSleeveCapEdgeInches = {
  widthInches: number;
  /** Distance above the underarm. */
  upInches: number;
};

/**
 * Cap outline in finished inches. Width uses the stitch gauge. Height uses
 * the row gauge. Endpoints stay on the finished upper-arm and cap-top widths
 * and on the finished cap height.
 */
export function setInSleeveCapEdgeInches(
  marks: readonly { rowsFromCapStart: number; stitches: number }[],
  stitchesPerInch: number,
  rowsPerInch: number,
  finished?: { upperArmInches?: number; topWidthInches?: number; capHeightInches?: number },
): SetInSleeveCapEdgeInches[] {
  const edge = marks.map((mark) => ({
    widthInches: setInSleeveFlatWidthInches(
      setInSleeveInchesFromStitches(mark.stitches, stitchesPerInch),
    ),
    upInches: Math.max(0, setInSleeveInchesFromRows(mark.rowsFromCapStart, rowsPerInch)),
  }));
  if (edge.length === 0) return edge;
  const upper = finished?.upperArmInches;
  const top = finished?.topWidthInches;
  const cap = finished?.capHeightInches;
  if (upper !== undefined && upper > 0) edge[0]!.widthInches = upper;
  if (top !== undefined && top > 0) edge[edge.length - 1]!.widthInches = top;
  if (cap !== undefined && cap > 0) edge[edge.length - 1]!.upInches = cap;
  return edge;
}

export type SetInSleeveLaidOpenGeometry = {
  pxPerInch: number;
  schematicId: typeof SET_IN_SLEEVE_SCHEMATIC_ID;
  midX: number;
  /** Underarm. The cap is above this line. Y increases downward. */
  underarmY: number;
  capTopY: number;
  cuffJoinY: number;
  wristY: number;
  upperWidthPx: number;
  wristWidthPx: number;
  topWidthPx: number;
  sleeveLengthPx: number;
  capHeightPx: number;
  cuffDepthPx: number;
  bodyPx: number;
  /** Upper-arm width ÷ cuff-to-underarm length, in the same pixels. */
  widthToLength: number;
  upperLeft: number;
  upperRight: number;
  wristLeft: number;
  wristRight: number;
  topLeft: number;
  topRight: number;
  capEdge: { y: number; left: number; right: number }[];
};

export function buildSetInSleeveLaidOpenGeometry(input: {
  upperArmInches: number;
  wristInches: number;
  /** Cuff to underarm. Includes cuff depth. */
  sleeveLengthInches: number;
  cuffDepthInches: number;
  capHeightInches: number;
  topWidthInches: number;
  capEdgeInches?: readonly SetInSleeveCapEdgeInches[];
  /** Center of the sleeve. */
  midX?: number;
  /** Underarm y. Y increases downward. */
  underarmY?: number;
  pxPerInch?: number;
}): SetInSleeveLaidOpenGeometry {
  const pxPerInch = input.pxPerInch && input.pxPerInch > 0 ? input.pxPerInch : SET_IN_SLEEVE_PX_PER_INCH;
  const midX = input.midX ?? 0;
  const underarmY = input.underarmY ?? 0;
  const upperArmInches = positive(input.upperArmInches, 1);
  const wristInches = positive(input.wristInches, 0.5);
  const sleeveLengthInches = positive(input.sleeveLengthInches, 1);
  const cuffDepthInches = Math.max(0, Math.min(finite(input.cuffDepthInches), sleeveLengthInches));
  const bodyInches = Math.max(0, sleeveLengthInches - cuffDepthInches);
  const capHeightInches = Math.max(0, finite(input.capHeightInches));
  const topWidthInches = positive(input.topWidthInches, upperArmInches);
  const upperWidthPx = setInSleeveFlatWidthInches(upperArmInches) * pxPerInch;
  const wristWidthPx = setInSleeveFlatWidthInches(wristInches) * pxPerInch;
  const topWidthPx = setInSleeveFlatWidthInches(topWidthInches) * pxPerInch;
  const cuffDepthPx = cuffDepthInches * pxPerInch;
  const bodyPx = bodyInches * pxPerInch;
  const capHeightPx = capHeightInches * pxPerInch;
  const sleeveLengthPx = bodyPx + cuffDepthPx;
  const capEdge = (input.capEdgeInches ?? []).map((point) => {
    const width = setInSleeveFlatWidthInches(point.widthInches) * pxPerInch;
    return {
      y: underarmY - Math.max(0, point.upInches) * pxPerInch,
      left: midX - width / 2,
      right: midX + width / 2,
    };
  });
  const capTopY = capEdge.length > 0 ? Math.min(...capEdge.map((point) => point.y)) : underarmY - capHeightPx;
  return {
    pxPerInch,
    schematicId: SET_IN_SLEEVE_SCHEMATIC_ID,
    midX,
    underarmY,
    capTopY,
    cuffJoinY: underarmY + bodyPx,
    wristY: underarmY + sleeveLengthPx,
    upperWidthPx,
    wristWidthPx,
    topWidthPx,
    sleeveLengthPx,
    capHeightPx: underarmY - capTopY,
    cuffDepthPx,
    bodyPx,
    widthToLength: sleeveLengthPx > 0 ? upperWidthPx / sleeveLengthPx : 0,
    upperLeft: midX - upperWidthPx / 2,
    upperRight: midX + upperWidthPx / 2,
    wristLeft: midX - wristWidthPx / 2,
    wristRight: midX + wristWidthPx / 2,
    topLeft: midX - topWidthPx / 2,
    topRight: midX + topWidthPx / 2,
    capEdge,
  };
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
