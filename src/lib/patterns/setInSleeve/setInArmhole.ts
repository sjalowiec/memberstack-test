/**
 * Set-in armhole for the adult set-in sleeve sweater.
 *
 * One plan is used for the front and the back. The sleeveless armhole helper
 * is not used here.
 *
 * Preferred method (The Knitter's Guide, alternate set-in armhole): split the
 * shaping stitches on one side into three groups of about one third.
 * 1. Bind off the first group at once.
 * 2. Bind off the second group as a stair step, in two or three steps of at
 *    least two stitches. This group must contain at least four stitches.
 * 3. Decrease the last group one stitch every other row.
 * 4. Work even to the shoulder.
 *
 * When the stair-step group would be smaller than four stitches, or a group
 * would be empty, the standard set-in armhole is used instead: bind off about
 * half the shaping stitches, then decrease the rest every other row.
 *
 * Rounding never adds or drops a shaping stitch. Each bind-off action takes
 * two rows, one for each side.
 */

export const SET_IN_ARMHOLE_BIND_OFF_ROWS = 2;
export const MIN_STAIR_STEP_STITCHES = 4;
export const MIN_STAIR_BIND_OFF_STITCHES = 2;

export type SetInArmholeMethod = "alternate" | "standard";

export type SetInArmholePlan = {
  ok: true;
  method: SetInArmholeMethod;
  /** This plan is used for both the front and the back. */
  appliesTo: "front-and-back";
  shapingStitchesEachSide: number;
  /** First underarm bind-off, worked at once on both sides. */
  initialBindOffStitchesEachSide: number;
  initialBindOffRows: number;
  /** Later bind-offs. Empty for the standard method. Larger steps come first. */
  stairStepBindOffsEachSide: number[];
  stairStepStitchesEachSide: number;
  stairStepRows: number;
  /** Initial bind-off plus stair steps. */
  matchedBindOffStitchesEachSide: number;
  matchedBindOffRows: number;
  decreaseStitchesEachSide: number;
  decreaseRows: number;
  straightRows: number;
  totalRows: number;
};

export type SetInArmholeFailure = {
  ok: false;
  reason: "armhole-shaping" | "armhole-too-shallow";
  message: string;
};

export type SetInArmholeResult = SetInArmholePlan | SetInArmholeFailure;

export type SetInArmholeGroups = {
  method: SetInArmholeMethod;
  initialBindOffStitchesEachSide: number;
  stairStepBindOffsEachSide: number[];
  decreaseStitchesEachSide: number;
};

function fail(reason: SetInArmholeFailure["reason"], message: string): SetInArmholeFailure {
  return { ok: false, reason, message };
}

/**
 * Split a stair-step group into two or three bind-offs.
 * Four or five stitches use two steps. Six or more use three.
 * Each step is at least two stitches, larger steps come first, and the
 * steps add up to the group.
 */
export function stairStepBindOffs(stairStitches: number): number[] | null {
  if (!Number.isInteger(stairStitches) || stairStitches < MIN_STAIR_STEP_STITCHES) return null;
  const steps = stairStitches >= MIN_STAIR_BIND_OFF_STITCHES * 3 ? 3 : 2;
  const base = Math.floor(stairStitches / steps);
  let extra = stairStitches - base * steps;
  const amounts = Array.from({ length: steps }, () => base);
  for (let index = 0; index < amounts.length && extra > 0; index += 1) {
    amounts[index] += 1;
    extra -= 1;
  }
  if (
    extra !== 0 ||
    amounts.some((stitches) => stitches < MIN_STAIR_BIND_OFF_STITCHES) ||
    amounts.reduce((sum, stitches) => sum + stitches, 0) !== stairStitches
  ) {
    return null;
  }
  return amounts;
}

/**
 * Divide one side's shaping stitches. The alternate method is used only when
 * every group has stitches and the stair-step group has at least four.
 */
export function divideSetInArmholeShaping(shapingStitchesEachSide: number): SetInArmholeGroups | null {
  if (!Number.isInteger(shapingStitchesEachSide) || shapingStitchesEachSide < 1) return null;

  const third = Math.round(shapingStitchesEachSide / 3);
  const decreases = shapingStitchesEachSide - third * 2;
  const stairs = stairStepBindOffs(third);
  if (third >= 1 && decreases >= 1 && stairs) {
    return {
      method: "alternate",
      initialBindOffStitchesEachSide: third,
      stairStepBindOffsEachSide: stairs,
      decreaseStitchesEachSide: decreases,
    };
  }

  const initial = Math.round(shapingStitchesEachSide / 2);
  const standardDecreases = shapingStitchesEachSide - initial;
  if (initial < 1 || standardDecreases < 0) return null;
  return {
    method: "standard",
    initialBindOffStitchesEachSide: initial,
    stairStepBindOffsEachSide: [],
    decreaseStitchesEachSide: standardDecreases,
  };
}

export function calculateSetInArmhole(input: {
  startingStitches: number;
  targetStitches: number;
  totalRows: number;
}): SetInArmholeResult {
  const { startingStitches, targetStitches, totalRows } = input;
  if (
    !Number.isInteger(startingStitches) ||
    !Number.isInteger(targetStitches) ||
    !Number.isInteger(totalRows) ||
    startingStitches <= 0 ||
    targetStitches <= 0 ||
    totalRows <= 0
  ) {
    return fail(
      "armhole-shaping",
      "Armhole shaping needs whole stitch counts and a whole row budget, all greater than zero.",
    );
  }
  if (targetStitches >= startingStitches) {
    return fail(
      "armhole-shaping",
      "Armhole shaping needs fewer stitches at the shoulder than at the underarm.",
    );
  }

  const totalChange = startingStitches - targetStitches;
  if (totalChange % 2 !== 0) {
    return fail(
      "armhole-shaping",
      "Armhole shaping stitches do not divide evenly between the two sides.",
    );
  }

  const shapingStitchesEachSide = totalChange / 2;
  const groups = divideSetInArmholeShaping(shapingStitchesEachSide);
  if (!groups) {
    return fail("armhole-shaping", "These stitches cannot be divided into a set-in armhole.");
  }

  const stairStepStitchesEachSide = groups.stairStepBindOffsEachSide.reduce(
    (sum, stitches) => sum + stitches,
    0,
  );
  const matchedBindOffStitchesEachSide =
    groups.initialBindOffStitchesEachSide + stairStepStitchesEachSide;
  if (
    matchedBindOffStitchesEachSide + groups.decreaseStitchesEachSide !==
    shapingStitchesEachSide
  ) {
    return fail(
      "armhole-shaping",
      "Armhole bind-offs and decreases do not add up to the shaping stitches.",
    );
  }

  const bindOffActions = 1 + groups.stairStepBindOffsEachSide.length;
  const matchedBindOffRows = bindOffActions * SET_IN_ARMHOLE_BIND_OFF_ROWS;
  const decreaseRows = groups.decreaseStitchesEachSide * 2;
  const straightRows = totalRows - matchedBindOffRows - decreaseRows;
  if (straightRows < 0) {
    return fail(
      "armhole-too-shallow",
      `This armhole is ${totalRows} rows deep, and the bind-offs plus decreases need ${matchedBindOffRows + decreaseRows} rows. There are not enough rows to finish the armhole.`,
    );
  }

  return {
    ok: true,
    method: groups.method,
    appliesTo: "front-and-back",
    shapingStitchesEachSide,
    initialBindOffStitchesEachSide: groups.initialBindOffStitchesEachSide,
    initialBindOffRows: SET_IN_ARMHOLE_BIND_OFF_ROWS,
    stairStepBindOffsEachSide: groups.stairStepBindOffsEachSide,
    stairStepStitchesEachSide,
    stairStepRows: groups.stairStepBindOffsEachSide.length * SET_IN_ARMHOLE_BIND_OFF_ROWS,
    matchedBindOffStitchesEachSide,
    matchedBindOffRows,
    decreaseStitchesEachSide: groups.decreaseStitchesEachSide,
    decreaseRows,
    straightRows,
    totalRows,
  };
}
