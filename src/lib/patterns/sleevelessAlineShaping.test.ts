import { describe, expect, it } from "vitest";
import {
  computeSleevelessAlineBodyShaping,
  distributeSleevelessAlineBodyShapingRows,
  isSleevelessAlineBodyShape,
} from "./sleevelessAlineShaping";

describe("isSleevelessAlineBodyShape", () => {
  it("detects aline on style.bodyShape", () => {
    expect(isSleevelessAlineBodyShape({ style: { bodyShape: "aline" } })).toBe(true);
    expect(isSleevelessAlineBodyShape({ style: { bodyShape: "straight" } })).toBe(false);
  });
});

describe("computeSleevelessAlineBodyShaping", () => {
  const bodyRows = 100;
  const hemRows = 14;

  it("returns straight plan when hip matches bust width", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 72,
      finishedHipInches: 36,
      finishedBustInches: 36,
      stitchesPerInch: 4,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan).not.toBeNull();
    expect(plan!.shapingType).toBe("straight");
    expect(plan!.hemCastOnSts).toBe(72);
    expect(plan!.pairedShapingRows).toBe(0);
    expect(plan!.bodyFirstHalf.instructionLines).toHaveLength(0);
  });

  it("casts on 72 and plans 11 paired decreases when bust is 50 and hip is 72 sts", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 50,
      finishedHipInches: 28.8,
      finishedBustInches: 20,
      stitchesPerInch: 5,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan).not.toBeNull();
    expect(plan!.hemCastOnSts).toBe(72);
    expect(plan!.bustBodySts).toBe(50);
    expect(plan!.shapingType).toBe("decrease-to-bust");
    expect(plan!.totalStitchDifference).toBe(22);
    expect(plan!.pairedShapingRows).toBe(11);
    expect(plan!.shapingRowNumbers).toHaveLength(11);
    expect(plan!.bodyFirstHalf.instructionLines[0]).toMatch(
      /Decrease 1 stitch at each side edge on the following rows:/,
    );
    expect(plan!.bodyFirstHalf.rows + plan!.bodySecondHalf.rows).toBe(bodyRows);
    expect(plan!.bodySecondHalf.endSts).toBe(50);
    expect(plan!.shapingRowNumbers.every((r) => r > hemRows)).toBe(true);
  });

  it("casts on 50 and plans 11 paired increases when bust is 72 and hip is 50 sts", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 72,
      finishedHipInches: 20,
      finishedBustInches: 28.8,
      stitchesPerInch: 5,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan).not.toBeNull();
    expect(plan!.hemCastOnSts).toBe(50);
    expect(plan!.shapingType).toBe("increase-to-bust");
    expect(plan!.pairedShapingRows).toBe(11);
    expect(plan!.bodySecondHalf.endSts).toBe(72);
    expect(plan!.bodyFirstHalf.instructionLines[0]).toMatch(
      /Increase 1 stitch at each side edge on the following rows:/,
    );
  });

  it("places hip at cast-on (hipRowsFromHem 0)", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 80,
      finishedHipInches: 44,
      finishedBustInches: 40,
      stitchesPerInch: 4,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan!.hipRowsFromHem).toBe(0);
  });
});

describe("distributeSleevelessAlineBodyShapingRows", () => {
  it("starts after the hem rows", () => {
    const rows = distributeSleevelessAlineBodyShapingRows(14, 100, 11);
    expect(rows[0]).toBeGreaterThan(14);
    expect(rows).toHaveLength(11);
  });
});
