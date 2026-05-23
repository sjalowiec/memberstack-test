/**
 * Sleeveless pattern row accounting — exact row counts are canonical; inches are derived.
 *
 * RC endpoints are **completed** row counts (RC 000 is not a knitted row).
 * Span rows = endRc − startRc (e.g. hem RC 000→022 = 22 rows).
 */

export type RowAccountingSeverity = "ok" | "rounding-warning" | "warning";

export type RowAccountingInput = {
  hemRows: number;
  bodyRows: number;
  /** Rows worked after the armhole RC reset through piece completion (upper body). */
  armholeRows: number;
  rowsPerInch: number;
  totalLengthInches: number;
};

export type RowAccountingResult = {
  hemRows: number;
  bodyRows: number;
  armholeRows: number;
  totalInstructionRows: number;
  expectedRowsFromLength: number;
  rowDifference: number;
  rowsPerInch: number;
  totalLengthInches: number;
  severity: RowAccountingSeverity;
};

/** Rows worked from `startRc` (exclusive of row 0 as a knit row) to `endRc` (inclusive completed count). */
export function rowsWorkedBetweenRc(startRc: number, endRc: number): number {
  const start = Math.max(0, Math.floor(startRc));
  const end = Math.max(0, Math.floor(endRc));
  return Math.max(0, end - start);
}

export function rowsToInches(rows: number, rowsPerInch: number): number | undefined {
  if (!Number.isFinite(rows) || !Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    return undefined;
  }
  return rows / rowsPerInch;
}

export function inchesToRows(inches: number, rowsPerInch: number): number {
  if (!Number.isFinite(inches) || !Number.isFinite(rowsPerInch) || rowsPerInch <= 0) {
    return 0;
  }
  return Math.round(inches * rowsPerInch);
}

/** Expected total rows from finished length × row gauge (single budget target). */
export function expectedRowsFromFinishedLength(
  totalLengthInches: number,
  rowsPerInch: number,
): number {
  return inchesToRows(totalLengthInches, rowsPerInch);
}

export function totalInstructionRowsFromSections(
  hemRows: number,
  bodyRows: number,
  armholeRows: number,
): number {
  const hem = Math.max(0, Math.floor(hemRows));
  const body = Math.max(0, Math.floor(bodyRows));
  const armhole = Math.max(0, Math.floor(armholeRows));
  return hem + body + armhole;
}

function classifyRowDifference(absDiff: number): RowAccountingSeverity {
  if (absDiff <= 1) return "ok";
  if (absDiff <= 3) return "rounding-warning";
  return "warning";
}

export function validateRowAccounting(input: RowAccountingInput): RowAccountingResult {
  const hemRows = Math.max(0, Math.floor(input.hemRows));
  const bodyRows = Math.max(0, Math.floor(input.bodyRows));
  const armholeRows = Math.max(0, Math.floor(input.armholeRows));
  const rowsPerInch = input.rowsPerInch;
  const totalLengthInches = input.totalLengthInches;
  const totalInstructionRows = totalInstructionRowsFromSections(hemRows, bodyRows, armholeRows);
  const expectedRowsFromLength = expectedRowsFromFinishedLength(totalLengthInches, rowsPerInch);
  const rowDifference = totalInstructionRows - expectedRowsFromLength;
  const severity = classifyRowDifference(Math.abs(rowDifference));

  return {
    hemRows,
    bodyRows,
    armholeRows,
    totalInstructionRows,
    expectedRowsFromLength,
    rowDifference,
    rowsPerInch,
    totalLengthInches,
    severity,
  };
}

export type FormatRowsAndInchesOptions = {
  unit?: "in" | "cm";
  /** Decimal places for fractional inch/cm display (default 1). */
  decimals?: number;
};

function formatLengthNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return String(rounded);
  const factor = 10 ** decimals;
  const one = Math.round(n * factor) / factor;
  return String(one).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/**
 * Display label from exact row count (inches derived from rows, not the reverse).
 * Returns e.g. `"146 rows (13.3 in)"` or rows-only when gauge is missing.
 */
export function formatRowsAndInches(
  rows: number,
  rowsPerInch: number,
  options?: FormatRowsAndInchesOptions,
): string {
  const rowN = Math.max(0, Math.round(rows));
  const inches = rowsToInches(rowN, rowsPerInch);
  if (inches === undefined) return `${rowN} rows`;
  const unit = options?.unit ?? "in";
  const decimals = options?.decimals ?? 1;
  const length = unit === "cm" ? inches * 2.54 : inches;
  const unitLabel = unit === "cm" ? "cm" : "in";
  return `${rowN} rows (${formatLengthNumber(length, decimals)} ${unitLabel})`;
}

/** Derive inch/cm length from rows for diagram tokens (no independent measurement rounding). */
export function lengthFromRowsForDiagram(
  rows: number,
  rowsPerInch: number,
  unit: "in" | "cm",
): number | undefined {
  const inches = rowsToInches(rows, rowsPerInch);
  if (inches === undefined) return undefined;
  return unit === "cm" ? inches * 2.54 : inches;
}

export type SleevelessRowAccountingDebugSlice = {
  hemRows?: number;
  bodyRows?: number;
  armholeRows?: number;
  armholeShapingRows?: number;
  rowsFromCastOnToArmholeStart?: number;
  armholeStartRow?: number;
  backFinalRow?: number;
  backNeckToHem?: number;
  rowsPerInch?: number;
};

/**
 * Post-armhole rows on the armhole counter: garment RC span from armhole start to final RC.
 * Matches local Armhole RC at completion (final garment RC − armhole start RC).
 */
export function resolveArmholeInstructionRows(
  d: SleevelessRowAccountingDebugSlice,
): number | undefined {
  const start = d.armholeStartRow;
  const end = d.backFinalRow;
  if (typeof start === "number" && Number.isFinite(start) && typeof end === "number" && Number.isFinite(end)) {
    return rowsWorkedBetweenRc(start, end);
  }
  if (typeof d.armholeShapingRows === "number" && Number.isFinite(d.armholeShapingRows)) {
    return Math.max(0, Math.round(d.armholeShapingRows));
  }
  if (typeof d.armholeRows === "number" && Number.isFinite(d.armholeRows)) {
    return Math.max(0, Math.round(d.armholeRows));
  }
  return undefined;
}

/** Total knitted rows: hem + body + upper body after armhole reset. */
export function resolveTotalInstructionRows(
  d: SleevelessRowAccountingDebugSlice,
): number | undefined {
  const hem = d.hemRows;
  const body = d.bodyRows;
  const armhole = resolveArmholeInstructionRows(d);
  if (
    typeof hem === "number" &&
    Number.isFinite(hem) &&
    typeof body === "number" &&
    Number.isFinite(body) &&
    typeof armhole === "number" &&
    Number.isFinite(armhole)
  ) {
    return totalInstructionRowsFromSections(hem, body, armhole);
  }
  const castOnToArmhole = d.rowsFromCastOnToArmholeStart;
  if (
    typeof castOnToArmhole === "number" &&
    Number.isFinite(castOnToArmhole) &&
    typeof armhole === "number" &&
    Number.isFinite(armhole)
  ) {
    return castOnToArmhole + armhole;
  }
  return undefined;
}

export function buildRowAccountingInputFromDebug(
  d: SleevelessRowAccountingDebugSlice,
): RowAccountingInput | undefined {
  const rowsPerInch = d.rowsPerInch;
  const totalLengthInches = d.backNeckToHem;
  const hemRows = d.hemRows;
  const bodyRows = d.bodyRows;
  const armholeRows = resolveArmholeInstructionRows(d);
  if (
    typeof rowsPerInch !== "number" ||
    !Number.isFinite(rowsPerInch) ||
    rowsPerInch <= 0 ||
    typeof totalLengthInches !== "number" ||
    !Number.isFinite(totalLengthInches) ||
    totalLengthInches <= 0 ||
    typeof hemRows !== "number" ||
    !Number.isFinite(hemRows) ||
    typeof bodyRows !== "number" ||
    !Number.isFinite(bodyRows) ||
    typeof armholeRows !== "number" ||
    !Number.isFinite(armholeRows)
  ) {
    return undefined;
  }
  return {
    hemRows,
    bodyRows,
    armholeRows,
    rowsPerInch,
    totalLengthInches,
  };
}

function isDevEnvironment(): boolean {
  return typeof import.meta !== "undefined" && import.meta.env?.DEV === true;
}

/** Dev-only — logs when instruction rows drift from length × gauge. */
export function warnRowAccountingDriftIfDev(
  result: RowAccountingResult,
  context = "sleeveless",
): void {
  if (!isDevEnvironment()) return;
  if (result.severity === "ok") return;
  if (typeof console === "undefined" || typeof console.warn !== "function") return;
  console.warn(`[${context}] sleeveless row accounting drift`, {
    hemRows: result.hemRows,
    bodyRows: result.bodyRows,
    armholeRows: result.armholeRows,
    totalInstructionRows: result.totalInstructionRows,
    expectedRowsFromLength: result.expectedRowsFromLength,
    rowDifference: result.rowDifference,
    rowsPerInch: result.rowsPerInch,
    totalLengthInches: result.totalLengthInches,
    severity: result.severity,
  });
}
