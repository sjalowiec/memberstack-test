/**
 * Shared Bust Dart Lego block — optional short-row bust darts for women’s sweater builders.
 *
 * Owns eligibility, saved-config normalization, 1″-below-armhole placement, Dart Formula
 * shaping math reuse, and structured front-only instruction data. Builders supply garment
 * context and insert returned steps into front BODY sequencing; they must not redefine dart math.
 */

import { inchesToRows } from "../sleevelessRowAccounting";
import { normalizeSleevelessAudience } from "../patternStorage";
import {
  formatMeasurementDisplayFromInches,
  resolveMeasurementDisplayUnitFromPatternData,
  type MeasurementDisplayUnit,
} from "../patternMeasurementDisplayUnit";
import {
  computeDartShapingFromPerInch,
  isDartCupSize,
  parsePositiveDartMeasurement,
  resolveDartDimensionsInches,
  roundToTwoDecimals,
  type DartCupSize,
  type DartShapingSuccess,
} from "../../tools/dartFormulaMath";
import { dartShapingHoldStepLines } from "../../tools/dartFormulaInstructions";

export { dartShapingHoldStepLines };

/** Physical placement: dart begins this many inches below the armhole opening (bottom-up). */
export const BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE = 1;

/**
 * Placement distance for knitting copy, using the pattern’s measurement display unit
 * ({@link formatMeasurementDisplayFromInches} — inch quarter grid / 0.1 cm grid).
 * Examples: `1″`, `2.5 cm`.
 */
export function formatBustDartPlacementDistanceLabel(
  unit: MeasurementDisplayUnit = "in",
): string {
  const amount = formatMeasurementDisplayFromInches(
    BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE,
    unit,
  );
  if (!amount) return unit === "cm" ? "2.5 cm" : "1″";
  return unit === "cm" ? `${amount} cm` : `${amount}″`;
}

/** Chart audiences that may offer bust darts (Women’s + Plus). */
export const BUST_DART_ELIGIBLE_AUDIENCES = ["misses", "plus"] as const;

export type BustDartEligibleAudience = (typeof BUST_DART_ELIGIBLE_AUDIENCES)[number];

export type BustDartFrontConstruction = "pullover" | "cardigan";

/**
 * Canonical saved / style field for bust darts (version-tolerant).
 * Width/depth are stored in inches. When enabled with only `cupSize` (legacy),
 * calculate-time resolution uses the cup preset defaults.
 */
export type BustDartSavedConfig = {
  enabled: boolean;
  /** Cup preset context; optional when width+depth are present. */
  cupSize: DartCupSize | null;
  /** Authoritative dart width in inches when set; null → resolve from cup preset. */
  dartWidthInches: number | null;
  /** Authoritative dart depth in inches when set; null → resolve from cup preset. */
  dartDepthInches: number | null;
};

export const BUST_DART_STYLE_KEY = "bustDart";

export type BustDartInput = {
  /** User wants darts (before eligibility / validation). */
  enabled: boolean;
  cupSize?: string | null;
  /** Canonical-inch overrides (authoritative when present). */
  dartWidthInches?: number | null;
  dartDepthInches?: number | null;
  /**
   * Size-group / chart audience (`misses`, `plus`, `men`, …) or Express `who` (`women`).
   * Normalized via {@link normalizeSleevelessAudience}.
   */
  sizeGroup: string;
  stitchesPerInch: number;
  rowsPerInch: number;
  frontConstruction: BustDartFrontConstruction;
  /**
   * Front stitch count at the dart (full front for pullover; one cardigan half for cardigan).
   * Used only to validate the dart fits; short rows do not permanently change stitch count.
   */
  frontStitchCount: number;
  /** Garment RC of the armhole opening (first armhole bind-off / armhole marker row). */
  armholeOpeningGarmentRc: number;
  /** Hem row count (garment RC after hem). */
  hemRows: number;
  /** Body rows from end of hem to armhole opening. */
  bodyToArmholeRows: number;
  /**
   * Pattern measurement display unit for placement wording only (row math stays inch-canonical).
   * Defaults to inches when omitted.
   */
  measurementDisplayUnit?: MeasurementDisplayUnit;
};

export type BustDartShapingSummary = {
  cupKey: DartCupSize | null;
  customized: boolean;
  dartWidthInches: number;
  dartDepthInches: number;
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

export type BustDartResult = {
  /** True only when eligible, enabled, valid, and shaping computed. */
  active: boolean;
  eligible: boolean;
  config: BustDartSavedConfig;
  errors: string[];
  warnings: string[];
  /** Rows for 1″ at the pattern’s row gauge (`Math.round`). */
  placementOffsetRows: number;
  /** Garment RC where the dart begins; null when inactive. */
  dartStartGarmentRc: number | null;
  /** Rows of plain knitting from end of hem to dart start. */
  rowsFromHemToDartStart: number | null;
  /** Rows of plain knitting after dart (RC resumed) to armhole opening. */
  rowsFromDartToArmhole: number | null;
  shaping: BustDartShapingSummary | null;
  /** Ordered instruction paragraphs for the active piece (pullover front or cardigan left). */
  instructionParagraphs: string[];
  /** Cardigan right-front mirror note (null for pullover / inactive). */
  cardiganRightMirrorParagraph: string | null;
  /** Short-row hold steps only (shared with Dart Tool wording). */
  holdStepLines: string[];
  /** Display unit used for placement distance labels in instructions. */
  measurementDisplayUnit: MeasurementDisplayUnit;
  /** Formatted placement distance (`1″` / `2.5 cm`) matching {@link measurementDisplayUnit}. */
  placementDistanceLabel: string;
};

function emptyDisabledResult(
  partial: Partial<BustDartResult> & { config: BustDartSavedConfig; eligible: boolean },
): BustDartResult {
  const unit = partial.measurementDisplayUnit ?? "in";
  return {
    active: false,
    errors: [],
    warnings: [],
    placementOffsetRows: 0,
    dartStartGarmentRc: null,
    rowsFromHemToDartStart: null,
    rowsFromDartToArmhole: null,
    shaping: null,
    instructionParagraphs: [],
    cardiganRightMirrorParagraph: null,
    holdStepLines: [],
    measurementDisplayUnit: unit,
    placementDistanceLabel: formatBustDartPlacementDistanceLabel(unit),
    ...partial,
  };
}

export function isBustDartEligibleAudience(raw: unknown): boolean {
  const aud = normalizeSleevelessAudience(raw);
  return (BUST_DART_ELIGIBLE_AUDIENCES as readonly string[]).includes(aud);
}

export function emptyBustDartSavedConfig(): BustDartSavedConfig {
  return {
    enabled: false,
    cupSize: null,
    dartWidthInches: null,
    dartDepthInches: null,
  };
}

function parseSavedInches(raw: unknown): number | null {
  const n = parsePositiveDartMeasurement(raw);
  return n == null ? null : roundToTwoDecimals(n);
}

/** Coerce untrusted saved / form values. Missing or invalid → darts off. */
export function normalizeBustDartSavedConfig(raw: unknown): BustDartSavedConfig {
  if (raw == null) return emptyBustDartSavedConfig();
  if (typeof raw === "boolean") {
    return { ...emptyBustDartSavedConfig(), enabled: raw === true };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return emptyBustDartSavedConfig();
  }
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === true || o.enabled === "true" || o.addBustDarts === true;
  const cupRaw = o.cupSize ?? o.cup ?? o.dartCupSize;
  const cupSize = isDartCupSize(cupRaw) ? cupRaw : null;
  const dartWidthInches = parseSavedInches(
    o.dartWidthInches ?? o.widthInches ?? o.dartWidth,
  );
  const dartDepthInches = parseSavedInches(
    o.dartDepthInches ?? o.depthInches ?? o.dartDepth,
  );
  if (!enabled) return emptyBustDartSavedConfig();
  return {
    enabled: true,
    cupSize,
    dartWidthInches,
    dartDepthInches,
  };
}

/** True when saved config can produce an active dart (cup and/or dimensions). */
export function bustDartSavedConfigIsActive(config: BustDartSavedConfig): boolean {
  if (!config.enabled) return false;
  if (config.cupSize != null) return true;
  return config.dartWidthInches != null && config.dartDepthInches != null;
}

/** Read `style.bustDart` (or legacy top-level) from pattern data; missing → off. */
export function readBustDartConfigFromPatternData(
  patternData: Record<string, unknown> | null | undefined,
): BustDartSavedConfig {
  if (!patternData || typeof patternData !== "object") {
    return emptyBustDartSavedConfig();
  }
  const style =
    patternData.style && typeof patternData.style === "object" && !Array.isArray(patternData.style)
      ? (patternData.style as Record<string, unknown>)
      : {};
  if (style[BUST_DART_STYLE_KEY] != null) {
    return normalizeBustDartSavedConfig(style[BUST_DART_STYLE_KEY]);
  }
  // Legacy flat keys (if ever written)
  if (style.addBustDarts != null || style.bustDartCupSize != null) {
    return normalizeBustDartSavedConfig({
      enabled: style.addBustDarts,
      cupSize: style.bustDartCupSize,
    });
  }
  return emptyBustDartSavedConfig();
}

/**
 * When the size group becomes ineligible, force darts off without inventing a cup size.
 */
export function normalizeBustDartConfigForAudience(
  config: BustDartSavedConfig,
  sizeGroup: unknown,
): BustDartSavedConfig {
  if (!isBustDartEligibleAudience(sizeGroup)) {
    return emptyBustDartSavedConfig();
  }
  if (!config.enabled) return emptyBustDartSavedConfig();
  return {
    enabled: true,
    cupSize: config.cupSize,
    dartWidthInches: config.dartWidthInches,
    dartDepthInches: config.dartDepthInches,
  };
}

/**
 * Persist shape for a newly added/updated dart: always store exact width/depth inches.
 * Legacy cup-only configs are left as-is until the user saves again.
 */
export function buildEnabledBustDartSavedConfig(args: {
  cupSize: DartCupSize | null;
  dartWidthInches: number;
  dartDepthInches: number;
}): BustDartSavedConfig {
  return {
    enabled: true,
    cupSize: args.cupSize,
    dartWidthInches: roundToTwoDecimals(args.dartWidthInches),
    dartDepthInches: roundToTwoDecimals(args.dartDepthInches),
  };
}

function shapingSummary(s: DartShapingSuccess): BustDartShapingSummary {
  return {
    cupKey: s.cupKey,
    customized: s.customized,
    dartWidthInches: s.dartWidthInches,
    dartDepthInches: s.dartDepthInches,
    totalHeldStitches: s.totalHeldStitches,
    totalDepthRows: s.totalDepthRows,
    shapingPasses: s.shapingPasses,
    dividesEvenly: s.dividesEvenly,
    holdPerPassWhenEven: s.holdPerPassWhenEven,
    lowerHoldCount: s.lowerHoldCount,
    higherHoldCount: s.higherHoldCount,
    numberOfLowerPasses: s.numberOfLowerPasses,
    numberOfHigherPasses: s.numberOfHigherPasses,
  };
}

function formatHoldLinesForPattern(
  holdLines: string[],
  frontConstruction: BustDartFrontConstruction,
): string[] {
  const placePrefix =
    frontConstruction === "cardigan"
      ? "From the side (armhole) edge toward the Front center, place "
      : "On each side of the Front center, place ";

  return holdLines
    .filter((l) => l.startsWith("Place ") || l === "Turn off hold settings.")
    .map((l) => {
      if (l === "Turn off hold settings.") return "Turn off the hold settings.";
      // "Place 6 needles…" → "On each side of the Front center, place 6 needles…"
      return `${placePrefix}${l.slice("Place ".length)}`;
    });
}

/**
 * Ordered knitting steps for the active dart card (cup is shown in the heading, not repeated here).
 */
function buildInstructionParagraphs(args: {
  dartStartGarmentRc: number;
  frontConstruction: BustDartFrontConstruction;
  holdLines: string[];
  placementDistanceLabel: string;
}): { paragraphs: string[]; cardiganRightMirrorParagraph: string | null } {
  // Tool hold lines end with turn-off / reset-RC / continue — sweater patterns own RC reset
  // and the following Front BODY block owns knitting from dart start to the armhole.
  const holdSteps = formatHoldLinesForPattern(args.holdLines, args.frontConstruction);

  const paragraphs: string[] = [
    `Stop the row counter at RC ${args.dartStartGarmentRc}, ${args.placementDistanceLabel} below the armhole opening.`,
    ...holdSteps,
    `Reset the row counter to RC ${args.dartStartGarmentRc} so the next plain row is counted correctly.`,
  ];

  const cardiganRightMirrorParagraph =
    args.frontConstruction === "cardigan"
      ? "Work the RIGHT FRONT to match, reversing the bust-dart short rows so shaping also falls at the side (armhole) edge (not the center-front edge)."
      : null;

  return { paragraphs, cardiganRightMirrorParagraph };
}

export type BustDartPlacementGeometry = {
  placementOffsetRows: number;
  dartStartGarmentRc: number;
  rowsFromHemToDartStart: number;
  rowsFromDartToArmhole: number;
  errors: string[];
};

/**
 * Dart begins {@link BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE} below the armhole opening
 * (bottom-up): `dartStartGarmentRc = armholeOpeningGarmentRc − inchesToRows(1″, rpi)`.
 * Returns null when row gauge / armhole RC cannot produce a placement.
 */
export function resolveBustDartPlacementGeometry(args: {
  rowsPerInch: number;
  armholeOpeningGarmentRc: number;
  hemRows: number;
  bodyToArmholeRows: number;
}): BustDartPlacementGeometry | null {
  const errors: string[] = [];
  const rpi = Number(args.rowsPerInch);
  const hemRows = Math.max(0, Math.floor(Number(args.hemRows) || 0));
  const bodyToArmholeRows = Math.max(0, Math.floor(Number(args.bodyToArmholeRows) || 0));
  const armholeRc = Math.floor(Number(args.armholeOpeningGarmentRc));

  if (!Number.isFinite(rpi) || rpi <= 0) {
    return null;
  }
  if (!Number.isFinite(armholeRc) || armholeRc <= 0) {
    return null;
  }

  const placementOffsetRows = inchesToRows(BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE, rpi);
  if (placementOffsetRows < 1) {
    errors.push(
      "Row gauge is too coarse to place the dart 1″ below the armhole. Increase row gauge or omit bust darts.",
    );
    return {
      placementOffsetRows,
      dartStartGarmentRc: armholeRc,
      rowsFromHemToDartStart: Math.max(0, armholeRc - hemRows),
      rowsFromDartToArmhole: 0,
      errors,
    };
  }

  const dartStartGarmentRc = armholeRc - placementOffsetRows;
  if (dartStartGarmentRc <= hemRows) {
    errors.push(
      "Not enough rows below the armhole for bust darts (dart would fall inside the hem). Lengthen the body or omit bust darts.",
    );
  }
  if (bodyToArmholeRows < placementOffsetRows) {
    errors.push(
      "Not enough body rows below the armhole for a 1″ dart placement. Lengthen the body or omit bust darts.",
    );
  }
  if (dartStartGarmentRc >= armholeRc) {
    errors.push("Bust dart placement collides with the armhole opening.");
  }

  const rowsFromHemToDartStart = Math.max(0, dartStartGarmentRc - hemRows);
  const rowsFromDartToArmhole = Math.max(0, armholeRc - dartStartGarmentRc);
  if (rowsFromDartToArmhole < 1) {
    errors.push("No rows remain between the dart and the armhole opening after placement rounding.");
  }

  return {
    placementOffsetRows,
    dartStartGarmentRc,
    rowsFromHemToDartStart,
    rowsFromDartToArmhole,
    errors,
  };
}

/**
 * Compute optional bust-dart placement and short-row shaping for a women’s sweater front.
 * Does not mutate `input`. Returns `active: false` when disabled, ineligible, or invalid.
 */
export function calculateBustDart(input: BustDartInput): BustDartResult {
  const eligible = isBustDartEligibleAudience(input.sizeGroup);
  const cupSize = isDartCupSize(input.cupSize) ? input.cupSize : null;
  const dartWidthInches = parsePositiveDartMeasurement(input.dartWidthInches);
  const dartDepthInches = parsePositiveDartMeasurement(input.dartDepthInches);
  const measurementDisplayUnit: MeasurementDisplayUnit =
    input.measurementDisplayUnit === "cm" ? "cm" : "in";
  const placementDistanceLabel = formatBustDartPlacementDistanceLabel(measurementDisplayUnit);
  const config: BustDartSavedConfig = input.enabled === true
    ? {
        enabled: true,
        cupSize,
        dartWidthInches: dartWidthInches == null ? null : roundToTwoDecimals(dartWidthInches),
        dartDepthInches: dartDepthInches == null ? null : roundToTwoDecimals(dartDepthInches),
      }
    : emptyBustDartSavedConfig();

  if (!eligible) {
    return emptyDisabledResult({
      eligible: false,
      config: emptyBustDartSavedConfig(),
      measurementDisplayUnit,
      placementDistanceLabel,
      warnings:
        input.enabled === true
          ? ["Bust darts are available for women’s sweater patterns only."]
          : [],
    });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const spi = Number(input.stitchesPerInch);
  const rpi = Number(input.rowsPerInch);
  const hemRows = Math.max(0, Math.floor(Number(input.hemRows) || 0));
  const bodyToArmholeRows = Math.max(0, Math.floor(Number(input.bodyToArmholeRows) || 0));
  const armholeRc = Math.floor(Number(input.armholeOpeningGarmentRc));
  const frontSts = Math.floor(Number(input.frontStitchCount));

  // Placement is computed for eligible patterns even when darts are off so the Front can
  // offer Optional Bust Dart at the dart RC. The dart *begins* at armholeRc − 1″ (rounded).
  const placement = resolveBustDartPlacementGeometry({
    rowsPerInch: rpi,
    armholeOpeningGarmentRc: armholeRc,
    hemRows,
    bodyToArmholeRows,
  });
  const placementOffsetRows = placement?.placementOffsetRows ?? 0;
  const dartStartGarmentRc = placement?.dartStartGarmentRc ?? null;
  const rowsFromHemToDartStart = placement?.rowsFromHemToDartStart ?? null;
  const rowsFromDartToArmhole = placement?.rowsFromDartToArmhole ?? null;

  if (!config.enabled) {
    return emptyDisabledResult({
      eligible: true,
      config: emptyBustDartSavedConfig(),
      measurementDisplayUnit,
      placementDistanceLabel,
      placementOffsetRows,
      dartStartGarmentRc,
      rowsFromHemToDartStart,
      rowsFromDartToArmhole,
      errors: placement?.errors ?? [],
    });
  }

  const dims = resolveDartDimensionsInches({
    cupKey: cupSize,
    dartWidthInches: config.dartWidthInches,
    dartDepthInches: config.dartDepthInches,
    unit: "in",
  });
  if (!dims.ok) {
    errors.push(dims.error);
  }

  if (!Number.isFinite(spi) || spi <= 0) {
    errors.push("Stitch gauge must be greater than 0.");
  }
  if (!Number.isFinite(rpi) || rpi <= 0) {
    errors.push("Row gauge must be greater than 0.");
  }
  if (!Number.isFinite(armholeRc) || armholeRc <= 0) {
    errors.push("Armhole opening row is required to place bust darts.");
  }
  if (!Number.isFinite(frontSts) || frontSts < 1) {
    errors.push("Front stitch count is required to validate bust darts.");
  }
  if (placement?.errors.length) {
    errors.push(...placement.errors);
  }

  if (errors.length || !dims.ok || dartStartGarmentRc == null || rowsFromDartToArmhole == null) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors,
      warnings,
      measurementDisplayUnit,
      placementDistanceLabel,
      placementOffsetRows,
      dartStartGarmentRc,
      rowsFromHemToDartStart,
      rowsFromDartToArmhole,
    });
  }

  const shapingResult = computeDartShapingFromPerInch({
    cupKey: dims.cupKey,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
    dartWidthInches: dims.dartWidthInches,
    dartDepthInches: dims.dartDepthInches,
  });

  if (!shapingResult.ok) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors: [shapingResult.error],
      warnings,
      measurementDisplayUnit,
      placementDistanceLabel,
      placementOffsetRows,
      dartStartGarmentRc,
      rowsFromHemToDartStart,
      rowsFromDartToArmhole,
    });
  }

  // Short-row darts temporarily hold stitches; require enough front width for the held span.
  // Leave at least one stitch active so the piece is not fully in hold.
  if (shapingResult.totalHeldStitches >= frontSts) {
    errors.push(
      input.frontConstruction === "cardigan"
        ? "This cardigan front is too narrow for the selected dart. Choose a smaller dart width or omit bust darts."
        : "The front does not have enough stitches for the selected dart. Choose a smaller dart width or omit bust darts.",
    );
  }

  // Depth in rows must leave a workable short-row sequence within the body span context.
  if (shapingResult.totalDepthRows > bodyToArmholeRows) {
    errors.push(
      "This dart depth needs more rows than are available in the body below the armhole. Reduce dart depth or lengthen the body.",
    );
  }

  if (errors.length) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors,
      warnings,
      measurementDisplayUnit,
      placementDistanceLabel,
      placementOffsetRows,
      dartStartGarmentRc,
      rowsFromHemToDartStart,
      rowsFromDartToArmhole,
      shaping: shapingSummary(shapingResult),
    });
  }

  const holdStepLines = dartShapingHoldStepLines(shapingResult);
  const { paragraphs, cardiganRightMirrorParagraph } = buildInstructionParagraphs({
    dartStartGarmentRc,
    frontConstruction: input.frontConstruction,
    holdLines: holdStepLines,
    placementDistanceLabel,
  });

  const savedActive = buildEnabledBustDartSavedConfig({
    cupSize: dims.cupKey,
    dartWidthInches: shapingResult.dartWidthInches,
    dartDepthInches: shapingResult.dartDepthInches,
  });

  return {
    active: true,
    eligible: true,
    config: savedActive,
    errors: [],
    warnings,
    placementOffsetRows,
    dartStartGarmentRc,
    rowsFromHemToDartStart,
    rowsFromDartToArmhole,
    shaping: shapingSummary(shapingResult),
    instructionParagraphs: paragraphs,
    cardiganRightMirrorParagraph,
    holdStepLines,
    measurementDisplayUnit,
    placementDistanceLabel,
  };
}

/**
 * Split a straight BODY knit-to-armhole span into: knit to dart → dart steps → knit to armhole.
 * Returns null when the dart is inactive (caller keeps original paragraphs).
 */
export function bustDartBodySplitTargets(result: BustDartResult): {
  dartStartGarmentRc: number;
  armholeOpeningGarmentRc: number;
  rowsFromHemToDartStart: number;
  rowsFromDartToArmhole: number;
  instructionParagraphs: string[];
} | null {
  if (
    !result.active ||
    result.dartStartGarmentRc == null ||
    result.rowsFromHemToDartStart == null ||
    result.rowsFromDartToArmhole == null
  ) {
    return null;
  }
  return {
    dartStartGarmentRc: result.dartStartGarmentRc,
    armholeOpeningGarmentRc: result.dartStartGarmentRc + result.rowsFromDartToArmhole,
    rowsFromHemToDartStart: result.rowsFromHemToDartStart,
    rowsFromDartToArmhole: result.rowsFromDartToArmhole,
    instructionParagraphs: result.instructionParagraphs,
  };
}

/** Minimal display-row shapes the applicator understands (matches sleeveless / drop-shoulder rows). */
export type BustDartPatternDisplayRow =
  | { kind: "piece"; title: string }
  | { kind: "section"; title: string; titleHtml?: string }
  | { kind: "neckShoulderChartTableMount" }
  | {
      kind: "bustDartCustomization";
      active: boolean;
      cupSize: string | null;
      customized: boolean;
      dartWidthInches: number | null;
      dartDepthInches: number | null;
      dartStartGarmentRc: number;
      armholeOpeningGarmentRc: number;
      placementOffsetRows: number;
      rowsFromHemToDartStart: number;
      rowsFromDartToArmhole: number;
      instructionParagraphs: string[];
      measurementDisplayUnit: MeasurementDisplayUnit;
      placementDistanceLabel: string;
      errors: string[];
    }
  | {
      kind: "block";
      rc?: string;
      paragraphs: string[];
      trustedParagraphs?: string[];
      stitchCount?: number;
      [key: string]: unknown;
    };

function pickAudienceFromPatternData(patternData: Record<string, unknown>): string {
  const fit =
    patternData.fit && typeof patternData.fit === "object" && !Array.isArray(patternData.fit)
      ? (patternData.fit as Record<string, unknown>)
      : {};
  const style =
    patternData.style && typeof patternData.style === "object" && !Array.isArray(patternData.style)
      ? (patternData.style as Record<string, unknown>)
      : {};
  return (
    normalizeSleevelessAudience(fit.sizingChart) ||
    normalizeSleevelessAudience(fit.knitFor) ||
    normalizeSleevelessAudience(style.recipientCategory) ||
    ""
  );
}

/**
 * Resolve bust darts for a sweater front from saved pattern data + builder-supplied geometry.
 */
export function resolveBustDartForSweaterFront(args: {
  patternData: Record<string, unknown>;
  frontConstruction: BustDartFrontConstruction;
  frontStitchCount: number;
  armholeOpeningGarmentRc: number;
  hemRows: number;
  bodyToArmholeRows: number;
  stitchesPerInch: number;
  rowsPerInch: number;
}): BustDartResult {
  const config = readBustDartConfigFromPatternData(args.patternData);
  const sizeGroup = pickAudienceFromPatternData(args.patternData);
  const normalized = normalizeBustDartConfigForAudience(config, sizeGroup);
  const measurementDisplayUnit = resolveMeasurementDisplayUnitFromPatternData(
    args.patternData,
    args.patternData,
  );
  return calculateBustDart({
    enabled: normalized.enabled,
    cupSize: normalized.cupSize,
    dartWidthInches: normalized.dartWidthInches,
    dartDepthInches: normalized.dartDepthInches,
    sizeGroup,
    stitchesPerInch: args.stitchesPerInch,
    rowsPerInch: args.rowsPerInch,
    frontConstruction: args.frontConstruction,
    frontStitchCount: args.frontStitchCount,
    armholeOpeningGarmentRc: args.armholeOpeningGarmentRc,
    hemRows: args.hemRows,
    bodyToArmholeRows: args.bodyToArmholeRows,
    measurementDisplayUnit,
  });
}

function canSplitFrontBodyForBustDart(result: BustDartResult): result is BustDartResult & {
  dartStartGarmentRc: number;
  rowsFromHemToDartStart: number;
  rowsFromDartToArmhole: number;
} {
  return (
    result.eligible === true &&
    result.dartStartGarmentRc != null &&
    result.rowsFromHemToDartStart != null &&
    result.rowsFromDartToArmhole != null &&
    result.rowsFromDartToArmhole >= 1 &&
    !(result.errors ?? []).some((e) =>
      /row gauge is too coarse|not enough rows below|not enough body rows|collides with the armhole|no rows remain between the dart/i.test(
        e,
      ),
    )
  );
}

function buildBustDartCustomizationRow(
  result: BustDartResult & {
    dartStartGarmentRc: number;
    rowsFromHemToDartStart: number;
    rowsFromDartToArmhole: number;
  },
): Extract<BustDartPatternDisplayRow, { kind: "bustDartCustomization" }> {
  const armholeOpeningGarmentRc = result.dartStartGarmentRc + result.rowsFromDartToArmhole;
  return {
    kind: "bustDartCustomization",
    active: result.active === true,
    cupSize: result.config.cupSize,
    customized: result.shaping?.customized === true,
    dartWidthInches: result.shaping?.dartWidthInches ?? result.config.dartWidthInches,
    dartDepthInches: result.shaping?.dartDepthInches ?? result.config.dartDepthInches,
    dartStartGarmentRc: result.dartStartGarmentRc,
    armholeOpeningGarmentRc,
    placementOffsetRows: result.placementOffsetRows,
    rowsFromHemToDartStart: result.rowsFromHemToDartStart,
    rowsFromDartToArmhole: result.rowsFromDartToArmhole,
    instructionParagraphs: result.active ? [...result.instructionParagraphs] : [],
    measurementDisplayUnit: result.measurementDisplayUnit,
    placementDistanceLabel: result.placementDistanceLabel,
    errors: result.active ? [] : [...(result.errors ?? [])],
  };
}

/**
 * Insert bust-dart instruction / optional-slot into the FRONT piece BODY section only.
 * Back / sleeve rows must not be passed through this helper.
 *
 * Eligible women’s patterns always split at the dart RC (even when no dart is selected) so the
 * Optional Bust Dart control sits at the knitting point. When placement is invalid, returns a
 * shallow copy of the input rows unchanged.
 */
export function insertBustDartIntoFrontBodyDisplayRows<T extends BustDartPatternDisplayRow>(
  rows: readonly T[],
  result: BustDartResult,
  helpers: {
    formatRc: (rc: number) => string;
    knitToRcLine: (targetRc: number) => string;
    knitRowsToRcLine?: (rows: number, targetRc: number) => string;
    knitRowsEvenToRcLine?: (rows: number, targetRc: number) => string;
  },
): T[] {
  if (!canSplitFrontBodyForBustDart(result)) {
    return rows.map((r) => r);
  }

  const dartStart = result.dartStartGarmentRc;
  const afterDart = result.rowsFromDartToArmhole;
  const toDart = result.rowsFromHemToDartStart;
  const armholeRc = dartStart + afterDart;
  const dartSlot = buildBustDartCustomizationRow(result);

  const knitToDartLine =
    helpers.knitRowsToRcLine && toDart > 0
      ? helpers.knitRowsToRcLine(toDart, dartStart)
      : helpers.knitToRcLine(dartStart);
  const knitAfterDartLine = helpers.knitRowsEvenToRcLine
    ? helpers.knitRowsEvenToRcLine(afterDart, armholeRc)
    : helpers.knitToRcLine(armholeRc);

  const out: BustDartPatternDisplayRow[] = [];
  let inBody = false;
  let dartInserted = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.kind === "section") {
      if (row.title === "BODY") {
        inBody = true;
      } else if (
        row.title === "ARMHOLE" ||
        row.title === "ABOVE ARMHOLE MARKERS" ||
        row.title === "FRONT NECKLINE & SHOULDERS" ||
        row.title === "BACK NECKLINE & SHOULDERS"
      ) {
        inBody = false;
      }
      out.push(row);
      continue;
    }

    if (!inBody || row.kind !== "block" || dartInserted) {
      out.push(row);
      continue;
    }

    const block = row as Extract<BustDartPatternDisplayRow, { kind: "block" }>;
    const paras = block.paragraphs ?? [];
    const trusted = block.trustedParagraphs;

    if (paras.some((p) => /Begin armhole shaping\.?/i.test(p))) {
      if (toDart > 0) {
        out.push({
          kind: "block",
          rc: helpers.formatRc(Math.max(0, dartStart - toDart)),
          paragraphs: [knitToDartLine],
          stitchCount: block.stitchCount,
        });
      }
      out.push(dartSlot);
      if (afterDart > 0) {
        out.push({
          kind: "block",
          rc: helpers.formatRc(dartStart),
          paragraphs: [knitAfterDartLine],
          stitchCount: block.stitchCount,
        });
      }
      dartInserted = true;
      out.push(row);
      continue;
    }

    const knitToMatch = paras
      .map((p) => p.match(/Knit\s+to\s+RC:?\s*0*(\d+)/i))
      .find((m) => m != null);
    const evenMatch = paras
      .map((p) => p.match(/Knit\s+(\d+)\s+rows?\s+even/i))
      .find((m) => m != null);

    if (knitToMatch) {
      const target = parseInt(knitToMatch[1], 10);
      if (target === armholeRc || target >= armholeRc) {
        out.push({
          ...block,
          paragraphs: [knitToDartLine],
          ...(trusted ? { trustedParagraphs: undefined } : {}),
        });
        out.push(dartSlot);
        if (afterDart > 0) {
          out.push({
            kind: "block",
            rc: helpers.formatRc(dartStart),
            paragraphs: [knitAfterDartLine],
            stitchCount: block.stitchCount,
          });
        }
        dartInserted = true;
        continue;
      }
    }

    if (evenMatch && toDart >= 0) {
      const totalEven = parseInt(evenMatch[1], 10);
      if (toDart + afterDart === totalEven || totalEven === toDart + afterDart) {
        if (toDart > 0) {
          out.push({
            ...block,
            paragraphs: [knitToDartLine],
          });
        }
        out.push(dartSlot);
        if (afterDart > 0) {
          out.push({
            kind: "block",
            rc: helpers.formatRc(dartStart),
            paragraphs: [knitAfterDartLine],
            stitchCount: block.stitchCount,
          });
        }
        dartInserted = true;
        continue;
      }
    }

    const straightMatch = paras
      .map((p) => p.match(/Knit\s+(\d+)\s+rows?\s+straight\.?/i))
      .find((m) => m != null);
    if (straightMatch) {
      out.push(dartSlot);
      if (afterDart > 0) {
        out.push({
          ...block,
          rc: helpers.formatRc(dartStart),
          paragraphs: [
            afterDart === 1 ? "Knit 1 row straight." : "Knit " + afterDart + " rows straight.",
          ],
        });
      }
      dartInserted = true;
      continue;
    }

    out.push(row);
  }

  if (result.active && result.cardiganRightMirrorParagraph) {
    const mirror = result.cardiganRightMirrorParagraph;
    const already = out.some(
      (r) =>
        r.kind === "block" &&
        Array.isArray(r.paragraphs) &&
        r.paragraphs.some((p) => p.includes("RIGHT FRONT") && /bust-dart|bust dart/i.test(p)),
    );
    if (!already) {
      let augmented = false;
      for (let i = 0; i < out.length; i++) {
        const r = out[i];
        if (
          r.kind === "block" &&
          r.paragraphs.some((p) => /Work the RIGHT FRONT to match/i.test(p))
        ) {
          out[i] = {
            ...r,
            paragraphs: [...r.paragraphs, mirror],
          };
          augmented = true;
          break;
        }
      }
      if (!augmented) {
        out.push({ kind: "block", paragraphs: [mirror] });
      }
    }
  }

  return out as T[];
}
