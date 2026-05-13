import { describe, expect, it } from "vitest";
import {
  buildVNeckFrontFullWidthTimeline,
  buildVNecklinePlan,
  calculateNecklineShaping,
  calculateRoundNecklineShaping,
  calculateVNeckNeckEdgePlan,
  neckDecreaseStitchesPerSideFromOpening,
  vNeckPlanToInnerEdgeEventsByRow,
} from "./necklineShaping";

describe("calculateNecklineShaping", () => {
  it("distributes remainder stitches across steps", () => {
    const steps = calculateNecklineShaping(7, 5);
    const total = steps.reduce((s, x) => s + x.stitches * x.times, 0);
    expect(total).toBe(7);
  });
});

describe("necklineShaping re-exports", () => {
  it("exposes round-neck API (unchanged)", () => {
    expect(typeof calculateRoundNecklineShaping).toBe("function");
    const round = calculateRoundNecklineShaping({ necklineStitches: 24 });
    expect(round.necklineStitches).toBe(24);
  });

  it("exposes V-neck API alongside round-neck", () => {
    expect(typeof buildVNecklinePlan).toBe("function");
    expect(typeof calculateVNeckNeckEdgePlan).toBe("function");
    expect(typeof vNeckPlanToInnerEdgeEventsByRow).toBe("function");
    expect(typeof neckDecreaseStitchesPerSideFromOpening).toBe("function");
    expect(typeof buildVNeckFrontFullWidthTimeline).toBe("function");

    const v = buildVNecklinePlan({
      stitchesAfterArmhole: 110,
      neckWidthSts: 30,
      neckDepthRows: 15,
      side: "left",
      firstShapingRow: 100,
      lastShapingRow: 114,
    });
    expect(v.side).toBe("left");
    expect(v.neckDecreaseStitchesPerSide).toBe(15);
  });
});
