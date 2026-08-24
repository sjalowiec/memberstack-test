/**
 * Shared Cardigan LEFT FRONT armhole notation stack.
 *
 * Collector order is knitting chronology: bind-off first, then later decreases.
 * Render that order upward so earlier actions sit lower on the garment.
 */

export const CARDIGAN_ARMHOLE_NOTATION_GAP = 18;

/**
 * Ys for an armhole notation stack.
 * Index 0 (BO) stays on the armhole-start / bind-off row; later lines go up.
 */
export function cardiganArmholeNotationYs(
  armholeStartY: number,
  lineCount: number,
  gap: number = CARDIGAN_ARMHOLE_NOTATION_GAP,
): number[] {
  const n = Math.max(1, lineCount);
  return Array.from({ length: n }, (_, i) => armholeStartY - i * gap);
}
