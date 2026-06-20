/**
 * Drop-shoulder armhole depth is derived from upper arm circumference (not a user input).
 * Matches {@link generateDropShoulderPattern} (`upperArmIn / 2`).
 */
export function computeDropShoulderArmholeDepthInches(
  upperArmInches: number | undefined,
): number | undefined {
  if (upperArmInches === undefined || !Number.isFinite(upperArmInches) || upperArmInches <= 0) {
    return undefined;
  }
  return upperArmInches / 2;
}
