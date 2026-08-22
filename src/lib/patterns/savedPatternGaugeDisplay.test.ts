import { describe, expect, it } from "vitest";
import {
  extractSavedHatGauge,
  extractSavedPatternGauge,
  extractSavedProjectGauge,
  formatSavedPatternGauge,
  SAVED_PATTERN_GAUGE_FALLBACK_TEXT,
} from "./savedPatternGaugeDisplay";

describe("extractSavedPatternGauge", () => {
  it("prefers stored per-inch values", () => {
    expect(extractSavedPatternGauge({ stitchGauge: "7", rowGauge: "11" })).toEqual({
      stitchesPerInch: 7,
      rowsPerInch: 11,
    });
  });

  it("keeps decimal per-inch values", () => {
    expect(extractSavedPatternGauge({ stitchGauge: "7.5", rowGauge: "10.25" })).toEqual({
      stitchesPerInch: 7.5,
      rowsPerInch: 10.25,
    });
  });

  it("keeps original entered swatch counts for display over 4 inches", () => {
    expect(
      extractSavedPatternGauge({ gaugeStitchRaw: "28", gaugeRowRaw: "44", gaugeRawUnit: "in" }),
    ).toEqual({
      stitchesPerInch: 7,
      rowsPerInch: 11,
      displayStitches: 28,
      displayRows: 44,
    });
  });

  it("prefers entered swatch counts for display when both raw and per-inch are stored", () => {
    expect(
      extractSavedPatternGauge({
        gaugeStitchRaw: "28",
        gaugeRowRaw: "44",
        gaugeRawUnit: "in",
        stitchGauge: "7",
        rowGauge: "11",
      }),
    ).toEqual({
      stitchesPerInch: 7,
      rowsPerInch: 11,
      displayStitches: 28,
      displayRows: 44,
    });
    expect(
      formatSavedPatternGauge(
        extractSavedPatternGauge({
          gaugeStitchRaw: "28",
          gaugeRowRaw: "44",
          gaugeRawUnit: "in",
          stitchGauge: "7",
          rowGauge: "11",
        }),
      ),
    ).toBe("28 sts / 44 rows");
  });

  it("derives per-inch from raw swatch counts over 10 cm", () => {
    const gauge = extractSavedPatternGauge({
      gaugeStitchRaw: "20",
      gaugeRowRaw: "30",
      gaugeRawUnit: "cm",
    });
    expect(gauge?.stitchesPerInch).toBeCloseTo((20 / 10) * 2.54, 5);
    expect(gauge?.rowsPerInch).toBeCloseTo((30 / 10) * 2.54, 5);
    expect(gauge?.displayStitches).toBe(20);
    expect(gauge?.displayRows).toBe(30);
  });

  it("returns null for missing or invalid gauge", () => {
    expect(extractSavedPatternGauge(undefined)).toBeNull();
    expect(extractSavedPatternGauge({})).toBeNull();
    expect(extractSavedPatternGauge({ stitchGauge: "0", rowGauge: "11" })).toBeNull();
    expect(extractSavedPatternGauge({ stitchGauge: "abc", rowGauge: "11" })).toBeNull();
  });
});

describe("extractSavedHatGauge", () => {
  it("reads inches gaugeSlots from a saved Hat draft", () => {
    expect(
      extractSavedHatGauge({
        patternType: "hat",
        patternSystem: "hat",
        unit: "inches",
        gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
      }),
    ).toEqual({
      stitchesPerInch: 1.25,
      rowsPerInch: 1.75,
      displayStitches: 5,
      displayRows: 7,
    });
    expect(
      formatSavedPatternGauge(
        extractSavedHatGauge({
          patternType: "hat",
          gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
        }),
      ),
    ).toBe("5 sts / 7 rows");
  });

  it("uses the cm slot when that is the saved unit", () => {
    const gauge = extractSavedHatGauge({
      patternType: "hat",
      unit: "cm",
      gaugeSlots: { inches: { stitch: "", row: "" }, cm: { stitch: "20", row: "28" } },
    });
    expect(gauge?.displayStitches).toBe(20);
    expect(gauge?.displayRows).toBe(28);
    expect(gauge?.stitchesPerInch).toBeCloseTo((20 / 10) * 2.54, 5);
  });

  it("falls back to the other slot when the preferred unit is empty", () => {
    expect(
      extractSavedHatGauge({
        patternType: "hat",
        unit: "cm",
        gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
      })?.displayStitches,
    ).toBe(5);
  });

  it("returns null when the saved Hat has no usable gaugeSlots", () => {
    expect(
      extractSavedHatGauge({
        patternType: "hat",
        gaugeSlots: { inches: { stitch: "", row: "" }, cm: { stitch: "", row: "" } },
      }),
    ).toBeNull();
    expect(formatSavedPatternGauge(extractSavedHatGauge({ patternType: "hat" }))).toBe(
      SAVED_PATTERN_GAUGE_FALLBACK_TEXT,
    );
  });
});

describe("extractSavedProjectGauge", () => {
  it("does not treat a Hat with valid gaugeSlots as Gauge not set", () => {
    const gauge = extractSavedProjectGauge({
      patternSystem: "hat",
      pattern: {
        patternType: "hat",
        patternSystem: "hat",
        unit: "inches",
        gaugeSlots: { inches: { stitch: "5", row: "7" }, cm: { stitch: "", row: "" } },
      },
    });
    expect(gauge).not.toBeNull();
    expect(formatSavedPatternGauge(gauge)).not.toBe(SAVED_PATTERN_GAUGE_FALLBACK_TEXT);
    expect(formatSavedPatternGauge(gauge)).toBe("5 sts / 7 rows");
  });

  it("still reads sweater yarnGauge for non-hat projects", () => {
    expect(
      extractSavedProjectGauge({
        patternSystem: "sleeveless",
        pattern: { yarnGauge: { gaugeStitchRaw: "28", gaugeRowRaw: "44", gaugeRawUnit: "in" } },
      }),
    ).toMatchObject({ displayStitches: 28, displayRows: 44 });
  });
});

describe("formatSavedPatternGauge", () => {
  it("formats whole-number gauge", () => {
    expect(formatSavedPatternGauge({ stitchesPerInch: 7, rowsPerInch: 11 })).toBe(
      "7 sts / 11 rows",
    );
    expect(
      formatSavedPatternGauge({
        stitchesPerInch: 7,
        rowsPerInch: 11,
        displayStitches: 28,
        displayRows: 44,
      }),
    ).toBe("28 sts / 44 rows");
  });

  it("formats decimal gauge with trimmed trailing zeros", () => {
    expect(formatSavedPatternGauge({ stitchesPerInch: 7.5, rowsPerInch: 10.25 })).toBe(
      "7.5 sts / 10.25 rows",
    );
  });

  it("falls back gracefully when gauge is missing", () => {
    expect(formatSavedPatternGauge(null)).toBe(SAVED_PATTERN_GAUGE_FALLBACK_TEXT);
    expect(formatSavedPatternGauge(undefined)).toBe("Gauge not set");
  });
});
