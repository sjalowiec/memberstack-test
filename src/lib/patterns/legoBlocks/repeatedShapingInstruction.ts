/**
 * Repeated shaping instruction — one sentence for a uniform increase, decrease,
 * bind-off, or hold.
 *
 * The caller supplies the shaping-row readings. This formatter does not schedule
 * rows or change stitch counts. Rows knitted between shaping rows are not listed;
 * the interval states that rhythm. Non-uniform gaps return null so a sequence that
 * needs carriage side, changing amounts, or a second action on the same row can
 * keep its own wording.
 */

import { formatRcColon } from "../sleevelessPatternOutput";

export type RepeatedShapingAction = "increase" | "decrease" | "bind-off" | "hold";

export type RepeatedShapingInstruction = {
  action: RepeatedShapingAction;
  /** Stitches shaped at the named edge on each shaping row. */
  stitchesPerAction: number;
  /** Placement after "at", e.g. "each armhole edge" or "the armhole edge". */
  edgePhrase: string;
  /** Rows from one shaping row to the next. 2 is "every other row". */
  interval: number;
  /** Shaping rows only, in the order they are worked. The list is the repetition count. */
  actionRows: readonly number[];
};

function positiveWhole(n: number): boolean {
  return Number.isInteger(n) && n > 0;
}

function rowsMatchInterval(rows: readonly number[], interval: number): boolean {
  if (rows.length === 0 || !rows.every((rc) => Number.isInteger(rc) && rc >= 0)) return false;
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index]! - rows[index - 1]! !== interval) return false;
  }
  return true;
}

function intervalPhrase(interval: number): string {
  if (interval <= 1) return "every row";
  if (interval === 2) return "every other row";
  return `every ${interval} rows`;
}

function actionClause(action: RepeatedShapingAction, stitches: number, edgePhrase: string): string {
  const stitchWord = stitches === 1 ? "stitch" : "stitches";
  const at = `at ${edgePhrase}`;
  if (action === "increase") return `Increase ${stitches} ${stitchWord} ${at}`;
  if (action === "decrease") return `Decrease ${stitches} ${stitchWord} ${at}`;
  if (action === "bind-off") return `Bind off ${stitches} ${stitchWord} ${at}`;
  return `Put ${stitches} ${stitchWord} in hold ${at}`;
}

/**
 * Concise repeated-shaping sentence, or null when the readings are not one uniform interval.
 * Example: `Decrease 1 stitch at each armhole edge every other row, 4 times (RC: 006, RC: 008, RC: 010, RC: 012).`
 */
export function formatRepeatedShapingInstruction(input: RepeatedShapingInstruction): string | null {
  const edge = input.edgePhrase.trim();
  const rows = input.actionRows;
  if (!edge || !positiveWhole(input.stitchesPerAction) || !positiveWhole(input.interval)) return null;
  if (!rowsMatchInterval(rows, input.interval)) return null;
  const times = rows.length === 1 ? "time" : "times";
  const listed = rows.map((rc) => formatRcColon(rc)).join(", ");
  return `${actionClause(input.action, input.stitchesPerAction, edge)} ${intervalPhrase(input.interval)}, ${rows.length} ${times} (${listed}).`;
}
