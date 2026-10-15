/**
 * Parenthetical row-counter list for written shaping instructions.
 *
 * `(RC: 006, 012, 018)` — `RC:` once, each reading three digits.
 * Individual headings stay `RC: 006`. This helper is only the list.
 */

/** Same three-digit reading as a pattern heading (`RC: 006`). */
function rcReadingDigits(rc: number): string {
  const n = Math.max(0, Math.floor(rc));
  return String(n).padStart(3, "0");
}

/** `(RC: 006, 012, 018)`. An empty list is `(RC: )`; callers skip that case. */
export function formatParentheticalRcList(rows: readonly number[]): string {
  return `(RC: ${rows.map(rcReadingDigits).join(", ")})`;
}

/**
 * Collapse a parenthetical RC list so the label appears once and every reading is three digits.
 * `(RC: 006, RC: 012)` and `(RC: 6, 12)` both become `(RC: 006, 012)`.
 * Headings outside parentheses are left alone.
 */
const PARENTHETICAL_RC_LIST =
  /\(RC:\s*((?:RC:\s*)?\d+(?:\s*,\s*(?:RC:\s*)?\d+)*)\)/gi;

export function normalizeParentheticalRcLists(text: string): string {
  return text.replace(PARENTHETICAL_RC_LIST, (match, list: string) => {
    const parts = list
      .split(",")
      .map((part) => part.replace(/RC:\s*/gi, "").trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0 || parts.some((part) => !/^\d+$/.test(part))) return match;
    return formatParentheticalRcList(parts.map((part) => Number(part)));
  });
}
