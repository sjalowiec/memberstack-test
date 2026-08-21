import { describe, expect, it } from "vitest";
import { FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST } from "./frontArmholeNecklineComposition";
import {
  FRONT_VNECK_FIRST_SECOND_SHOULDER_SUMMARY,
  sleevelessPulloverVNeckWrittenSummaryParagraphs,
} from "./sleevelessFrontVNeckWrittenSummary";

describe("sleevelessPulloverVNeckWrittenSummaryParagraphs", () => {
  it("with-armhole includes divide, per-side BO, remaining decreases, and checklist handoff", () => {
    const paras = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "with-armhole",
      overlap: {
        divideGarmentRc: 126,
        firstArmholeGarmentRc: 126,
        necklineBeginsBeforeArmhole: false,
        liveTotalAtDivide: 102,
        leftAtDivide: 51,
        rightAtDivide: 51,
        heldAfterDivideRow: 47,
        activeAfterDivideRow: 47,
        completedDecreaseLocalRcs: [],
        remainingDecreaseLocalRcs: [2, 4, 6],
        completedDecreaseSts: 0,
        remainingDecreaseSts: 3,
        lastArmholeGarmentRc: 132,
        stitchesAfterArmhole: 88,
      },
      bindOffSts: 4,
      decreaseSts: 3,
      shoulderStitches: 22,
    });
    const text = paras.join("\n");
    expect(text).toMatch(/Divide the Front at the center: 51 stitches on each side/);
    expect(text).toMatch(/bind off OR hold 4 stitches/);
    expect(text).toMatch(/decreasing 1 stitch at the armhole edge every other row, 3 times/);
    expect(text).toMatch(/Decrease on rows: 2 - 4 - 6/);
    expect(text).toContain(FRONT_VNECK_FIRST_SECOND_SHOULDER_SUMMARY);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
    expect(text).not.toMatch(/carriage side/);
    expect(text).not.toMatch(/knit across, then next row/i);
  });

  it("after-armhole omits armhole BO because that shaping already has written instructions", () => {
    const paras = sleevelessPulloverVNeckWrittenSummaryParagraphs({
      timing: "after-armhole",
      liveStitchesAtDivide: 48,
      shoulderStitches: 12,
    });
    const text = paras.join("\n");
    expect(text).toMatch(/24 stitches on each side/);
    expect(text).not.toMatch(/bind off OR hold/);
    expect(text).toContain(FRONT_VNECK_HANDOFF_FOLLOW_CHECKLIST);
  });
});
