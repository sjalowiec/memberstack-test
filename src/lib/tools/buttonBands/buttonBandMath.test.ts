import { describe, expect, it } from "vitest";
import { calculateButtonBandMath } from "./buttonBandMath";
import type { ButtonBandInput } from "./buttonBandTypes";

const inchBase: ButtonBandInput = {
  stitchGauge: 20,
  rowGauge: 28,
  gaugeBasis: 4,
  numberOfButtonholes: 3,
  cardiganEdge: 1.5,
  bandWidth: 10,
  buttonholeSize: 0.25,
  startOffset: 0.5,
  endOffset: 0.5,
  currentRowCount: 0,
  unit: "in",
};

describe("calculateButtonBandMath", () => {
  it("calculates a basic inch folded band with three buttonholes", () => {
    const result = calculateButtonBandMath(inchBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rowsPerUnit).toBe(7);
    expect(result.stitchesPerUnit).toBe(5);
    expect(result.cardiganEdgeStitches).toBe(8);
    expect(result.finishedBandRows).toBe(70);
    expect(result.castOnStitches).toBe(8);
    expect(result.totalBandRows).toBe(141);
    expect(result.startOffsetStitches).toBe(2);
    expect(result.endOffsetStitches).toBe(2);
    expect(result.buttonholeWidthStitches).toBe(1);
    expect(result.firstButtonholeRow).toBe(35);
    expect(result.turningRow).toBe(70);
    expect(result.secondButtonholeRow).toBe(105);
    expect(result.finalRow).toBe(141);
    expect(result.spacingBetweenButtonholes).toBe(0);
    expect(result.buttonholeSegments).toHaveLength(7);
  });

  it("calculates centimeters using gaugeBasis 10", () => {
    const result = calculateButtonBandMath({
      stitchGauge: 22,
      rowGauge: 30,
      gaugeBasis: 10,
      numberOfButtonholes: 2,
      cardiganEdge: 4,
      bandWidth: 25,
      buttonholeSize: 0.6,
      startOffset: 1,
      endOffset: 1,
      currentRowCount: 0,
      unit: "cm",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.finishedBandRows).toBe(75);
    expect(result.totalBandRows).toBe(151);
    expect(result.turningRow).toBe(75);
    expect(result.firstButtonholeRow).toBe(37);
    expect(result.secondButtonholeRow).toBe(112);
    expect(result.finalRow).toBe(151);
  });

  it("totalBandRows includes both sides plus the turning row", () => {
    const result = calculateButtonBandMath(inchBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.totalBandRows).toBe(result.finishedBandRows * 2 + 1);
  });

  it("places the first buttonhole row at the midpoint of the first side", () => {
    const result = calculateButtonBandMath(inchBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.firstButtonholeRow).toBe(
      inchBase.currentRowCount + Math.trunc(result.finishedBandRows / 2),
    );
  });

  it("places the turning row after the first finished band width", () => {
    const result = calculateButtonBandMath(inchBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.turningRow).toBe(inchBase.currentRowCount + result.finishedBandRows);
  });

  it("places the second buttonhole row at the midpoint of the second side after the turning row", () => {
    const result = calculateButtonBandMath(inchBase);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.secondButtonholeRow).toBe(
      result.turningRow + Math.trunc(result.finishedBandRows / 2),
    );
  });

  it("sets spacing to zero for a single buttonhole", () => {
    const result = calculateButtonBandMath({
      ...inchBase,
      numberOfButtonholes: 1,
      cardiganEdge: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.cardiganEdgeStitches).toBe(10);
    expect(result.spacingBetweenButtonholes).toBe(0);
    expect(result.buttonholeSegments).toHaveLength(3);
    expect(result.buttonholeSegments.filter((s) => s.label === "Spacing")).toHaveLength(0);
  });

  it("returns an error when cardigan edge stitch space is insufficient", () => {
    const result = calculateButtonBandMath({
      ...inchBase,
      cardiganEdge: 0.75,
      numberOfButtonholes: 4,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/cardigan edge is not long enough/i);
  });

  it("returns an error when numberOfButtonholes is zero", () => {
    const result = calculateButtonBandMath({
      ...inchBase,
      numberOfButtonholes: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/at least one buttonhole/i);
  });

  it("adds current row count to folded-band row markers", () => {
    const result = calculateButtonBandMath({
      ...inchBase,
      currentRowCount: 20,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.firstButtonholeRow).toBe(55);
    expect(result.turningRow).toBe(90);
    expect(result.secondButtonholeRow).toBe(125);
    expect(result.finalRow).toBe(161);
  });
});
