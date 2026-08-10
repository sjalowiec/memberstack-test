/**
 * Hat pattern math — pure calculation layer used by the Hat Pattern Builder.
 *
 * Ported from the inline logic in `src/pages/patterns/hat.astro` (Phase A).
 * All length/depth values in the calc pipeline are inches unless noted.
 */

export type HatDisplayUnit = "inches" | "cm";

export type HatCrownStyle = "gathered" | "wedge-4-decrease" | "wedge-4" | "spiral";

/** Brim construction types — order matches builder picker (Rolled, Single, Folded). */
export type HatBrimType = "rolled" | "single" | "folded";

export const HAT_BRIM_TYPES = ["rolled", "single", "folded"] as const;

/** Default visible brim height when Rolled Brim is newly selected (inches). */
export const HAT_ROLLED_BRIM_DEFAULT_DEPTH_INCHES = 1;

/** True when `raw` is a known brim construction value. */
export function isHatBrimType(raw: string): raw is HatBrimType {
  return (HAT_BRIM_TYPES as readonly string[]).includes(raw);
}

/**
 * Resolve brim type for calculation. Unknown / empty values fall back to `"single"`
 * so older drafts without an explicit type keep prior behavior.
 */
export function resolveHatBrimType(raw: unknown): HatBrimType {
  if (raw === "rolled" || raw === "folded" || raw === "single") return raw;
  return "single";
}

export function hatBrimDisplayLabel(brimType: string): string {
  if (brimType === "rolled") return "Rolled Brim";
  if (brimType === "folded") return "Folded Hem";
  if (brimType === "single") return "Single Layer";
  return brimType || "—";
}

/** Display string for the Rolled Brim default height in the active unit. */
export function formatHatRolledBrimDefaultLength(unit: HatDisplayUnit): string {
  if (unit === "cm") {
    return String(Math.round(HAT_ROLLED_BRIM_DEFAULT_DEPTH_INCHES * 2.54 * 10) / 10);
  }
  return String(HAT_ROLLED_BRIM_DEFAULT_DEPTH_INCHES);
}

/**
 * When the user newly selects Rolled Brim, return the default height to apply.
 * Returns `null` when already on rolled (so a user-edited height is not overwritten)
 * or when selecting another brim type.
 */
export function nextBrimLengthAfterBrimTypeChange(args: {
  previousBrimType: string;
  nextBrimType: string;
  unit: HatDisplayUnit;
}): string | null {
  if (args.nextBrimType !== "rolled") return null;
  if (args.previousBrimType === "rolled") return null;
  return formatHatRolledBrimDefaultLength(args.unit);
}

export type HatFitStyle = "beanie" | "watchcap" | "slouchy" | "relaxed" | "custom";

export type HatNamedFitStyle = Exclude<HatFitStyle, "custom">;

/**
 * Named length styles as multipliers of the selected size chart’s standard `hatLength`.
 *
 * Derived from the former adult fixed inches relative to Classic/Standard (8.5"):
 *   Beanie 7" / 8.5" ≈ 0.824 → shorter than Standard
 *   Standard (watchcap) 8.5" / 8.5" = 1 → 100% of chart length
 *   Relaxed 9" / 8.5" ≈ 1.059 → modestly longer
 *   Slouchy 10" / 8.5" ≈ 1.176 → longer still
 */
export const HAT_FIT_LENGTH_STYLE_MULTIPLIERS: Readonly<Record<HatNamedFitStyle, number>> = {
  beanie: 7 / 8.5,
  watchcap: 1,
  relaxed: 9 / 8.5,
  slouchy: 10 / 8.5,
};

/** Named fit keys in picker order (Beanie → Standard → Slouchy → Relaxed). */
export const HAT_NAMED_FIT_STYLES: readonly HatNamedFitStyle[] = [
  "beanie",
  "watchcap",
  "slouchy",
  "relaxed",
];

/**
 * Fallback Standard length when size is custom / chart length is missing.
 * Matches Adult Woman chart `hatLength`.
 */
export const HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES = 11;

/** Round finished hat length to the project’s 0.1" measurement precision. */
export function roundHatFinishedLengthInches(inches: number): number {
  if (!Number.isFinite(inches)) return inches;
  return Math.round(inches * 10) / 10;
}

export function isHatNamedFitStyle(fit: string): fit is HatNamedFitStyle {
  return Object.prototype.hasOwnProperty.call(HAT_FIT_LENGTH_STYLE_MULTIPLIERS, fit);
}

/** Chart Standard finished hat length for a size, or null when unavailable. */
export function chartStandardHatLengthInches(
  hatSizeValue: string,
  sizingRows: ReadonlyArray<HatSizingLengthRow>,
): number | null {
  if (!hatSizeValue || hatSizeValue === "custom") return null;
  const selectedSize = sizingRows.find((s) => s.size === hatSizeValue);
  const fromChart =
    selectedSize != null && Number(selectedSize.hatLength) > 0
      ? Number(selectedSize.hatLength)
      : null;
  return fromChart;
}

/**
 * Resolve a named length style to total finished hat length (inches) for the
 * selected size: chart Standard × style multiplier, rounded to 0.1".
 */
export function resolveNamedFitLengthInches(
  fit: string,
  hatSizeValue: string,
  sizingRows: ReadonlyArray<HatSizingLengthRow>,
): number | null {
  if (!isHatNamedFitStyle(fit)) return null;
  const standard =
    chartStandardHatLengthInches(hatSizeValue, sizingRows) ??
    HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES;
  if (!(standard > 0)) return null;
  return roundHatFinishedLengthInches(standard * HAT_FIT_LENGTH_STYLE_MULTIPLIERS[fit]);
}

/**
 * @deprecated Prefer `resolveNamedFitLengthInches` with a size chart row.
 * Adult Woman lengths from the percentage model (legacy pages without size context).
 */
export const HAT_FIT_HEIGHTS_INCHES: Readonly<Record<HatNamedFitStyle, number>> = {
  beanie: roundHatFinishedLengthInches(
    HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES * HAT_FIT_LENGTH_STYLE_MULTIPLIERS.beanie,
  ),
  watchcap: roundHatFinishedLengthInches(
    HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES * HAT_FIT_LENGTH_STYLE_MULTIPLIERS.watchcap,
  ),
  relaxed: roundHatFinishedLengthInches(
    HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES * HAT_FIT_LENGTH_STYLE_MULTIPLIERS.relaxed,
  ),
  slouchy: roundHatFinishedLengthInches(
    HAT_FIT_LENGTH_FALLBACK_STANDARD_INCHES * HAT_FIT_LENGTH_STYLE_MULTIPLIERS.slouchy,
  ),
};

export type HatSpiralPlan = {
  decreasePoints: number;
  targetStitches: number;
  decreaseRows: number;
  gradual: number;
  rapid: number;
  gradualRows: number;
  rapidRows: number;
  crownRows: number;
};

export type HatCrownPlan = {
  crownDepth: number;
  bodyLength: number;
  note: string;
  crownRows: number;
  spiral: HatSpiralPlan | null;
};

export type HatWedgeNeedleRange = {
  wedgeNumber: number;
  stitchCount: number;
  startNeedleLabel: string;
  endNeedleLabel: string;
  displayRange: string;
  needleLabels: string[];
};

export type HatFourWedgeCrownSetup = {
  baseCastOnStitches: number;
  adjustedCastOnStitches: number;
  castOnAdjustedFromBase: boolean;
  wedgeStitchCount: number;
  scrapOffStitchCount: number;
  crownStartRow: number;
  wedgeNeedleRanges: HatWedgeNeedleRange[];
  scrapOffDisplayRange: string;
  firstWedgeDisplayRange: string;
};

/** Inputs for the full hat pattern calculation (already converted to inches where needed). */
export type HatPatternCalcInput = {
  /** Finished body circumference in inches (chart finished size or custom). */
  finishedHatCircInches: number;
  /** Stitch gauge as entered in the UI (per 4" or 10 cm). */
  stitchGaugeDisplay: number;
  /** Row gauge as entered in the UI (per 4" or 10 cm). */
  rowGaugeDisplay: number;
  displayUnit: HatDisplayUnit;
  /** Total finished hat length in inches. */
  totalHatLengthInches: number;
  /** Visible brim height in inches. */
  brimDepthInches: number;
  brimType: HatBrimType;
  crown: HatCrownStyle | string;
  /** Chart suggested/default crown depth in inches (0 when unknown). */
  suggestedCrownDepthInches: number;
  fit: string;
};

/** Derived pattern calculation used by instructions, diagram, and print summary. */
export type HatPatternCalc = {
  targetWidth: number;
  castOnSts: number;
  hatHeight: number;
  brimDepth: number;
  brimRows: number;
  brimType: HatBrimType;
  bodyRows: number;
  crownRowCount: number;
  bodyHeightInches: number;
  crownHeightInches: number;
  crownPlan: HatCrownPlan;
  crown: string;
  fit: string;
  stGaugePerInch: number;
  rowGaugePerInch: number;
  stitchGaugeRaw: number;
  rowGaugeRaw: number;
  fourWedgeCrownSetup?: HatFourWedgeCrownSetup | null;
};

/** Chart row fields needed to resolve finished length. */
export type HatSizingLengthRow = {
  size: string;
  hatLength?: number;
  suggestedCrownDepth?: number;
  defaultCrownDepth?: number;
  finishedSizeInches?: number;
  circumference?: number;
};

/** Round finished hat size from head circumference: head × 0.9, rounded to 0.5". */
export function roundFinishedHatSizeFromHead(headInches: number): number {
  const n = Number(headInches);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 0.9 * 2) / 2;
}

/** Round to integer; if odd, bump up to next even (stitch/row parity). */
export function roundToEvenPreferUp(value: number): number {
  const n = Math.round(value);
  return n % 2 === 0 ? n : n + 1;
}

/** Spiral crown: stitch count must be divisible by 6. Snaps to nearest multiple of 6. */
export function snapCastOnToNearestMultipleOf6(castOnStitches: number): number {
  let n = castOnStitches;
  if (n % 6 !== 0) {
    const lower = Math.floor(n / 6) * 6;
    const upper = Math.ceil(n / 6) * 6;
    n = Math.abs(n - lower) <= Math.abs(upper - n) ? lower : upper;
  }
  return n;
}

/** Adjust cast-on for crown type (legacy wedge-4 trim; 4-wedge round up; spiral ÷6; gathered even). */
export function applyHatCrownCastOnAdjustment(castOnSts: number, crown: string): number {
  if (crown === "wedge-4") return castOnSts - (castOnSts % 4);
  if (crown === "wedge-4-decrease") {
    const r = castOnSts % 4;
    return r === 0 ? castOnSts : castOnSts + (4 - r);
  }
  if (crown === "spiral") return snapCastOnToNearestMultipleOf6(castOnSts);
  // Gathered every-other transfer needs an even cast-on so remaining stitches are whole.
  if (crown === "gathered") return roundToEvenPreferUp(castOnSts);
  return castOnSts;
}

/**
 * Stitches remaining after transferring every other stitch for a gathered crown.
 * Even cast-on → exactly half; odd (defensive) → floor(n/2) so we never imply a half stitch.
 */
export function gatheredCrownRemainingStitches(patternCastOnSts: number): number {
  const n = Math.max(0, Math.round(Number(patternCastOnSts) || 0));
  return Math.floor(n / 2);
}

/** Continuous RC where gathered/swirl/four-gore crown shaping begins (after brim + body). */
export function hatCrownStartRow(calc: {
  brimRows: number;
  bodyRows: number;
}): number {
  return Math.max(0, Math.floor(calc.brimRows) + Math.floor(calc.bodyRows));
}

/** RC after knitting the calculated crown rows (crownStart + crownRowCount). */
export function hatCrownEndingRow(calc: {
  brimRows: number;
  bodyRows: number;
  crownRowCount: number;
}): number {
  return hatCrownStartRow(calc) + Math.max(0, Math.floor(calc.crownRowCount));
}

/**
 * Shared crown planning logic. All values returned in inches unless otherwise stated.
 */
export function buildHatCrownPlan(args: {
  crown: string;
  finishedHatLength: number;
  suggestedCrownDepth: number;
  castOnStitches: number;
  rowGaugePerInch: number;
}): HatCrownPlan {
  const {
    crown,
    finishedHatLength,
    suggestedCrownDepth,
    castOnStitches,
    rowGaugePerInch,
  } = args;
  const safeLength = Number.isFinite(finishedHatLength) ? finishedHatLength : 0;
  const safeSuggestedDepth = Number.isFinite(suggestedCrownDepth) ? suggestedCrownDepth : 0;
  const safeCastOn = Number.isFinite(castOnStitches) ? castOnStitches : 0;
  const safeRowGauge = Number.isFinite(rowGaugePerInch) && rowGaugePerInch > 0 ? rowGaugePerInch : 0;

  if (crown === "gathered") {
    // Suggested crown depth is knitted after the every-other transfer (not part of the body).
    const crownDepth = Math.max(0, safeSuggestedDepth);
    return {
      crownDepth,
      bodyLength: Math.max(0, safeLength - crownDepth),
      note: "Gathered crown: transfer every other stitch, knit the crown rows, then gather.",
      crownRows: Math.max(0, Math.round(crownDepth * safeRowGauge)),
      spiral: null,
    };
  }

  if (crown === "spiral") {
    const decreasePoints = 6;
    const targetStitches = 6;
    const castOnForSpiral = snapCastOnToNearestMultipleOf6(safeCastOn);
    if ((castOnForSpiral - targetStitches) % 6 !== 0) {
      console.warn("Spiral crown math mismatch: stitches not reducing cleanly by 6.");
    }
    const decreaseRows = Math.max(0, (castOnForSpiral - targetStitches) / decreasePoints);
    const gradual = Math.round(decreaseRows * 0.67);
    const rapid = decreaseRows - gradual;
    const gradualRows = Math.max(0, gradual > 0 ? gradual * 2 - 1 : 0);
    const rapidRows = rapid;
    const crownRows = gradualRows + rapidRows;
    const crownDepth = safeRowGauge > 0 ? crownRows / safeRowGauge : 0;
    return {
      crownDepth,
      bodyLength: safeLength - crownDepth,
      note: "Spiral crown depth is calculated from the shaping schedule.",
      crownRows,
      spiral: {
        decreasePoints,
        targetStitches,
        decreaseRows,
        gradual,
        rapid,
        gradualRows,
        rapidRows,
        crownRows,
      },
    };
  }

  const crownDepth = safeSuggestedDepth;
  return {
    crownDepth,
    bodyLength: safeLength - crownDepth,
    note: "Wedge crown depth is based on the sizing chart.",
    crownRows: Math.max(0, Math.round(crownDepth * safeRowGauge)),
    spiral: null,
  };
}

/**
 * Centered cast-on needle label at a left-to-right stitch index.
 */
export function hatCastOnNeedleAtIndex(
  stitchIndex: number,
  N: number,
): { side: "L" | "R"; num: number; label: string } {
  const half = N / 2;
  if (stitchIndex < half) {
    const num = half - stitchIndex;
    return { side: "L", num, label: `L${num}` };
  }
  const num = stitchIndex - half + 1;
  return { side: "R", num, label: `R${num}` };
}

/** Map a contiguous stitch index range to L/R needle display text. */
export function formatHatWedgeNeedleDisplayRange(
  startIdx: number,
  endIdx: number,
  N: number,
): string {
  const half = N / 2;
  if (
    !Number.isFinite(startIdx) ||
    !Number.isFinite(endIdx) ||
    !Number.isFinite(N) ||
    N <= 0 ||
    startIdx > endIdx
  ) {
    return "";
  }
  const a = Math.max(0, Math.min(N - 1, startIdx));
  const b = Math.max(0, Math.min(N - 1, endIdx));

  function leftSpan(s: number, e: number): string {
    if (s > e) return "";
    const outer = half - s;
    const inner = half - e;
    if (outer < 1 || inner < 1) return "";
    if (outer === inner) return `L${outer}`;
    return `L${outer} to L${inner}`;
  }
  function rightSpan(s: number, e: number): string {
    if (s > e) return "";
    const lo = s - half + 1;
    const hi = e - half + 1;
    if (lo < 1 || hi < 1) return "";
    if (lo === hi) return `R${lo}`;
    return `R${lo} to R${hi}`;
  }

  if (b < half) return leftSpan(a, b);
  if (a >= half) return rightSpan(a, b);
  const leftPart = leftSpan(a, half - 1);
  const rightPart = rightSpan(half, b);
  if (leftPart && rightPart) return `${leftPart}, then ${rightPart}`;
  return leftPart || rightPart || "";
}

/** Build four wedge needle ranges for an adjusted cast-on divisible by 4. */
export function buildFourWedgeNeedleRanges(
  N: number,
  wedgeStitchCount: number,
): HatWedgeNeedleRange[] {
  const w = wedgeStitchCount;
  if (!Number.isFinite(N) || N <= 0 || N % 4 !== 0 || !Number.isFinite(w) || w !== N / 4) {
    return [];
  }
  const wedges: HatWedgeNeedleRange[] = [];
  for (let wn = 1; wn <= 4; wn += 1) {
    const physicalSlot = 4 - wn;
    const startIdx = physicalSlot * w;
    const endIdx = startIdx + w - 1;
    const needleLabels: string[] = [];
    for (let i = startIdx; i <= endIdx; i += 1) {
      needleLabels.push(hatCastOnNeedleAtIndex(i, N).label);
    }
    const startL = hatCastOnNeedleAtIndex(startIdx, N);
    const endL = hatCastOnNeedleAtIndex(endIdx, N);
    wedges.push({
      wedgeNumber: wn,
      stitchCount: w,
      startNeedleLabel: startL.label,
      endNeedleLabel: endL.label,
      displayRange: formatHatWedgeNeedleDisplayRange(startIdx, endIdx, N),
      needleLabels,
    });
  }
  return wedges;
}

/**
 * Convert display gauge (sts/rows per 4" or 10 cm) to per-inch, matching wizard-utils.
 */
export function hatGaugeToPerInch(gauge: number, displayUnit: HatDisplayUnit): number {
  if (!(gauge > 0)) return 0;
  return displayUnit === "inches" ? gauge / 4 : gauge / (10 / 2.54);
}

/**
 * Total finished hat length (inches): custom input, named fit style, or chart fallback.
 * Named styles (Beanie / Standard / Slouchy / …) scale from the size chart’s Standard length.
 * Chart hatLength is only a fallback when fit is empty/unknown (e.g. size-driven default).
 */
export function resolveTotalHatLengthInches(args: {
  fit: string;
  hatSizeValue: string;
  customLengthDisplay?: number;
  displayUnit: HatDisplayUnit;
  sizingRows: HatSizingLengthRow[];
  /** cm → inches converter when custom length is in cm. */
  convertCmToInches?: (cm: number) => number;
}): number | null {
  const { fit, hatSizeValue, customLengthDisplay, displayUnit, sizingRows, convertCmToInches } =
    args;
  if (!fit) {
    return chartStandardHatLengthInches(hatSizeValue, sizingRows);
  }
  if (fit === "custom") {
    const customLengthValue = Number(customLengthDisplay) || 0;
    if (customLengthValue <= 0) return null;
    if (displayUnit === "inches") return customLengthValue;
    return convertCmToInches ? convertCmToInches(customLengthValue) : customLengthValue / 2.54;
  }
  const fromNamed = resolveNamedFitLengthInches(fit, hatSizeValue, sizingRows);
  if (fromNamed != null) return fromNamed;
  return chartStandardHatLengthInches(hatSizeValue, sizingRows);
}

/** Build four-wedge crown setup attached during instruction generation. */
export function buildFourWedgeCrownSetup(args: {
  castOnSts: number;
  crown: string;
  brimRows: number;
  bodyRows: number;
}): HatFourWedgeCrownSetup | null {
  const { castOnSts, crown, brimRows, bodyRows } = args;
  if (crown !== "wedge-4-decrease") return null;
  const adjustedCastOnStitches = applyHatCrownCastOnAdjustment(castOnSts, crown);
  const wedgeStitchCount = adjustedCastOnStitches / 4;
  const N = adjustedCastOnStitches;
  const wedgeNeedleRanges = buildFourWedgeNeedleRanges(N, wedgeStitchCount);
  const scrapOffEndIdx = 3 * wedgeStitchCount - 1;
  const firstWedgeStartIdx = 3 * wedgeStitchCount;
  const firstWedgeEndIdx = N - 1;
  const scrapOffDisplayRange = `${hatCastOnNeedleAtIndex(0, N).label} to ${hatCastOnNeedleAtIndex(scrapOffEndIdx, N).label}`;
  return {
    baseCastOnStitches: castOnSts,
    adjustedCastOnStitches,
    castOnAdjustedFromBase: adjustedCastOnStitches !== castOnSts,
    wedgeStitchCount,
    scrapOffStitchCount: adjustedCastOnStitches - wedgeStitchCount,
    crownStartRow: brimRows + bodyRows,
    wedgeNeedleRanges,
    scrapOffDisplayRange,
    firstWedgeDisplayRange: formatHatWedgeNeedleDisplayRange(
      firstWedgeStartIdx,
      firstWedgeEndIdx,
      N,
    ),
  };
}

/**
 * Per-wedge decrease schedule for four-gore crowns.
 * Shared by written instructions and the shaping-notation diagram — not a second calc path.
 */
export type HatFourWedgeDecreaseSchedule = {
  finalWedgeStitchCount: number;
  decreaseCount: number;
  /** Rows between decrease rows (1 = every row). */
  rowFrequency: number;
  /** Remaining stitches after all four wedges finish. */
  remainingStitchesTotal: number;
};

export function buildFourWedgeDecreaseSchedule(
  wedgeStitchCount: number,
  crownRowCount: number,
): HatFourWedgeDecreaseSchedule {
  const safeWedge = Math.max(0, Math.round(wedgeStitchCount));
  const finalWedgeStitchCount = safeWedge % 2 === 1 ? 1 : 2;
  const decreaseCount = Math.max(0, (safeWedge - finalWedgeStitchCount) / 2);
  const safeCrownRows = Math.max(0, Math.round(crownRowCount));
  const rowFrequency =
    decreaseCount > 0 ? Math.max(1, Math.round(safeCrownRows / decreaseCount)) : 1;
  return {
    finalWedgeStitchCount,
    decreaseCount,
    rowFrequency,
    remainingStitchesTotal: finalWedgeStitchCount * 4,
  };
}

/**
 * Full hat pattern calculation (parity with former inline `calculate()` math).
 */
export function calculateHatPattern(input: HatPatternCalcInput): HatPatternCalc {
  const {
    finishedHatCircInches,
    stitchGaugeDisplay,
    rowGaugeDisplay,
    displayUnit,
    totalHatLengthInches,
    brimDepthInches,
    brimType,
    crown,
    suggestedCrownDepthInches,
    fit,
  } = input;

  const stGaugePerInch = hatGaugeToPerInch(stitchGaugeDisplay, displayUnit);
  const rowGaugePerInch = hatGaugeToPerInch(rowGaugeDisplay, displayUnit);

  const targetWidth = finishedHatCircInches;
  const castOnSts = roundToEvenPreferUp(targetWidth * stGaugePerInch);
  const hatHeight = totalHatLengthInches;
  const brimDepth = brimDepthInches;

  const crownPlan = buildHatCrownPlan({
    crown,
    finishedHatLength: hatHeight,
    suggestedCrownDepth: Number.isFinite(suggestedCrownDepthInches)
      ? suggestedCrownDepthInches
      : 0,
    castOnStitches: castOnSts,
    rowGaugePerInch,
  });

  const crownHeightInches = Math.max(0, crownPlan.crownDepth);
  const resolvedBrimType = resolveHatBrimType(brimType);
  /**
   * Brim rows vs finished length:
   * - Finished hat length (hatHeight) is bottom-of-brim → crown and includes the
   *   selected visible brim height for all constructions (rolled, single, folded).
   * - Folded Hem doubles fabric rows for the turn-under; body math still subtracts
   *   only the visible brim once.
   * - Rolled Brim uses the same single-layer row formula (brimDepth × gauge) — do
   *   not double. The rolled section is the visible brim included in total length.
   */
  const brimRows =
    resolvedBrimType === "folded"
      ? roundToEvenPreferUp(brimDepth * 2 * rowGaugePerInch)
      : roundToEvenPreferUp(brimDepth * rowGaugePerInch);
  const crownRowCount =
    crown === "spiral"
      ? Math.max(0, crownPlan.crownRows)
      : roundToEvenPreferUp(crownHeightInches * rowGaugePerInch);

  const bodyHeightInches = Math.max(0, crownPlan.bodyLength - brimDepth);
  const bodyRows = roundToEvenPreferUp(bodyHeightInches * rowGaugePerInch);

  return {
    targetWidth,
    castOnSts,
    hatHeight,
    brimDepth,
    brimRows,
    brimType: resolvedBrimType,
    bodyRows,
    crownRowCount,
    bodyHeightInches,
    crownHeightInches,
    crownPlan,
    crown,
    fit,
    stGaugePerInch,
    rowGaugePerInch,
    stitchGaugeRaw: stitchGaugeDisplay,
    rowGaugeRaw: rowGaugeDisplay,
    fourWedgeCrownSetup: null,
  };
}
