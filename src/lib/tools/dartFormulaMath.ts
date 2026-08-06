/**
 * Authoritative short-row bust dart shaping math (Dart Formula tool + sweater builders).
 *
 * Cup width/depth are stored in inches. Gauge may be entered over 4″ or 10 cm; cup
 * dimensions are converted to match the gauge unit before stitches/rows are computed
 * so inch and centimeter paths describe the same physical dart.
 */

export type DartCupSize = "B" | "C" | "D" | "DD";

export type DartFormulaUnit = "in" | "cm";

/** Cup presets: width and depth in inches (canonical storage). */
export const CUP_DART_BY_SIZE: Readonly<
  Record<DartCupSize, { readonly dartWidth: number; readonly dartDepth: number }>
> = {
  B: { dartWidth: 3, dartDepth: 0.5 },
  C: { dartWidth: 3.25, dartDepth: 1 },
  D: { dartWidth: 3.5, dartDepth: 1.5 },
  DD: { dartWidth: 4, dartDepth: 2 },
};

export const DART_CUP_SIZES = Object.keys(CUP_DART_BY_SIZE) as DartCupSize[];

export const INCH_TO_CM = 2.54;

export function isDartCupSize(raw: unknown): raw is DartCupSize {
  return typeof raw === "string" && (DART_CUP_SIZES as readonly string[]).includes(raw);
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ComputeDartShapingParams = {
  cupKey: string;
  /** Stitches over the gauge basis (4″ or 10 cm). */
  stitchGauge: number;
  /** Rows over the gauge basis (4″ or 10 cm). */
  rowGauge: number;
  unit: DartFormulaUnit;
};

export type DartShapingSuccess = {
  ok: true;
  cupKey: DartCupSize;
  unit: DartFormulaUnit;
  gaugeBase: number;
  perUnitStitches: number;
  perUnitRows: number;
  /** Dart width in the form’s display unit (inches or cm). */
  dartWidth: number;
  /** Dart depth in the form’s display unit (inches or cm). */
  dartDepth: number;
  /** Canonical cup width in inches. */
  dartWidthInches: number;
  /** Canonical cup depth in inches. */
  dartDepthInches: number;
  stitchGauge: number;
  rowGauge: number;
  totalHeldStitches: number;
  totalDepthRows: number;
  shapingPasses: number;
  dividesEvenly: boolean;
  holdPerPassWhenEven: number;
  lowerHoldCount: number;
  higherHoldCount: number;
  numberOfLowerPasses: number;
  numberOfHigherPasses: number;
};

export type DartShapingFailure = {
  ok: false;
  error: string;
};

export type DartShapingResult = DartShapingSuccess | DartShapingFailure;

/**
 * Short-row bust dart shaping from cup size + swatch gauge (4″ or 10 cm basis).
 * Preserves the Dart Tool’s floor / even-pass distribution rules.
 */
export function computeDartShaping(params: ComputeDartShapingParams): DartShapingResult {
  const cupKey = String(params.cupKey ?? "").trim();
  if (!isDartCupSize(cupKey)) {
    return { ok: false, error: "Select a cup size." };
  }
  const spec = CUP_DART_BY_SIZE[cupKey];
  const unit: DartFormulaUnit = params.unit === "cm" ? "cm" : "in";
  const stitchGauge = Number(params.stitchGauge);
  const rowGauge = Number(params.rowGauge);
  if (!Number.isFinite(stitchGauge) || stitchGauge <= 0) {
    return { ok: false, error: "Stitch gauge must be greater than 0." };
  }
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) {
    return { ok: false, error: "Row gauge must be greater than 0." };
  }

  const dartWidthInches = spec.dartWidth;
  const dartDepthInches = spec.dartDepth;
  const gaugeBase = unit === "cm" ? 10 : 4;
  // Convert cup inches → cm when the swatch is over 10 cm so physical size matches.
  const dartWidth = unit === "cm" ? dartWidthInches * INCH_TO_CM : dartWidthInches;
  const dartDepth = unit === "cm" ? dartDepthInches * INCH_TO_CM : dartDepthInches;

  const perUnitStitches = roundToTwoDecimals(stitchGauge / gaugeBase);
  const perUnitRows = roundToTwoDecimals(rowGauge / gaugeBase);

  const totalHeldStitches = Math.floor(dartWidth * perUnitStitches);
  const totalDepthRows = Math.floor(dartDepth * perUnitRows);

  if (totalHeldStitches < 1) {
    return {
      ok: false,
      error:
        "At this gauge, the dart width rounds to fewer than one stitch. Try a slightly different stitch gauge or cup size.",
    };
  }
  if (totalDepthRows < 1) {
    return {
      ok: false,
      error:
        "At this gauge, the dart depth rounds to fewer than one row. Try a slightly different row gauge or cup size.",
    };
  }

  let shapingPasses = Math.floor(totalDepthRows / 2);
  if (shapingPasses % 2 !== 0) {
    shapingPasses += 1;
  }

  if (shapingPasses < 1) {
    return {
      ok: false,
      error: "Not enough depth rows to form shaping passes. Check your row gauge and cup size.",
    };
  }

  const remainder = totalHeldStitches % shapingPasses;
  const dividesEvenly = remainder === 0;
  const holdPerPassWhenEven = dividesEvenly ? Math.floor(totalHeldStitches / shapingPasses) : 0;

  let lowerHoldCount = 0;
  let higherHoldCount = 0;
  let numberOfLowerPasses = 0;
  let numberOfHigherPasses = 0;

  if (!dividesEvenly) {
    const baseHoldRate = totalHeldStitches / shapingPasses;
    lowerHoldCount = Math.floor(baseHoldRate);
    higherHoldCount = lowerHoldCount + 1;
    numberOfLowerPasses = shapingPasses * higherHoldCount - totalHeldStitches;
    numberOfHigherPasses = shapingPasses - numberOfLowerPasses;
  }

  return {
    ok: true,
    cupKey,
    unit,
    gaugeBase,
    perUnitStitches,
    perUnitRows,
    dartWidth: unit === "cm" ? roundToTwoDecimals(dartWidth) : dartWidth,
    dartDepth: unit === "cm" ? roundToTwoDecimals(dartDepth) : dartDepth,
    dartWidthInches,
    dartDepthInches,
    stitchGauge,
    rowGauge,
    totalHeldStitches,
    totalDepthRows,
    shapingPasses,
    dividesEvenly,
    holdPerPassWhenEven,
    lowerHoldCount,
    higherHoldCount,
    numberOfLowerPasses,
    numberOfHigherPasses,
  };
}

/**
 * Sweater-builder entry: gauges are already stitches/rows per inch (canonical pattern storage).
 * Equivalent to {@link computeDartShaping} with a 4″ swatch of `spi * 4` / `rpi * 4`.
 */
export function computeDartShapingFromPerInch(params: {
  cupKey: string;
  stitchesPerInch: number;
  rowsPerInch: number;
}): DartShapingResult {
  const spi = Number(params.stitchesPerInch);
  const rpi = Number(params.rowsPerInch);
  if (!Number.isFinite(spi) || spi <= 0) {
    return { ok: false, error: "Stitch gauge must be greater than 0." };
  }
  if (!Number.isFinite(rpi) || rpi <= 0) {
    return { ok: false, error: "Row gauge must be greater than 0." };
  }
  return computeDartShaping({
    cupKey: params.cupKey,
    stitchGauge: spi * 4,
    rowGauge: rpi * 4,
    unit: "in",
  });
}

/** Visible cup dropdown labels; values stay B/C/D/DD. */
export function formatDartCupOptionLabel(cupKey: DartCupSize, unit: DartFormulaUnit): string {
  const spec = CUP_DART_BY_SIZE[cupKey];
  if (unit === "cm") {
    const w = roundToTwoDecimals(spec.dartWidth * INCH_TO_CM);
    const d = roundToTwoDecimals(spec.dartDepth * INCH_TO_CM);
    return `${cupKey} — ${w} cm width, ${d} cm depth`;
  }
  const w = roundToTwoDecimals(spec.dartWidth);
  const d = roundToTwoDecimals(spec.dartDepth);
  const wLabel = w === Math.floor(w) ? String(Math.floor(w)) : String(w);
  const dLabel = d === Math.floor(d) ? String(Math.floor(d)) : String(d);
  return `${cupKey} — ${wLabel}" width, ${dLabel}" depth`;
}
