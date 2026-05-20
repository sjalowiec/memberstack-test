import { describe, expect, it } from "vitest";
import { buildSleevelessBodyBlockPlan } from "./bodyBlock/sleevelessBodyBlock";
import {
  bodyBlockPlanToAlineShapingPlan,
  computeSleevelessAlineBodyShaping,
  distributeSleevelessAlineBodyShapingRows,
  isSleevelessAlineBodyShape,
  isSleevelessExplicitCustomBuildStraight,
  measurementsImplySleevelessAlineBody,
  resolveBodyBlockHipCircumferenceInches,
  shouldApplySleevelessAlineShapingFromMeasurements,
  shouldRunSleevelessBodyBlockForPullover,
} from "./sleevelessAlineShaping";

describe("isSleevelessAlineBodyShape", () => {
  it("detects aline on style.bodyShape", () => {
    expect(isSleevelessAlineBodyShape({ style: { bodyShape: "aline" } })).toBe(true);
    expect(isSleevelessAlineBodyShape({ style: { bodyShape: "straight" } })).toBe(false);
  });
});

describe("body block gating from measurements", () => {
  it("infers A-line when hip differs from bust beyond tolerance", () => {
    expect(measurementsImplySleevelessAlineBody(38, 44)).toBe(true);
    expect(measurementsImplySleevelessAlineBody(40, 40)).toBe(false);
    expect(measurementsImplySleevelessAlineBody(40, 40.125)).toBe(false);
  });

  it("runs body block for pullover whenever bust is set", () => {
    expect(shouldRunSleevelessBodyBlockForPullover(38)).toBe(true);
    expect(shouldRunSleevelessBodyBlockForPullover(undefined)).toBe(false);
  });

  it("applies A-line shaping from measurements when bodyShape is straight (express)", () => {
    expect(
      shouldApplySleevelessAlineShapingFromMeasurements(
        { style: { bodyShape: "straight", patternMode: "express" } },
        38,
        44,
      ),
    ).toBe(true);
  });

  it("infers A-line for custom-build straight when review hip exceeds bust", () => {
    const pd = { style: { bodyShape: "straight", patternMode: "custom-build" } };
    expect(isSleevelessExplicitCustomBuildStraight(pd, 38, 44)).toBe(false);
    expect(resolveBodyBlockHipCircumferenceInches(pd, 38, 44)).toBe(44);
    expect(shouldApplySleevelessAlineShapingFromMeasurements(pd, 38, 44)).toBe(true);
  });

  it("honors explicit custom-build straight when hip matches bust", () => {
    const pd = { style: { bodyShape: "straight", patternMode: "custom-build" } };
    expect(isSleevelessExplicitCustomBuildStraight(pd, 40, 40)).toBe(true);
    expect(resolveBodyBlockHipCircumferenceInches(pd, 40, 40)).toBe(40);
  });
});

describe("computeSleevelessAlineBodyShaping", () => {
  const bodyRows = 100;
  const hemRows = 14;
  const rowsPerInch = 7;

  it("returns straight plan when hip matches bust width", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 72,
      finishedHipInches: 36,
      finishedBustInches: 36,
      stitchesPerInch: 4,
      rowsPerInch,
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
      rowsPerInch,
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
    expect(plan!.bodySecondHalf.instructionLines).toHaveLength(0);
    expect(plan!.bodyFirstHalf.instructionLines[0]).toMatch(
      /glossary-tooltip-placeholder.*data-glossary-id="178".*Decrease.*11 times evenly across/,
    );
    expect(plan!.bodyFirstHalf.rows + plan!.bodySecondHalf.rows).toBe(bodyRows);
    expect(plan!.pairedShapingRows).toBe(11);
    expect(plan!.bodySecondHalf.endSts).toBe(50);
    expect(plan!.shapingRowNumbers.every((r) => r >= plan!.shapingStartRow)).toBe(true);
    expect(plan!.shapingRowNumbers.every((r) => r <= plan!.shapingEndRow)).toBe(true);
  });

  it("casts on 50 and plans 11 paired increases when bust is 72 and hip is 50 sts", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 72,
      finishedHipInches: 20,
      finishedBustInches: 28.8,
      stitchesPerInch: 5,
      rowsPerInch,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan).not.toBeNull();
    expect(plan!.hemCastOnSts).toBe(50);
    expect(plan!.shapingType).toBe("increase-to-bust");
    expect(plan!.pairedShapingRows).toBe(11);
    expect(plan!.bodyFirstHalf.endSts).toBe(72);
    expect(plan!.bodyFirstHalf.instructionLines[0]).toMatch(
      /glossary-tooltip-placeholder.*data-glossary-id="186".*Increase.*11 times evenly across/,
    );
    expect(plan!.bodyFirstHalf.instructionLines[1]).toMatch(
      /Work increases on:/,
    );
    expect(plan!.bodyFirstHalf.instructionLines[1]).not.toContain("glossary-tooltip-placeholder");
    expect(plan!.pairedShapingRows).toBe(11);
  });

  it("places hip at cast-on (hipRowsFromHem 0)", () => {
    const plan = computeSleevelessAlineBodyShaping({
      bustBodySts: 80,
      finishedHipInches: 44,
      finishedBustInches: 40,
      stitchesPerInch: 4,
      rowsPerInch,
      bodyToArmholeRows: bodyRows,
      hemRows,
    });
    expect(plan!.hipRowsFromHem).toBe(0);
  });
});

describe("distributeSleevelessAlineBodyShapingRows", () => {
  it("starts after 1 inch straight above the hem", () => {
    const rows = distributeSleevelessAlineBodyShapingRows(14, 100, 11, 7);
    expect(rows[0]).toBeGreaterThanOrEqual(14);
    expect(rows[rows.length - 1]).toBeLessThanOrEqual(106);
    expect(rows).toHaveLength(11);
  });
});

describe("continuous A-line shaping span", () => {
  const hemRows = 22;
  const bodyToArmholeRows = 146;
  const bustBodySts = 126;

  const bodyPlan = buildSleevelessBodyBlockPlan({
    garmentStyle: "pullover",
    pieceRole: "back",
    bustCircumferenceInches: 63,
    hipCircumferenceInches: 70,
    stitchesPerInch: 4,
    rowsPerInch: 11,
    rowsToArmhole: bodyToArmholeRows,
    hemRows,
    mode: "auto",
    precomputedBustStitches: bustBodySts,
  });

  const plan = bodyBlockPlanToAlineShapingPlan(bodyPlan, bodyToArmholeRows, hemRows);

  it("plans 135 shaping rows and 7 paired decreases (140→126 sts)", () => {
    expect(plan.pairedShapingRows).toBe(7);
    expect(plan.straightRowsBeforeArmhole).toBe(11);
    expect(plan.availableShapingRows).toBe(135);
    expect(plan.shapingBeginRc).toBe(hemRows);
    expect(plan.shapingEndRow).toBe(156);
    expect(plan.straightBeforeArmholeBeginRc).toBe(157);
    expect(plan.armholeBeginRc).toBe(168);
    expect(plan.bodyFirstHalf.rows + plan.bodySecondHalf.rows).toBe(bodyToArmholeRows);
    expect(plan.bodyFirstHalf.shapingRowNumbers).toEqual(plan.shapingRowNumbers);
  });
});
