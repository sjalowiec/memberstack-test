import type {
  ButtonBandInput,
  ButtonBandMathResult,
  ButtonBandMathSuccess,
  ButtonBandUnit,
  ButtonholeSegment,
} from "./buttonBandTypes";

/** Gauge basis for inches (sts/rows per 4″). */
export const GAUGE_BASIS_INCHES = 4;

/** Gauge basis for centimeters (sts/rows per 10 cm). */
export const GAUGE_BASIS_CM = 10;

export function gaugeBasisForUnit(unit: ButtonBandUnit): number {
  return unit === "cm" ? GAUGE_BASIS_CM : GAUGE_BASIS_INCHES;
}

function toInt(value: number): number {
  return Math.trunc(value);
}

export function buildButtonholeSegments(
  startOffsetStitches: number,
  endOffsetStitches: number,
  buttonholeWidthStitches: number,
  spacingBetweenButtonholes: number,
  numberOfButtonholes: number,
): ButtonholeSegment[] {
  const segments: ButtonholeSegment[] = [
    { type: "knit", stitches: startOffsetStitches, label: "Start offset" },
  ];

  for (let i = 1; i <= numberOfButtonholes; i++) {
    segments.push({
      type: "buttonhole",
      stitches: buttonholeWidthStitches,
      label: `Buttonhole ${i}`,
    });
    if (i < numberOfButtonholes) {
      segments.push({
        type: "knit",
        stitches: spacingBetweenButtonholes,
        label: "Spacing",
      });
    }
  }

  segments.push({
    type: "knit",
    stitches: endOffsetStitches,
    label: "End offset",
  });

  return segments;
}

/**
 * Validates inputs and computes folded vertical button band buttonhole placement.
 * Returns friendly error messages instead of throwing.
 */
export function calculateButtonBandMath(input: ButtonBandInput): ButtonBandMathResult {
  const errors: string[] = [];

  const {
    stitchGauge,
    rowGauge,
    gaugeBasis,
    numberOfButtonholes,
    cardiganEdge,
    bandWidth,
    buttonholeSize,
    startOffset,
    endOffset,
    currentRowCount,
  } = input;

  if (!Number.isFinite(stitchGauge) || stitchGauge <= 0) {
    errors.push("Enter a stitch gauge greater than zero.");
  }
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) {
    errors.push("Enter a row gauge greater than zero.");
  }
  if (!Number.isFinite(gaugeBasis) || gaugeBasis <= 0) {
    errors.push("Gauge basis must be greater than zero.");
  }
  if (!Number.isFinite(cardiganEdge) || cardiganEdge <= 0) {
    errors.push("Enter a cardigan edge measurement greater than zero.");
  }
  if (!Number.isFinite(bandWidth) || bandWidth <= 0) {
    errors.push("Enter a band width greater than zero.");
  }
  if (!Number.isFinite(buttonholeSize) || buttonholeSize <= 0) {
    errors.push("Enter a buttonhole size greater than zero.");
  }
  if (!Number.isFinite(startOffset) || startOffset <= 0) {
    errors.push("Enter a start offset greater than zero.");
  }
  if (!Number.isFinite(endOffset) || endOffset <= 0) {
    errors.push("Enter an end offset greater than zero.");
  }
  if (!Number.isFinite(currentRowCount) || currentRowCount < 0) {
    errors.push("Current row count must be zero or greater.");
  }
  if (
    !Number.isFinite(numberOfButtonholes) ||
    numberOfButtonholes <= 0 ||
    !Number.isInteger(numberOfButtonholes)
  ) {
    errors.push("Enter at least one buttonhole.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const rowsPerUnit = rowGauge / gaugeBasis;
  const stitchesPerUnit = stitchGauge / gaugeBasis;

  const cardiganEdgeStitches = Math.ceil(cardiganEdge * stitchesPerUnit);
  const finishedBandRows = Math.ceil(bandWidth * rowsPerUnit);
  const startOffsetStitches = toInt(startOffset * stitchesPerUnit);
  const endOffsetStitches = toInt(endOffset * stitchesPerUnit);
  const buttonholeWidthStitches = Math.max(
    1,
    toInt(buttonholeSize * stitchesPerUnit) - 1,
  );

  const firstSideMidpoint = toInt(finishedBandRows / 2);
  const firstButtonholeRow = currentRowCount + firstSideMidpoint;
  const turningRow = currentRowCount + finishedBandRows;
  const secondButtonholeRow = turningRow + firstSideMidpoint;
  const totalBandRows = finishedBandRows * 2 + 1;
  const finalRow = currentRowCount + totalBandRows;

  const totalButtonholeStitches = buttonholeWidthStitches * numberOfButtonholes;
  const usableSpace =
    cardiganEdgeStitches -
    startOffsetStitches -
    endOffsetStitches -
    totalButtonholeStitches;

  if (usableSpace < 0) {
    return {
      ok: false,
      errors: [
        "The cardigan edge is not long enough to fit all buttonholes with your selected offsets. Try a longer cardigan edge, fewer or smaller buttonholes, or smaller start and end offsets.",
      ],
    };
  }

  const spacingBetweenButtonholes =
    numberOfButtonholes > 1 ? toInt(usableSpace / (numberOfButtonholes - 1)) : 0;

  const success: ButtonBandMathSuccess = {
    ok: true,
    rowsPerUnit,
    stitchesPerUnit,
    cardiganEdgeStitches,
    finishedBandRows,
    castOnStitches: cardiganEdgeStitches,
    totalBandRows,
    firstButtonholeRow,
    turningRow,
    secondButtonholeRow,
    finalRow,
    buttonholeWidthStitches,
    startOffsetStitches,
    endOffsetStitches,
    spacingBetweenButtonholes,
    buttonholeSegments: buildButtonholeSegments(
      startOffsetStitches,
      endOffsetStitches,
      buttonholeWidthStitches,
      spacingBetweenButtonholes,
      numberOfButtonholes,
    ),
  };

  return success;
}
