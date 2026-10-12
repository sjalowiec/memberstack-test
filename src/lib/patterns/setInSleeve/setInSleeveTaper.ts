/**
 * Set-in sleeve taper check: increases or decreases between the cuff and the upper arm
 * must fit in the sleeve-body rows. Every-row shaping is allowed. A wider cuff is allowed
 * when the stitch difference fits.
 */

import { sleeveEvenShapingSchedule, sleeveShapingPerSide } from "../evenShapingSchedule";

export function setInSleeveTaperProblem(args: {
  topStitches: number;
  cuffStitches: number;
  sleeveBodyRows: number;
}): string | null {
  const { topStitches, cuffStitches, sleeveBodyRows } = args;
  if (
    !Number.isInteger(topStitches) ||
    topStitches <= 0 ||
    !Number.isInteger(cuffStitches) ||
    cuffStitches <= 0
  ) {
    return "Sleeve stitch counts must be whole numbers greater than zero.";
  }
  if (topStitches % 2 !== 0 || cuffStitches % 2 !== 0) {
    return "Sleeve stitch counts must be even so both edges shape the same amount.";
  }
  const perSide = sleeveShapingPerSide(topStitches, cuffStitches);
  if (!Number.isInteger(perSide)) {
    return "The upper arm and cuff need an even stitch difference.";
  }
  if (perSide === 0) return null;
  if (!Number.isInteger(sleeveBodyRows) || sleeveBodyRows <= 0) {
    return "The sleeve length does not leave any rows for shaping between the cuff and the upper arm.";
  }
  const schedule = sleeveEvenShapingSchedule(topStitches, cuffStitches, sleeveBodyRows);
  if (schedule.interval * schedule.count > sleeveBodyRows) {
    return `The sleeve shaping does not fit. This sleeve needs ${perSide} stitches shaped on each side and the sleeve body has ${sleeveBodyRows} rows.`;
  }
  return null;
}
