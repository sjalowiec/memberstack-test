import { describe, expect, it } from "vitest";
import {
  evaluateGaugeSanity,
  formatGaugeSanityWarningBody,
  gaugeSanityAcknowledgementKey,
  gaugeSanityBlocksProceed,
  GAUGE_SANITY_MAX_ROWS_PER_INCH,
  GAUGE_SANITY_MAX_STITCHES_PER_INCH,
  GAUGE_SANITY_MIN_ROWS_PER_INCH,
  GAUGE_SANITY_MIN_STITCHES_PER_INCH,
  GAUGE_SANITY_WARNING_HEADING,
  toGaugeSanityUnit,
} from "./gaugeSanity";

describe("gaugeSanity bounds", () => {
  it("normalizes the DIY Blanket 4-inch unusual ranges to per-inch values", () => {
    expect(GAUGE_SANITY_MIN_STITCHES_PER_INCH).toBe(2.5);
    expect(GAUGE_SANITY_MAX_STITCHES_PER_INCH).toBe(12.5);
    expect(GAUGE_SANITY_MIN_ROWS_PER_INCH).toBe(2.5);
    expect(GAUGE_SANITY_MAX_ROWS_PER_INCH).toBe(15);
  });
});

describe("toGaugeSanityUnit", () => {
  it("treats hat inches the same as builder in", () => {
    expect(toGaugeSanityUnit("inches")).toBe("in");
    expect(toGaugeSanityUnit("in")).toBe("in");
    expect(toGaugeSanityUnit("cm")).toBe("cm");
  });
});

describe("evaluateGaugeSanity", () => {
  it("returns null when stitch or row is missing or not a positive number", () => {
    expect(evaluateGaugeSanity("", "10", "in")).toBeNull();
    expect(evaluateGaugeSanity("7", "", "in")).toBeNull();
    expect(evaluateGaugeSanity("0", "10", "in")).toBeNull();
    expect(evaluateGaugeSanity("abc", "10", "in")).toBeNull();
  });

  it("flags the customer case of 7 stitches / 10 rows over 4 inches", () => {
    const result = evaluateGaugeSanity("7", "10", "in");
    expect(result).toMatchObject({
      unusual: true,
      stitchesPerInch: 1.75,
      rowsPerInch: 2.5,
      unit: "in",
    });
    expect(result?.reasons).toContain("low-stitch");
    expect(result?.reasons).not.toContain("low-row");
  });

  it("does not warn on a typical 4-inch swatch or the DIY Blanket boundaries", () => {
    expect(evaluateGaugeSanity("20", "28", "in")?.unusual).toBe(false);
    expect(evaluateGaugeSanity("16", "24", "in")?.unusual).toBe(false);
    expect(evaluateGaugeSanity("10", "10", "in")?.unusual).toBe(false);
    expect(evaluateGaugeSanity("50", "60", "in")?.unusual).toBe(false);
  });

  it("warns just outside the DIY Blanket boundaries", () => {
    expect(evaluateGaugeSanity("9", "10", "in")?.reasons).toContain("low-stitch");
    expect(evaluateGaugeSanity("51", "10", "in")?.reasons).toContain("high-stitch");
    expect(evaluateGaugeSanity("10", "9", "in")?.reasons).toContain("low-row");
    expect(evaluateGaugeSanity("10", "61", "in")?.reasons).toContain("high-row");
  });

  it("uses normalized per-inch values so 7 over 10 cm also warns", () => {
    const result = evaluateGaugeSanity("7", "10", "cm");
    expect(result?.unusual).toBe(true);
    expect(result?.stitchesPerInch).toBeCloseTo((7 / 10) * 2.54, 5);
    expect(result?.rowsPerInch).toBeCloseTo((10 / 10) * 2.54, 5);
  });

  it("does not warn on a reasonable 10 cm swatch", () => {
    expect(evaluateGaugeSanity("20", "28", "cm")?.unusual).toBe(false);
  });
});

describe("gauge sanity acknowledgement and copy", () => {
  it("blocks until the same raw entry is acknowledged", () => {
    const result = evaluateGaugeSanity("7", "10", "in");
    expect(gaugeSanityBlocksProceed(result, "7", "10", "in", null)).toBe(true);
    expect(
      gaugeSanityBlocksProceed(result, "7", "10", "in", gaugeSanityAcknowledgementKey("7", "10", "in")),
    ).toBe(false);
    expect(
      gaugeSanityBlocksProceed(result, "7", "10", "in", gaugeSanityAcknowledgementKey("8", "10", "in")),
    ).toBe(true);
  });

  it("does not block a usual gauge even without acknowledgement", () => {
    const result = evaluateGaugeSanity("20", "28", "in");
    expect(gaugeSanityBlocksProceed(result, "20", "28", "in", null)).toBe(false);
  });

  it("keeps the customer 7 / 10 inch case in the same per-inch wording", () => {
    const result = evaluateGaugeSanity("7", "10", "in");
    expect(formatGaugeSanityWarningBody(result!)).toBe(
      "Enter your gauge over 4 inches. You entered 7 stitches and 10 rows over 4 inches, which equals approximately 1.75 stitches and 2.5 rows per inch.",
    );
  });

  it("explains inch entries as a 4-inch swatch converted per inch", () => {
    const result = evaluateGaugeSanity("5", "7", "in");
    expect(result).not.toBeNull();
    expect(GAUGE_SANITY_WARNING_HEADING).toBe("Please double-check your gauge.");
    expect(formatGaugeSanityWarningBody(result!)).toBe(
      "Enter your gauge over 4 inches. You entered 5 stitches and 7 rows over 4 inches, which equals approximately 1.25 stitches and 1.75 rows per inch.",
    );
    expect(formatGaugeSanityWarningBody(result!)).not.toContain("per cm");
  });

  it("explains centimeter entries as a 10 cm swatch converted per cm", () => {
    const result = evaluateGaugeSanity("5", "7", "cm");
    expect(result).not.toBeNull();
    expect(formatGaugeSanityWarningBody(result!)).toBe(
      "Enter your gauge over 10 cm. You entered 5 stitches and 7 rows over 10 cm, which equals approximately 0.5 stitches and 0.7 rows per cm.",
    );
    expect(formatGaugeSanityWarningBody(result!)).not.toContain("per inch");
    expect(formatGaugeSanityWarningBody(result!)).not.toContain("4 inches");
  });
});
