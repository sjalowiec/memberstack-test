/**
 * Basic Sock pure math — stitch/row calculations only.
 *
 * No instructions, diagrams, or UI. Heel and toe share {@link calculateShortRowShaping}.
 *
 * Rounding (documented working specification for this pass):
 *
 * 1. **Total sock stitches** — `roundToEvenPreferUp(footCircumferenceInches × stitchGaugePerInch)`.
 *    Same Knit It Now even-up used by Hat cast-on (`hatMath.roundToEvenPreferUp`): nearest
 *    integer, then bump odd results up so the count is even. Socks stay even so the tube
 *    splits into two integer halves.
 *
 * 2. **Half split** — `working = held = totalSockStitches / 2` (exact). We do **not**
 *    round total to a multiple of 4. Hat/KIN even-up is ÷2, not ÷4, so the working half
 *    may be odd (e.g. 62 → 31). Held + working always equals total.
 *
 * 3. **Approximately one-third remaining** — round `working / 3` to nearest integer, then
 *    snap to the **same parity as working** so `(working − remaining)` is even and both
 *    sides wrap the same number of stitches. On a tie, prefer the candidate closer to
 *    `working / 3`; if still tied, prefer the larger remaining (fewer wraps). Clamp so
 *    at least 1 stitch remains in work and at least 1 wrap is taken on each side.
 *
 * 4. **No ease** — finished measurements are used as entered. No ease is added.
 *
 * 5. **Heel/toe physical depth** uses ONE DIRECTION of short-row shaping (wrap-in
 *    only), not decrease + increase together:
 *    `shortRowDepthRows = workingStitches - remainingStitches`
 *    (one stitch short-rowed each row). Then
 *    `heelDepthInches = heel.shortRowDepthRows / rowGaugePerInch` (same for toe).
 *    In + out knitting row counts are stored separately for instructions and are
 *    **not** used for finished-length depth.
 *
 * 6. **Straight foot** — `requestedFinishedFootLength - heelDepth - toeDepth`,
 *    then `roundToEvenPreferUp` for rows. A non-positive straight foot is a
 *    calculation error (not clamped).
 *
 * 7. **Straight ankle section** is derived, not entered:
 *    `min(1", footCircumferenceInches / 10)`. Baby is short (~0.4"); adult sizes land
 *    around 0.75–1"; custom large circumferences cap at 1". Rows use
 *    {@link roundToEvenPreferUp}. Remaining leg rows receive Magic Formula shaping
 *    (or are knitted straight). Cuff-to-toe works upper leg then ankle-before-heel;
 *    toe-up works ankle after heel then upper leg toward the cuff.
 *
 * 8. **Leg shaping** uses the shared Magic Formula paired helper
 *    (`computeMagicFormulaPairedShaping` → `magicFormulaIntervals`) over
 *    `legShapingRowsAvailable` only. Wider top = paired increases (+2 per event);
 *    narrower top = paired decreases (−2). Cuff-to-toe and toe-up share the same
 *    finished geometry and interval schedule; knitting-order start/target reverse.
 */

import type { SockConstructionDirection, SockDraft, SockDraftUnit } from "./sockDraft";
import {
  computeMagicFormulaPairedShaping,
  type MagicFormulaPairedEvent,
  type MagicFormulaPairedSuccess,
} from "../legoBlocks/magicFormulaShaping";
import type { ShapingStep } from "../../shaping/generateRowByRow";
import {
  findSockChartSize,
  type SockSizingAdapter,
} from "./sockSizing";

export type { SockConstructionDirection };

export type BasicSockCalcInput = {
  /** Finished foot circumference in inches. Primary stitch driver. */
  footCircumferenceInches: number;
  footLengthInches: number;
  legCircumferenceInches: number;
  legLengthInches: number;
  /** Stitch gauge as entered (per 4" or 10 cm). */
  stitchGaugeDisplay: number;
  /** Row gauge as entered (per 4" or 10 cm). */
  rowGaugeDisplay: number;
  displayUnit: SockDraftUnit;
  constructionDirection: SockConstructionDirection;
};

/**
 * Knit It Now stitch/row rounding: nearest integer, then bump odds up to even.
 * Matches Hat `roundToEvenPreferUp`. Not extracted from Hat (no Hat refactor this pass).
 */
export function roundToEvenPreferUp(value: number): number {
  const n = Math.round(value);
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Display swatch (sts/rows per 4" or 10 cm) → per inch.
 * Matches Hat `hatGaugeToPerInch` / wizard `rawSwatchToPerInch`.
 */
export function sockGaugeToPerInch(gauge: number, displayUnit: SockDraftUnit): number {
  if (!(gauge > 0)) return 0;
  return displayUnit === "inches" ? gauge / 4 : gauge / (10 / 2.54);
}

/**
 * Derived straight-ankle length (inches). Scales with finished foot circumference
 * and caps at {@link SOCK_ANKLE_SECTION_MAX_INCHES} so large/custom socks do not
 * grow an ever-longer ankle.
 *
 * Chart examples at this rule: Baby 0.4", Child 0.65", Woman Medium 0.85",
 * Man Large 1".
 */
export const SOCK_ANKLE_SECTION_MAX_INCHES = 1;
export const SOCK_ANKLE_SECTION_FOOT_CIRC_DIVISOR = 10;

export function deriveSockAnkleStraightLengthInches(footCircumferenceInches: number): number {
  if (!(footCircumferenceInches > 0) || !Number.isFinite(footCircumferenceInches)) return 0;
  return Math.min(
    SOCK_ANKLE_SECTION_MAX_INCHES,
    footCircumferenceInches / SOCK_ANKLE_SECTION_FOOT_CIRC_DIVISOR,
  );
}

export type ShortRowShaping = {
  /** Heel/toe stitches in work (approximately half of the tube). */
  workingStitches: number;
  /** Opposite half, held. */
  heldStitches: number;
  /** Stitches still in work at the short-row turnaround (~1/3 of working). */
  remainingStitches: number;
  /** Stitches wrapped on each side. `2 * wrapsEachSide + remaining = working`. */
  wrapsEachSide: number;
  /**
   * One-stitch-per-row wrap-in steps. Equals {@link shortRowDepthRows};
   * not the return/increase rows.
   */
  shortRowInSteps: number;
  /** One-stitch-per-row wrap-out steps (instruction rows; not physical depth). */
  shortRowOutSteps: number;
  /**
   * Physical depth rows: one direction only, from full working width down to
   * remaining stitches. `workingStitches - remainingStitches`.
   */
  shortRowDepthRows: number;
  /** In + out knitting rows for instructions. Do not use for finished length. */
  shortRowKnittingRows: number;
};

/** No remaining math gaps for Basic Socks geometry + Magic Formula leg shaping. */
export const SOCK_MATH_UNRESOLVED = [] as const;

export type SockMathUnresolved = (typeof SOCK_MATH_UNRESOLVED)[number];

export type SockLegShapingDirection = "none" | "increase" | "decrease";

export type SockLegMagicFormulaIntervals = {
  shortInterval: number;
  longInterval: number;
  shortCount: number;
  longCount: number;
};

export type SockLegSectionKind = "straight-ankle" | "straight-leg" | "leg-shaping";

/** One knitting-order segment. No instruction prose. */
export type SockLegSection = {
  kind: SockLegSectionKind;
  rows: number;
  startStitches: number;
  endStitches: number;
};

export type SockLegKnitOrder = {
  constructionDirection: SockConstructionDirection;
  startStitches: number;
  targetStitches: number;
  direction: SockLegShapingDirection;
  events: MagicFormulaPairedEvent[];
  /** Construction-order segments (cuff-to-toe vs toe-up). */
  sections: SockLegSection[];
};

/**
 * Reusable leg-shaping construction result for Summary and future instructions.
 * Geometry (`direction` / start / target) is finished ankle → top of leg.
 * {@link knitOrder} is the same schedule applied in knitting order.
 */
export type SockLegShapingSchedule = {
  method: "magic";
  direction: SockLegShapingDirection;
  startStitches: number;
  targetStitches: number;
  totalStitchChange: number;
  pairedEventCount: number;
  rowsAvailable: number;
  intervals: SockLegMagicFormulaIntervals;
  steps: ShapingStep[];
  shapingMode: "both";
  knitOrder: SockLegKnitOrder;
};

export type BasicSockCalc = {
  constructionDirection: SockConstructionDirection;
  stGaugePerInch: number;
  rowGaugePerInch: number;
  footCircumferenceInches: number;
  footLengthInches: number;
  legCircumferenceInches: number;
  legLengthInches: number;
  /** Tube stitches from finished foot circumference. */
  totalSockStitches: number;
  footStitches: number;
  /** Same as the foot tube until a separate ankle input exists. */
  ankleStitches: number;
  legStitches: number;
  /** Even-upped rows for finished leg length. */
  legRows: number;
  /**
   * Derived straight section immediately above the heel.
   * Not a user-entered measurement.
   */
  ankleStraightLengthInches: number;
  /** Even-upped rows for {@link ankleStraightLengthInches}. */
  ankleStraightRows: number;
  /**
   * Remaining finished-leg rows after the straight ankle.
   * Magic Formula uses only these rows. `ankleStraightRows + this === legRows`.
   */
  legShapingRowsAvailable: number;
  legShapingNeeded: boolean;
  /** `legStitches - footStitches` (positive = wider leg). */
  legStitchChange: number;
  /** Magic Formula paired schedule. Always present on a successful calc. */
  legShapingSchedule: SockLegShapingSchedule;
  heel: ShortRowShaping;
  toe: ShortRowShaping;
  /** Physical heel depth: one-way short-row rows ÷ row gauge. */
  heelDepthInches: number;
  /** Physical toe depth: one-way short-row rows ÷ row gauge. */
  toeDepthInches: number;
  /** Finished straight foot after subtracting heel and toe depth. */
  straightFootLengthInches: number;
  /** Even-upped rows for {@link straightFootLengthInches}. */
  straightFootRows: number;
  unresolved: readonly SockMathUnresolved[];
};

export type BasicSockCalcFailure = {
  ok: false;
  errors: string[];
};

export type BasicSockCalcResult =
  | { ok: true; calc: BasicSockCalc }
  | BasicSockCalcFailure;

function isPositiveFinite(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/**
 * Split an even tube into held vs working halves.
 * `totalStitches` must already be even (KIN even-up). Defensive odd totals keep
 * `working + held === total` by giving the extra stitch to working.
 */
export function splitSockStitchesIntoHalves(totalStitches: number): {
  workingStitches: number;
  heldStitches: number;
} {
  const total = Math.max(0, Math.round(totalStitches));
  const workingStitches = Math.ceil(total / 2);
  return { workingStitches, heldStitches: total - workingStitches };
}

function sameParity(a: number, b: number): boolean {
  return a % 2 === b % 2;
}

/**
 * Remaining stitches at the short-row turnaround (~1/3 of working), same parity
 * as `workingStitches` so both sides wrap equally.
 */
export function remainingStitchesAtOneThird(workingStitches: number): number | null {
  const working = Math.round(workingStitches);
  if (!(working >= 3)) return null;

  const target = working / 3;
  let remaining = Math.round(target);

  if (!sameParity(remaining, working)) {
    const down = remaining - 1;
    const up = remaining + 1;
    const downDist = Math.abs(down - target);
    const upDist = Math.abs(up - target);
    remaining = downDist < upDist ? down : upDist < downDist ? up : Math.max(down, up);
  }

  const minRemaining = working % 2 === 0 ? 2 : 1;
  const maxRemaining = working - 2;
  if (remaining < minRemaining) remaining = minRemaining;
  if (remaining > maxRemaining) remaining = maxRemaining;
  if (!sameParity(remaining, working)) {
    remaining = remaining + 1 <= maxRemaining ? remaining + 1 : remaining - 1;
  }
  if (remaining < minRemaining || remaining > maxRemaining || !sameParity(remaining, working)) {
    return null;
  }
  return remaining;
}

function sockLegGeometryDirection(
  ankleStitches: number,
  topLegStitches: number,
): SockLegShapingDirection {
  if (topLegStitches > ankleStitches) return "increase";
  if (topLegStitches < ankleStitches) return "decrease";
  return "none";
}

function sockLegShapingScheduleFromPaired(
  ankleStitches: number,
  topLegStitches: number,
  constructionDirection: SockConstructionDirection,
  paired: MagicFormulaPairedSuccess,
  sections: SockLegSection[],
): SockLegShapingSchedule {
  return {
    method: "magic",
    direction: sockLegGeometryDirection(ankleStitches, topLegStitches),
    startStitches: ankleStitches,
    targetStitches: topLegStitches,
    totalStitchChange: topLegStitches - ankleStitches,
    pairedEventCount: paired.pairedEventCount,
    rowsAvailable: paired.rows,
    intervals: {
      shortInterval: paired.shortInterval,
      longInterval: paired.longInterval,
      shortCount: paired.shortCount,
      longCount: paired.longCount,
    },
    steps: paired.steps,
    shapingMode: "both",
    knitOrder: {
      constructionDirection,
      startStitches: paired.startSts,
      targetStitches: paired.endSts,
      direction: paired.direction,
      events: paired.events,
      sections,
    },
  };
}

function buildSockLegConstructionSections(args: {
  constructionDirection: SockConstructionDirection;
  ankleStitches: number;
  topLegStitches: number;
  ankleStraightRows: number;
  remainingRows: number;
  shapingNeeded: boolean;
}): SockLegSection[] {
  const {
    constructionDirection,
    ankleStitches,
    topLegStitches,
    ankleStraightRows,
    remainingRows,
    shapingNeeded,
  } = args;
  const sections: SockLegSection[] = [];
  if (ankleStraightRows > 0) {
    sections.push({
      kind: "straight-ankle",
      rows: ankleStraightRows,
      startStitches: ankleStitches,
      endStitches: ankleStitches,
    });
  }
  if (remainingRows > 0) {
    const knitStart =
      constructionDirection === "cuff-to-toe" ? topLegStitches : ankleStitches;
    const knitEnd =
      constructionDirection === "cuff-to-toe" ? ankleStitches : topLegStitches;
    sections.push({
      kind: shapingNeeded ? "leg-shaping" : "straight-leg",
      rows: remainingRows,
      startStitches: knitStart,
      endStitches: knitEnd,
    });
  }
  if (constructionDirection === "cuff-to-toe") {
    return sections.slice().reverse();
  }
  return sections;
}

function emptyStraightPaired(
  startSts: number,
  endSts: number,
  rows: number,
): MagicFormulaPairedSuccess {
  return {
    ok: true,
    method: "magic",
    noShaping: true,
    direction: "none",
    startSts,
    endSts,
    stitchChange: 0,
    pairedEventCount: 0,
    rows,
    shortInterval: 0,
    longInterval: 0,
    shortCount: 0,
    longCount: 0,
    steps: [],
    shapingMode: "both",
    events: [],
  };
}

/**
 * Reusable short-row primitive (heel and toe). One stitch at a time until
 * ~1/3 of the working stitches remain, then reverse until all are back in work.
 *
 * Physical depth counts wrap-in rows only. Instruction knitting rows count in + out.
 */
export function calculateShortRowShaping(totalSockStitches: number): ShortRowShaping | null {
  const { workingStitches, heldStitches } = splitSockStitchesIntoHalves(totalSockStitches);
  const remainingStitches = remainingStitchesAtOneThird(workingStitches);
  if (remainingStitches == null) return null;
  const wrapsEachSide = (workingStitches - remainingStitches) / 2;
  if (!Number.isInteger(wrapsEachSide) || wrapsEachSide < 1) return null;
  const shortRowDepthRows = workingStitches - remainingStitches;
  return {
    workingStitches,
    heldStitches,
    remainingStitches,
    wrapsEachSide,
    shortRowInSteps: shortRowDepthRows,
    shortRowOutSteps: shortRowDepthRows,
    shortRowDepthRows,
    shortRowKnittingRows: 2 * shortRowDepthRows,
  };
}

export function sockFootTooShortMessage(args: {
  footLengthInches: number;
  heelDepthInches: number;
  toeDepthInches: number;
}): string {
  const combined = args.heelDepthInches + args.toeDepthInches;
  const fmt = (n: number) => {
    const rounded = Math.round(n * 1000) / 1000;
    return String(rounded);
  };
  return `Heel and toe short-row depth (${fmt(combined)} inches combined) is longer than the requested finished foot length (${fmt(args.footLengthInches)} inches). Choose a longer foot, a tighter row gauge, or a smaller circumference.`;
}

export function sockLegTooShortForAnkleMessage(args: {
  legLengthInches: number;
  ankleStraightLengthInches: number;
}): string {
  const fmt = (n: number) => {
    const rounded = Math.round(n * 1000) / 1000;
    return String(rounded);
  };
  return `The finished leg length (${fmt(args.legLengthInches)} inches) is too short to include the derived straight ankle section (${fmt(args.ankleStraightLengthInches)} inches) and the required leg shaping. Lengthen the leg or reduce the circumference difference.`;
}

export function calculateBasicSockPattern(input: BasicSockCalcInput): BasicSockCalcResult {
  const errors: string[] = [];
  if (!isPositiveFinite(input.footCircumferenceInches)) {
    errors.push("Foot circumference must be a positive finished measurement.");
  }
  if (!isPositiveFinite(input.footLengthInches)) {
    errors.push("Foot length must be a positive finished measurement.");
  }
  if (!isPositiveFinite(input.legCircumferenceInches)) {
    errors.push("Leg circumference must be a positive finished measurement.");
  }
  if (!isPositiveFinite(input.legLengthInches)) {
    errors.push("Leg length must be a positive finished measurement.");
  }
  if (!isPositiveFinite(input.stitchGaugeDisplay)) {
    errors.push("Stitch gauge must be a positive number.");
  }
  if (!isPositiveFinite(input.rowGaugeDisplay)) {
    errors.push("Row gauge must be a positive number.");
  }
  if (
    input.constructionDirection !== "cuff-to-toe" &&
    input.constructionDirection !== "toe-up"
  ) {
    errors.push("Construction direction must be cuff-to-toe or toe-up.");
  }
  if (errors.length > 0) return { ok: false, errors };

  const stGaugePerInch = sockGaugeToPerInch(input.stitchGaugeDisplay, input.displayUnit);
  const rowGaugePerInch = sockGaugeToPerInch(input.rowGaugeDisplay, input.displayUnit);
  if (!(stGaugePerInch > 0) || !(rowGaugePerInch > 0)) {
    return { ok: false, errors: ["Gauge must convert to a positive per-inch density."] };
  }

  const totalSockStitches = roundToEvenPreferUp(input.footCircumferenceInches * stGaugePerInch);
  const legStitches = roundToEvenPreferUp(input.legCircumferenceInches * stGaugePerInch);
  const legRows = roundToEvenPreferUp(input.legLengthInches * rowGaugePerInch);

  if (totalSockStitches < 6) {
    return {
      ok: false,
      errors: [
        "Finished foot circumference and stitch gauge produce too few stitches for a short-row heel and toe.",
      ],
    };
  }
  if (legStitches < 2) {
    return { ok: false, errors: ["Leg circumference and stitch gauge produce too few stitches."] };
  }
  if (legRows < 2) {
    return { ok: false, errors: ["Leg length and row gauge produce too few rows."] };
  }

  const shaping = calculateShortRowShaping(totalSockStitches);
  if (!shaping) {
    return {
      ok: false,
      errors: ["Short-row heel/toe shaping cannot be formed from this stitch count."],
    };
  }

  const heel = shaping;
  const toe = { ...shaping };
  const heelDepthInches = heel.shortRowDepthRows / rowGaugePerInch;
  const toeDepthInches = toe.shortRowDepthRows / rowGaugePerInch;
  const straightFootLengthInches =
    input.footLengthInches - heelDepthInches - toeDepthInches;
  if (!(straightFootLengthInches > 0)) {
    return {
      ok: false,
      errors: [
        sockFootTooShortMessage({
          footLengthInches: input.footLengthInches,
          heelDepthInches,
          toeDepthInches,
        }),
      ],
    };
  }

  const straightFootRows = roundToEvenPreferUp(straightFootLengthInches * rowGaugePerInch);
  if (straightFootRows < 2) {
    return {
      ok: false,
      errors: [
        sockFootTooShortMessage({
          footLengthInches: input.footLengthInches,
          heelDepthInches,
          toeDepthInches,
        }),
      ],
    };
  }

  const knitStartStitches =
    input.constructionDirection === "cuff-to-toe" ? legStitches : totalSockStitches;
  const knitTargetStitches =
    input.constructionDirection === "cuff-to-toe" ? totalSockStitches : legStitches;
  const shapingNeeded = legStitches !== totalSockStitches;

  const derivedAnkleLengthInches = deriveSockAnkleStraightLengthInches(
    input.footCircumferenceInches,
  );
  let ankleStraightLengthInches = derivedAnkleLengthInches;
  let ankleStraightRows = roundToEvenPreferUp(derivedAnkleLengthInches * rowGaugePerInch);
  if (ankleStraightRows > legRows) {
    if (shapingNeeded) {
      return {
        ok: false,
        errors: [
          sockLegTooShortForAnkleMessage({
            legLengthInches: input.legLengthInches,
            ankleStraightLengthInches: derivedAnkleLengthInches,
          }),
        ],
      };
    }
    // Very short/Baby-scale fallback: the entire finished leg is the straight ankle.
    ankleStraightRows = legRows;
    ankleStraightLengthInches = Math.min(derivedAnkleLengthInches, input.legLengthInches);
  }
  const legShapingRowsAvailable = legRows - ankleStraightRows;

  let paired: MagicFormulaPairedSuccess;
  if (legShapingRowsAvailable < 1) {
    if (shapingNeeded) {
      return {
        ok: false,
        errors: [
          sockLegTooShortForAnkleMessage({
            legLengthInches: input.legLengthInches,
            ankleStraightLengthInches: derivedAnkleLengthInches,
          }),
        ],
      };
    }
    paired = emptyStraightPaired(knitStartStitches, knitTargetStitches, 0);
  } else {
    const computed = computeMagicFormulaPairedShaping({
      startSts: knitStartStitches,
      endSts: knitTargetStitches,
      rows: legShapingRowsAvailable,
    });
    if (!computed.ok) {
      return { ok: false, errors: [computed.message] };
    }
    paired = computed;
  }

  const sections = buildSockLegConstructionSections({
    constructionDirection: input.constructionDirection,
    ankleStitches: totalSockStitches,
    topLegStitches: legStitches,
    ankleStraightRows,
    remainingRows: legShapingRowsAvailable,
    shapingNeeded,
  });

  const calc: BasicSockCalc = {
    constructionDirection: input.constructionDirection,
    stGaugePerInch,
    rowGaugePerInch,
    footCircumferenceInches: input.footCircumferenceInches,
    footLengthInches: input.footLengthInches,
    legCircumferenceInches: input.legCircumferenceInches,
    legLengthInches: input.legLengthInches,
    totalSockStitches,
    footStitches: totalSockStitches,
    ankleStitches: totalSockStitches,
    legStitches,
    legRows,
    ankleStraightLengthInches,
    ankleStraightRows,
    legShapingRowsAvailable,
    legShapingNeeded: shapingNeeded,
    legStitchChange: legStitches - totalSockStitches,
    legShapingSchedule: sockLegShapingScheduleFromPaired(
      totalSockStitches,
      legStitches,
      input.constructionDirection,
      paired,
      sections,
    ),
    heel,
    toe,
    heelDepthInches,
    toeDepthInches,
    straightFootLengthInches,
    straightFootRows,
    unresolved: SOCK_MATH_UNRESOLVED,
  };

  return { ok: true, calc };
}

function parsePositiveDisplay(raw: string): number | null {
  const n = Number(String(raw).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toInches(displayValue: number, unit: SockDraftUnit): number {
  return unit === "cm" ? displayValue / 2.54 : displayValue;
}

/**
 * Map a Sock draft + sizing adapter to calculator input.
 * Non-empty draft measurement strings win (future Perfect Fit overrides);
 * otherwise a chart size supplies defaults. Chart has no leg circumference —
 * that default is foot circumference.
 */
export function basicSockCalcInputFromDraft(
  draft: SockDraft,
  adapter: SockSizingAdapter,
): BasicSockCalcInput | null {
  const unit: SockDraftUnit = draft.unit === "cm" ? "cm" : "inches";
  const chart = findSockChartSize(adapter, draft.sizeSel);

  const readMeasurement = (
    raw: string,
    chartInches: number | undefined,
  ): number | null => {
    const entered = parsePositiveDisplay(raw);
    if (entered != null) return toInches(entered, unit);
    return chartInches != null && chartInches > 0 ? chartInches : null;
  };

  const footCircumferenceInches = readMeasurement(
    draft.footCircumference,
    chart?.footCircumferenceInches,
  );
  const footLengthInches = readMeasurement(draft.footLength, chart?.footLengthInches);
  const legCircumferenceInches = readMeasurement(
    draft.legCircumference,
    chart?.defaultLegCircumferenceInches,
  );
  const legLengthInches = readMeasurement(draft.legLength, chart?.legLengthInches);

  const slot = draft.gaugeSlots[unit] ?? { stitch: "", row: "" };
  const stitchGaugeDisplay = parsePositiveDisplay(slot.stitch);
  const rowGaugeDisplay = parsePositiveDisplay(slot.row);
  const constructionDirection = draft.constructionDirection;

  if (
    footCircumferenceInches == null ||
    footLengthInches == null ||
    legCircumferenceInches == null ||
    legLengthInches == null ||
    stitchGaugeDisplay == null ||
    rowGaugeDisplay == null ||
    (constructionDirection !== "cuff-to-toe" && constructionDirection !== "toe-up")
  ) {
    return null;
  }

  return {
    footCircumferenceInches,
    footLengthInches,
    legCircumferenceInches,
    legLengthInches,
    stitchGaugeDisplay,
    rowGaugeDisplay,
    displayUnit: unit,
    constructionDirection,
  };
}
