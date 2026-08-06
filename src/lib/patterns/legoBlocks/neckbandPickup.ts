/**
 * Shared LEGO block: neckband pickup along a shaped neckline.
 *
 * Round neck (pullover + cardigan): pickup = round(actual edge length × stitch gauge),
 * where edge length is the finished neckline polyline reconstructed from
 * {@link calculateRoundNecklinePlan} / {@link calculateBackRoundNecklinePlan}
 * (center horizontals, stair/hold horizontals, single-decrease diagonals, leftover
 * vertical rows). No depth-only shortcut and no correction factor.
 *
 * V-neck: unchanged row-edge gauge ratio (audit did not require path correction).
 *
 * Rounding rule (documented, used everywhere in this module):
 *   Whole-number stitch counts use `Math.round` (nearest integer; ties round
 *   away from zero toward +∞ for positive values — standard JS half-up).
 *   Section pickup = Math.round(sectionLength × stitchesPerUnit).
 *   Gauge conversion never applies an extra inch/cm factor: stitch and row counts
 *   are unitless; gauges must share the same length basis.
 *
 * Cardigan fronts exclude the center-front opening, button band, and buttonhole
 * band — only each front’s neckline edge is counted.
 */

import {
  calculateBackRoundNecklinePlan,
  calculateRoundNecklinePlan,
  type RoundNecklinePlanResult,
  type RoundNecklineSidePlan,
} from "./roundNeckline";

export type NeckbandPickupNecklineKind = "v-neck" | "round";
export type NeckbandPickupGarment = "pullover" | "cardigan";

/** Typical every-other-row span for a single neck-edge decrease (machine-knit). */
export const NECKBAND_SINGLE_DECREASE_ROW_SPAN = 2;

export type NeckbandPickupGeometryInput = {
  neckline: NeckbandPickupNecklineKind;
  garment?: NeckbandPickupGarment;
  /**
   * Full neck opening N in stitches. Required for round path-length pickup so
   * existing plan APIs can be the source of truth (not duplicated here).
   */
  necklineStitches?: number;
  /**
   * Optional precomputed plans (tests / callers that already ran the planners).
   * When omitted for round, plans are obtained via calculateRoundNecklinePlan /
   * calculateBackRoundNecklinePlan.
   */
  frontRoundPlan?: RoundNecklinePlanResult | null;
  backRoundPlan?: RoundNecklinePlanResult | null;
  /**
   * Horizontal center-neck stitches on the front (pullover round fallback when
   * no plan is available). Prefer plan.centerBindOff.
   */
  frontCenterNeckStitches?: number;
  /**
   * Horizontal center-neck stitches on the back (fallback). Prefer plan.centerBindOff.
   */
  backCenterNeckStitches?: number;
  /** Front neckline depth in rows (plan depth budget). */
  frontNeckDepthRows: number;
  /** Back neckline depth in rows. */
  backNeckDepthRows: number;
  /** Stitch gauge (per inch or per cm — same basis as row gauge). */
  stitchesPerUnit: number;
  /** Row gauge (same length basis as stitch gauge). */
  rowsPerUnit: number;

  // ---- Cardigan-only section inputs (independent so fronts may differ) ----

  /** First front: override depth rows for leftover-vertical budget (rare). */
  firstFrontNeckEdgeRows?: number;
  /** Second front: override depth rows for leftover-vertical budget (rare). */
  secondFrontNeckEdgeRows?: number;
  /**
   * First front horizontal neck stitches (round: CF-corner neck BO on that half;
   * V-neck: 0). Never includes button/buttonhole band stitches.
   */
  firstFrontHorizontalStitches?: number;
  /** Second front horizontal neck stitches (may differ from the first). */
  secondFrontHorizontalStitches?: number;
};

/**
 * Internal section breakdown. Pullover knitters see only the combined total;
 * cardigan instructions expose first/back/second counts.
 */
export type NeckbandPickupSections = {
  /** Sum of front + back horizontal center stitches from plans (round). */
  centerNeckStitches: number;
  /**
   * Vertical-projection row count around the opening (diagnostic / V-neck Y):
   * `2 * (frontNeckDepthRows + backNeckDepthRows)`.
   */
  necklineEdgeRows: number;
  /**
   * Vertical-projection pickup of those edge rows only (diagnostic).
   * Round path-length totals are intentionally larger when the edge is shaped.
   */
  curvedEdgePickupStitches: number;
  /** Pullover round: front-piece path-length pickup. */
  frontPickupStitches?: number;
  /** Pullover round / cardigan: back-piece path-length pickup. */
  backPickupStitches?: number;
  /** Cardigan: first front neckline-edge pickup. */
  firstFrontStitches?: number;
  /** Cardigan: complete back neckline pickup. */
  backStitches?: number;
  /** Cardigan: second front neckline-edge pickup. */
  secondFrontStitches?: number;
};

export type NeckbandPickupVNeckResult = {
  kind: "v-neck";
  garment: NeckbandPickupGarment;
  pickupStitches: number;
  necklineEdgeRows?: number;
  sections: NeckbandPickupSections;
};

export type NeckbandPickupRoundResult = {
  kind: "round";
  garment: NeckbandPickupGarment;
  pickupStitches: number;
  sections: NeckbandPickupSections;
};

export type NeckbandPickupResult = NeckbandPickupVNeckResult | NeckbandPickupRoundResult;

export type NeckbandPickupInstructionViewModel = {
  kind: NeckbandPickupNecklineKind;
  garment: NeckbandPickupGarment;
  primaryText: string;
  estimateNoteText?: string;
  pickupStitches: number;
  necklineEdgeRows?: number;
  firstFrontStitches?: number;
  backStitches?: number;
  secondFrontStitches?: number;
  /** Pullover round section totals (for tests / debugging). */
  frontPickupStitches?: number;
  backPickupStitches?: number;
};

/** Canonical round-neck estimate note (single source of wording). */
export const NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE =
  "This is an estimate. Adjust the number slightly if needed so the neckband lies flat without pulling or flaring.";

function wholeNonNeg(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

/**
 * Convert a pure vertical row-edge length to pickup stitches (V-neck + diagnostics).
 * `pickup = round(rows * stitchesPerUnit / rowsPerUnit)`
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

/** Left+right on front and back (vertical projection perimeter in rows). */
export function necklineEdgeRowsAroundOpening(
  frontNeckDepthRows: number,
  backNeckDepthRows: number,
): number {
  const front = Math.max(0, Math.round(Number(frontNeckDepthRows)));
  const back = Math.max(0, Math.round(Number(backNeckDepthRows)));
  return 2 * (front + back);
}

/**
 * Length in gauge units of one neck-edge side from a round-neck side plan.
 * Horizontals counted once; singles use diagonal hypot; hold spacing adds
 * vertical between consecutive hold groups only.
 */
export function roundNeckSideEdgeLength(
  side: RoundNecklineSidePlan,
  stitchesPerUnit: number,
  rowsPerUnit: number,
  singleDecreaseRowSpan: number = NECKBAND_SINGLE_DECREASE_ROW_SPAN,
): number {
  const spi = Number(stitchesPerUnit);
  const rpi = Number(rowsPerUnit);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return 0;
  }
  let length = 0;
  for (const step of side.stairSteps) {
    const sts = wholeNonNeg(step);
    if (sts > 0) length += sts / spi;
  }
  const holds = side.holdGroups;
  for (let i = 0; i < holds.length; i++) {
    const sts = wholeNonNeg(holds[i]);
    if (sts > 0) length += sts / spi;
    if (i < holds.length - 1) {
      length += NECKBAND_SINGLE_DECREASE_ROW_SPAN / rpi;
    }
  }
  const span = Math.max(1, Math.round(singleDecreaseRowSpan));
  for (let i = 0; i < wholeNonNeg(side.singleDecreaseCount); i++) {
    length += Math.hypot(1 / spi, span / rpi);
  }
  return length;
}

/**
 * Finished edge length for a full neckline piece (front or back):
 * center horizontal + left side + right side + leftover vertical on both sides.
 */
export function roundNeckPieceEdgeLength(
  plan: RoundNecklinePlanResult,
  depthRows: number,
  stitchesPerUnit: number,
  rowsPerUnit: number,
): number {
  const spi = Number(stitchesPerUnit);
  const rpi = Number(rowsPerUnit);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return 0;
  }
  const center = wholeNonNeg(plan.centerBindOff);
  let length = center / spi;
  length += roundNeckSideEdgeLength(plan.left, spi, rpi);
  length += roundNeckSideEdgeLength(plan.right, spi, rpi);
  const rem = Math.max(0, wholeNonNeg(depthRows) - wholeNonNeg(plan.rowsRequired));
  if (rem > 0) {
    length += (2 * rem) / rpi;
  }
  return length;
}

/**
 * One cardigan front neckline edge: CF-corner horizontal + one plan side +
 * leftover vertical for that side only (not the opposite front, not CF band).
 */
export function roundNeckCardiganFrontEdgeLength(
  side: RoundNecklineSidePlan,
  horizontalStitches: number,
  depthRows: number,
  planRowsRequired: number,
  stitchesPerUnit: number,
  rowsPerUnit: number,
): number {
  const spi = Number(stitchesPerUnit);
  const rpi = Number(rowsPerUnit);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return 0;
  }
  let length = wholeNonNeg(horizontalStitches) / spi;
  length += roundNeckSideEdgeLength(side, spi, rpi);
  const rem = Math.max(0, wholeNonNeg(depthRows) - wholeNonNeg(planRowsRequired));
  if (rem > 0) {
    length += rem / rpi;
  }
  return length;
}

/** `round(length × stitchesPerUnit)` — primary pickup rounding. */
export function pickupStitchesFromEdgeLength(
  lengthInGaugeUnits: number,
  stitchesPerUnit: number,
): number {
  const spi = Number(stitchesPerUnit);
  if (!Number.isFinite(lengthInGaugeUnits) || lengthInGaugeUnits <= 0) return 0;
  if (!Number.isFinite(spi) || spi <= 0) return 0;
  return Math.round(lengthInGaugeUnits * spi);
}

function resolveFrontRoundPlan(
  input: NeckbandPickupGeometryInput,
): RoundNecklinePlanResult | null {
  if (input.frontRoundPlan) return input.frontRoundPlan;
  const N = wholeNonNeg(input.necklineStitches);
  const depth = wholeNonNeg(input.frontNeckDepthRows);
  if (N <= 0 || depth <= 0) return null;
  return calculateRoundNecklinePlan({ necklineStitches: N, necklineDepthRows: depth });
}

function resolveBackRoundPlan(
  input: NeckbandPickupGeometryInput,
): RoundNecklinePlanResult | null {
  if (input.backRoundPlan) return input.backRoundPlan;
  const N = wholeNonNeg(input.necklineStitches);
  const depth = Math.max(1, wholeNonNeg(input.backNeckDepthRows));
  if (N <= 0) return null;
  return calculateBackRoundNecklinePlan({ necklineStitches: N, necklineDepthRows: depth });
}

function cardiganVNeckFrontStitches(args: {
  edgeRows: number;
  stitchesPerUnit: number;
  rowsPerUnit: number;
}): number {
  return pickupStitchesFromRowEdge(args.edgeRows, args.stitchesPerUnit, args.rowsPerUnit);
}

/**
 * Calculate neckband pickup from final neckline geometry + gauge.
 */
export function calculateNeckbandPickup(input: NeckbandPickupGeometryInput): NeckbandPickupResult {
  const garment: NeckbandPickupGarment = input.garment === "cardigan" ? "cardigan" : "pullover";
  const spi = input.stitchesPerUnit;
  const rpi = input.rowsPerUnit;
  const necklineEdgeRows = necklineEdgeRowsAroundOpening(
    input.frontNeckDepthRows,
    input.backNeckDepthRows,
  );
  const verticalProjectionPickup = pickupStitchesFromRowEdge(necklineEdgeRows, spi, rpi);

  // ---- V-neck (unchanged depth-based model) ----
  if (input.neckline === "v-neck") {
    if (garment === "cardigan") {
      const frontDepth = wholeNonNeg(input.frontNeckDepthRows);
      const firstFrontEdgeRows =
        input.firstFrontNeckEdgeRows !== undefined
          ? wholeNonNeg(input.firstFrontNeckEdgeRows)
          : frontDepth;
      const secondFrontEdgeRows =
        input.secondFrontNeckEdgeRows !== undefined
          ? wholeNonNeg(input.secondFrontNeckEdgeRows)
          : frontDepth;
      const firstFrontStitches = cardiganVNeckFrontStitches({
        edgeRows: firstFrontEdgeRows,
        stitchesPerUnit: spi,
        rowsPerUnit: rpi,
      });
      const secondFrontStitches = cardiganVNeckFrontStitches({
        edgeRows: secondFrontEdgeRows,
        stitchesPerUnit: spi,
        rowsPerUnit: rpi,
      });
      // V-neck cardigan back: keep prior depth-based model (audit did not require path fix).
      const backCenter = wholeNonNeg(input.backCenterNeckStitches);
      const backStitches =
        backCenter +
        pickupStitchesFromRowEdge(2 * wholeNonNeg(input.backNeckDepthRows), spi, rpi);
      const sections: NeckbandPickupSections = {
        centerNeckStitches: backCenter,
        necklineEdgeRows:
          firstFrontEdgeRows + secondFrontEdgeRows + 2 * wholeNonNeg(input.backNeckDepthRows),
        curvedEdgePickupStitches:
          pickupStitchesFromRowEdge(firstFrontEdgeRows, spi, rpi) +
          pickupStitchesFromRowEdge(secondFrontEdgeRows, spi, rpi) +
          pickupStitchesFromRowEdge(2 * wholeNonNeg(input.backNeckDepthRows), spi, rpi),
        firstFrontStitches,
        backStitches,
        secondFrontStitches,
        backPickupStitches: backStitches,
      };
      return {
        kind: "v-neck",
        garment,
        pickupStitches: firstFrontStitches + backStitches + secondFrontStitches,
        sections,
      };
    }

    const sections: NeckbandPickupSections = {
      centerNeckStitches: 0,
      necklineEdgeRows,
      curvedEdgePickupStitches: verticalProjectionPickup,
    };
    return {
      kind: "v-neck",
      garment,
      pickupStitches: verticalProjectionPickup,
      necklineEdgeRows,
      sections,
    };
  }

  // ---- Round: path-length × stitch gauge ----
  const frontPlan = resolveFrontRoundPlan(input);
  const backPlan = resolveBackRoundPlan(input);

  if (garment === "cardigan") {
    const frontDepth = wholeNonNeg(input.frontNeckDepthRows);
    const firstDepth =
      input.firstFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(input.firstFrontNeckEdgeRows)
        : frontDepth;
    const secondDepth =
      input.secondFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(input.secondFrontNeckEdgeRows)
        : frontDepth;
    const firstHorizontal = wholeNonNeg(input.firstFrontHorizontalStitches);
    const secondHorizontal = wholeNonNeg(input.secondFrontHorizontalStitches);
    const rowsRequired = frontPlan?.rowsRequired ?? 0;

    const firstFrontStitches = frontPlan
      ? pickupStitchesFromEdgeLength(
          roundNeckCardiganFrontEdgeLength(
            frontPlan.left,
            firstHorizontal,
            firstDepth,
            rowsRequired,
            spi,
            rpi,
          ),
          spi,
        )
      : firstHorizontal + pickupStitchesFromRowEdge(firstDepth, spi, rpi);
    const secondFrontStitches = frontPlan
      ? pickupStitchesFromEdgeLength(
          roundNeckCardiganFrontEdgeLength(
            frontPlan.right,
            secondHorizontal,
            secondDepth,
            rowsRequired,
            spi,
            rpi,
          ),
          spi,
        )
      : secondHorizontal + pickupStitchesFromRowEdge(secondDepth, spi, rpi);
    const backStitches = backPlan
      ? pickupStitchesFromEdgeLength(
          roundNeckPieceEdgeLength(backPlan, input.backNeckDepthRows, spi, rpi),
          spi,
        )
      : wholeNonNeg(input.backCenterNeckStitches) +
        pickupStitchesFromRowEdge(2 * wholeNonNeg(input.backNeckDepthRows), spi, rpi);

    const centerNeckStitches =
      wholeNonNeg(backPlan?.centerBindOff ?? input.backCenterNeckStitches);
    const sections: NeckbandPickupSections = {
      centerNeckStitches,
      necklineEdgeRows,
      curvedEdgePickupStitches: verticalProjectionPickup,
      firstFrontStitches,
      backStitches,
      secondFrontStitches,
      backPickupStitches: backStitches,
    };
    return {
      kind: "round",
      garment,
      pickupStitches: firstFrontStitches + backStitches + secondFrontStitches,
      sections,
    };
  }

  // Pullover round
  const frontLen = frontPlan
    ? roundNeckPieceEdgeLength(frontPlan, input.frontNeckDepthRows, spi, rpi)
    : wholeNonNeg(input.frontCenterNeckStitches) / spi +
      (2 * wholeNonNeg(input.frontNeckDepthRows)) / rpi;
  const backLen = backPlan
    ? roundNeckPieceEdgeLength(backPlan, input.backNeckDepthRows, spi, rpi)
    : wholeNonNeg(input.backCenterNeckStitches) / spi +
      (2 * wholeNonNeg(input.backNeckDepthRows)) / rpi;
  const frontPickupStitches = pickupStitchesFromEdgeLength(frontLen, spi);
  const backPickupStitches = pickupStitchesFromEdgeLength(backLen, spi);
  const centerNeckStitches =
    wholeNonNeg(frontPlan?.centerBindOff ?? input.frontCenterNeckStitches) +
    wholeNonNeg(backPlan?.centerBindOff ?? input.backCenterNeckStitches);

  const sections: NeckbandPickupSections = {
    centerNeckStitches,
    necklineEdgeRows,
    curvedEdgePickupStitches: verticalProjectionPickup,
    frontPickupStitches,
    backPickupStitches,
  };
  return {
    kind: "round",
    garment,
    pickupStitches: frontPickupStitches + backPickupStitches,
    sections,
  };
}

/**
 * Format a reusable instruction view model (wording lives here, not in each pattern).
 */
export function formatNeckbandPickupInstruction(
  result: NeckbandPickupResult,
): NeckbandPickupInstructionViewModel {
  if (result.garment === "cardigan") {
    const first = result.sections.firstFrontStitches ?? 0;
    const back = result.sections.backStitches ?? 0;
    const second = result.sections.secondFrontStitches ?? 0;
    const primaryText = `Pick up approximately ${first} stitches along the first front neckline edge, ${back} stitches across the back neckline, and ${second} stitches along the second front neckline edge.`;
    return {
      kind: result.kind,
      garment: "cardigan",
      pickupStitches: result.pickupStitches,
      firstFrontStitches: first,
      backStitches: back,
      secondFrontStitches: second,
      primaryText,
      estimateNoteText:
        result.kind === "round" ? NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE : undefined,
    };
  }

  if (result.kind === "v-neck") {
    return {
      kind: "v-neck",
      garment: "pullover",
      pickupStitches: result.pickupStitches,
      necklineEdgeRows: result.necklineEdgeRows,
      primaryText: `Pick up ${result.pickupStitches} stitches evenly over ${result.necklineEdgeRows} rows around the neckline.`,
    };
  }
  return {
    kind: "round",
    garment: "pullover",
    pickupStitches: result.pickupStitches,
    frontPickupStitches: result.sections.frontPickupStitches,
    backPickupStitches: result.sections.backPickupStitches,
    primaryText: `Pick up approximately ${result.pickupStitches} stitches evenly around the neckline.`,
    estimateNoteText: NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
  };
}

export type NeckbandPickupDebugFields = {
  frontNeckDepthRows?: number;
  backNeckDepthRows?: number;
  stitchesPerInch?: number;
  rowsPerInch?: number;
  /** Full neck opening N — required to rebuild round plans for path-length pickup. */
  necklineStitches?: number;
  frontCenterNeckBindOffStitches?: number;
  centerNeckBindOffStitches?: number;
  cardiganFrontInitialNeckBindOffStitches?: number;
  firstFrontNeckEdgeRows?: number;
  secondFrontNeckEdgeRows?: number;
  firstFrontHorizontalStitches?: number;
  secondFrontHorizontalStitches?: number;
};

/**
 * Build geometry input from pattern debug fields shared by Sleeveless and Drop Shoulder.
 * Round plans are resolved inside {@link calculateNeckbandPickup} from N + depths via
 * the existing round-neckline planners (no duplicated planning algorithm).
 */
export function neckbandPickupGeometryFromDebug(
  neckline: NeckbandPickupNecklineKind,
  debug: NeckbandPickupDebugFields,
  garment: NeckbandPickupGarment = "pullover",
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

  const base: NeckbandPickupGeometryInput = {
    neckline,
    garment,
    necklineStitches: wholeNonNeg(debug.necklineStitches),
    frontCenterNeckStitches:
      neckline === "round" ? wholeNonNeg(debug.frontCenterNeckBindOffStitches) : 0,
    backCenterNeckStitches: wholeNonNeg(debug.centerNeckBindOffStitches),
    frontNeckDepthRows: wholeNonNeg(frontRows),
    backNeckDepthRows: wholeNonNeg(backRows),
    stitchesPerUnit: spi,
    rowsPerUnit: rpi,
  };

  if (garment !== "cardigan") {
    return base;
  }

  const defaultHorizontal =
    neckline === "round" ? wholeNonNeg(debug.cardiganFrontInitialNeckBindOffStitches) : 0;
  const frontDepth = wholeNonNeg(frontRows);

  return {
    ...base,
    firstFrontNeckEdgeRows:
      debug.firstFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(debug.firstFrontNeckEdgeRows)
        : frontDepth,
    secondFrontNeckEdgeRows:
      debug.secondFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(debug.secondFrontNeckEdgeRows)
        : frontDepth,
    firstFrontHorizontalStitches:
      debug.firstFrontHorizontalStitches !== undefined
        ? wholeNonNeg(debug.firstFrontHorizontalStitches)
        : defaultHorizontal,
    secondFrontHorizontalStitches:
      debug.secondFrontHorizontalStitches !== undefined
        ? wholeNonNeg(debug.secondFrontHorizontalStitches)
        : defaultHorizontal,
  };
}

/** Calculate + format from debug in one step (view/print finishing). */
export function neckbandPickupInstructionFromDebug(
  neckline: NeckbandPickupNecklineKind,
  debug: NeckbandPickupDebugFields,
  garment: NeckbandPickupGarment = "pullover",
): NeckbandPickupInstructionViewModel | null {
  const geometry = neckbandPickupGeometryFromDebug(neckline, debug, garment);
  if (!geometry) return null;
  return formatNeckbandPickupInstruction(calculateNeckbandPickup(geometry));
}
