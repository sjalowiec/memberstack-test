export type SlopeStep = {
  stitches: number;
  times: number;
};

export function calculateSlopeShaping(rows: number, stitches: number): SlopeStep[] {
  if (!Number.isFinite(rows) || !Number.isFinite(stitches)) return [];
  if (rows <= 0 || stitches <= 0) return [];

  const evenRows = Math.floor(rows) % 2 === 0 ? Math.floor(rows) : Math.floor(rows) - 1;
  if (evenRows <= 0) return [];

  const shapingEvents = evenRows / 2;
  if (shapingEvents <= 0) return [];

  const totalStitches = Math.round(stitches);
  const lower = Math.floor(totalStitches / shapingEvents);
  const higher = lower + 1;

  if (lower <= 0) {
    return [{ stitches: totalStitches, times: 1 }];
  }

  const lowerTimes = (shapingEvents * higher) - totalStitches;
  const higherTimes = shapingEvents - lowerTimes;

  const steps: SlopeStep[] = [];

  if (lowerTimes > 0) {
    steps.push({ stitches: lower, times: lowerTimes });
  }

  if (higherTimes > 0) {
    steps.push({ stitches: higher, times: higherTimes });
  }

  return steps;
}
