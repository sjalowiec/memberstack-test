import { describe, expect, it } from "vitest";
import { FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST } from "./frontArmholeNecklineComposition";
import {
  FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT,
  FRONT_VNECK_SIMULTANEOUS_TOGETHER,
  pulloverVNeckArmholeShapingRemainsAfterDivide,
  sleevelessPulloverVNeckActionBullet,
  sleevelessPulloverVNeckWrittenSummaryParagraphs,
} from "./sleevelessFrontVNeckWrittenSummary";

const remainingOverlap = {
  divideGarmentRc: 126,
  firstArmholeGarmentRc: 126,
  necklineBeginsBeforeArmhole: false,
  liveTotalAtDivide: 102,
  leftAtDivide: 51,
  rightAtDivide: 51,
  heldAfterDivideRow: 47,
  activeAfterDivideRow: 47,
  completedDecreaseLocalRcs: [] as number[],
  remainingDecreaseLocalRcs: [2, 4, 6],
  completedDecreaseSts: 0,
  remainingDecreaseSts: 3,
  lastArmholeGarmentRc: 132,
  stitchesAfterArmhole: 88,
};

describe("pulloverVNeckArmholeShapingRemainsAfterDivide", () => {
  it("is false without overlap and true when remaining armhole events exist", () => {
    expect(pulloverVNeckArmholeShapingRemainsAfterDivide(null)).toBe(false);
    expect(pulloverVNeckArmholeShapingRemainsAfterDivide(remainingOverlap)).toBe(true);
    expect(
      pulloverVNeckArmholeShapingRemainsAfterDivide({
        ...remainingOverlap,
        remainingDecreaseSts: 0,
        remainingDecreaseLocalRcs: [],
        lastArmholeGarmentRc: 120,
        divideGarmentRc: 126,
      }),
    ).toBe(false);
  });
});

describe("sleevelessPulloverVNeckWrittenSummaryParagraphs", () => {
  it("with-armhole is concise: simultaneous sentence plus action bullets", () => {
    const paras = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "with-armhole",
      overlap: remainingOverlap,
      bindOffSts: 4,
      decreaseSts: 3,
    });
    const text = paras.join("\n");
    expect(paras[0]).toBe(FRONT_VNECK_SIMULTANEOUS_TOGETHER);
    expect(text).toContain(
      sleevelessPulloverVNeckActionBullet(
        "Divide the Front at center: 51 stitches each side. Place one side on hold.",
      ),
    );
    expect(text).toContain(
      sleevelessPulloverVNeckActionBullet("At the armhole edge, bind off or hold 4 stitches."),
    );
    expect(text).toContain(
      sleevelessPulloverVNeckActionBullet(
        "Decrease 1 stitch at the armhole edge every other row, 3 times, on rows 2, 4, 6.",
      ),
    );
    expect(text).toContain(sleevelessPulloverVNeckActionBullet(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST));
    expect(text).not.toMatch(/inside edge|outside edge/);
    expect(text).not.toMatch(/Each side decreases/);
    expect(text).not.toMatch(/First Shoulder|Second Shoulder/);
  });

  it("after-armhole has no simultaneous-shaping sentence", () => {
    const paras = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "after-armhole",
      liveStitchesAtDivide: 48,
    });
    const text = paras.join("\n");
    expect(text).not.toMatch(/at the same time/);
    expect(text).toMatch(/24 stitches each side/);
    expect(text).not.toMatch(/bind off or hold/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
  });

  it("during-armhole uses from-this-point copy and remaining decreases only", () => {
    const paras = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "during-armhole",
      overlap: {
        ...remainingOverlap,
        divideGarmentRc: 77,
        firstArmholeGarmentRc: 70,
        completedDecreaseSts: 3,
        completedDecreaseLocalRcs: [2, 4, 6],
        remainingDecreaseSts: 4,
        remainingDecreaseLocalRcs: [8, 10, 12, 14],
        leftAtDivide: 28,
        rightAtDivide: 28,
      },
    });
    const text = paras.join("\n");
    expect(text).toContain(FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT);
    expect(text).toMatch(/4 more times, on rows 8, 10, 12, 14/);
    expect(text).not.toMatch(/bind off or hold 8/);
    expect(text).not.toMatch(/inside edge|outside edge/);
  });

  it("before-armhole start omits simultaneous copy; join phase includes it", () => {
    const start = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "before-armhole",
      overlap: {
        ...remainingOverlap,
        divideGarmentRc: 117,
        firstArmholeGarmentRc: 133,
        necklineBeginsBeforeArmhole: true,
      },
      bindOffSts: 4,
    });
    expect(start.join("\n")).not.toMatch(/at the same time/);
    expect(start.join("\n")).toMatch(/Divide the Front at center/);
    const join = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "before-armhole",
      overlap: {
        ...remainingOverlap,
        divideGarmentRc: 117,
        firstArmholeGarmentRc: 133,
        necklineBeginsBeforeArmhole: true,
      },
      bindOffSts: 4,
      phase: "armhole-join",
    });
    expect(join.join("\n")).toContain(FRONT_VNECK_SIMULTANEOUS_FROM_THIS_POINT);
    expect(join.join("\n")).toMatch(/bind off or hold 4 stitches/);
    expect(join.join("\n")).toMatch(/on rows 135, 137, 139/);
    expect(join.join("\n")).not.toMatch(/Divide the Front/);
  });
});
