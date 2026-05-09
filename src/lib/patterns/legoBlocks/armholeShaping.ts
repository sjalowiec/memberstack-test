export type ArmholeResult = {
  bindOffSts: number;
  decreaseSts: number;
  decreaseRows: number;
  evenRows: number;
};

export type ArmholeInput = {
  /** A — full width in stitches at cast-on / armhole start. */
  startingStitches: number;
  /** B — target stitch count after armhole shaping (caller supplies, e.g. chart shoulder width × gauge). */
  targetStitches: number;
  /** Row budget for the armhole depth (same role as previous `armholeDepthRows`). */
  totalRows: number;
};

/**
 * Distributes bind-offs and decreases from A down to B. Does not compute B — caller supplies target stitches.
 */
export function calculateArmholeShaping(input: ArmholeInput): ArmholeResult {
  const A = input.startingStitches;
  const B = input.targetStitches;

  if (B >= A) {
    throw new Error(
      "Armhole shaping error: target stitches (B) must be less than starting stitches (A)."
    );
  }

  const totalArmholeStitches = A - B;
  const rawPerSide = totalArmholeStitches / 2;
  const stitchesPerSide = Math.floor(rawPerSide);

  if (stitchesPerSide <= 0) {
    throw new Error("Armhole shaping error: no stitches to shape.");
  }

  if (rawPerSide !== stitchesPerSide) {
    console.warn(
      "Armhole shaping: fractional stitches per side; using whole-number bind-off and decrease counts.",
      { A, B, totalArmholeStitches, rawPerSide, stitchesPerSide }
    );
  }

  const bindOffSts = Math.round(stitchesPerSide / 2);
  const decreaseSts = stitchesPerSide - bindOffSts;

  const decreaseRows = decreaseSts * 2;
  const evenRows = input.totalRows - decreaseRows;

  const impliedFinal = A - stitchesPerSide * 2;
  if (impliedFinal !== B) {
    console.warn("Armhole shaping stitch target note:", {
      impliedFinalStitches: impliedFinal,
      requestedTarget: B,
      stitchesPerSide,
    });
  }

  return {
    bindOffSts,
    decreaseSts,
    decreaseRows,
    evenRows,
  };
}
