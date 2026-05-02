export type NecklineStep = {
  stitches: number;
  times: number;
};

export function calculateNecklineShaping(stitches: number, steps: number): NecklineStep[] {
  if (!Number.isFinite(stitches) || !Number.isFinite(steps)) return [];
  if (stitches <= 0 || steps <= 0) return [];

  const totalStitches = Math.round(stitches);
  const totalSteps = Math.floor(steps);

  const base = Math.floor(totalStitches / totalSteps);
  const remainder = totalStitches % totalSteps;

  const stepsArr: NecklineStep[] = [];

  if (remainder > 0) {
    stepsArr.push({ stitches: base + 1, times: remainder });
  }

  if (totalSteps - remainder > 0 && base > 0) {
    stepsArr.push({ stitches: base, times: totalSteps - remainder });
  }

  return stepsArr;
}
