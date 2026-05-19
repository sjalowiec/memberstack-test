import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { calculateHemRows, getDefaultHemLengthInches } from "./hemDefaults";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

const baseDebug = {
  stitchesPerInch: 81 / 40,
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
  it("includes HEM_ROWS and HEM_INCHES from debug hemRows and default band depth", () => {
    const patternData = { fit: { sizingChart: "woman" } };
    const audience = "woman";
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
    });

    expect(repl.HEM_ROWS).toBe(String(baseDebug.hemRows));
    expect(repl.HEM_INCHES).toBe(String(getDefaultHemLengthInches(audience)));
    expect(repl.HEM_INCHES).toBe("2");
  });

  it("derives HEM_ROWS from calculateHemRows when debug.hemRows is missing", () => {
    const patternData = { fit: { sizingChart: "woman" } };
    const { hemRows: _omit, ...debugWithoutHemRows } = baseDebug;
    const result = { debug: debugWithoutHemRows } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "back",
    });

    expect(repl.HEM_ROWS).toBe(String(calculateHemRows(baseDebug.rowsPerInch, "woman")));
    expect(repl.HEM_ROWS).toBe("20");
  });

  it("uses baby default hem depth for HEM_INCHES when audience is baby", () => {
    const patternData = { style: { recipientCategory: "baby" } };
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(repl.HEM_INCHES).toBe("1");
    expect(repl.HEM_ROWS).toBe(String(baseDebug.hemRows));
  });

  it("converts HEM_INCHES to cm when unit is cm", () => {
    const patternData = { fit: { sizingChart: "woman" } };
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "cm", {
      patternData,
      measurementPiece: "front",
    });

    expect(repl.UNIT).toBe("cm");
    expect(repl.HEM_INCHES).toBe("5.1");
  });

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

  it("provides HIP_STS (not HIP_ROWS) for diagram token replacement", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });
    expect(repl).toHaveProperty("HIP_STS");
    expect(repl).toHaveProperty("HIP_INCHES");
    expect(repl).not.toHaveProperty("HIP_ROWS");
  });

  it("includes HIP_STS and HIP_INCHES defaulting hip to bust when finished_hip is absent", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });

    expect(repl.HIP_STS).toBe(String(baseDebug.backStitches));
    expect(repl.HIP_INCHES).toBe("20");
    expect(repl.HIP_INCHES).toBe(repl.BUST_WIDTH);
  });

  it("uses chart finished_hip for HIP tokens when present", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;
    const patternData = {
      fit: { selectedMeasurements: { finished_hip: 44, finished_bust_chest: 40 } },
    };

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
    });

    expect(repl.HIP_INCHES).toBe("22");
    expect(repl.HIP_STS).toBe("89");
    expect(repl.BUST_WIDTH).toBe("20");
  });

  it("halves HIP tokens on cardigan half schematic", () => {
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

    expect(Number(replCardigan.HIP_STS)).toBeLessThan(Number(replPullover.HIP_STS));
    expect(Number(replCardigan.HIP_STS) + Number(replCardigan.HIP_STS)).toBe(
      Number(replPullover.HIP_STS) + 1,
    );
    expect(replCardigan.HIP_INCHES).toBe("10");
    expect(replPullover.HIP_INCHES).toBe("20");
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
    expect(replCardigan.HEM_ROWS).toBe(replPullover.HEM_ROWS);
    expect(replCardigan.HEM_INCHES).toBe(replPullover.HEM_INCHES);
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
