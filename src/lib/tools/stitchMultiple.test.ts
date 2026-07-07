import { describe, expect, it } from "vitest";
import {
  calculateStitchMultiple,
  formatDiff,
  formatRepeat,
  formatRepeats,
  parseWholeNumber,
} from "./stitchMultiple";

describe("parseWholeNumber", () => {
  it("parses non-negative integers", () => {
    expect(parseWholeNumber("124")).toBe(124);
    expect(parseWholeNumber(" 0 ")).toBe(0);
  });

  it("rejects empty, non-numeric, and non-integer input", () => {
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("   ")).toBeNull();
    expect(parseWholeNumber("abc")).toBeNull();
    expect(parseWholeNumber("3.5")).toBeNull();
  });
});

describe("calculateStitchMultiple", () => {
  it("returns an exact fit when it divides evenly (plus > 0)", () => {
    const result = calculateStitchMultiple({ castOn: 124, repeat: 3, plus: 1 });
    expect(result).toEqual({
      ok: true,
      exact: true,
      castOn: 124,
      repeat: 3,
      plus: 1,
      repeats: 41,
    });
  });

  it("returns an exact fit when plus = 0", () => {
    const result = calculateStitchMultiple({ castOn: 120, repeat: 4, plus: 0 });
    expect(result).toMatchObject({ ok: true, exact: true, repeats: 30 });
  });

  it("returns nearest lower and higher when it does not fit", () => {
    const result = calculateStitchMultiple({ castOn: 124, repeat: 3, plus: 2 });
    expect(result).toEqual({
      ok: true,
      exact: false,
      castOn: 124,
      repeat: 3,
      plus: 2,
      lower: { stitches: 122, repeats: 40, diff: -2 },
      higher: { stitches: 125, repeats: 41, diff: 1 },
    });
  });

  it("finds the nearest lower result correctly", () => {
    const result = calculateStitchMultiple({ castOn: 100, repeat: 6, plus: 0 });
    if (result.ok && !result.exact) {
      expect(result.lower).toEqual({ stitches: 96, repeats: 16, diff: -4 });
    } else {
      throw new Error("expected a non-exact result");
    }
  });

  it("finds the nearest higher result correctly", () => {
    const result = calculateStitchMultiple({ castOn: 100, repeat: 6, plus: 0 });
    if (result.ok && !result.exact) {
      expect(result.higher).toEqual({ stitches: 102, repeats: 17, diff: 2 });
    } else {
      throw new Error("expected a non-exact result");
    }
  });

  it("offers only a higher option when the cast-on is smaller than the repeat", () => {
    const result = calculateStitchMultiple({ castOn: 2, repeat: 5, plus: 0 });
    expect(result).toEqual({
      ok: true,
      exact: false,
      castOn: 2,
      repeat: 5,
      plus: 0,
      lower: null,
      higher: { stitches: 5, repeats: 1, diff: 3 },
    });
  });

  it("still offers a higher option when plus exceeds the cast-on", () => {
    const result = calculateStitchMultiple({ castOn: 3, repeat: 4, plus: 5 });
    if (result.ok && !result.exact) {
      expect(result.lower).toBeNull();
      expect(result.higher).toEqual({ stitches: 9, repeats: 1, diff: 6 });
    } else {
      throw new Error("expected a non-exact result");
    }
  });

  it("rejects invalid (non-integer) inputs", () => {
    const result = calculateStitchMultiple({ castOn: 124.5, repeat: 3, plus: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("rejects zero or negative cast-on and repeat", () => {
    const zero = calculateStitchMultiple({ castOn: 0, repeat: 0, plus: 0 });
    expect(zero.ok).toBe(false);
    if (!zero.ok) {
      expect(zero.errors).toHaveLength(2);
    }

    const negative = calculateStitchMultiple({ castOn: -10, repeat: 3, plus: -1 });
    expect(negative.ok).toBe(false);
    if (!negative.ok) {
      expect(negative.errors).toHaveLength(2);
    }
  });
});

describe("formatting helpers", () => {
  it("formats a repeat with and without plus stitches", () => {
    expect(formatRepeat(3, 1)).toBe("3 + 1");
    expect(formatRepeat(3, 0)).toBe("3");
  });

  it("pluralizes repeat counts", () => {
    expect(formatRepeats(41)).toBe("41 repeats");
    expect(formatRepeats(1)).toBe("1 repeat");
  });

  it("describes the cast-on adjustment", () => {
    expect(formatDiff(-2)).toBe("Cast on 2 fewer stitches");
    expect(formatDiff(1)).toBe("Cast on 1 more stitch");
    expect(formatDiff(3)).toBe("Cast on 3 more stitches");
    expect(formatDiff(0)).toBe("Same cast on");
  });
});
