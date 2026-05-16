import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const baseDebug = {
  rowsPerInch: 10,
  hemRows: 20,
  bodyRows: 80,
  finishedBustChest: 40,
  backStitches: 81,
  stitchesAfterArmhole: 60,
  shoulderWidthInches: 16,
  necklineStitches: 30,
  necklineWidthInches: 8,
  reservedNecklineShoulderInches: 3,
  reservedNecklineShoulderRows: 30,
  armholeRows: 40,
  armholeDepth: 4,
  backNeckToHem: 22,
};

describe("buildSleevelessGarmentDiagramReplacements", () => {
  it("uses half body cast-on for cardigan left half BUST_STS (from backStitches)", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(repl.BUST_STS).toBe("41");
    expect(repl.PIECE_TITLE).toBe("LEFT FRONT");
    expect(repl.OPENING_STS).toBe("0");
  });

  it("keeps full shoulder tokens on cardigan half (same as back / pullover front)", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const replCardigan = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    const replPullover = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
    });

    expect(replCardigan.SHOULDER_STS).toBe("60");
    expect(replCardigan.SHOULDER_STS).toBe(replPullover.SHOULDER_STS);
    expect(replCardigan.SHOULDER_WIDTH).toBe(replPullover.SHOULDER_WIDTH);
  });

  it("halves neck tokens on cardigan half schematic only (CF split)", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const replCardigan = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "right",
    });
    const replPullover = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
    });

    expect(replCardigan.NECK_STS).toBe("15");
    expect(replPullover.NECK_STS).toBe("30");
  });

  it("keeps row and armhole tokens identical to pullover when cardigan half", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const replCardigan = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    const replPullover = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
    });

    expect(replCardigan.ARMHOLE_ROWS).toBe(replPullover.ARMHOLE_ROWS);
    expect(replCardigan.ARMHOLE_DEPTH).toBe(replPullover.ARMHOLE_DEPTH);
    expect(replCardigan.SIDE_LENGTH_ROWS).toBe(replPullover.SIDE_LENGTH_ROWS);
    expect(replCardigan.HEIGHT).toBe(replPullover.HEIGHT);
  });

  it("uses right half cast-on from same body/back geometry", () => {
    const result = { debug: { ...baseDebug, backStitches: 81 } } as unknown as SleevelessBackPatternResult;

    const left = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    const right = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "right",
    });

    expect(left.BUST_STS).toBe("41");
    expect(right.BUST_STS).toBe("40");
    expect(Number(left.BUST_STS) + Number(right.BUST_STS)).toBe(81);
  });
});
