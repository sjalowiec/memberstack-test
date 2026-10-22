/**
 * Fixed KnitSync swatch for the dev-only interactive pattern test.
 * Row selection uses the Bluetooth row-counter rules. This module does not
 * read pattern builders, saved patterns, or instructions.
 */
import {
  applyRowCounterKey,
  normalizeRowCount,
  stepRowCount,
  type RowCounterDirection,
  type RowCounterKeyDecision,
  type RowCounterKeyInput,
} from "./bluetoothRowCounter";

export type CarriageSide = "left" | "right";
export type KnitSyncRowKind = "knit" | "decrease" | "increase" | "bind-off";

export interface KnitSyncPatternRow {
  row: number;
  kind: KnitSyncRowKind;
  /** Side the carriage is on before this row is knitted. */
  carriageSide: CarriageSide;
  stitchesBefore: number;
  stitchesAfter: number;
  /** One line for the previous and upcoming slots. */
  summary: string;
  /** Full instruction, shown before the knitter works this row. */
  instruction: string;
}

export interface KnitSyncPattern {
  name: string;
  castOnStitches: number;
  /** Carriage side after cast-on, before row 1. */
  startingCarriageSide: CarriageSide;
  rows: readonly KnitSyncPatternRow[];
}

export interface KnitSyncInstructionView {
  completedRows: number;
  totalRows: number;
  complete: boolean;
  /** Next pattern row to knit. Null when every row is already knitted. */
  currentRow: number | null;
  previousRow: number | null;
  upcomingRow: number | null;
  progressLabel: string;
  heading: string;
  metaLabel: string;
  previousText: string;
  currentText: string;
  upcomingText: string;
  canReverse: boolean;
  canAdvance: boolean;
}

/**
 * Explicit row actions for a 40-stitch swatch.
 * Odd rows start with the carriage on the right; even rows start on the left.
 * Each decrease or increase is one stitch on the carriage-side edge, worked
 * before that row is knitted. The return row shapes the other edge.
 */
const SWATCH_ROW_KINDS = [
  "knit",
  "knit",
  "knit",
  "knit",
  "knit",
  "knit",
  "decrease",
  "decrease",
  "knit",
  "knit",
  "knit",
  "knit",
  "increase",
  "increase",
  "knit",
  "knit",
  "knit",
  "knit",
  "knit",
  "knit",
] as const satisfies readonly KnitSyncRowKind[];

const CAST_ON_STITCHES = 40;
const STARTING_CARRIAGE: CarriageSide = "right";

function oppositeSide(side: CarriageSide): CarriageSide {
  return side === "right" ? "left" : "right";
}

function carriageSideForRow(row: number, startingSide: CarriageSide): CarriageSide {
  return row % 2 === 1 ? startingSide : oppositeSide(startingSide);
}

function stitchDelta(kind: KnitSyncRowKind): number {
  if (kind === "decrease") return -1;
  if (kind === "increase") return 1;
  return 0;
}

function summaryFor(row: KnitSyncPatternRow): string {
  const side = row.carriageSide;
  if (row.kind === "decrease") {
    return `Row ${row.row} · Decrease 1 at the ${side} edge · ${row.stitchesBefore} to ${row.stitchesAfter}`;
  }
  if (row.kind === "increase") {
    return `Row ${row.row} · Increase 1 at the ${side} edge · ${row.stitchesBefore} to ${row.stitchesAfter}`;
  }
  return `Row ${row.row} · Knit · carriage on the ${side} · ${row.stitchesBefore} stitches`;
}

function instructionFor(row: Pick<KnitSyncPatternRow, "kind" | "carriageSide" | "stitchesBefore" | "stitchesAfter">): string {
  const side = row.carriageSide;
  const placed = `${row.stitchesBefore} stitches. Carriage on the ${side}.`;
  if (row.kind === "decrease") {
    return (
      `${placed} Before knitting this row, transfer the ${side}-edge stitch one needle inward ` +
      `and leave the empty needle out of work. Knit the row. ${row.stitchesAfter} stitches remain.`
    );
  }
  if (row.kind === "increase") {
    return (
      `${placed} Before knitting this row, move the ${side}-edge stitch one needle outward ` +
      `and hang a stitch on the empty needle. Knit the row. ${row.stitchesAfter} stitches remain.`
    );
  }
  return `${placed} Knit the row.`;
}

function buildSwatchRows(): KnitSyncPatternRow[] {
  let stitches = CAST_ON_STITCHES;
  return SWATCH_ROW_KINDS.map((kind, index) => {
    const rowNumber = index + 1;
    const stitchesBefore = stitches;
    const stitchesAfter = stitchesBefore + stitchDelta(kind);
    const row: KnitSyncPatternRow = {
      row: rowNumber,
      kind,
      carriageSide: carriageSideForRow(rowNumber, STARTING_CARRIAGE),
      stitchesBefore,
      stitchesAfter,
      summary: "",
      instruction: "",
    };
    row.summary = summaryFor(row);
    row.instruction = instructionFor(row);
    stitches = stitchesAfter;
    return row;
  });
}

export const KNITSYNC_SWATCH: KnitSyncPattern = {
  name: "20-row shaping swatch",
  castOnStitches: CAST_ON_STITCHES,
  startingCarriageSide: STARTING_CARRIAGE,
  rows: buildSwatchRows(),
};

export function clampCompletedRows(completedRows: number, totalRows: number): number {
  const total = normalizeRowCount(totalRows);
  return Math.min(normalizeRowCount(completedRows), total);
}

export function completedRowsAfterStep(
  completedRows: number,
  direction: RowCounterDirection,
  totalRows: number,
): number {
  const base = clampCompletedRows(completedRows, totalRows);
  return clampCompletedRows(stepRowCount(base, direction), totalRows);
}

export function completedRowsAfterKey(
  completedRows: number,
  input: RowCounterKeyInput,
  totalRows: number,
): { completedRows: number; decision: RowCounterKeyDecision } {
  const base = clampCompletedRows(completedRows, totalRows);
  const applied = applyRowCounterKey(base, input);
  return {
    completedRows: clampCompletedRows(applied.rows, totalRows),
    decision: applied.decision,
  };
}

function rowLabel(count: number): string {
  return count === 1 ? "1 row completed" : `${count} rows completed`;
}

export function selectKnitSyncInstruction(
  pattern: KnitSyncPattern,
  completedRows: number,
): KnitSyncInstructionView {
  const totalRows = pattern.rows.length;
  const completed = clampCompletedRows(completedRows, totalRows);
  const complete = completed >= totalRows;
  const current = complete ? null : pattern.rows[completed] ?? null;
  const previous = completed === 0 ? null : pattern.rows[completed - 1] ?? null;
  const upcoming =
    current && completed + 1 < totalRows ? pattern.rows[completed + 1] ?? null : null;
  const last = pattern.rows[totalRows - 1];
  const endingSide = last ? oppositeSide(last.carriageSide) : pattern.startingCarriageSide;

  return {
    completedRows: completed,
    totalRows,
    complete,
    currentRow: current?.row ?? null,
    previousRow: previous?.row ?? null,
    upcomingRow: upcoming?.row ?? null,
    progressLabel: rowLabel(completed),
    heading: complete || !current ? "Pattern complete" : `Row ${current.row} of ${totalRows}`,
    metaLabel: complete
      ? `${last?.stitchesAfter ?? pattern.castOnStitches} stitches · Carriage is on the ${endingSide}`
      : `${current?.stitchesBefore ?? pattern.castOnStitches} stitches on the machine · Carriage on the ${current?.carriageSide ?? pattern.startingCarriageSide}`,
    previousText: previous
      ? previous.summary
      : `Cast on ${pattern.castOnStitches} stitches. Carriage is on the ${pattern.startingCarriageSide}.`,
    currentText: current
      ? current.instruction
      : `All ${totalRows} rows are knitted. ${last?.stitchesAfter ?? pattern.castOnStitches} stitches. Carriage is on the ${endingSide}.`,
    upcomingText: upcoming ? upcoming.summary : "None",
    canReverse: completed > 0,
    canAdvance: !complete,
  };
}
