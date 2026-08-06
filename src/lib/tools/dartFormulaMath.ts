/**
 * Authoritative short-row bust dart shaping math (Dart Formula tool + sweater patterns).
 *
 * Cup width/depth presets are stored in inches. Gauge may be entered over 4″ or 10 cm; dart
 * dimensions are converted to match the gauge unit before stitches/rows are computed
 * so inch and centimeter paths describe the same physical dart.
 *
 * Callers may override width/depth (canonical inches or display-unit values). Overrides are
 * authoritative; cup presets are starting values only.
 */

export type DartCupSize = "B" | "C" | "D" | "DD";

export type DartFormulaUnit = "in" | "cm";

/** Cup presets: width and depth in inches (canonical storage). Single source of truth. */
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

/** Epsilon for comparing customized display/inch measurements to presets. */
const DART_DIM_EPS = 0.0005;

export function isDartCupSize(raw: unknown): raw is DartCupSize {
  return typeof raw === "string" && (DART_CUP_SIZES as readonly string[]).includes(raw);
}

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getCupDartPresetInches(cupKey: DartCupSize): {
  dartWidthInches: number;
  dartDepthInches: number;
} {
  const spec = CUP_DART_BY_SIZE[cupKey];
  return { dartWidthInches: spec.dartWidth, dartDepthInches: spec.dartDepth };
}

/** Convert a single physical length between display units (inches ↔ cm). */
export function convertDartLength(value: number, from: DartFormulaUnit, to: DartFormulaUnit): number {
  if (!Number.isFinite(value)) return value;
  if (from === to) return value;
  return from === "in" ? value * INCH_TO_CM : value / INCH_TO_CM;
}

export function inchesFromDisplayDartLength(value: number, unit: DartFormulaUnit): number {
  return unit === "cm" ? value / INCH_TO_CM : value;
}

export function displayDartLengthFromInches(inches: number, unit: DartFormulaUnit): number {
  const raw = unit === "cm" ? inches * INCH_TO_CM : inches;
  return roundToTwoDecimals(raw);
}

/** Parse a required positive finite measurement (display or inches). */
export function parsePositiveDartMeasurement(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Distinguish absent overrides (use preset) from present-but-invalid (reject).
 * Empty string / null / undefined → absent.
 */
function readDimOverride(raw: unknown): "absent" | "invalid" | number {
  if (raw == null || raw === "") return "absent";
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return "invalid";
  return n;
}

export function dartDimensionsNearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= DART_DIM_EPS;
}

/**
 * True when width/depth (canonical inches) differ from the cup preset.
 * Without a cup, any resolved dimensions count as customized.
 */
export function isCustomDartDimensions(
  cupKey: DartCupSize | null | undefined,
  dartWidthInches: number,
  dartDepthInches: number,
): boolean {
  if (!isDartCupSize(cupKey)) return true;
  const preset = getCupDartPresetInches(cupKey);
  return (
    !dartDimensionsNearlyEqual(dartWidthInches, preset.dartWidthInches) ||
    !dartDimensionsNearlyEqual(dartDepthInches, preset.dartDepthInches)
  );
}

export type ResolveDartDimensionsParams = {
  cupKey?: string | null;
  /** Canonical inches — preferred when present. */
  dartWidthInches?: number | null;
  dartDepthInches?: number | null;
  /** Display-unit values matching `unit` (used when inches overrides are absent). */
  dartWidth?: number | null;
  dartDepth?: number | null;
  unit?: DartFormulaUnit;
};

export type ResolvedDartDimensions = {
  ok: true;
  cupKey: DartCupSize | null;
  dartWidthInches: number;
  dartDepthInches: number;
  customized: boolean;
};

export type ResolveDartDimensionsFailure = { ok: false; error: string };

/**
 * Resolve authoritative dart width/depth in inches from overrides and/or cup preset.
 * Custom inches (or display-unit values) win over the cup table.
 * Explicit non-positive overrides are rejected (not silently replaced by the preset).
 */
export function resolveDartDimensionsInches(
  params: ResolveDartDimensionsParams,
): ResolvedDartDimensions | ResolveDartDimensionsFailure {
  const unit: DartFormulaUnit = params.unit === "cm" ? "cm" : "in";
  const cupKey = isDartCupSize(params.cupKey) ? params.cupKey : null;
  const preset = cupKey ? getCupDartPresetInches(cupKey) : null;

  const widthInchesOverride = readDimOverride(params.dartWidthInches);
  const depthInchesOverride = readDimOverride(params.dartDepthInches);
  const widthDisplayOverride = readDimOverride(params.dartWidth);
  const depthDisplayOverride = readDimOverride(params.dartDepth);

  if (
    widthInchesOverride === "invalid" ||
    depthInchesOverride === "invalid" ||
    widthDisplayOverride === "invalid" ||
    depthDisplayOverride === "invalid"
  ) {
    return { ok: false, error: "Dart width and depth must be greater than 0." };
  }

  let dartWidthInches: number | null =
    typeof widthInchesOverride === "number" ? widthInchesOverride : null;
  let dartDepthInches: number | null =
    typeof depthInchesOverride === "number" ? depthInchesOverride : null;

  if (dartWidthInches == null && typeof widthDisplayOverride === "number") {
    dartWidthInches = inchesFromDisplayDartLength(widthDisplayOverride, unit);
  }
  if (dartDepthInches == null && typeof depthDisplayOverride === "number") {
    dartDepthInches = inchesFromDisplayDartLength(depthDisplayOverride, unit);
  }

  if (dartWidthInches == null && preset) dartWidthInches = preset.dartWidthInches;
  if (dartDepthInches == null && preset) dartDepthInches = preset.dartDepthInches;

  if (dartWidthInches == null || dartDepthInches == null) {
    if (!cupKey) {
      return { ok: false, error: "Select a cup size." };
    }
    return {
      ok: false,
      error: "Dart width and depth must be greater than 0.",
    };
  }

  if (!(dartWidthInches > 0) || !(dartDepthInches > 0)) {
    return { ok: false, error: "Dart width and depth must be greater than 0." };
  }

  return {
    ok: true,
    cupKey,
    dartWidthInches,
    dartDepthInches,
    customized: isCustomDartDimensions(cupKey, dartWidthInches, dartDepthInches),
  };
}

export type ComputeDartShapingParams = {
  /** Cup preset to seed defaults / label; optional when width+depth are supplied. */
  cupKey?: string;
  /** Stitches over the gauge basis (4″ or 10 cm). */
  stitchGauge: number;
  /** Rows over the gauge basis (4″ or 10 cm). */
  rowGauge: number;
  unit: DartFormulaUnit;
  /** Canonical-inch overrides (authoritative when valid). */
  dartWidthInches?: number | null;
  dartDepthInches?: number | null;
  /** Display-unit overrides matching `unit` (used when inch overrides are absent). */
  dartWidth?: number | null;
  dartDepth?: number | null;
};

export type DartShapingSuccess = {
  ok: true;
  cupKey: DartCupSize | null;
  customized: boolean;
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
 * Short-row bust dart shaping from cup preset and/or custom dimensions + swatch gauge.
 * Preserves the Dart Tool’s floor / even-pass distribution rules.
 */
export function computeDartShaping(params: ComputeDartShapingParams): DartShapingResult {
  const unit: DartFormulaUnit = params.unit === "cm" ? "cm" : "in";
  const stitchGauge = Number(params.stitchGauge);
  const rowGauge = Number(params.rowGauge);
  if (!Number.isFinite(stitchGauge) || stitchGauge <= 0) {
    return { ok: false, error: "Stitch gauge must be greater than 0." };
  }
  if (!Number.isFinite(rowGauge) || rowGauge <= 0) {
    return { ok: false, error: "Row gauge must be greater than 0." };
  }

  const dims = resolveDartDimensionsInches({
    cupKey: params.cupKey,
    dartWidthInches: params.dartWidthInches,
    dartDepthInches: params.dartDepthInches,
    dartWidth: params.dartWidth,
    dartDepth: params.dartDepth,
    unit,
  });
  if (!dims.ok) return dims;

  const { cupKey, dartWidthInches, dartDepthInches, customized } = dims;
  const gaugeBase = unit === "cm" ? 10 : 4;
  // Convert canonical inches → display unit so physical size matches the swatch basis.
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
        "At this gauge, the dart width rounds to fewer than one stitch. Try a slightly different stitch gauge or dart width.",
    };
  }
  if (totalDepthRows < 1) {
    return {
      ok: false,
      error:
        "At this gauge, the dart depth rounds to fewer than one row. Try a slightly different row gauge or dart depth.",
    };
  }

  let shapingPasses = Math.floor(totalDepthRows / 2);
  if (shapingPasses % 2 !== 0) {
    shapingPasses += 1;
  }

  if (shapingPasses < 1) {
    return {
      ok: false,
      error: "Not enough depth rows to form shaping passes. Check your row gauge and dart depth.",
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

  // Impossible hold counts (e.g. zero needles per pass with leftover distribution).
  if (dividesEvenly && holdPerPassWhenEven < 1) {
    return {
      ok: false,
      error:
        "This dart width and depth cannot produce a workable short-row sequence at this gauge. Adjust the measurements and try again.",
    };
  }
  if (!dividesEvenly && (lowerHoldCount < 1 || higherHoldCount < 1)) {
    return {
      ok: false,
      error:
        "This dart width and depth cannot produce a workable short-row sequence at this gauge. Adjust the measurements and try again.",
    };
  }

  return {
    ok: true,
    cupKey,
    customized,
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
  cupKey?: string | null;
  stitchesPerInch: number;
  rowsPerInch: number;
  dartWidthInches?: number | null;
  dartDepthInches?: number | null;
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
    cupKey: params.cupKey ?? undefined,
    stitchGauge: spi * 4,
    rowGauge: rpi * 4,
    unit: "in",
    dartWidthInches: params.dartWidthInches,
    dartDepthInches: params.dartDepthInches,
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

/** Unit suffix for editable width/depth field labels. */
export function dartDimensionUnitLabel(unit: DartFormulaUnit): string {
  return unit === "cm" ? "cm" : "in";
}
