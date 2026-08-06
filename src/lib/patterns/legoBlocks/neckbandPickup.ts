/**
 * Shared LEGO block: neckband pickup along a shaped neckline.
 *
 * Pure geometry → pickup counts for any pattern that picks up a neckband
 * (Sleeveless, Drop Shoulder, and future constructions). Does not reshape
 * neckline dimensions; consumes final calculated stitch/row geometry only.
 *
 * Rounding rule (documented, used everywhere in this module):
 *   Whole-number stitch counts use `Math.round` (nearest integer; ties round
 *   away from zero toward +∞ for positive values — standard JS half-up).
 *   Row counts used as display/`Y` values are non-negative integers via
 *   `Math.max(0, Math.round(...))` on the supplied geometry (already whole
 *   from generators). Gauge conversion never applies an extra inch/cm factor:
 *   stitch and row counts are unitless; only the ratio stitchesPerUnit/rowsPerUnit
 *   matters, and both gauges must share the same length basis.
 */

export type NeckbandPickupNecklineKind = "v-neck" | "round";

export type NeckbandPickupGeometryInput = {
  neckline: NeckbandPickupNecklineKind;
  /**
   * Horizontal center-neck stitches on the front (round only).
   * From the front round-neck plan’s `centerBindOff` (full neck opening N).
   */
  frontCenterNeckStitches?: number;
  /**
   * Horizontal center-neck stitches on the back (round only).
   * From the back / shallow plan’s `centerBindOff`.
   */
  backCenterNeckStitches?: number;
  /** Front neckline depth in rows (one side’s vertical/diagonal edge budget). */
  frontNeckDepthRows: number;
  /** Back neckline depth in rows (one side’s vertical/diagonal edge budget). */
  backNeckDepthRows: number;
  /** Stitch gauge (per inch or per cm — same basis as row gauge). */
  stitchesPerUnit: number;
  /** Row gauge (same length basis as stitch gauge). */
  rowsPerUnit: number;
};

/**
 * Internal section breakdown (not shown to knitters). Useful for tests and
 * for verifying round totals include center + converted curved edges.
 */
export type NeckbandPickupSections = {
  /** Sum of front + back horizontal center stitches (0 for V-neck). */
  centerNeckStitches: number;
  /**
   * Total row-edge length around the neckline: left+right on front and back =
   * `2 * (frontNeckDepthRows + backNeckDepthRows)`.
   */
  necklineEdgeRows: number;
  /** Edge rows converted to stitches via stitch/row gauge. */
  curvedEdgePickupStitches: number;
};

export type NeckbandPickupVNeckResult = {
  kind: "v-neck";
  /** X — stitches to pick up over the neckline row edges. */
  pickupStitches: number;
  /** Y — total neckline edge rows around the opening. */
  necklineEdgeRows: number;
  sections: NeckbandPickupSections;
};

export type NeckbandPickupRoundResult = {
  kind: "round";
  /** Estimated total pickup around the neckline (center + curved edges). */
  pickupStitches: number;
  sections: NeckbandPickupSections;
};

export type NeckbandPickupResult = NeckbandPickupVNeckResult | NeckbandPickupRoundResult;

export type NeckbandPickupInstructionViewModel = {
  kind: NeckbandPickupNecklineKind;
  /** Primary finishing sentence for view + print. */
  primaryText: string;
  /**
   * Round-neck estimate disclaimer. Undefined for V-neck.
   * Always present when `kind === "round"`.
   */
  estimateNoteText?: string;
  /** Whole-number pickup stitch count used in `primaryText`. */
  pickupStitches: number;
  /** V-neck only: whole-number row count Y. */
  necklineEdgeRows?: number;
};

/** Canonical round-neck estimate note (single source of wording). */
export const NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE =
  "This is an estimate. Adjust the number slightly if needed so the neckband lies flat without pulling or flaring.";

/**
 * Convert a row-edge length to pickup stitches using stitch and row gauge.
 *
 * `pickup = round(rows * stitchesPerUnit / rowsPerUnit)`
 *
 * No inch/cm conversion — gauges must already share a length basis.
 */
export function pickupStitchesFromRowEdge(
  rowCount: number,
  stitchesPerUnit: number,
  rowsPerUnit: number,
): number {
  const rows = Math.max(0, Math.round(Number(rowCount)));
  if (rows === 0) return 0;
  const spi = Number(stitchesPerUnit);
  const rpi = Number(rowsPerUnit);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return 0;
  }
  return Math.round((rows * spi) / rpi);
}

/** Left+right on front and back. */
export function necklineEdgeRowsAroundOpening(
  frontNeckDepthRows: number,
  backNeckDepthRows: number,
): number {
  const front = Math.max(0, Math.round(Number(frontNeckDepthRows)));
  const back = Math.max(0, Math.round(Number(backNeckDepthRows)));
  return 2 * (front + back);
}

function wholeNonNeg(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/**
 * Calculate neckband pickup from final neckline geometry + gauge.
 */
export function calculateNeckbandPickup(input: NeckbandPickupGeometryInput): NeckbandPickupResult {
  const necklineEdgeRows = necklineEdgeRowsAroundOpening(
    input.frontNeckDepthRows,
    input.backNeckDepthRows,
  );
  const curvedEdgePickupStitches = pickupStitchesFromRowEdge(
    necklineEdgeRows,
    input.stitchesPerUnit,
    input.rowsPerUnit,
  );

  if (input.neckline === "v-neck") {
    const sections: NeckbandPickupSections = {
      centerNeckStitches: 0,
      necklineEdgeRows,
      curvedEdgePickupStitches,
    };
    return {
      kind: "v-neck",
      pickupStitches: curvedEdgePickupStitches,
      necklineEdgeRows,
      sections,
    };
  }

  const centerNeckStitches =
    wholeNonNeg(input.frontCenterNeckStitches) + wholeNonNeg(input.backCenterNeckStitches);
  const sections: NeckbandPickupSections = {
    centerNeckStitches,
    necklineEdgeRows,
    curvedEdgePickupStitches,
  };
  return {
    kind: "round",
    pickupStitches: centerNeckStitches + curvedEdgePickupStitches,
    sections,
  };
}

/**
 * Format a reusable instruction view model (wording lives here, not in each pattern).
 */
export function formatNeckbandPickupInstruction(
  result: NeckbandPickupResult,
): NeckbandPickupInstructionViewModel {
  if (result.kind === "v-neck") {
    return {
      kind: "v-neck",
      pickupStitches: result.pickupStitches,
      necklineEdgeRows: result.necklineEdgeRows,
      primaryText: `Pick up ${result.pickupStitches} stitches evenly over ${result.necklineEdgeRows} rows around the neckline.`,
    };
  }
  return {
    kind: "round",
    pickupStitches: result.pickupStitches,
    primaryText: `Pick up approximately ${result.pickupStitches} stitches evenly around the neckline.`,
    estimateNoteText: NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
  };
}

/**
 * Build geometry input from pattern debug fields shared by Sleeveless and Drop Shoulder.
 */
export function neckbandPickupGeometryFromDebug(
  neckline: NeckbandPickupNecklineKind,
  debug: {
    frontNeckDepthRows?: number;
    backNeckDepthRows?: number;
    stitchesPerInch?: number;
    rowsPerInch?: number;
    /** Front horizontal center (round); optional alias used when present. */
    frontCenterNeckBindOffStitches?: number;
    /** Back horizontal center (existing debug field). */
    centerNeckBindOffStitches?: number;
  },
): NeckbandPickupGeometryInput | null {
  const spi = Number(debug.stitchesPerInch);
  const rpi = Number(debug.rowsPerInch);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return null;
  }
  const frontRows = Number(debug.frontNeckDepthRows);
  const backRows = Number(debug.backNeckDepthRows);
  if (!Number.isFinite(frontRows) && !Number.isFinite(backRows)) {
    return null;
  }
  return {
    neckline,
    frontCenterNeckStitches:
      neckline === "round" ? wholeNonNeg(debug.frontCenterNeckBindOffStitches) : 0,
    backCenterNeckStitches:
      neckline === "round" ? wholeNonNeg(debug.centerNeckBindOffStitches) : 0,
    frontNeckDepthRows: wholeNonNeg(frontRows),
    backNeckDepthRows: wholeNonNeg(backRows),
    stitchesPerUnit: spi,
    rowsPerUnit: rpi,
  };
}

/** Calculate + format from debug in one step (view/print finishing). */
export function neckbandPickupInstructionFromDebug(
  neckline: NeckbandPickupNecklineKind,
  debug: Parameters<typeof neckbandPickupGeometryFromDebug>[1],
): NeckbandPickupInstructionViewModel | null {
  const geometry = neckbandPickupGeometryFromDebug(neckline, debug);
  if (!geometry) return null;
  return formatNeckbandPickupInstruction(calculateNeckbandPickup(geometry));
}
