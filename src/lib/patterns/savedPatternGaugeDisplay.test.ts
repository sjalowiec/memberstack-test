import { describe, expect, it } from "vitest";
import {
  extractSavedPatternGauge,
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
