import { describe, expect, it } from "vitest";
import {
  evaluateGaugeSanity as evaluateFromLego,
  formatGaugeSanityWarningBody,
  GAUGE_SANITY_MIN_STITCHES_PER_INCH,
} from "./gaugeSanity";
import { evaluateGaugeSanity as evaluateFromShared } from "../gaugeSanity";

describe("gauge sanity Lego block", () => {
  it("is the same evaluator Sweater and Hat already use", () => {
    expect(evaluateFromLego).toBe(evaluateFromShared);
  });

  it("flags 4 stitches / 7 rows over 4 inches as an implausible per-inch entry", () => {
    const result = evaluateFromLego("4", "7", "in");
    expect(result).not.toBeNull();
    expect(result?.unusual).toBe(true);
    expect(result?.stitchesPerInch).toBe(1);
    expect(result?.rowsPerInch).toBe(1.75);
    expect(result?.reasons).toContain("low-stitch");
    expect(result?.reasons).toContain("low-row");
    expect(result!.stitchesPerInch).toBeLessThan(GAUGE_SANITY_MIN_STITCHES_PER_INCH);
    expect(formatGaugeSanityWarningBody(result!)).toContain("over 4 inches");
    expect(formatGaugeSanityWarningBody(result!)).toContain("1 stitch");
  });

  it("does not warn on a typical machine-knitting 4-inch swatch", () => {
    expect(evaluateFromLego("28", "40", "in")?.unusual).toBe(false);
    expect(evaluateFromLego("20", "28", "in")?.unusual).toBe(false);
  });
});
