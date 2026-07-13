/**
 * Even shaping schedule shared by drop-shoulder sleeve written instructions and JP notation.
 */

export type EvenShapingSchedule = {
  interval: number;
  count: number;
  remainderRows: number;
};

/**
 * Even shaping schedule: shape every `interval` rows, `count` times, fitting inside `rows`
 * (any leftover is knit even). `interval` is the largest spacing that still fits; an even
 * spacing is preferred (same carriage side) but a 1-row spacing is used for steep shaping.
 */
export function evenShapingSchedule(count: number, rows: number): EvenShapingSchedule {
  if (count <= 0 || rows <= 0) {
    return { interval: 0, count: 0, remainderRows: Math.max(0, rows) };
  }
  let interval = Math.max(1, Math.floor(rows / count));
  if (interval >= 2 && interval % 2 !== 0) interval -= 1;
  const remainderRows = Math.max(0, rows - interval * count);
  return { interval, count, remainderRows };
}

/** Stitches to shape on each edge between wrist and sleeve top (flat piece). */
export function sleeveShapingPerSide(topSts: number, wristSts: number): number {
  return Math.max(0, (topSts - wristSts) / 2);
}

export function sleeveEvenShapingSchedule(
  topSts: number,
  wristSts: number,
  sleeveBodyRows: number,
): EvenShapingSchedule {
  return evenShapingSchedule(sleeveShapingPerSide(topSts, wristSts), sleeveBodyRows);
}

/**
 * Garment RC of each shaping action when the first action falls on `firstActionRc` and repeats
 * every `interval` rows (same spacing as sleeveless armhole decreases at interval 2).
 */
export function shapingActionRowNumbers(
  firstActionRc: number,
  count: number,
  interval: number,
): number[] {
  const n = Math.max(0, Math.floor(count));
  const step = Math.max(0, Math.floor(interval));
  if (n === 0 || step === 0) return [];
  const start = Math.max(0, Math.floor(firstActionRc));
  return Array.from({ length: n }, (_, i) => start + i * step);
}

/** Italic parenthetical shaping RC list: <em>(RC: 168, 170)</em> — trusted HTML only. */
export function formatParentheticalShapingRowNumbers(rows: readonly number[]): string {
  if (rows.length === 0) return "";
  return `<em>(RC: ${rows.join(", ")})</em>`;
}

/**
 * Garment RC list for {@link evenShapingSchedule} decreases beginning at `shapingStartRc`
 * (first decrease on `shapingStartRc + interval`, matching {@link generateRowByRow} spacing).
 */
export function evenShapingGarmentRowNumbers(
  shapingStartRc: number,
  schedule: EvenShapingSchedule,
): number[] {
  const { interval, count } = schedule;
  if (count <= 0 || interval <= 0) return [];
  return shapingActionRowNumbers(shapingStartRc + interval, count, interval);
}
