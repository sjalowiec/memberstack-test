import { describe, expect, it } from "vitest";
import {
  castOnEdgeDiagramLabel,
  formatKnittedDiagramMeasurement,
  knittedWidthInches,
} from "./stitchesRowsDiagramLabel";

describe("cast-on edge diagram label", () => {
  it("shows the stitch count and the knitted width of that count", () => {
    expect(knittedWidthInches(140, 7)).toBe(20);
    expect(castOnEdgeDiagramLabel(140, 7, "in")).toBe("140 sts\n20 in");
    expect(castOnEdgeDiagramLabel(140, 7, "cm")).toBe("140 sts\n50.8 cm");
  });

  it("uses the seam-inclusive stitch count for a split piece", () => {
    const halfWithoutSeam = 88;
    const halfOnTheNeedles = halfWithoutSeam + 1;
    const gauge = 7;
    const label = castOnEdgeDiagramLabel(halfOnTheNeedles, gauge, "in");
    expect(label.startsWith("89 sts\n")).toBe(true);
    expect(label).toContain(formatKnittedDiagramMeasurement(89 / gauge, "in"));
    expect(label).not.toContain(formatKnittedDiagramMeasurement(halfWithoutSeam / gauge, "in"));
  });

  it("does not snap the knitted width to the quarter-inch chart grid", () => {
    expect(formatKnittedDiagramMeasurement(142 / 7, "in")).toBe("20.3 in");
    expect(castOnEdgeDiagramLabel(142, 7, "in")).toBe("142 sts\n20.3 in");
  });

  it("keeps the stitch count when gauge is missing", () => {
    expect(knittedWidthInches(80, undefined)).toBeUndefined();
    expect(castOnEdgeDiagramLabel(80, undefined, "in")).toBe("80 sts");
  });
});
