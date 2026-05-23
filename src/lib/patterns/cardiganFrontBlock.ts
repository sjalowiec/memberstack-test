/**
 * Cardigan front “LEGO” foundation — each labeled front is one **half-body** piece using the same
 * outer garment geometry as the pullover/back system (Express sleeveless).
 *
 * ## Geometry rules (Express sleeveless)
 *
 * **RULE 1** — Pullover front cast-on stitches = back cast-on stitches (full torso width at hem/bust).
 *
 * **RULE 2** — Each cardigan front cast-on = **half** of that body/back cast-on, after any reserved
 * center-front opening (`frontOpeningWidthSts`). Odd workable width: one half gets +1 stitch;
 * default is left (`oddStitchLargerSide: "left"`). This keeps
 * `left + right + opening === bodyBackCastOn` deterministically so two fronts always reconcile to
 * full body width.
 *
 * **RULE 3–4** — Total rows and armhole depth rows match the back (same RC placement).
 *
 * **RULE 5** — Stitch **widths** on each cardigan front panel are half of the corresponding full
 * back/body values: hem cast-on, bust/body at armhole, and stitches after armhole shaping. Use
 * {@link resolveCardiganHalfFrontWidths} so diagram tokens and written counts never show full-back
 * bust/hem/armhole stitch totals on one front.
 *
 * ## Why the split exists
 *
 * Cardigan pieces replace the folded **full** front with two mirror halves. Width at the cast-on
 * is the only dimension that is halved here. Future bands, overlaps, or buttonhole columns may
 * consume additional stitches via `frontOpeningWidthSts` or separate pattern rows — those are
 * reserved at CF, not taken from shoulder/armhole math.
 */

/** Pullover vs cardigan — drives diagram mode selection alongside neckline helpers. */
export type SleevelessGarmentStyle = "pullover" | "cardigan";

/** Which schematic we render for the front opening diagram slot. */
export type SleevelessFrontDiagramType =
  | "pulloverFullFrontRound"
  | "pulloverFullFrontV"
  | "cardiganFullFrontRound"
  | "cardiganFullFrontV"
  /** DEV-only half-body preview (`cardigan-half-front-round.svg`). */
  | "cardiganHalfFrontRound"
  | "cardiganHalfFrontV";

/** Logical piece when shaping/cardigan logic splits the front. */
export type SleevelessFrontPieceType = "fullFront" | "leftFront" | "rightFront";

export type CardiganFrontSplitOptions = {
  /** Reserved at CF for overlap/bands — excluded before left/right split (default 0). */
  frontOpeningWidthSts?: number;
  /** Which labeled half receives the +1 when workable width is odd (default left). */
  oddStitchLargerSide?: "left" | "right";
};

export type CardiganFrontSplit = {
  /**
   * Body/back cast-on in stitches — same as pullover full front (RULE 1). This is the width
   * **before** opening reserve; it must not come from a separately scaled “front width.”
   */
  bodyBackCastOnSts: number;
  leftFrontWidthSts: number;
  rightFrontWidthSts: number;
  /** Same as input reserve — stitches “between” halves / consumed by future CF treatments. */
  frontOpeningWidthSts: number;
};

/**
 * Split **body/back cast-on** (identical to pullover front cast-on) into symmetric cardigan halves.
 *
 * @param bodyBackCastOnSts — Full torso cast-on (same as `backStitches` / pullover front), not an
 *   independently scaled front measurement.
 */
export function splitBodyBackCastOnToSymmetricCardiganHalves(
  bodyBackCastOnSts: number,
  opts?: CardiganFrontSplitOptions,
): CardiganFrontSplit {
  const full = Math.max(0, Math.floor(Number(bodyBackCastOnSts)));
  const opening = Math.max(0, Math.floor(opts?.frontOpeningWidthSts ?? 0));
  const workable = Math.max(0, full - opening);
  const favorLeft = opts?.oddStitchLargerSide !== "right";
  const leftFrontWidthSts = favorLeft ? Math.ceil(workable / 2) : Math.floor(workable / 2);
  const rightFrontWidthSts = workable - leftFrontWidthSts;

  return {
    bodyBackCastOnSts: full,
    leftFrontWidthSts,
    rightFrontWidthSts,
    frontOpeningWidthSts: opening,
  };
}

/**
 * @deprecated Use {@link splitBodyBackCastOnToSymmetricCardiganHalves}. The argument is **body/back
 * cast-on** (same as pullover front), not a separately derived front width.
 */
export function splitFullFrontToSymmetricCardiganHalves(
  fullFrontWidthSts: number,
  opts?: CardiganFrontSplitOptions,
): CardiganFrontSplit {
  return splitBodyBackCastOnToSymmetricCardiganHalves(fullFrontWidthSts, opts);
}

/** Stitches for one labeled half (after opening reserve). */
export function cardiganHalfFrontBodySts(split: CardiganFrontSplit, side: "left" | "right"): number {
  return side === "left" ? split.leftFrontWidthSts : split.rightFrontWidthSts;
}

/** Half-panel stitch counts for one cardigan front (hem, bust/body, post-armhole). */
export type CardiganHalfFrontWidths = {
  hemCastOnSts: number;
  bustBodySts: number;
  stitchesAfterArmhole: number;
};

/**
 * Maps full back/body stitch widths to one cardigan front panel (default left receives odd +1).
 * Example: hem 140 / bust 112 → left front 70 / 56 when workable width splits evenly.
 */
export function resolveCardiganHalfFrontWidths(
  full: {
    hemCastOnSts: number;
    bustBodySts: number;
    stitchesAfterArmhole: number;
  },
  side: "left" | "right",
  opts?: CardiganFrontSplitOptions,
): CardiganHalfFrontWidths {
  const hemSplit = splitBodyBackCastOnToSymmetricCardiganHalves(full.hemCastOnSts, opts);
  const bustSplit = splitBodyBackCastOnToSymmetricCardiganHalves(full.bustBodySts, opts);
  const shoulderSplit = splitBodyBackCastOnToSymmetricCardiganHalves(full.stitchesAfterArmhole, opts);
  return {
    hemCastOnSts: cardiganHalfFrontBodySts(hemSplit, side),
    bustBodySts: cardiganHalfFrontBodySts(bustSplit, side),
    stitchesAfterArmhole: cardiganHalfFrontBodySts(shoulderSplit, side),
  };
}
