/**
 * Stitch Multiple Calculator — core logic (UI-free so it can be unit tested).
 *
 * A stitch pattern repeat is written as "repeat + plus" (e.g. "3 + 1"), meaning
 * the pattern repeats every `repeat` stitches and finishes with `plus` extra
 * stitches. A cast-on count fits when (castOn - plus) divides evenly by `repeat`
 * with at least one full repeat.
 */

export type StitchMultipleInput = {
  castOn: number;
  repeat: number;
  plus: number;
};

export type StitchCountOption = {
  /** Total stitches for this option. */
  stitches: number;
  /** Number of complete pattern repeats at this stitch count. */
  repeats: number;
  /** Difference from the original cast-on (negative = fewer, positive = more). */
  diff: number;
};

export type StitchMultipleResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      exact: true;
      castOn: number;
      repeat: number;
      plus: number;
      repeats: number;
    }
  | {
      ok: true;
      exact: false;
      castOn: number;
      repeat: number;
      plus: number;
      lower: StitchCountOption | null;
      higher: StitchCountOption | null;
    };

/**
 * Parse a whole-number field. Returns null when empty, not a number, or not a
 * non-negative integer.
 */
export function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
  return value;
}

function makeOption(repeats: number, repeat: number, plus: number, castOn: number): StitchCountOption {
  const stitches = repeats * repeat + plus;
  return { stitches, repeats, diff: stitches - castOn };
}

/**
 * Determine whether a cast-on fits a stitch pattern repeat, and if not, find the
 * nearest lower and higher valid stitch counts.
 */
export function calculateStitchMultiple(input: StitchMultipleInput): StitchMultipleResult {
  const { castOn, repeat, plus } = input;
  const errors: string[] = [];

  if (!Number.isInteger(castOn) || castOn <= 0) {
    errors.push("Enter a cast-on stitch count greater than zero.");
  }
  if (!Number.isInteger(repeat) || repeat <= 0) {
    errors.push("Enter a stitch pattern repeat greater than zero.");
  }
  if (!Number.isInteger(plus) || plus < 0) {
    errors.push("Plus stitches must be zero or greater.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const base = castOn - plus;

  // Exact fit: divides evenly with at least one complete repeat.
  if (base > 0 && base % repeat === 0) {
    return {
      ok: true,
      exact: true,
      castOn,
      repeat,
      plus,
      repeats: base / repeat,
    };
  }

  const lowerRepeats = Math.floor(base / repeat);
  const lower = lowerRepeats >= 1 ? makeOption(lowerRepeats, repeat, plus, castOn) : null;

  const higherRepeats = Math.max(lowerRepeats + 1, 1);
  const higher = makeOption(higherRepeats, repeat, plus, castOn);

  return {
    ok: true,
    exact: false,
    castOn,
    repeat,
    plus,
    lower,
    higher,
  };
}

/** Format a repeat as "3 + 1", or just "3" when there are no plus stitches. */
export function formatRepeat(repeat: number, plus: number): string {
  return plus > 0 ? `${repeat} + ${plus}` : `${repeat}`;
}

/** Pluralize the repeat count, e.g. "41 repeats" / "1 repeat". */
export function formatRepeats(repeats: number): string {
  return `${repeats} repeat${repeats === 1 ? "" : "s"}`;
}

/** Human-readable cast-on adjustment, e.g. "Cast on 2 fewer stitches". */
export function formatDiff(diff: number): string {
  if (diff === 0) return "Same cast on";
  const count = Math.abs(diff);
  const noun = count === 1 ? "stitch" : "stitches";
  const direction = diff < 0 ? "fewer" : "more";
  return `Cast on ${count} ${direction} ${noun}`;
}
