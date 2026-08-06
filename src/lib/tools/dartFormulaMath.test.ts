import { describe, expect, it } from "vitest";
import {
  CUP_DART_BY_SIZE,
  computeDartShaping,
  computeDartShapingFromPerInch,
  formatDartCupOptionLabel,
  roundToTwoDecimals,
} from "./dartFormulaMath";

describe("dartFormulaMath", () => {
  it("computes known inch values for cup C at 5 sts / 7 rows per inch (20/28 over 4″)", () => {
    const r = computeDartShaping({
      cupKey: "C",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // width 3.25″ × 5 spi = 16.25 → floor 16
    expect(r.totalHeldStitches).toBe(16);
    // depth 1″ × 7 rpi = 7 → floor 7
    expect(r.totalDepthRows).toBe(7);
    // shapingPasses = floor(7/2)=3 → bump to even 4
    expect(r.shapingPasses).toBe(4);
    expect(r.dartWidthInches).toBe(3.25);
    expect(r.dartDepthInches).toBe(1);
    expect(r.dartWidth).toBe(3.25);
  });

  it("keeps cup B inch path deterministic at 4.5 / 6.5 per inch", () => {
    const r = computeDartShaping({
      cupKey: "B",
      stitchGauge: 18,
      rowGauge: 26,
      unit: "in",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totalHeldStitches).toBe(Math.floor(3 * roundToTwoDecimals(18 / 4)));
    expect(r.totalDepthRows).toBe(Math.floor(0.5 * roundToTwoDecimals(26 / 4)));
  });

  it("produces identical physical stitch/row counts for equivalent inch and cm gauges", () => {
    const inch = computeDartShaping({
      cupKey: "D",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    // 20 sts / 4″ = 5 spi; over 10 cm: 5 * (10/2.54) ≈ 19.685
    const cmGaugeSts = roundToTwoDecimals(20 * (10 / 4 / 2.54) * 2.54); // keep exact: sts per 10cm = spi * 10/2.54
    const spi = 20 / 4;
    const rpi = 28 / 4;
    const cm = computeDartShaping({
      cupKey: "D",
      stitchGauge: spi * (10 / 2.54),
      rowGauge: rpi * (10 / 2.54),
      unit: "cm",
    });
    expect(inch.ok).toBe(true);
    expect(cm.ok).toBe(true);
    if (!inch.ok || !cm.ok) return;
    expect(cm.totalHeldStitches).toBe(inch.totalHeldStitches);
    expect(cm.totalDepthRows).toBe(inch.totalDepthRows);
    expect(cm.shapingPasses).toBe(inch.shapingPasses);
    expect(cmGaugeSts).toBeTypeOf("number");
  });

  it("matches per-inch helper to 4″ swatch path", () => {
    const a = computeDartShapingFromPerInch({
      cupKey: "DD",
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    const b = computeDartShaping({
      cupKey: "DD",
      stitchGauge: 20,
      rowGauge: 28,
      unit: "in",
    });
    expect(a).toEqual(b);
  });

  it("rejects missing cup and zero gauges", () => {
    expect(computeDartShaping({ cupKey: "", stitchGauge: 20, rowGauge: 28, unit: "in" }).ok).toBe(
      false,
    );
    expect(
      computeDartShaping({ cupKey: "B", stitchGauge: 0, rowGauge: 28, unit: "in" }).ok,
    ).toBe(false);
  });

  it("does not mutate cup preset table", () => {
    const before = { ...CUP_DART_BY_SIZE.C };
    computeDartShaping({ cupKey: "C", stitchGauge: 20, rowGauge: 28, unit: "in" });
    expect(CUP_DART_BY_SIZE.C).toEqual(before);
  });

  it("formats cup option labels in both units", () => {
    expect(formatDartCupOptionLabel("B", "in")).toContain('3" width');
    expect(formatDartCupOptionLabel("B", "cm")).toContain("cm width");
  });
});
