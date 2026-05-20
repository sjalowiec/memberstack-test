/**
 * Authoritative sleeveless body block (pullover back): hem/hip cast-on, A-line shaping math,
 * placement, and validation. Cardigan and waist-shaped modes are typed for later.
 */

import { distributeVNeckInnerDecreaseRows } from "../legoBlocks/vNeckline";
import { SLEEVELESS_ALINE_MAX_SIDE_STITCH_CHANGE_RATIO } from "../sleevelessHipSizingLimits";

/** Finished hip and bust within this many inches are treated as straight. */
export const SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES = 0.25;

/** Minimum rows between paired shaping rows before spacing is considered too tight. */
export const SLEEVELESS_BODY_MIN_SHAPING_ROW_SPACING = 2;

export type SleevelessGarmentStyle = "pullover" | "cardigan";
export type SleevelessBodyPieceRole = "back" | "front";
export type SleevelessBodyShapingMode = "auto" | "waist-shaped";

export type BodyBlockValidationIssue = {
  code: string;
  message: string;
};

export type BodyBlockValidation = {
  valid: boolean;
  warnings: BodyBlockValidationIssue[];
  errors: BodyBlockValidationIssue[];
};

export type SleevelessBodyBlockInput = {
  garmentStyle: SleevelessGarmentStyle;
  pieceRole: SleevelessBodyPieceRole;
  bustCircumferenceInches: number;
  hipCircumferenceInches: number;
  stitchesPerInch: number;
  rowsPerInch: number;
  rowsToArmhole: number;
  /** Reserved for fitted waist — not used in this release. */
  waistCircumferenceInches?: number;
  mode?: SleevelessBodyShapingMode;
  /** Ribbed hem rows — body rows are counted after this RC. */
  hemRows?: number;
  /**
   * When set, used as bust/armhole stitch count instead of deriving from bust circumference.
   * Keeps the body block aligned with the generator's existing bust stitch normalization.
   */
  precomputedBustStitches?: number;
};

export type BodyBlockShapingEvent = {
  action: "increase" | "decrease";
  stitchesPerEdge: 1;
  everyRows: number;
  times: number;
  startingAfterRows?: number;
};

export type BodyShapingPlacement = {
  /** Straight body rows immediately before the armhole (1″ from row gauge). */
  straightRowsBeforeArmhole: number;
  /** RC where the “begin A-line shaping” instruction is anchored (end of hem). */
  shapingBeginRc: number;
  /** RC of the first row where a side-edge decrease/increase may be worked. */
  shapingStartRow: number;
  /** RC of the last row where shaping may occur (before the pre-armhole straight section). */
  shapingEndRow: number;
  /** RC where the 1″ straight knit before the armhole begins. */
  straightBeforeArmholeBeginRc: number;
  /** RC where armhole shaping begins (end of body to armhole). */
  armholeBeginRc: number;
  /** Rows in the continuous A-line shaping span (body rows minus pre-armhole straight). */
  availableShapingRows: number;
  /** @deprecated Use {@link straightRowsBeforeArmhole}. Always 0 — no straight buffer after the hem. */
  shapingStartRows: number;
  /** @deprecated Use {@link straightRowsBeforeArmhole}. */
  shapingEndBufferRows: number;
};

/** Diagram overlay hints — consumed by garment schematic renderers (no shaping math in SVG layer). */
export type SleevelessBodyDiagramGuides = {
  showBodyShapeGuides: boolean;
  bodyShapeKind: "straight" | "aline" | "waist-shaped";
  shapingDirection: "none" | "increase" | "decrease";
  hemStitches: number;
  bustStitches: number;
  hemCircumferenceInches: number;
  bustCircumferenceInches: number;
};

export type SleevelessBodyBlockPlan = {
  bodyShapeKind: "straight" | "aline" | "waist-shaped";
  shapingDirection: "none" | "increase" | "decrease";
  diagramGuides: SleevelessBodyDiagramGuides;
  hemCircumferenceInches: number;
  hipCircumferenceInches: number;
  bustCircumferenceInches: number;
  hemStitches: number;
  bustStitches: number;
  armholeStartStitches: number;
  totalStitchChange: number;
  stitchChangePerSide: number;
  shapingEvents: BodyBlockShapingEvent[];
  rowsToArmhole: number;
  shapingStartRows: number;
  shapingEndBufferRows: number;
  shapingStartRow: number;
  shapingEndRow: number;
  availableShapingRows: number;
  summary: string;
  /** Flat warning strings for legacy callers. */
  warnings: string[];
  validation: BodyBlockValidation;
  /** When true, shaping math is not applied for this garment style in this release. */
  unsupportedForRelease?: boolean;
  /** RC row numbers for paired side shaping (legacy pattern rendering). */
  shapingRowNumbers: number[];
};

function evenPositiveInt(n: number): number {
  const v = Math.max(0, Math.round(n));
  if (v <= 0) return 0;
  return v % 2 === 0 ? v : v + 1;
}

function circumferenceToPieceStitches(circumferenceInches: number, stitchesPerInch: number): number {
  if (!Number.isFinite(circumferenceInches) || circumferenceInches <= 0) return 0;
  if (!Number.isFinite(stitchesPerInch) || stitchesPerInch <= 0) return 0;
  return evenPositiveInt(Math.round(circumferenceInches * stitchesPerInch) / 2);
}

function measurementsEffectivelyEqual(
  hipCircumferenceInches: number,
  bustCircumferenceInches: number,
): boolean {
  return (
    Math.abs(hipCircumferenceInches - bustCircumferenceInches) <=
    SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES
  );
}

function emptyPlacement(hemRows: number): BodyShapingPlacement {
  const hem = Math.max(0, Math.floor(hemRows));
  return {
    straightRowsBeforeArmhole: 0,
    shapingBeginRc: hem,
    shapingStartRow: hem,
    shapingEndRow: hem,
    straightBeforeArmholeBeginRc: hem,
    armholeBeginRc: hem,
    availableShapingRows: 0,
    shapingStartRows: 0,
    shapingEndBufferRows: 0,
  };
}

/**
 * Computes shaping placement: A-line shaping begins immediately after the hem; 1″ straight knit
 * sits immediately before the armhole. Shaping does not extend into that pre-armhole straight section.
 */
export function computeBodyShapingPlacement(
  hemRows: number,
  rowsToArmhole: number,
  rowsPerInch: number,
): BodyShapingPlacement {
  const hem = Math.max(0, Math.floor(hemRows));
  const bodyRows = Math.max(0, Math.floor(rowsToArmhole));
  const rpi = Number.isFinite(rowsPerInch) && rowsPerInch > 0 ? rowsPerInch : 0;

  const straightRowsBeforeArmhole = rpi > 0 ? Math.max(0, Math.round(rpi)) : 0;
  const availableShapingRows = Math.max(0, bodyRows - straightRowsBeforeArmhole);

  const shapingBeginRc = hem;
  const shapingStartRow = hem;
  const armholeBeginRc = hem + bodyRows;
  const shapingEndRow =
    bodyRows > 0
      ? Math.max(shapingStartRow, armholeBeginRc - straightRowsBeforeArmhole - 1)
      : hem;
  const straightBeforeArmholeBeginRc = shapingEndRow + 1;

  return {
    straightRowsBeforeArmhole,
    shapingBeginRc,
    shapingStartRow,
    shapingEndRow,
    straightBeforeArmholeBeginRc,
    armholeBeginRc,
    availableShapingRows,
    shapingStartRows: 0,
    shapingEndBufferRows: straightRowsBeforeArmhole,
  };
}

/**
 * Distributes paired side shaping RCs inside the body-block shaping window only.
 */
export function distributeSleevelessBodyShapingRows(
  hemRows: number,
  rowsToArmhole: number,
  rowsPerInch: number,
  pairedShapingRows: number,
): number[] {
  const placement = computeBodyShapingPlacement(hemRows, rowsToArmhole, rowsPerInch);
  return distributeSleevelessBodyShapingRowsInPlacement(placement, pairedShapingRows);
}

/** Distributes shaping rows using a precomputed placement window. */
export function distributeSleevelessBodyShapingRowsInPlacement(
  placement: BodyShapingPlacement,
  pairedShapingRows: number,
): number[] {
  const count = Math.max(0, Math.floor(pairedShapingRows));
  if (count <= 0 || placement.availableShapingRows <= 0) return [];
  const { shapingStartRow, shapingEndRow } = placement;
  if (shapingEndRow < shapingStartRow) return [];
  return distributeVNeckInnerDecreaseRows(count, shapingStartRow, shapingEndRow);
}

function buildShapingEvents(
  shapingDirection: "increase" | "decrease",
  stitchChangePerSide: number,
  placement: BodyShapingPlacement,
  hemRows: number,
  shapingRowNumbers: readonly number[],
): BodyBlockShapingEvent[] {
  if (stitchChangePerSide <= 0 || shapingRowNumbers.length === 0) return [];

  if (shapingRowNumbers.length === 1) {
    return [
      {
        action: shapingDirection,
        stitchesPerEdge: 1,
        everyRows: Math.max(1, placement.availableShapingRows),
        times: 1,
        startingAfterRows: hemRows > 0 ? hemRows : undefined,
      },
    ];
  }

  const gaps: number[] = [];
  for (let i = 1; i < shapingRowNumbers.length; i++) {
    gaps.push(shapingRowNumbers[i]! - shapingRowNumbers[i - 1]!);
  }
  const uniformGap = gaps.length > 0 && gaps.every((g) => g === gaps[0]);
  if (uniformGap && gaps[0]! > 0) {
    return [
      {
        action: shapingDirection,
        stitchesPerEdge: 1,
        everyRows: gaps[0]!,
        times: stitchChangePerSide,
        startingAfterRows: placement.shapingStartRow > 0 ? placement.shapingStartRow - 1 : undefined,
      },
    ];
  }

  const events: BodyBlockShapingEvent[] = [];
  let runStart = 0;
  while (runStart < gaps.length) {
    const gap = gaps[runStart]!;
    let runLen = 1;
    while (runStart + runLen < gaps.length && gaps[runStart + runLen] === gap) {
      runLen++;
    }
    events.push({
      action: shapingDirection,
      stitchesPerEdge: 1,
      everyRows: gap,
      times: runLen,
      startingAfterRows:
        runStart === 0
          ? placement.shapingStartRow > 0
            ? placement.shapingStartRow - 1
            : undefined
          : shapingRowNumbers[runStart] !== undefined
            ? shapingRowNumbers[runStart]! - 1
            : undefined,
    });
    runStart += runLen;
  }
  return events;
}

function buildSummary(
  bodyShapeKind: SleevelessBodyBlockPlan["bodyShapeKind"],
  shapingDirection: SleevelessBodyBlockPlan["shapingDirection"],
  hemStitches: number,
  bustStitches: number,
  stitchChangePerSide: number,
  placement: BodyShapingPlacement,
): string {
  if (bodyShapeKind === "straight" || shapingDirection === "none") {
    return `Straight body: cast on at bust width (${hemStitches} stitches on the needle).`;
  }
  const verb = shapingDirection === "decrease" ? "decrease" : "increase";
  return `A-line body: cast on ${hemStitches} stitches at hip/hem width, ${verb} ${stitchChangePerSide} time${
    stitchChangePerSide === 1 ? "" : "s"
  } per side edge across ${placement.availableShapingRows} shaping row${
    placement.availableShapingRows === 1 ? "" : "s"
  } (RC ${placement.shapingStartRow}–${placement.shapingEndRow}) to bust width (${bustStitches} stitches).`;
}

function validationMessagesToStrings(validation: BodyBlockValidation): string[] {
  return [
    ...validation.warnings.map((w) => w.message),
    ...validation.errors.map((e) => e.message),
  ];
}

function emptyValidation(): BodyBlockValidation {
  return { valid: true, warnings: [], errors: [] };
}

type BodyBlockValidationContext = {
  bustIn: number;
  hipIn: number;
  spi: number;
  rpi: number;
  rowsToArmhole: number;
  bustStitches: number;
  hemStitches: number;
  totalStitchChange: number;
  stitchChangePerSide: number;
  bodyShapeKind: SleevelessBodyBlockPlan["bodyShapeKind"];
  shapingDirection: SleevelessBodyBlockPlan["shapingDirection"];
  placement: BodyShapingPlacement;
  distributedPairedRows: number;
};

function validateBodyBlock(ctx: BodyBlockValidationContext): BodyBlockValidation {
  const validation = emptyValidation();

  const pushWarning = (code: string, message: string) => {
    validation.warnings.push({ code, message });
  };
  const pushError = (code: string, message: string) => {
    validation.errors.push({ code, message });
    validation.valid = false;
  };

  if (!Number.isFinite(ctx.spi) || ctx.spi <= 0) {
    pushError(
      "INVALID_GAUGE",
      "Stitch gauge is missing or invalid — body stitch counts cannot be calculated.",
    );
  }
  if (!Number.isFinite(ctx.rpi) || ctx.rpi <= 0) {
    pushWarning(
      "INVALID_ROW_GAUGE",
      "Row gauge is missing or invalid — shaping placement uses 0-row buffers until gauge is set.",
    );
  }
  if (ctx.bustIn <= 0) {
    pushError(
      "INVALID_MEASUREMENTS",
      "Finished bust/chest measurement is missing — body block cannot continue.",
    );
  }
  if (ctx.bustStitches <= 0) {
    pushError(
      "INVALID_STITCH_COUNT",
      "Bust body stitch count is zero — check bust measurement and stitch gauge.",
    );
  }
  if (ctx.rowsToArmhole <= 0 && ctx.shapingDirection !== "none") {
    pushWarning(
      "ROWS_TO_ARMHOLE_ZERO",
      "Rows to armhole are zero — side shaping rows cannot be distributed.",
    );
  }

  if (ctx.totalStitchChange > 0 && ctx.totalStitchChange % 2 !== 0) {
    pushWarning(
      "SYMMETRY_ODD_STITCH_CHANGE",
      "Hip–bust stitch difference is odd — adjusted for symmetrical left/right shaping.",
    );
  }

  if (ctx.bodyShapeKind === "aline" && ctx.stitchChangePerSide > 0) {
    const maxSideChange = Math.max(
      1,
      Math.floor(ctx.bustStitches * SLEEVELESS_ALINE_MAX_SIDE_STITCH_CHANGE_RATIO),
    );
    if (ctx.totalStitchChange > maxSideChange) {
      const isFlare = ctx.hemStitches > ctx.bustStitches;
      pushWarning(
        "EXCESSIVE_STITCH_CHANGE",
        isFlare
          ? `A-line hip flare is large (${ctx.totalStitchChange} stitches across the body) — verify hip measurement and body length in Fit.`
          : `A-line hip taper is large (${ctx.totalStitchChange} stitches across the body) — verify hip measurement and body length in Fit.`,
      );
    }

    if (ctx.placement.availableShapingRows <= 0) {
      pushWarning(
        "INSUFFICIENT_SHAPING_ROWS",
        "Body length is too short for 1″ straight knitting before the armhole — shaping cannot be placed.",
      );
    } else if (ctx.distributedPairedRows < ctx.stitchChangePerSide) {
      pushWarning(
        "INSUFFICIENT_SHAPING_ROWS",
        `Only ${ctx.placement.availableShapingRows} shaping row${ctx.placement.availableShapingRows === 1 ? "" : "s"} available for ${ctx.stitchChangePerSide} paired side changes — shaping is packed more densely.`,
      );
    } else if (ctx.distributedPairedRows > 0) {
      const minSpacing = Math.floor(ctx.placement.availableShapingRows / ctx.distributedPairedRows);
      if (minSpacing < SLEEVELESS_BODY_MIN_SHAPING_ROW_SPACING) {
        pushWarning(
          "EXCESSIVE_STITCH_CHANGE",
          `Side shaping is very frequent (about every ${Math.max(1, minSpacing)} row${minSpacing === 1 ? "" : "s"}) — consider a smaller hip–bust difference or longer body length.`,
        );
      }
    }
  }

  return validation;
}

function cardiganStubPlan(
  input: SleevelessBodyBlockInput,
  bustStitches: number,
): SleevelessBodyBlockPlan {
  const bustIn = Math.max(0, input.bustCircumferenceInches);
  const hipIn = Math.max(0, input.hipCircumferenceInches);
  const hemRows = Math.max(0, Math.floor(input.hemRows ?? 0));
  const rowsToArmhole = Math.max(0, Math.floor(input.rowsToArmhole));
  const placement = emptyPlacement(hemRows);
  const validation = emptyValidation();

  return finalizePlan({
    bodyShapeKind: "straight",
    shapingDirection: "none",
    hemCircumferenceInches: hipIn,
    hipCircumferenceInches: hipIn,
    bustCircumferenceInches: bustIn,
    hemStitches: bustStitches,
    bustStitches,
    armholeStartStitches: bustStitches,
    totalStitchChange: 0,
    stitchChangePerSide: 0,
    shapingEvents: [],
    rowsToArmhole,
    ...placement,
    summary: "Cardigan body block shaping is not active in this release — using bust-width cast-on.",
    validation,
    unsupportedForRelease: true,
    shapingRowNumbers: [],
  });
}

/** Builds diagram guide flags from an authoritative body block plan (no measurement re-inference). */
export function buildDiagramGuidesFromBodyPlan(
  plan: Pick<
    SleevelessBodyBlockPlan,
    | "bodyShapeKind"
    | "shapingDirection"
    | "hemStitches"
    | "bustStitches"
    | "hemCircumferenceInches"
    | "bustCircumferenceInches"
    | "unsupportedForRelease"
  >,
): SleevelessBodyDiagramGuides {
  const showBodyShapeGuides =
    !plan.unsupportedForRelease &&
    plan.bodyShapeKind === "aline" &&
    (plan.shapingDirection === "increase" || plan.shapingDirection === "decrease");
  return {
    showBodyShapeGuides,
    bodyShapeKind: plan.bodyShapeKind,
    shapingDirection: plan.shapingDirection,
    hemStitches: plan.hemStitches,
    bustStitches: plan.bustStitches,
    hemCircumferenceInches: plan.hemCircumferenceInches,
    bustCircumferenceInches: plan.bustCircumferenceInches,
  };
}

function finalizePlan(
  plan: Omit<SleevelessBodyBlockPlan, "warnings" | "diagramGuides"> & {
    validation: BodyBlockValidation;
  },
): SleevelessBodyBlockPlan {
  const withGuides = { ...plan, diagramGuides: buildDiagramGuidesFromBodyPlan(plan) };
  return {
    ...withGuides,
    warnings: validationMessagesToStrings(withGuides.validation),
  };
}

/**
 * Builds the sleeveless body block plan for cast-on width and side shaping to the armhole.
 * Active: pullover + back + mode `auto` (straight / A-line from hip vs bust).
 */
export function buildSleevelessBodyBlockPlan(input: SleevelessBodyBlockInput): SleevelessBodyBlockPlan {
  const mode = input.mode ?? "auto";
  const hemRows = Math.max(0, Math.floor(input.hemRows ?? 0));
  const rowsToArmhole = Math.max(0, Math.floor(input.rowsToArmhole));
  const bustIn = Math.max(0, input.bustCircumferenceInches);
  const hipIn = Math.max(0, input.hipCircumferenceInches);
  const spi = input.stitchesPerInch;
  const rpi = input.rowsPerInch;
  const placement = computeBodyShapingPlacement(hemRows, rowsToArmhole, rpi);

  const bustStitches =
    input.precomputedBustStitches !== undefined && input.precomputedBustStitches > 0
      ? input.precomputedBustStitches % 2 === 0
        ? input.precomputedBustStitches
        : input.precomputedBustStitches + 1
      : circumferenceToPieceStitches(bustIn, spi);

  if (input.garmentStyle === "cardigan") {
    return cardiganStubPlan(input, bustStitches);
  }

  if (mode === "waist-shaped") {
    const validation = emptyValidation();
    return finalizePlan({
      bodyShapeKind: "waist-shaped",
      shapingDirection: "none",
      hemCircumferenceInches: hipIn,
      hipCircumferenceInches: hipIn,
      bustCircumferenceInches: bustIn,
      hemStitches: bustStitches,
      bustStitches,
      armholeStartStitches: bustStitches,
      totalStitchChange: 0,
      stitchChangePerSide: 0,
      shapingEvents: [],
      rowsToArmhole,
      ...placement,
      summary: "Waist-shaped body block is not active in this release — using bust-width cast-on.",
      validation,
      unsupportedForRelease: true,
      shapingRowNumbers: [],
    });
  }

  if (bustStitches <= 0 || spi <= 0) {
    const validation = validateBodyBlock({
      bustIn,
      hipIn,
      spi,
      rpi,
      rowsToArmhole,
      bustStitches,
      hemStitches: 0,
      totalStitchChange: 0,
      stitchChangePerSide: 0,
      bodyShapeKind: "straight",
      shapingDirection: "none",
      placement,
      distributedPairedRows: 0,
    });
    return finalizePlan({
      bodyShapeKind: "straight",
      shapingDirection: "none",
      hemCircumferenceInches: hipIn,
      hipCircumferenceInches: hipIn,
      bustCircumferenceInches: bustIn,
      hemStitches: 0,
      bustStitches: 0,
      armholeStartStitches: 0,
      totalStitchChange: 0,
      stitchChangePerSide: 0,
      shapingEvents: [],
      rowsToArmhole,
      ...placement,
      summary: "Body block unavailable — check bust measurement and stitch gauge.",
      validation,
      shapingRowNumbers: [],
    });
  }

  const straightByMeasurement = measurementsEffectivelyEqual(hipIn, bustIn);
  let bodyShapeKind: SleevelessBodyBlockPlan["bodyShapeKind"] = "straight";
  let shapingDirection: SleevelessBodyBlockPlan["shapingDirection"] = "none";
  let hemStitches = bustStitches;
  let hemCircumferenceInches = bustIn;

  if (!straightByMeasurement) {
    bodyShapeKind = "aline";
    const hipStitchesRaw = circumferenceToPieceStitches(hipIn, spi);
    if (hipStitchesRaw > bustStitches) {
      shapingDirection = "decrease";
      hemStitches = hipStitchesRaw;
      hemCircumferenceInches = hipIn;
    } else if (hipStitchesRaw < bustStitches) {
      shapingDirection = "increase";
      hemStitches = hipStitchesRaw;
      hemCircumferenceInches = hipIn;
    } else {
      bodyShapeKind = "straight";
      shapingDirection = "none";
      hemStitches = bustStitches;
      hemCircumferenceInches = bustIn;
    }
  }

  let totalStitchChange = Math.abs(hemStitches - bustStitches);
  if (totalStitchChange % 2 !== 0) {
    totalStitchChange = Math.max(0, totalStitchChange - 1);
  }
  const stitchChangePerSide = totalStitchChange / 2;

  const distributedPairedRows =
    shapingDirection === "none" || stitchChangePerSide <= 0 || placement.availableShapingRows <= 0
      ? 0
      : stitchChangePerSide;

  const shapingRowNumbers =
    distributedPairedRows > 0
      ? distributeSleevelessBodyShapingRowsInPlacement(placement, distributedPairedRows)
      : [];

  const shapingEvents =
    shapingDirection === "increase" || shapingDirection === "decrease"
      ? buildShapingEvents(
          shapingDirection,
          distributedPairedRows,
          placement,
          hemRows,
          shapingRowNumbers,
        )
      : [];

  const validation = validateBodyBlock({
    bustIn,
    hipIn,
    spi,
    rpi,
    rowsToArmhole,
    bustStitches,
    hemStitches,
    totalStitchChange,
    stitchChangePerSide,
    bodyShapeKind,
    shapingDirection,
    placement,
    distributedPairedRows,
  });

  const summary = buildSummary(
    bodyShapeKind,
    shapingDirection,
    hemStitches,
    bustStitches,
    distributedPairedRows > 0 ? distributedPairedRows : stitchChangePerSide,
    placement,
  );

  return finalizePlan({
    bodyShapeKind,
    shapingDirection,
    hemCircumferenceInches,
    hipCircumferenceInches: hipIn,
    bustCircumferenceInches: bustIn,
    hemStitches,
    bustStitches,
    armholeStartStitches: bustStitches,
    totalStitchChange,
    stitchChangePerSide,
    shapingEvents,
    rowsToArmhole,
    ...placement,
    summary,
    validation,
    shapingRowNumbers,
  });
}
