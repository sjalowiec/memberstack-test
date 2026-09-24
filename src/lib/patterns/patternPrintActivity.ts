/**
 * One pattern_printed event per user print action.
 * Several listeners can call print in the same click (button plus modal, or a
 * double-bound Print control). Later calls in that burst are ignored.
 */
const PATTERN_PRINT_DEDUPE_MS = 1500;

let lastPatternPrintAt = 0;

export function resetPatternPrintActivityDedupe(): void {
  lastPatternPrintAt = 0;
}

/** True only for the first print call in a short burst. */
export function shouldRecordPatternPrint(now = Date.now()): boolean {
  if (now - lastPatternPrintAt < PATTERN_PRINT_DEDUPE_MS) return false;
  lastPatternPrintAt = now;
  return true;
}
