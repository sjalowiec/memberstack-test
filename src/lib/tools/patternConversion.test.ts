import { describe, expect, it } from "vitest";
import { calculatePatternConversion } from "./patternConversion";
import { renderConversionResults } from "./patternConversionResults";

describe("calculatePatternConversion", () => {
  it("converts pattern stitch and row counts using gauge ratios", () => {
    const result = calculatePatternConversion({
      patternGauge: { stitches: 16, rows: 24 },
      myGauge: { stitches: 20, rows: 30 },
      patternStitchCount: 99,
      patternRowCount: 120,
    });

    expect(result.ratios?.stitchRatio).toBe(1.25);
    expect(result.ratios?.rowRatio).toBe(1.25);
    expect(result.stitchConversion?.convertedValue).toBe(124);
    expect(result.rowConversion?.convertedValue).toBe(150);
  });

  it("converts 100 pattern stitches at 17/22 gauge to 106 stitches", () => {
    const result = calculatePatternConversion({
      patternGauge: { stitches: 16, rows: 24 },
      myGauge: { stitches: 17, rows: 22 },
      patternStitchCount: 100,
    });

    expect(result.stitchConversion?.convertedValue).toBe(106);
  });

  it("converts 50 pattern rows at 17/22 gauge to 46 rows", () => {
    const result = calculatePatternConversion({
      patternGauge: { stitches: 16, rows: 24 },
      myGauge: { stitches: 17, rows: 22 },
      patternRowCount: 50,
    });

    expect(result.rowConversion?.convertedValue).toBe(46);
  });

  it("returns null ratios when pattern gauge stitches are zero", () => {
    const result = calculatePatternConversion({
      patternGauge: { stitches: 0, rows: 24 },
      myGauge: { stitches: 20, rows: 30 },
    });

    expect(result.ratios).toBeNull();
  });
});

describe("renderConversionResults", () => {
  it("shows a heading and prominent converted stitch and row values", () => {
    const html = renderConversionResults(
      { convertedValue: 106 },
      { convertedValue: 183 },
    );

    expect(html).toContain("Use These Numbers");
    expect(html).toContain('class="conversion-result-item__value">106<');
    expect(html).toContain('class="conversion-result-item__value">183<');
    expect(html).toContain('class="conversion-result-item__label">Stitches<');
    expect(html).toContain('class="conversion-result-item__label">Rows<');
    expect(html).toContain("conversion-result-card");
    expect(html).not.toContain("row-counter");
  });

  it("shows only stitches when row conversion is absent", () => {
    const html = renderConversionResults({ convertedValue: 106 }, null);

    expect(html).toContain('class="conversion-result-item__label">Stitches<');
    expect(html).not.toContain('class="conversion-result-item__label">Rows<');
    expect(html).toContain("conversion-result-card__values--single");
  });

  it("shows only rows when stitch conversion is absent", () => {
    const html = renderConversionResults(null, { convertedValue: 183 });

    expect(html).toContain('class="conversion-result-item__label">Rows<');
    expect(html).not.toContain('class="conversion-result-item__label">Stitches<');
    expect(html).toContain("conversion-result-card__values--single");
  });
});
