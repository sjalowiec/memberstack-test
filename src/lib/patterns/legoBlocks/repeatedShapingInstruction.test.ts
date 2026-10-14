import { describe, expect, it } from "vitest";
import { formatParentheticalRcList, formatRepeatedShapingInstruction } from "./repeatedShapingInstruction";

const repeatedRcLabel = /RC: \d{3}, RC:/;

describe("formatRepeatedShapingInstruction", () => {
  it("writes a decrease without the rows knitted between shaping rows", () => {
    const sentence = formatRepeatedShapingInstruction({
      action: "decrease",
      stitchesPerAction: 1,
      edgePhrase: "each armhole edge",
      interval: 2,
      actionRows: [6, 8, 10, 12],
    });
    expect(sentence).toBe(
      "Decrease 1 stitch at each armhole edge every other row, 4 times (RC: 006, 008, 010, 012).",
    );
    expect(sentence).not.toMatch(repeatedRcLabel);
  });

  it("uses the armhole edge for a single-edge decrease", () => {
    const sentence = formatRepeatedShapingInstruction({
      action: "decrease",
      stitchesPerAction: 1,
      edgePhrase: "the armhole edge",
      interval: 2,
      actionRows: [2, 4, 6, 8],
    });
    expect(sentence).toBe(
      "Decrease 1 stitch at the armhole edge every other row, 4 times (RC: 002, 004, 006, 008).",
    );
    expect(sentence).not.toMatch(repeatedRcLabel);
  });

  it("supports increases, bind-offs, holds, and other intervals", () => {
    const increase = formatRepeatedShapingInstruction({
      action: "increase",
      stitchesPerAction: 1,
      edgePhrase: "each side",
      interval: 4,
      actionRows: [4, 8, 12],
    });
    expect(increase).toBe("Increase 1 stitch at each side every 4 rows, 3 times (RC: 004, 008, 012).");
    expect(increase).not.toMatch(repeatedRcLabel);
    const bindOff = formatRepeatedShapingInstruction({
      action: "bind-off",
      stitchesPerAction: 2,
      edgePhrase: "each end",
      interval: 1,
      actionRows: [0, 1],
    });
    expect(bindOff).toBe("Bind off 2 stitches at each end every row, 2 times (RC: 000, 001).");
    expect(bindOff).not.toMatch(repeatedRcLabel);
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

  it("pads every reading and writes RC once", () => {
    expect(formatParentheticalRcList([6, 8, 10, 12])).toBe("(RC: 006, 008, 010, 012)");
    expect(formatParentheticalRcList([0, 1])).toBe("(RC: 000, 001)");
    expect(formatParentheticalRcList([4])).toBe("(RC: 004)");
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
