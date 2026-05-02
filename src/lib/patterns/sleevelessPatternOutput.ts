/**
 * Plain-text pattern output for sleeveless garments (machine knitting).
 * First slice: BACK piece only — no finishing, pickup, or armhole pickup blocks.
 */

import { calculateArmholeShaping, type ArmholeResult } from "./legoBlocks/armholeBlock";
import {
  generateNeckShoulderExecution,
  type NeedleRange,
  type ShapingAction,
} from "./legoBlocks/neckShoulderExecution";
import { calculateBasicPatternNumbers } from "./patternCalculator";
import { calculateHemRows } from "./hemDefaults";
import {
  DEMO_NECK_SHOULDER_SHAPING_CHART,
  neckShoulderShapingChartFromRows,
  type NeckShoulderShapingChart,
} from "./neckShoulderShapingChart";
import {
  buildNeckShoulderShapingChartRows,
  type NeckShoulderShapingPatternNumbers,
} from "./neckShoulderShapingChartRows";

/** Row/stitch audit for console — verify math before changing pattern wording. */
export type SleevelessBackPatternDebug = {
  finishedBustChest: number | undefined;
  stitchesPerInch: number;
  rowsPerInch: number;
  backStitches: number;
  /** Chart shoulder width (inches) from selected measurements. */
  shoulderWidthInches: number | undefined;
  /** B — stitch count after armhole (shoulder width × sts/in from calculator). */
  stitchesAfterArmhole: number | undefined;
  /** A − B total stitches removed in armhole shaping. */
  armholeStitchesTotal: number | undefined;
  /** (A − B) / 2 per armhole side. */
  armholeStitchesEachSide: number | undefined;
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  necklineShoulderRows: number;
  totalCalculatedRows: number;
  expectedGarmentRows: number;
  backNeckToHem: number | undefined;
  armholeDepth: number | undefined;
  bodyInchesToArmhole: number | undefined;
  reservedNecklineShoulderInches: number;
  reservedNecklineShoulderRows: number;
  remainingRowsBeforeNeckline: number;
  /** Neck opening width in inches (neck_width or neck_opening / neckOpening). */
  necklineWidthInches: number | undefined;
  /** N — neckline stitch count from neck opening × gauge (relative to B). */
  necklineStitches: number | undefined;
  /** Each shoulder: (B − N) / 2 after armhole. */
  shoulderStitches: number | undefined;
  /** B − N — stitches for both shoulders together. */
  stitchesAfterNeckline: number | undefined;
  finalRC: number;
};

export type SleevelessBackPatternResult = {
  warnings: string[];
  lines: string[];
  debug: SleevelessBackPatternDebug;
  /** Row-by-row neckline / shoulder chart — source of truth for printed table and SVG. */
  neckShoulderShapingChart: NeckShoulderShapingChart;
  /** True when chart rows were generated from back calculations; false when demo fallback is used. */
  neckShoulderChartUsesLiveRows: boolean;
};

function section(obj: unknown): Record<string, unknown> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return {};
}

function pickAudience(patternData: Record<string, unknown>): string | undefined {
  const fit = section(patternData.fit);
  const style = section(patternData.style);
  const chart = fit.sizingChart ?? fit.knitFor;
  if (typeof chart === "string" && chart.trim()) return chart.trim();
  const cat = style.recipientCategory;
  if (typeof cat === "string" && cat.trim()) return cat.trim();
  return undefined;
}

function selectedMeasurements(patternData: Record<string, unknown>): Record<string, unknown> {
  const fit = section(patternData.fit);
  const sm = fit.selectedMeasurements;
  if (sm && typeof sm === "object" && !Array.isArray(sm)) {
    return sm as Record<string, unknown>;
  }
  return {};
}

/** Positive measurement from selectedMeasurements or fallback. */
function measurementInches(sm: Record<string, unknown>, key: string): number | undefined {
  const v = sm[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/**
 * Half-bust stitch count for the back piece (one half of finished circumference).
 */
function backStitchesFromPattern(bustChestStitches: number): number {
  if (!Number.isFinite(bustChestStitches) || bustChestStitches <= 0) return 0;
  return Math.round(bustChestStitches / 2);
}

function filterNeckShoulderExecutionLines(execLines: string[]): string[] {
  return execLines.filter(
    (line) =>
      line.trim().length > 0 &&
      !line.includes("Knit in pattern until neckline / shoulder execution.")
  );
}

/** Mechanical row counter display: space after “RC”, at least 3 digits with leading zeros. */
function formatMechanicalRc(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return `RC ${String(n).padStart(3, "0")}`;
}

/**
 * Neckline/shoulder execution output: stop showing RC numbers after the piece reaches this section.
 * Replaces the first “RC …. Carriage on the right.” line with “Stop row counter.” + “Carriage on the right.”
 * and strips RC prefixes from shaping lines and incidental “RC” phrasing in this block only.
 */
function rewriteNeckShoulderRcLines(lines: string[]): string[] {
  const out: string[] = [];
  let replacedCarriageLine = false;

  for (const raw of lines) {
    const trimmed = raw.trim();

    const isCarriageOpening =
      /^RC:\s*\d+(?:\s*[\u2013\-]\s*\d+)?\.\s*Carriage on the right\.?$/.test(trimmed) ||
      /^RC\s+\d+\.\s*Carriage on the right\.?$/.test(trimmed);

    if (!replacedCarriageLine && isCarriageOpening) {
      out.push("Stop row counter.");
      out.push("Carriage on the right.");
      replacedCarriageLine = true;
      continue;
    }

    let s = raw;
    s = s.replace(/^RC:\s*\d+\s*[\u2013\-]\s*\d+\.\s*/, "");
    s = s.replace(/^RC:\s*\d+\.\s*/, "");
    s = s.replace(/^RC\s+\d+\.\s*/, "");
    s = s.replace(/at the correct RC for your piece/gi, "when ready");
    s = s.replace(/no RC-targeted neck/gi, "no row-targeted neck");
    s = s.replace(/same RC targets/gi, "same row targets");
    out.push(s);
  }

  return out;
}

type ArmholeRcPlan = {
  lines: string[];
  endRC: number;
  totalRows: number;
};

/**
 * Armhole shaping — mechanical RC only (start of each step), no RC ranges.
 */
function buildArmholeRcLines(
  result: ArmholeResult,
  firstArmholeRC: number
): ArmholeRcPlan {
  const { bindOffSts, decreaseSts, decreaseRows, evenRows } = result;
  const totalRows = 2 + decreaseRows + evenRows;
  const lines: string[] = [];

  lines.push(`${formatMechanicalRc(firstArmholeRC)}. Begin armhole shaping.`);

  const r1 = firstArmholeRC;
  const r2 = firstArmholeRC + 1;
  lines.push(
    `${formatMechanicalRc(r1)}. Bind off ${bindOffSts} stitches at the beginning of this row at each armhole edge. Knit in pattern across.`
  );
  lines.push(
    `${formatMechanicalRc(r2)}. Bind off ${bindOffSts} stitches at the beginning of this row at each armhole edge. Knit in pattern across.`
  );

  if (decreaseRows > 0) {
    const decStart = firstArmholeRC + 2;
    lines.push(
      `${formatMechanicalRc(decStart)}. At each armhole edge, decrease 1 stitch every other row, ${decreaseSts} times total on each side (${decreaseRows} shaping rows; work decreases on alternating rows as established).`
    );
  }

  if (evenRows > 0) {
    const evStart = firstArmholeRC + 2 + decreaseRows;
    lines.push(`${formatMechanicalRc(evStart)}. Knit in pattern for ${evenRows} rows.`);
  }

  const endRC = firstArmholeRC + totalRows - 1;
  return { lines, endRC, totalRows };
}

function makePlaceholderNeckShoulderExecution(startRC: number) {
  const center: NeedleRange = {
    label: "center neckline stitches",
    start: "TODO L?",
    end: "TODO R?",
    stitchCount: 0,
  };
  const left: NeedleRange = {
    label: "left shoulder stitches",
    start: "TODO L?",
    end: "TODO L?",
    stitchCount: 0,
  };
  const right: NeedleRange = {
    label: "right shoulder stitches",
    start: "TODO R?",
    end: "TODO R?",
    stitchCount: 0,
  };
  const neckActions: ShapingAction[] = [
    {
      startRC: startRC + 1,
      text: "TODO: At neck edge, work neckline decreases per chart (stitch / row counts TBD).",
    },
  ];
  const shoulderActions: ShapingAction[] = [
    {
      startRC: startRC + 1,
      text: "TODO: At armhole / shoulder edge, work shoulder shaping per chart (short-rows or bind-offs TBD).",
    },
  ];
  return generateNeckShoulderExecution({
    startRC,
    centerNeck: center,
    leftShoulder: left,
    rightShoulder: right,
    neckActions,
    shoulderActions,
  });
}

/**
 * Merge overlap so AT THE SAME TIME only when RC ranges overlap (handled inside generateNeckShoulderExecution).
 * Demo uses overlapping RC for neck + shoulder; real data can separate them.
 */
export function generateSleevelessBackPattern(
  patternData: Record<string, unknown>
): SleevelessBackPatternResult {
  const warnings: string[] = [];
  const lines: string[] = [];

  const basic = calculateBasicPatternNumbers(patternData);
  const { stitchesPerInch, rowsPerInch, bustChestStitches, stitchesAfterArmhole } = basic;

  if (!Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    warnings.push("Row gauge is missing or invalid — row counts and RC targets may be wrong.");
  }
  if (!Number.isFinite(stitchesPerInch) || stitchesPerInch <= 0) {
    warnings.push("Stitch gauge is missing or invalid — stitch counts may be wrong.");
  }

  const audience = pickAudience(patternData);
  const sm = selectedMeasurements(patternData);

  const finishedBust = measurementInches(sm, "finished_bust_chest") ?? basic.finishedBustChest;
  const backNeckToHem = measurementInches(sm, "back_neck_to_hem");
  const armholeDepthIn = measurementInches(sm, "armhole_depth");
  const shoulderWidthIn = measurementInches(sm, "shoulder_width");
  const backNeckDepthIn = measurementInches(sm, "back_neck_depth");
  const neckWidthIn =
    measurementInches(sm, "neck_width") ??
    measurementInches(sm, "neck_opening") ??
    measurementInches(sm, "neckOpening");

  const castOnSts =
    backStitchesFromPattern(bustChestStitches) ||
    (finishedBust > 0 && stitchesPerInch > 0
      ? Math.round((finishedBust * stitchesPerInch) / 2)
      : 0);

  const hemRows = calculateHemRows(rowsPerInch, audience);
  const rowGauge = rowsPerInch;

  lines.push("BACK");
  lines.push("");
  lines.push("Note: Unless otherwise instructed, each piece begins at RC 000.");
  lines.push("");

  // --- 1. Cast on ---
  lines.push("1. Cast on");
  if (castOnSts > 0) {
    lines.push(`Cast on ${castOnSts} stitches for the back (half of finished bust/chest width).`);
  } else {
    lines.push("TODO: Cast on ___ stitches for the back (half of finished bust/chest width).");
    warnings.push("Could not derive cast-on stitch count — need finished bust/chest and stitch gauge.");
  }
  lines.push("");

  if (!backNeckToHem || !armholeDepthIn) {
    warnings.push(
      "back_neck_to_hem and/or armhole_depth missing — section row totals use TODO placeholders."
    );
  }

  const totalGarmentRows =
    backNeckToHem && rowGauge > 0 ? Math.round(backNeckToHem * rowGauge) : 0;

  const neckShoulderInches = Math.max(2, (backNeckDepthIn ?? 2.5) + 2);
  const neckShoulderRowsEstimate =
    rowGauge > 0 ? Math.max(12, Math.round(neckShoulderInches * rowGauge)) : 28;

  const nRowsForNeckShoulder = Math.min(8, Math.max(4, neckShoulderRowsEstimate));

  const armholeDepthRows =
    armholeDepthIn && rowGauge > 0 ? Math.max(1, Math.round(armholeDepthIn * rowGauge)) : 0;

  const armholeStitchesTotal =
    castOnSts > 0 && stitchesAfterArmhole !== undefined
      ? castOnSts - stitchesAfterArmhole
      : undefined;
  const armholeStitchesEachSide =
    armholeStitchesTotal !== undefined ? armholeStitchesTotal / 2 : undefined;

  /** Neckline N and shoulders use B = stitchesAfterArmhole (after armhole), not cast-on A. */
  let necklineStitches: number | undefined;
  let shoulderStitches: number | undefined;
  let stitchesAfterNeckline: number | undefined;
  if (
    castOnSts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole < castOnSts &&
    neckWidthIn !== undefined &&
    stitchesPerInch > 0
  ) {
    const B = stitchesAfterArmhole;
    let N = Math.round(neckWidthIn * stitchesPerInch);
    const maxN = Math.max(1, B - 2);
    N = Math.min(Math.max(1, N), maxN);
    necklineStitches = N;
    stitchesAfterNeckline = B - N;
    shoulderStitches = Math.floor(stitchesAfterNeckline / 2);

    if (N >= B) {
      warnings.push("neckline stitches (N) must be less than stitchesAfterArmhole (B).");
    }
    if (shoulderStitches <= 0) {
      warnings.push("shoulder stitches must be greater than zero — check neck opening vs shoulder width.");
    }
  } else if (castOnSts > 0 && stitchesAfterArmhole !== undefined && stitchesAfterArmhole >= castOnSts) {
    warnings.push("stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder vs bust.");
  }

  /**
   * Rows from hem to first armhole row: full-width knitting below the armhole curve,
   * excluding armhole depth and an allowance for neck + shoulder (so total length is not double-counted).
   */
  let bodyToArmholeRows = 0;
  if (backNeckToHem && armholeDepthIn && rowGauge > 0) {
    const bodyFlatInches = backNeckToHem - armholeDepthIn - neckShoulderInches;
    if (bodyFlatInches <= 0) {
      warnings.push(
        "Garment length may be too short for the default neck/shoulder allowance — verify measurements."
      );
    }
    const rowsFromHemToUnderarm = Math.max(0, Math.round(Math.max(0, bodyFlatInches) * rowGauge));
    bodyToArmholeRows = Math.max(0, rowsFromHemToUnderarm - hemRows);
  }

  let rc = 0;

  // --- 2. Hem --- (counter shows completed row count, e.g. 14 rows → RC 014)
  lines.push("2. Hem");
  if (hemRows > 0) {
    rc = hemRows;
    lines.push(`Knit in pattern for ${hemRows} rows (${formatMechanicalRc(rc)}).`);
  } else {
    lines.push("TODO: Knit in pattern for ___ rows (RC ___) — hem rows could not be calculated.");
    warnings.push("Hem rows are 0 — check row gauge and audience for default hem depth.");
  }
  lines.push("");

  // --- 3. Body to armhole --- (next section starts at same counter reading as end of hem)
  lines.push("3. Body to armhole");
  if (bodyToArmholeRows > 0) {
    lines.push(`${formatMechanicalRc(rc)}. Knit in pattern for ${bodyToArmholeRows} rows.`);
    rc += bodyToArmholeRows;
  } else {
    lines.push("TODO: Knit in pattern for ___ rows — set body length to armhole.");
    warnings.push("Body rows to armhole could not be computed — need back neck to hem, armhole depth, and row gauge.");
  }
  lines.push("");

  // --- 4. Armhole shaping ---
  lines.push("4. Armhole shaping");
  let armholePlan: ArmholeRcPlan | null = null;

  if (
    castOnSts > 0 &&
    stitchesAfterArmhole !== undefined &&
    stitchesAfterArmhole > 0 &&
    stitchesAfterArmhole < castOnSts &&
    armholeDepthRows > 0
  ) {
    try {
      const armholeMath = calculateArmholeShaping({
        startingStitches: castOnSts,
        targetStitches: stitchesAfterArmhole,
        totalRows: armholeDepthRows,
      });
      const firstArmholeRC = rc + 1;
      armholePlan = buildArmholeRcLines(armholeMath, firstArmholeRC);
      lines.push(...armholePlan.lines);
      rc = armholePlan.endRC;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(msg);
    }
  } else {
    lines.push("TODO: Armhole shaping — supply shoulder width (for target stitches) and armhole depth rows.");
    lines.push(
      "Placeholder structure: bind off at each armhole edge; then decrease every other row; then knit in pattern with rows and RC filled in."
    );
    if (stitchesAfterArmhole === undefined) {
      warnings.push(
        "stitchesAfterArmhole not available — need shoulder_width in selected measurements and stitch gauge."
      );
    } else if (stitchesAfterArmhole >= castOnSts) {
      warnings.push(
        "stitchesAfterArmhole (B) must be less than back stitches (A) — check shoulder width vs bust."
      );
    }
    if (!armholeDepthRows) {
      warnings.push("Armhole depth rows could not be computed.");
    }
  }
  lines.push("");

  // --- 5. Upper back: knit to neckline/shoulder start ---
  lines.push("5. Knit in pattern to neckline / shoulder start");
  const armholeTotalForBudget = armholePlan ? armholePlan.totalRows : 0;
  const baseThroughArmhole = hemRows + bodyToArmholeRows + armholeTotalForBudget;

  /**
   * Reach expected garment length: upper back absorbs rows that were previously
   * subtracted as "reserved" neckline rows but never knitted. Neckline start RC
   * must be even (carriage right); choose upper-back rows + optional parity pad
   * so the last RC before the neckline block matches the length budget.
   */
  function solveUpperBackAndPad(
    baseRc: number,
    targetFinalRc: number
  ): { upperRows: number; padRows: number } {
    if (!Number.isFinite(targetFinalRc) || targetFinalRc <= baseRc) {
      return { upperRows: 0, padRows: 0 };
    }
    for (let t = Math.floor(targetFinalRc); t >= baseRc; t--) {
      const need = t - baseRc;
      for (let pad = 0; pad <= 1; pad++) {
        const upperRows = need - pad;
        if (upperRows < 0) continue;
        if (baseRc + upperRows + pad !== t) continue;
        const neckStart = t + 1;
        if (neckStart % 2 === 0) {
          return { upperRows, padRows: pad };
        }
      }
    }
    return { upperRows: Math.max(0, targetFinalRc - baseRc), padRows: 0 };
  }

  let upperBackRows = 0;
  let evenRowPadRows = 0;
  if (totalGarmentRows > 0) {
    const solved = solveUpperBackAndPad(baseThroughArmhole, totalGarmentRows);
    upperBackRows = solved.upperRows;
    evenRowPadRows = solved.padRows;
    if (totalGarmentRows < baseThroughArmhole) {
      warnings.push(
        "Row budget is tight: hem + body + armhole exceed total garment rows — verify lengths."
      );
    }
  }

  if (upperBackRows > 0) {
    const upperStartRc = rc + 1;
    lines.push(`${formatMechanicalRc(upperStartRc)}. Knit in pattern for ${upperBackRows} rows.`);
    rc += upperBackRows;
  } else if (totalGarmentRows > 0 && baseThroughArmhole >= totalGarmentRows) {
    lines.push(
      "No separate upper-back segment in this row budget (hem + body + armhole already reach or exceed total length)."
    );
  } else if (totalGarmentRows > 0) {
    lines.push(
      "No separate upper-back segment in this row budget (length is accounted for by hem, body, and armhole)."
    );
  } else {
    lines.push("TODO: Knit in pattern for ___ rows — upper back after armhole, before neckline.");
    warnings.push("Upper-back row count not derived — check total length vs hem, body, armhole, and neck reserve.");
  }

  // Even RC + carriage right before neckline block (neckShoulderExecution expects even startRC).
  let neckStartRC = rc + 1;
  if (evenRowPadRows > 0) {
    const padStartRc = rc + 1;
    rc += evenRowPadRows;
    lines.push(
      `${formatMechanicalRc(padStartRc)}. Knit in pattern${evenRowPadRows > 1 ? ` for ${evenRowPadRows} rows` : ""}.`
    );
    neckStartRC = rc + 1;
  }
  lines.push("");

  // --- 6. Neckline / shoulder ---
  lines.push("6. Neckline and shoulder shaping");
  warnings.push(
    "Neck and shoulder needle positions use TODO placeholders until bed mapping is implemented."
  );

  let neckExec = makePlaceholderNeckShoulderExecution(neckStartRC);

  if (castOnSts > 0 && neckWidthIn === undefined) {
    warnings.push(
      "Neck width not set (neck_width, neck_opening, or neckOpening) — neckline stitch counts are placeholders."
    );
  }

  if (
    castOnSts > 0 &&
    necklineStitches !== undefined &&
    shoulderStitches !== undefined &&
    necklineStitches > 0 &&
    shoulderStitches > 0
  ) {
    const shoulderSts = shoulderStitches;
    const centerSts = necklineStitches;

    const todoNeedle = (label: string): NeedleRange => ({
      label,
      start: "TODO",
      end: "TODO",
      stitchCount: shoulderSts,
    });

    const center: NeedleRange = {
      label: "center neckline stitches (TODO needle range)",
      start: "TODO L?",
      end: "TODO R?",
      stitchCount: centerSts,
    };

    const neckActions: ShapingAction[] =
      centerSts > 0
        ? [
            {
              startRC: neckStartRC + 1,
              endRC: neckStartRC + nRowsForNeckShoulder,
              text: `At neck edge, decrease toward center — ${centerSts} sts total to remove (schedule TBD).`,
            },
          ]
        : [];

    const shoulderActions: ShapingAction[] = [
      {
        startRC: neckStartRC + 1,
        endRC: neckStartRC + nRowsForNeckShoulder,
        text: "At armhole edge, work shoulder slope (short-rows or bind-offs — schedule TBD).",
      },
    ];

    neckExec = generateNeckShoulderExecution({
      startRC: neckStartRC,
      centerNeck: center,
      leftShoulder: todoNeedle("left shoulder stitches"),
      rightShoulder: todoNeedle("right shoulder stitches"),
      neckActions,
      shoulderActions,
    });
  }

  warnings.push(...neckExec.warnings);
  lines.push(
    ...rewriteNeckShoulderRcLines(filterNeckShoulderExecutionLines(neckExec.lines))
  );
  lines.push("");

  // --- 7. End ---
  lines.push("7. End of back piece");
  lines.push("Back is complete to this point — finishing and pickups are not included in this draft.");

  const armholeRowsTotal = armholePlan ? armholePlan.totalRows : 0;
  const totalCalculatedRows =
    hemRows + bodyToArmholeRows + armholeRowsTotal + upperBackRows + evenRowPadRows;

  if (totalGarmentRows > 0) {
    rc = totalGarmentRows;
  }

  const debug: SleevelessBackPatternDebug = {
    finishedBustChest:
      finishedBust > 0 ? finishedBust : undefined,
    stitchesPerInch,
    rowsPerInch,
    backStitches: castOnSts,
    shoulderWidthInches: shoulderWidthIn,
    stitchesAfterArmhole,
    armholeStitchesTotal,
    armholeStitchesEachSide,
    hemRows,
    bodyRows: bodyToArmholeRows,
    armholeRows: armholeRowsTotal,
    necklineShoulderRows: neckShoulderRowsEstimate,
    totalCalculatedRows,
    expectedGarmentRows: totalGarmentRows,
    backNeckToHem,
    armholeDepth: armholeDepthIn,
    bodyInchesToArmhole:
      rowGauge > 0 ? bodyToArmholeRows / rowGauge : undefined,
    reservedNecklineShoulderInches: neckShoulderInches,
    reservedNecklineShoulderRows: neckShoulderRowsEstimate,
    remainingRowsBeforeNeckline: upperBackRows,
    necklineWidthInches: neckWidthIn,
    necklineStitches,
    shoulderStitches,
    stitchesAfterNeckline,
    finalRC: rc,
  };

  let neckShoulderShapingChart: NeckShoulderShapingChart = DEMO_NECK_SHOULDER_SHAPING_CHART;
  let neckShoulderChartUsesLiveRows = false;

  if (
    necklineStitches !== undefined &&
    shoulderStitches !== undefined &&
    necklineStitches > 0 &&
    shoulderStitches > 0
  ) {
    const patternNumbers: NeckShoulderShapingPatternNumbers = {
      firstShapingRow: neckStartRC + 1,
      shoulderStitchesPerSide: shoulderStitches,
      centerNeckBindOff: necklineStitches,
      shapingWorkRows: nRowsForNeckShoulder,
    };
    const liveRows = buildNeckShoulderShapingChartRows(patternNumbers);
    if (liveRows.length > 0) {
      neckShoulderShapingChart = neckShoulderShapingChartFromRows(liveRows);
      neckShoulderChartUsesLiveRows = true;
    }
  }

  return {
    warnings,
    lines,
    debug,
    neckShoulderShapingChart,
    neckShoulderChartUsesLiveRows,
  };
}

/** Split generated back lines into UI sections (Back / Armholes / Neckline & shoulders). */
export type SleevelessBackOrganizedSlices = {
  /** BACK header, note, and sections 1–3 (through body to armhole). */
  throughBody: string[];
  /** Section 4 only. */
  armhole: string[];
  /** Sections 5–7 (upper back through end of back piece). */
  necklineShoulderEnd: string[];
};

export function sliceSleevelessBackPatternLines(lines: readonly string[]): SleevelessBackOrganizedSlices {
  const idx = (pred: (s: string) => boolean) => lines.findIndex(pred);
  const i4 = idx((l) => l.trim() === "4. Armhole shaping");
  const i5 = idx((l) => l.trim() === "5. Knit in pattern to neckline / shoulder start");
  if (i4 === -1 || i5 === -1) {
    return { throughBody: [...lines], armhole: [], necklineShoulderEnd: [] };
  }
  return {
    throughBody: lines.slice(0, i4),
    armhole: lines.slice(i4, i5),
    necklineShoulderEnd: lines.slice(i5),
  };
}

/**
 * Human-facing instruction line: hide internal TODO markers while keeping the sentence readable.
 */
export function sanitizeSleevelessPatternLineForDisplay(line: string): string {
  let s = line;
  s = s.replace(/\bTODO L\?/gi, "—").replace(/\bTODO R\?/gi, "—");
  s = s.replace(/\bTODO:?\s*/gi, "").replace(/\bTODO\b/gi, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Normalize mechanical RC display to `RC: 000` with optional space before trailing text. */
export function normalizeRcDisplayLine(line: string): string {
  let s = line;
  s = s.replace(/^RC\s+(\d{1,3})\b/, (_, d: string) => `RC: ${String(d).padStart(3, "0")}`);
  s = s.replace(/^RC:\s*(\d{1,3})\b/, (_, d: string) => `RC: ${String(d).padStart(3, "0")}`);
  return s;
}

/**
 * Demo with simple numbers for manual math checks (5 sts/in, 7 rows/in, 40" bust, etc.).
 */
export function demoSleevelessBackPattern(): SleevelessBackPatternResult {
  const sample: Record<string, unknown> = {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      recipientCategory: "misses",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
  return generateSleevelessBackPattern(sample);
}
