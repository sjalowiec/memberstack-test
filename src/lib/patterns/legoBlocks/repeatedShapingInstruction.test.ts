import { describe, expect, it } from "vitest";
import { formatRepeatedShapingInstruction } from "./repeatedShapingInstruction";

describe("formatRepeatedShapingInstruction", () => {
  it("writes a decrease without the rows knitted between shaping rows", () => {
    expect(
      formatRepeatedShapingInstruction({
        action: "decrease",
        stitchesPerAction: 1,
        edgePhrase: "each armhole edge",
        interval: 2,
        actionRows: [6, 8, 10, 12],
      }),
    ).toBe(
      "Decrease 1 stitch at each armhole edge every other row, 4 times (RC: 006, RC: 008, RC: 010, RC: 012).",
    );
  });

  it("uses the armhole edge for a single-edge decrease", () => {
    expect(
      formatRepeatedShapingInstruction({
        action: "decrease",
        stitchesPerAction: 1,
        edgePhrase: "the armhole edge",
        interval: 2,
        actionRows: [2, 4, 6, 8],
      }),
    ).toBe("Decrease 1 stitch at the armhole edge every other row, 4 times (RC: 002, RC: 004, RC: 006, RC: 008).");
  });

  it("supports increases, bind-offs, holds, and other intervals", () => {
    expect(
      formatRepeatedShapingInstruction({
        action: "increase",
        stitchesPerAction: 1,
        edgePhrase: "each side",
        interval: 4,
        actionRows: [4, 8, 12],
      }),
    ).toBe("Increase 1 stitch at each side every 4 rows, 3 times (RC: 004, RC: 008, RC: 012).");
    expect(
      formatRepeatedShapingInstruction({
        action: "bind-off",
        stitchesPerAction: 2,
        edgePhrase: "each end",
        interval: 1,
        actionRows: [0, 1],
      }),
    ).toBe("Bind off 2 stitches at each end every row, 2 times (RC: 000, RC: 001).");
    expect(
      formatRepeatedShapingInstruction({
        action: "hold",
        stitchesPerAction: 3,
        edgePhrase: "the neck edge",
        interval: 2,
        actionRows: [4],
      }),
    ).toBe("Put 3 stitches in hold at the neck edge every other row, 1 time (RC: 004).");
  });

  it("refuses a sequence whose gaps are not the stated interval", () => {
    expect(
      formatRepeatedShapingInstruction({
        action: "decrease",
        stitchesPerAction: 1,
        edgePhrase: "each armhole edge",
        interval: 2,
        actionRows: [6, 8, 9, 12],
      }),
    ).toBeNull();
    expect(
      formatRepeatedShapingInstruction({
        action: "decrease",
        stitchesPerAction: 1,
        edgePhrase: "each armhole edge",
        interval: 2,
        actionRows: [],
      }),
    ).toBeNull();
  });
});
