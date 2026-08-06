/**
 * Shared LEGO block: neckband pickup along a shaped neckline.
 *
 * Round and V-neck: pickup = round(actual edge length × stitch gauge), where
 * edge length is the finished neckline polyline reconstructed from existing
 * shaping plans / decrease schedules (not a depth-row shortcut).
 *
 * Round: {@link calculateRoundNecklinePlan} / {@link calculateBackRoundNecklinePlan}
 * (center horizontals, stair/hold horizontals, single-decrease diagonals, leftover
 * vertical rows).
 *
 * V-neck fronts: zero center-front stitches; each slope from
 * {@link neckDecreaseStitchesPerSideFromOpening} + {@link distributeVNeckInnerDecreaseRows}.
 * V-neck back: same back round plan path as round neck.
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
import {
  distributeVNeckInnerDecreaseRows,
  neckDecreaseStitchesPerSideFromOpening,
} from "./vNeckline";

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
   * V-neck: always treated as 0). Never includes button/buttonhole band stitches.
   */
  firstFrontHorizontalStitches?: number;
  /** Second front horizontal neck stitches (may differ from the first; V-neck: 0). */
  secondFrontHorizontalStitches?: number;
  /**
   * Optional override for V-neck decreases per front slope (defaults to
   * {@link neckDecreaseStitchesPerSideFromOpening}(N)).
   */
  firstFrontVNeckDecreaseStitches?: number;
  secondFrontVNeckDecreaseStitches?: number;
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

/**
 * One V-neck front slope edge length (center-front stitches = 0).
 * Rebuilds the decrease row list via {@link distributeVNeckInnerDecreaseRows}
 * over the front depth budget and sums diagonal segments (plus leftover vertical).
 */
export function vNeckFrontSlopeEdgeLength(
  decreaseStitches: number,
  depthRows: number,
  stitchesPerUnit: number,
  rowsPerUnit: number,
): number {
  const spi = Number(stitchesPerUnit);
  const rpi = Number(rowsPerUnit);
  const depth = wholeNonNeg(depthRows);
  const count = wholeNonNeg(decreaseStitches);
  if (!Number.isFinite(spi) || spi <= 0 || !Number.isFinite(rpi) || rpi <= 0) {
    return 0;
  }
  if (depth <= 0) return 0;
  if (count <= 0) {
    return depth / rpi;
  }
  const decreaseRows = distributeVNeckInnerDecreaseRows(count, 1, depth);
  let length = 0;
  let prevRow = 0;
  for (const raw of decreaseRows) {
    const row = Math.max(0, Math.floor(raw));
    const dRows = Math.max(0, row - prevRow);
    if (dRows === 0) {
      // Multiple decreases on the same row: horizontal stitch only.
      length += 1 / spi;
    } else {
      length += Math.hypot(1 / spi, dRows / rpi);
    }
    prevRow = row;
  }
  if (prevRow < depth) {
    length += (depth - prevRow) / rpi;
  }
  return length;
}

function resolveVNeckDecreasesPerSide(input: NeckbandPickupGeometryInput): number {
  if (input.firstFrontVNeckDecreaseStitches !== undefined) {
    return wholeNonNeg(input.firstFrontVNeckDecreaseStitches);
  }
  return neckDecreaseStitchesPerSideFromOpening(wholeNonNeg(input.necklineStitches));
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

  // ---- V-neck: path-length (front slopes + back plan; zero center-front) ----
  if (input.neckline === "v-neck") {
    const frontDepth = wholeNonNeg(input.frontNeckDepthRows);
    const firstDepth =
      input.firstFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(input.firstFrontNeckEdgeRows)
        : frontDepth;
    const secondDepth =
      input.secondFrontNeckEdgeRows !== undefined
        ? wholeNonNeg(input.secondFrontNeckEdgeRows)
        : frontDepth;
    const firstDecreases =
      input.firstFrontVNeckDecreaseStitches !== undefined
        ? wholeNonNeg(input.firstFrontVNeckDecreaseStitches)
        : resolveVNeckDecreasesPerSide(input);
    const secondDecreases =
      input.secondFrontVNeckDecreaseStitches !== undefined
        ? wholeNonNeg(input.secondFrontVNeckDecreaseStitches)
        : resolveVNeckDecreasesPerSide(input);

    const firstFrontStitches = pickupStitchesFromEdgeLength(
      vNeckFrontSlopeEdgeLength(firstDecreases, firstDepth, spi, rpi),
      spi,
    );
    const secondFrontStitches = pickupStitchesFromEdgeLength(
      vNeckFrontSlopeEdgeLength(secondDecreases, secondDepth, spi, rpi),
      spi,
    );

    const backPlan = resolveBackRoundPlan(input);
    const backStitches = backPlan
      ? pickupStitchesFromEdgeLength(
          roundNeckPieceEdgeLength(backPlan, input.backNeckDepthRows, spi, rpi),
          spi,
        )
      : wholeNonNeg(input.backCenterNeckStitches) +
        pickupStitchesFromRowEdge(2 * wholeNonNeg(input.backNeckDepthRows), spi, rpi);
    const backCenter = wholeNonNeg(backPlan?.centerBindOff ?? input.backCenterNeckStitches);

    if (garment === "cardigan") {
      const sections: NeckbandPickupSections = {
        // Front center is always 0 for V-neck; report back center only.
        centerNeckStitches: backCenter,
        necklineEdgeRows:
          firstDepth + secondDepth + 2 * wholeNonNeg(input.backNeckDepthRows),
        curvedEdgePickupStitches: verticalProjectionPickup,
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

    const frontPickupStitches = firstFrontStitches + secondFrontStitches;
    const sections: NeckbandPickupSections = {
      centerNeckStitches: backCenter, // no center-front contribution
      necklineEdgeRows,
      curvedEdgePickupStitches: verticalProjectionPickup,
      frontPickupStitches,
      backPickupStitches: backStitches,
      firstFrontStitches,
      secondFrontStitches,
      backStitches,
    };
    return {
      kind: "v-neck",
      garment,
      pickupStitches: frontPickupStitches + backStitches,
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
      estimateNoteText: NECKBAND_ROUND_PICKUP_ESTIMATE_NOTE,
    };
  }

  // Pullover round and V-neck share the same approximate-around-neckline wording.
  return {
    kind: result.kind,
    garment: "pullover",
    pickupStitches: result.pickupStitches,
    frontPickupStitches: result.sections.frontPickupStitches,
    backPickupStitches: result.sections.backPickupStitches,
    firstFrontStitches: result.sections.firstFrontStitches,
    secondFrontStitches: result.sections.secondFrontStitches,
    backStitches: result.sections.backStitches,
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
  firstFrontVNeckDecreaseStitches?: number;
  secondFrontVNeckDecreaseStitches?: number;
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
    firstFrontVNeckDecreaseStitches:
      debug.firstFrontVNeckDecreaseStitches !== undefined
        ? wholeNonNeg(debug.firstFrontVNeckDecreaseStitches)
        : undefined,
    secondFrontVNeckDecreaseStitches:
      debug.secondFrontVNeckDecreaseStitches !== undefined
        ? wholeNonNeg(debug.secondFrontVNeckDecreaseStitches)
        : undefined,
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
