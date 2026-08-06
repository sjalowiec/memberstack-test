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
  computeDartShapingFromPerInch,
  isDartCupSize,
  type DartCupSize,
  type DartShapingSuccess,
} from "../../tools/dartFormulaMath";
import { dartShapingHoldStepLines } from "../../tools/dartFormulaInstructions";

export { dartShapingHoldStepLines };

/** Physical placement: dart begins this many inches below the armhole opening (bottom-up). */
export const BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE = 1;

/** Chart audiences that may offer bust darts (Women’s + Plus). */
export const BUST_DART_ELIGIBLE_AUDIENCES = ["misses", "plus"] as const;

export type BustDartEligibleAudience = (typeof BUST_DART_ELIGIBLE_AUDIENCES)[number];

export type BustDartFrontConstruction = "pullover" | "cardigan";

/** Canonical saved / style field for bust darts (version-tolerant). */
export type BustDartSavedConfig = {
  enabled: boolean;
  /** Required when enabled; ignored when disabled. */
  cupSize: DartCupSize | null;
};

export const BUST_DART_STYLE_KEY = "bustDart";

export type BustDartInput = {
  /** User wants darts (before eligibility / validation). */
  enabled: boolean;
  cupSize?: string | null;
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
};

export type BustDartShapingSummary = {
  cupKey: DartCupSize;
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
};

function emptyDisabledResult(
  partial: Partial<BustDartResult> & { config: BustDartSavedConfig; eligible: boolean },
): BustDartResult {
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
    ...partial,
  };
}

export function isBustDartEligibleAudience(raw: unknown): boolean {
  const aud = normalizeSleevelessAudience(raw);
  return (BUST_DART_ELIGIBLE_AUDIENCES as readonly string[]).includes(aud);
}

/** Coerce untrusted saved / form values. Missing or invalid → darts off. */
export function normalizeBustDartSavedConfig(raw: unknown): BustDartSavedConfig {
  if (raw == null) return { enabled: false, cupSize: null };
  if (typeof raw === "boolean") {
    return { enabled: raw === true, cupSize: null };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { enabled: false, cupSize: null };
  }
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled === true || o.enabled === "true" || o.addBustDarts === true;
  const cupRaw = o.cupSize ?? o.cup ?? o.dartCupSize;
  const cupSize = isDartCupSize(cupRaw) ? cupRaw : null;
  if (!enabled) return { enabled: false, cupSize: null };
  return { enabled: true, cupSize };
}

/** Read `style.bustDart` (or legacy top-level) from pattern data; missing → off. */
export function readBustDartConfigFromPatternData(
  patternData: Record<string, unknown> | null | undefined,
): BustDartSavedConfig {
  if (!patternData || typeof patternData !== "object") {
    return { enabled: false, cupSize: null };
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
  return { enabled: false, cupSize: null };
}

/**
 * When the size group becomes ineligible, force darts off without inventing a cup size.
 */
export function normalizeBustDartConfigForAudience(
  config: BustDartSavedConfig,
  sizeGroup: unknown,
): BustDartSavedConfig {
  if (!isBustDartEligibleAudience(sizeGroup)) {
    return { enabled: false, cupSize: null };
  }
  if (!config.enabled) return { enabled: false, cupSize: null };
  return { enabled: true, cupSize: config.cupSize };
}

function shapingSummary(s: DartShapingSuccess): BustDartShapingSummary {
  return {
    cupKey: s.cupKey,
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

function buildInstructionParagraphs(args: {
  dartStartGarmentRc: number;
  armholeOpeningGarmentRc: number;
  frontConstruction: BustDartFrontConstruction;
  holdLines: string[];
  cupKey: DartCupSize;
}): { paragraphs: string[]; cardiganRightMirrorParagraph: string | null } {
  const edgeHint =
    args.frontConstruction === "cardigan"
      ? "Work the short-row bust dart from the side (armhole) edge toward the center front."
      : "Work the short-row bust dart on the front only (both sides of center).";

  // Tool hold lines end with turn-off / reset-RC / continue — sweater patterns own RC reset wording.
  const holdOnly = args.holdLines.filter(
    (l) => l.startsWith("Place ") || l === "Turn off hold settings.",
  );

  const paragraphs: string[] = [
    `Stop the row counter at RC ${args.dartStartGarmentRc} (1″ below the armhole opening).`,
    `Add bust darts (cup ${args.cupKey}). Darts are worked on the front only — do not work darts on the back or sleeves.`,
    edgeHint,
    "Work the short-row shaping:",
    ...holdOnly,
    `Reset the row counter to RC ${args.dartStartGarmentRc} so the next plain row is counted correctly.`,
    `Continue knitting across all stitches to RC ${args.armholeOpeningGarmentRc} (armhole opening).`,
  ];

  const cardiganRightMirrorParagraph =
    args.frontConstruction === "cardigan"
      ? "Work the RIGHT FRONT to match, reversing the bust-dart short rows so shaping also falls at the side (armhole) edge (not the center-front edge)."
      : null;

  return { paragraphs, cardiganRightMirrorParagraph };
}

/**
 * Compute optional bust-dart placement and short-row shaping for a women’s sweater front.
 * Does not mutate `input`. Returns `active: false` when disabled, ineligible, or invalid.
 */
export function calculateBustDart(input: BustDartInput): BustDartResult {
  const eligible = isBustDartEligibleAudience(input.sizeGroup);
  const cupSize = isDartCupSize(input.cupSize) ? input.cupSize : null;
  const config: BustDartSavedConfig = {
    enabled: input.enabled === true,
    cupSize: input.enabled === true ? cupSize : null,
  };

  if (!eligible) {
    return emptyDisabledResult({
      eligible: false,
      config: { enabled: false, cupSize: null },
      warnings:
        input.enabled === true
          ? ["Bust darts are available for women’s sweater patterns only."]
          : [],
    });
  }

  if (!config.enabled) {
    return emptyDisabledResult({
      eligible: true,
      config: { enabled: false, cupSize: null },
    });
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!cupSize) {
    errors.push("Select a cup size to add bust darts.");
  }

  const spi = Number(input.stitchesPerInch);
  const rpi = Number(input.rowsPerInch);
  if (!Number.isFinite(spi) || spi <= 0) {
    errors.push("Stitch gauge must be greater than 0.");
  }
  if (!Number.isFinite(rpi) || rpi <= 0) {
    errors.push("Row gauge must be greater than 0.");
  }

  const hemRows = Math.max(0, Math.floor(Number(input.hemRows) || 0));
  const bodyToArmholeRows = Math.max(0, Math.floor(Number(input.bodyToArmholeRows) || 0));
  const armholeRc = Math.floor(Number(input.armholeOpeningGarmentRc));
  const frontSts = Math.floor(Number(input.frontStitchCount));

  if (!Number.isFinite(armholeRc) || armholeRc <= 0) {
    errors.push("Armhole opening row is required to place bust darts.");
  }
  if (!Number.isFinite(frontSts) || frontSts < 1) {
    errors.push("Front stitch count is required to validate bust darts.");
  }

  const placementOffsetRows = rpi > 0 ? inchesToRows(BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE, rpi) : 0;
  if (placementOffsetRows < 1) {
    errors.push(
      "Row gauge is too coarse to place the dart 1″ below the armhole. Increase row gauge or omit bust darts.",
    );
  }

  const dartStartGarmentRc =
    Number.isFinite(armholeRc) && placementOffsetRows >= 1 ? armholeRc - placementOffsetRows : null;

  if (dartStartGarmentRc != null) {
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
  }

  if (errors.length || !cupSize || dartStartGarmentRc == null) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors,
      warnings,
      placementOffsetRows,
      dartStartGarmentRc,
    });
  }

  const shapingResult = computeDartShapingFromPerInch({
    cupKey: cupSize,
    stitchesPerInch: spi,
    rowsPerInch: rpi,
  });

  if (!shapingResult.ok) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors: [shapingResult.error],
      warnings,
      placementOffsetRows,
      dartStartGarmentRc,
    });
  }

  // Short-row darts temporarily hold stitches; require enough front width for the held span.
  // Leave at least one stitch active so the piece is not fully in hold.
  if (shapingResult.totalHeldStitches >= frontSts) {
    errors.push(
      input.frontConstruction === "cardigan"
        ? "This cardigan front is too narrow for the selected dart. Choose a smaller cup size or omit bust darts."
        : "The front does not have enough stitches for the selected dart. Choose a smaller cup size or omit bust darts.",
    );
  }

  // Depth rows are worked with RC stopped — they must not consume the 1″ placement gap alone,
  // but warn if depth is large relative to remaining body below the dart.
  const rowsFromHemToDartStart = Math.max(0, dartStartGarmentRc - hemRows);
  const rowsFromDartToArmhole = Math.max(0, armholeRc - dartStartGarmentRc);
  if (rowsFromDartToArmhole < 1) {
    errors.push("No rows remain between the dart and the armhole opening after placement rounding.");
  }

  if (errors.length) {
    return emptyDisabledResult({
      eligible: true,
      config,
      errors,
      warnings,
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
    armholeOpeningGarmentRc: armholeRc,
    frontConstruction: input.frontConstruction,
    holdLines: holdStepLines,
    cupKey: cupSize,
  });

  return {
    active: true,
    eligible: true,
    config: { enabled: true, cupSize },
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
  return calculateBustDart({
    enabled: normalized.enabled,
    cupSize: normalized.cupSize,
    sizeGroup,
    stitchesPerInch: args.stitchesPerInch,
    rowsPerInch: args.rowsPerInch,
    frontConstruction: args.frontConstruction,
    frontStitchCount: args.frontStitchCount,
    armholeOpeningGarmentRc: args.armholeOpeningGarmentRc,
    hemRows: args.hemRows,
    bodyToArmholeRows: args.bodyToArmholeRows,
  });
}

/**
 * Insert bust-dart instruction blocks into the FRONT piece BODY section only.
 * Back / sleeve rows must not be passed through this helper.
 *
 * Straight BODY: splits the knit-to-armhole span at the dart RC.
 * A-line BODY: inserts the dart immediately before “Begin armhole shaping.” / ABOVE ARMHOLE MARKERS.
 * When inactive, returns the input rows unchanged (new array copy).
 */
export function insertBustDartIntoFrontBodyDisplayRows<T extends BustDartPatternDisplayRow>(
  rows: readonly T[],
  result: BustDartResult,
  helpers: {
    formatRc: (rc: number) => string;
    knitToRcLine: (targetRc: number) => string;
  },
): T[] {
  if (!result.active || result.dartStartGarmentRc == null) {
    return rows.map((r) => r);
  }

  const dartStart = result.dartStartGarmentRc;
  const armholeRc = dartStart + (result.rowsFromDartToArmhole ?? 0);
  const dartBlock = {
    kind: "block" as const,
    rc: helpers.formatRc(dartStart),
    paragraphs: [...result.instructionParagraphs],
  };

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

    // A-line: insert immediately before “Begin armhole shaping.”
    if (paras.some((p) => /Begin armhole shaping\.?/i.test(p))) {
      out.push(dartBlock);
      dartInserted = true;
      out.push(row);
      continue;
    }

    // Straight body / drop-shoulder even knit: rewrite knit-to-armhole into knit-to-dart + dart + knit-to-armhole.
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
          paragraphs: [helpers.knitToRcLine(dartStart)],
          ...(trusted ? { trustedParagraphs: undefined } : {}),
        });
        out.push(dartBlock);
        if ((result.rowsFromDartToArmhole ?? 0) > 0) {
          out.push({
            kind: "block",
            rc: helpers.formatRc(dartStart),
            paragraphs: [helpers.knitToRcLine(armholeRc)],
            stitchCount: block.stitchCount,
          });
        }
        dartInserted = true;
        continue;
      }
    }

    if (evenMatch && (result.rowsFromHemToDartStart ?? 0) >= 0) {
      const totalEven = parseInt(evenMatch[1], 10);
      const toDart = result.rowsFromHemToDartStart ?? 0;
      const afterDart = result.rowsFromDartToArmhole ?? 0;
      if (toDart + afterDart === totalEven || totalEven === (result.rowsFromHemToDartStart ?? 0) + afterDart) {
        if (toDart > 0) {
          out.push({
            ...block,
            paragraphs: [
              toDart === 1 ? "Knit 1 row even." : `Knit ${toDart} rows even.`,
            ],
          });
        }
        out.push(dartBlock);
        if (afterDart > 0) {
          out.push({
            kind: "block",
            rc: helpers.formatRc(dartStart),
            paragraphs: [
              afterDart === 1 ? "Knit 1 row even." : `Knit ${afterDart} rows even.`,
            ],
            stitchCount: block.stitchCount,
          });
        }
        dartInserted = true;
        continue;
      }
    }

    // A-line / body-block: 1″ straight buffer immediately before the armhole — dart starts here.
    const straightMatch = paras
      .map((p) => p.match(/Knit\s+(\d+)\s+rows?\s+straight\.?/i))
      .find((m) => m != null);
    if (straightMatch) {
      const straightRows = parseInt(straightMatch[1], 10);
      const afterDart = result.rowsFromDartToArmhole ?? straightRows;
      out.push(dartBlock);
      if (afterDart > 0) {
        out.push({
          ...block,
          rc: helpers.formatRc(dartStart),
          paragraphs: [
            afterDart === 1 ? "Knit 1 row straight." : `Knit ${afterDart} rows straight.`,
          ],
        });
      }
      dartInserted = true;
      continue;
    }

    out.push(row);
  }

  if (!dartInserted && result.cardiganRightMirrorParagraph) {
    // no-op — mirror is applied separately by cardigan builders
  }

  // Append cardigan mirror note after FRONT NECKLINE section content when present.
  if (result.cardiganRightMirrorParagraph) {
    const mirror = result.cardiganRightMirrorParagraph;
    const already = out.some(
      (r) =>
        r.kind === "block" &&
        Array.isArray(r.paragraphs) &&
        r.paragraphs.some((p) => p.includes("RIGHT FRONT") && /bust-dart|bust dart/i.test(p)),
    );
    if (!already) {
      // Prefer augmenting an existing RIGHT FRONT mirror block; else append at end.
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
