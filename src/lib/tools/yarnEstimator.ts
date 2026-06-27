export function parsePositiveNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = parseFloat(trimmed);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

export function formatGrams(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
}

export type YarnEstimateInput = {
  swatchWidth: number;
  swatchHeight: number;
  swatchWeight: number;
  pieceWidth: number;
  pieceHeight: number;
};

export function estimateYarnGrams(input: YarnEstimateInput): number {
  const swatchArea = input.swatchWidth * input.swatchHeight;
  const pieceArea = input.pieceWidth * input.pieceHeight;
  return (pieceArea / swatchArea) * input.swatchWeight;
}

export function formatYarnEstimateResult(grams: number): string {
  return `${formatGrams(grams)} grams are needed for this piece`;
}
