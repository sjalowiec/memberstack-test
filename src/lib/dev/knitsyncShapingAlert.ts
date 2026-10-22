/**
 * When the KnitSync proof of concept should beep and highlight a shaping row.
 * Audio playback stays in the page. This module only decides.
 */
import {
  clampCompletedRows,
  type KnitSyncPattern,
  type KnitSyncRowKind,
} from "./knitsyncPattern";

export interface ShapingAlertInput {
  pattern: KnitSyncPattern;
  fromCompleted: number;
  toCompleted: number;
  soundEnabled: boolean;
  /** Pattern row numbers that have already played an alert. */
  alertedRows: readonly number[];
}

export interface ShapingAlertDecision {
  alert: boolean;
  /** Pattern row to highlight, or null when the next row is ordinary knitting. */
  highlightRow: number | null;
  alertedRows: readonly number[];
}

/** Decrease, increase, bind-off, and any later non-knit action. */
export function isShapingAction(kind: KnitSyncRowKind): boolean {
  return kind !== "knit";
}

export function shapingHighlightRow(pattern: KnitSyncPattern, completedRows: number): number | null {
  const total = pattern.rows.length;
  const completed = clampCompletedRows(completedRows, total);
  if (completed >= total) return null;
  const next = pattern.rows[completed];
  if (!next || !isShapingAction(next.kind)) return null;
  return next.row;
}

/**
 * Beep only when the counter moves forward onto a shaping row that has not
 * already been alerted. Reversals, repeats, and ordinary rows update the
 * highlight without a beep.
 */
export function shapingAlertDecision(input: ShapingAlertInput): ShapingAlertDecision {
  const total = input.pattern.rows.length;
  const from = clampCompletedRows(input.fromCompleted, total);
  const to = clampCompletedRows(input.toCompleted, total);
  const highlightRow = shapingHighlightRow(input.pattern, to);
  const alreadyAlerted = highlightRow != null && input.alertedRows.includes(highlightRow);
  const alert = input.soundEnabled && to > from && highlightRow != null && !alreadyAlerted;
  return {
    alert,
    highlightRow,
    alertedRows: alert && highlightRow != null ? [...input.alertedRows, highlightRow] : input.alertedRows,
  };
}
