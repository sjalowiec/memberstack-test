/**
 * One pattern_printed event per user print action.
 * Several listeners can call print in the same click (button plus modal, or a
 * double-bound Print control). Later calls in that burst are ignored.
 */
const PATTERN_PRINT_DEDUPE_MS = 1500;
const PATTERN_PRINT_AT_KEY = "__kbmPatternPrintAt";

type PrintClock = { [PATTERN_PRINT_AT_KEY]?: number };

function printClock(): PrintClock {
  return globalThis as PrintClock;
}

export function resetPatternPrintActivityDedupe(): void {
  printClock()[PATTERN_PRINT_AT_KEY] = 0;
}

/**
 * True only for the first print call in a short burst.
 * Stored on globalThis so duplicate script copies share one clock.
 */
export function shouldRecordPatternPrint(now = Date.now()): boolean {
  const clock = printClock();
  const last = clock[PATTERN_PRINT_AT_KEY] ?? 0;
  if (now - last < PATTERN_PRINT_DEDUPE_MS) return false;
  clock[PATTERN_PRINT_AT_KEY] = now;
  return true;
}
