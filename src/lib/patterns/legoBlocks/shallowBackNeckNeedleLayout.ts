/**
 * Symmetric needle-bed layout for shallow back-neck hold workflow.
 *
 * Needles are labeled L1…Ln (left of center) and R1…Rn (right of center).
 * Needle 0 is a bed reference point only — it is never a working needle, never
 * counted as a stitch, and never appears in generated ranges. Odd center counts
 * split across L and R needles (floor on L, remainder on R).
 */

export type NeedleLabel = `${"L" | "R"}${number}`;

/** CSS class for visually emphasized needle ranges in pattern instructions. */
export const NEEDLE_RANGE_CLASS = "needle-range";

export type ShallowBackNeckNeedleLayout = {
  /** Inclusive outer→inner left shoulder range (e.g. L50 through L10). */
  leftShoulder: { start: NeedleLabel; end: NeedleLabel };
  /** Inclusive inner→outer right shoulder range (e.g. R10 through R50). */
  rightShoulder: { start: NeedleLabel; end: NeedleLabel };
  /** Center hold range spanning the neck opening (L and R needles only). */
  center: { start: NeedleLabel; end: NeedleLabel };
  /** Everything except the first-side working shoulder (right): hold L-outer through last center R. */
  firstSideHold: { start: NeedleLabel; end: NeedleLabel };
  /** Stitch counts for validation text (L/R needles only; derived from layout). */
  stitchCounts: {
    leftShoulder: number;
    rightShoulder: number;
    center: number;
    firstSideHold: number;
  };
};

export function formatNeedleLabel(side: "L" | "R", index: number): NeedleLabel {
  return `${side}${Math.max(1, Math.floor(index))}`;
}

/** User-facing needle span: "L65 through R11". */
export function formatNeedleRangeThrough(start: NeedleLabel, end: NeedleLabel): string {
  return `${start} through ${end}`;
}

/** HTML wrapper for a needle-range phrase (trusted pattern HTML). */
export function formatNeedleRangeHtml(phrase: string): string {
  return `<span class="${NEEDLE_RANGE_CLASS}">${phrase}</span>`;
}

/** Secondary validation suffix, e.g. " (22 stitches total)". */
export function formatStitchCountValidation(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return "";
  return ` (${n} ${n === 1 ? "stitch" : "stitches"} total)`;
}

export function parseNeedleLabel(label: NeedleLabel): { side: "L" | "R"; index: number } {
  const m = /^([LR])(\d+)$/.exec(label);
  if (!m) {
    throw new Error(`Invalid needle label: ${label}`);
  }
  return { side: m[1] as "L" | "R", index: Number(m[2]) };
}

/** Inclusive stitch count for a range on one side of the bed (L…L or R…R). */
export function countSameSideNeedleRange(start: NeedleLabel, end: NeedleLabel): number {
  const a = parseNeedleLabel(start);
  const b = parseNeedleLabel(end);
  if (a.side !== b.side) {
    throw new Error(`Needle range must stay on one side: ${start} – ${end}`);
  }
  return Math.abs(a.index - b.index) + 1;
}

/** Inclusive stitch count for a span from an L needle through an R needle (L/R only). */
export function countCrossBedNeedleRange(start: NeedleLabel, end: NeedleLabel): number {
  const a = parseNeedleLabel(start);
  const b = parseNeedleLabel(end);
  if (a.side === "L" && b.side === "R") {
    return a.index + b.index;
  }
  return countSameSideNeedleRange(start, end);
}

function symmetricBedHalves(bodyWidthStitches: number): { leftHalf: number; rightHalf: number } {
  const B = Math.max(0, Math.floor(bodyWidthStitches));
  const leftHalf = Math.floor(B / 2);
  return { leftHalf, rightHalf: B - leftHalf };
}

function centerNeedleRange(
  centerLeft: number,
  centerRight: number,
): { start: NeedleLabel; end: NeedleLabel } {
  if (centerLeft > 0 && centerRight > 0) {
    return {
      start: formatNeedleLabel("L", centerLeft),
      end: formatNeedleLabel("R", centerRight),
    };
  }
  if (centerRight > 0) {
    return {
      start: formatNeedleLabel("R", 1),
      end: formatNeedleLabel("R", centerRight),
    };
  }
  return {
    start: formatNeedleLabel("L", centerLeft),
    end: formatNeedleLabel("L", centerLeft),
  };
}

/** Plain-text center hold phrase (L/R needles only). */
export function formatCenterNeedleHoldPhrase(
  layout: ShallowBackNeckNeedleLayout,
): string {
  return formatNeedleRangeThrough(layout.center.start, layout.center.end);
}

/** Plain-text first-side hold phrase for stage-1 setup (L/R needles only). */
export function formatFirstSideHoldPhrase(layout: ShallowBackNeckNeedleLayout): string {
  return formatNeedleRangeThrough(layout.firstSideHold.start, layout.firstSideHold.end);
}

/** HTML-emphasized center hold phrase for trusted pattern instructions. */
export function formatCenterNeedleHoldPhraseHtml(layout: ShallowBackNeckNeedleLayout): string {
  return formatNeedleRangeHtml(formatCenterNeedleHoldPhrase(layout));
}

/** HTML-emphasized first-side hold phrase for trusted pattern instructions. */
export function formatFirstSideHoldPhraseHtml(layout: ShallowBackNeckNeedleLayout): string {
  return formatNeedleRangeHtml(formatFirstSideHoldPhrase(layout));
}

/**
 * Derives L/R needle ranges from full body width and center hold count at the neckline row.
 * Shoulder inner edges sit just outside the held center on L and R needles.
 */
export function computeShallowBackNeckNeedleLayout(
  bodyWidthStitches: number,
  centerHoldStitches: number,
): ShallowBackNeckNeedleLayout {
  const { leftHalf, rightHalf } = symmetricBedHalves(bodyWidthStitches);
  const C = Math.max(0, Math.floor(centerHoldStitches));
  const centerLeft = Math.floor(C / 2);
  const centerRight = C - centerLeft;

  const leftShoulderOuter = formatNeedleLabel("L", leftHalf);
  const leftShoulderInner = formatNeedleLabel("L", centerLeft > 0 ? centerLeft + 1 : 1);
  const rightShoulderInner = formatNeedleLabel("R", centerRight + 1);
  const rightShoulderOuter = formatNeedleLabel("R", rightHalf);

  const center = centerNeedleRange(centerLeft, centerRight);

  const firstSideHoldEnd =
    centerRight > 0
      ? formatNeedleLabel("R", centerRight)
      : formatNeedleLabel("L", centerLeft);

  const leftShoulderCount = countSameSideNeedleRange(leftShoulderOuter, leftShoulderInner);
  const rightShoulderCount = countSameSideNeedleRange(rightShoulderInner, rightShoulderOuter);
  const firstSideHoldCount = Math.max(0, bodyWidthStitches - rightShoulderCount);

  return {
    leftShoulder: { start: leftShoulderOuter, end: leftShoulderInner },
    rightShoulder: { start: rightShoulderInner, end: rightShoulderOuter },
    center,
    firstSideHold: {
      start: leftShoulderOuter,
      end: firstSideHoldEnd,
    },
    stitchCounts: {
      leftShoulder: leftShoulderCount,
      rightShoulder: rightShoulderCount,
      center: C,
      firstSideHold: firstSideHoldCount,
    },
  };
}
