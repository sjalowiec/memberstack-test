import { describe, expect, it } from "vitest";
import {
  buildSleevelessBodyBlockPlan,
  computeBodyShapingPlacement,
  distributeSleevelessBodyShapingRows,
  SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES,
} from "./sleevelessBodyBlock";

const baseInput = {
  garmentStyle: "pullover" as const,
  pieceRole: "back" as const,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  rowsToArmhole: 100,
  hemRows: 14,
};

describe("buildSleevelessBodyBlockPlan", () => {
  it("straight body when bust and hip match (40 / 40, 5 spi)", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 40,
    });
    expect(plan.bodyShapeKind).toBe("straight");
    expect(plan.shapingDirection).toBe("none");
    expect(plan.hemStitches).toBe(plan.bustStitches);
    expect(plan.bustStitches).toBe(100);
    expect(plan.shapingEvents).toHaveLength(0);
    expect(plan.validation.valid).toBe(true);
  });

  it("A-line decrease when hip is wider than bust (40 / 44, 5 spi)", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.bodyShapeKind).toBe("aline");
    expect(plan.shapingDirection).toBe("decrease");
    expect(plan.hemStitches).toBeGreaterThan(plan.bustStitches);
    expect(plan.bustStitches).toBe(100);
    expect(plan.hemStitches).toBe(110);
    expect(plan.stitchChangePerSide).toBe(5);
    expect(plan.shapingEvents.length).toBeGreaterThan(0);
    expect(plan.shapingEvents[0]?.action).toBe("decrease");
    expect(plan.validation.valid).toBe(true);
  });

  it("A-line increase when hip is narrower than bust (44 / 40, 5 spi)", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 44,
      hipCircumferenceInches: 40,
    });
    expect(plan.bodyShapeKind).toBe("aline");
    expect(plan.shapingDirection).toBe("increase");
    expect(plan.hemStitches).toBeLessThan(plan.bustStitches);
    expect(plan.bustStitches).toBe(110);
    expect(plan.hemStitches).toBe(100);
    expect(plan.shapingEvents[0]?.action).toBe("increase");
  });

  it("treats near-equal hip and bust as straight (40 / 40.125)", () => {
    expect(40.125 - 40).toBeLessThanOrEqual(SLEEVELESS_BODY_STRAIGHT_TOLERANCE_INCHES);
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 40.125,
    });
    expect(plan.bodyShapeKind).toBe("straight");
    expect(plan.shapingDirection).toBe("none");
    expect(plan.hemStitches).toBe(plan.bustStitches);
  });

  it("diagramGuides: straight body has showBodyShapeGuides false", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 40,
    });
    expect(plan.diagramGuides.showBodyShapeGuides).toBe(false);
    expect(plan.diagramGuides.bodyShapeKind).toBe("straight");
    expect(plan.diagramGuides.shapingDirection).toBe("none");
  });

  it("diagramGuides: A-line decrease has showBodyShapeGuides true and shapingDirection decrease", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.diagramGuides.showBodyShapeGuides).toBe(true);
    expect(plan.diagramGuides.shapingDirection).toBe("decrease");
    expect(plan.diagramGuides.hemStitches).toBeGreaterThan(plan.diagramGuides.bustStitches);
  });

  it("diagramGuides: A-line increase has showBodyShapeGuides true and shapingDirection increase", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      bustCircumferenceInches: 44,
      hipCircumferenceInches: 40,
    });
    expect(plan.diagramGuides.showBodyShapeGuides).toBe(true);
    expect(plan.diagramGuides.shapingDirection).toBe("increase");
    expect(plan.diagramGuides.hemStitches).toBeLessThan(plan.diagramGuides.bustStitches);
  });

  it("diagramGuides: cardigan unsupported has showBodyShapeGuides false", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      garmentStyle: "cardigan",
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.diagramGuides.showBodyShapeGuides).toBe(false);
    expect(plan.unsupportedForRelease).toBe(true);
  });

  it("cardigan returns a plan marked unsupported without throwing", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      garmentStyle: "cardigan",
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.unsupportedForRelease).toBe(true);
    expect(plan.bodyShapeKind).toBe("straight");
    expect(plan.shapingDirection).toBe("none");
    expect(plan.hemStitches).toBe(plan.bustStitches);
    expect(plan.validation.valid).toBe(true);
  });

  it("does not divide by zero when rowsToArmhole is zero", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      rowsToArmhole: 0,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.shapingRowNumbers).toHaveLength(0);
    expect(plan.availableShapingRows).toBe(0);
    expect(plan.validation.warnings.some((w) => w.code === "ROWS_TO_ARMHOLE_ZERO")).toBe(true);
  });
});

describe("shaping placement", () => {
  it("shapes immediately after hem with 1 inch straight before armhole", () => {
    const placement = computeBodyShapingPlacement(14, 100, 7);
    expect(placement.straightRowsBeforeArmhole).toBe(7);
    expect(placement.shapingStartRows).toBe(0);
    expect(placement.shapingEndBufferRows).toBe(7);
    expect(placement.availableShapingRows).toBe(93);
    expect(placement.shapingBeginRc).toBe(14);
    expect(placement.shapingStartRow).toBe(14);
    expect(placement.shapingEndRow).toBe(106);
    expect(placement.straightBeforeArmholeBeginRc).toBe(107);
    expect(placement.armholeBeginRc).toBe(114);
  });

  it("places shaping RCs inside the shaping window only", () => {
    const rows = distributeSleevelessBodyShapingRows(14, 100, 7, 11);
    expect(rows).toHaveLength(11);
    expect(rows[0]).toBeGreaterThanOrEqual(14);
    expect(rows[rows.length - 1]).toBeLessThanOrEqual(106);
  });

  it("clamps available shaping rows to zero when body is shorter than straight section", () => {
    const placement = computeBodyShapingPlacement(14, 5, 7);
    expect(placement.availableShapingRows).toBe(0);
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      rowsToArmhole: 5,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.shapingRowNumbers).toHaveLength(0);
    expect(plan.validation.warnings.some((w) => w.code === "INSUFFICIENT_SHAPING_ROWS")).toBe(
      true,
    );
  });
});

describe("validation", () => {
  it("returns hard error for invalid stitch gauge", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      stitchesPerInch: 0,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 40,
    });
    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.errors.some((e) => e.code === "INVALID_GAUGE")).toBe(true);
  });

  it("warns when stitch change spacing is very tight", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      rowsToArmhole: 12,
      bustCircumferenceInches: 20,
      hipCircumferenceInches: 44,
      precomputedBustStitches: 50,
    });
    expect(
      plan.validation.warnings.some(
        (w) => w.code === "EXCESSIVE_STITCH_CHANGE" || w.code === "INSUFFICIENT_SHAPING_ROWS",
      ),
    ).toBe(true);
  });

  it("exposes structured warnings and flat warning strings", () => {
    const plan = buildSleevelessBodyBlockPlan({
      ...baseInput,
      rowsToArmhole: 0,
      bustCircumferenceInches: 40,
      hipCircumferenceInches: 44,
    });
    expect(plan.validation.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings).toContain(plan.validation.warnings[0]!.message);
  });
});
