export type GaugePair = {
  stitches: number;
  rows: number;
};

export type PatternConversionInput = {
  patternGauge: GaugePair;
  myGauge: GaugePair;
  patternStitchCount?: number | null;
  patternRowCount?: number | null;
};

export type PatternConversionRatios = {
  stitchRatio: number;
  rowRatio: number;
};

export type ConvertedPatternNumber = {
  kind: "stitch" | "row";
  patternValue: number;
  convertedValue: number;
  ratio: number;
};

export type PatternConversionOutput = {
  ratios: PatternConversionRatios | null;
  stitchConversion: ConvertedPatternNumber | null;
  rowConversion: ConvertedPatternNumber | null;
};

export function parsePositiveNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

export function calculateStitchRatio(
  myStitches: number,
  patternStitches: number,
): number | null {
  if (patternStitches <= 0 || myStitches <= 0) return null;
  return myStitches / patternStitches;
}

export function calculateRowRatio(myRows: number, patternRows: number): number | null {
  if (patternRows <= 0 || myRows <= 0) return null;
  return myRows / patternRows;
}

export function convertPatternValue(patternValue: number, ratio: number): number {
  return Math.round(patternValue * ratio);
}

export function buildConversion(
  kind: ConvertedPatternNumber["kind"],
  patternValue: number,
  ratio: number,
): ConvertedPatternNumber {
  return {
    kind,
    patternValue,
    ratio,
    convertedValue: convertPatternValue(patternValue, ratio),
  };
}

export function formatRatio(ratio: number): string {
  return Number(ratio.toFixed(2)).toString();
}

export function formatConversionFormula(
  patternValue: number,
  ratio: number,
  convertedValue: number,
): string {
  return `${patternValue} × ${formatRatio(ratio)} = ${convertedValue}`;
}

export function calculatePatternConversion(
  input: PatternConversionInput,
): PatternConversionOutput {
  const stitchRatio = calculateStitchRatio(
    input.myGauge.stitches,
    input.patternGauge.stitches,
  );
  const rowRatio = calculateRowRatio(input.myGauge.rows, input.patternGauge.rows);

  if (stitchRatio === null || rowRatio === null) {
    return {
      ratios: null,
      stitchConversion: null,
      rowConversion: null,
    };
  }

  const ratios = { stitchRatio, rowRatio };

  return {
    ratios,
    stitchConversion:
      input.patternStitchCount != null && input.patternStitchCount > 0
        ? buildConversion("stitch", input.patternStitchCount, stitchRatio)
        : null,
    rowConversion:
      input.patternRowCount != null && input.patternRowCount > 0
        ? buildConversion("row", input.patternRowCount, rowRatio)
        : null,
  };
}
