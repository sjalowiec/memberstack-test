/** Length unit for band measurements (matches site-wide inch/cm toggle). */
export type ButtonBandUnit = "in" | "cm";

/** Inputs for vertical (sideways-knit) button band buttonhole placement. */
export type ButtonBandInput = {
  stitchGauge: number;
  rowGauge: number;
  /** Stitches/rows per this many units: 4 for inches, 10 for centimeters. */
  gaugeBasis: number;
  numberOfButtonholes: number;
  /** A — pickup edge along the garment (converted to stitches). */
  cardiganEdge: number;
  /** B — finished width of one side of the folded band (converted to rows). */
  bandWidth: number;
  buttonholeSize: number;
  startOffset: number;
  endOffset: number;
  /** Rows already worked before this band; may be zero. */
  currentRowCount: number;
  unit: ButtonBandUnit;
};

/** One segment of the buttonhole row knitting sequence. */
export type ButtonholeSegment = {
  type: "knit" | "buttonhole";
  stitches: number;
  label: string;
};

/** Successful button band math result (ready for instructions or pattern injection). */
export type ButtonBandMathSuccess = {
  ok: true;
  rowsPerUnit: number;
  stitchesPerUnit: number;
  /** Stitches along the cardigan edge (buttonhole spacing dimension). */
  cardiganEdgeStitches: number;
  /** Rows for one side of the folded band (from B band width). */
  finishedBandRows: number;
  castOnStitches: number;
  /** First side + turning row + second side. */
  totalBandRows: number;
  firstButtonholeRow: number;
  /** RC at end of the first side (before the turning row). */
  turningRow: number;
  secondButtonholeRow: number;
  /** Absolute RC when the band is complete (includes currentRowCount). */
  finalRow: number;
  buttonholeWidthStitches: number;
  startOffsetStitches: number;
  endOffsetStitches: number;
  spacingBetweenButtonholes: number;
  buttonholeSegments: ButtonholeSegment[];
};

export type ButtonBandMathError = {
  ok: false;
  errors: string[];
};

export type ButtonBandMathResult = ButtonBandMathSuccess | ButtonBandMathError;
