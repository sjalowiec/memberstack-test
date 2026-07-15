import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { applyGarmentDiagramSvgReplacements } from "./sleevelessGarmentDiagramSvg";
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
    const babyHemRows = calculateHemRows(baseDebug.rowsPerInch, "baby");
    const result = {
      debug: { ...baseDebug, hemRows: babyHemRows },
    } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(repl.HEM_INCHES).toBe("1");
    expect(repl.HEM_ROWS).toBe(String(babyHemRows));
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

  it("SHOULDER_BINDOFF_STS is per-side shoulder budget; NECK_* is neck opening on back schematic", () => {
    const result = {
      debug: { ...baseDebug, shoulderStitches: 15 },
    } as unknown as SleevelessBackPatternResult;

    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });

    expect(repl.SHOULDER_BINDOFF_STS).toBe("15");
    expect(repl.SHOULDER_STS).toBe(String(baseDebug.stitchesAfterArmhole));
    expect(repl.SHOULDER_BINDOFF_STS).not.toBe(repl.SHOULDER_STS);
    expect(repl.NECK_STS).toBe(String(baseDebug.necklineStitches));
    expect(repl.NECK_WIDTH).toBe(
      String(Math.round((baseDebug.necklineStitches / baseDebug.stitchesPerInch) * 10) / 10),
    );
  });

  it("replaces every token in diagram-back.svg including SHOULDER_BINDOFF_STS and NECK_WIDTH", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const result = {
      debug: { ...baseDebug, shoulderStitches: 15 },
    } as unknown as SleevelessBackPatternResult;
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });
    const svg = applyGarmentDiagramSvgReplacements(
      readFileSync(
        resolve("public/images/patterns/sleeveless/diagrams/diagram-back.svg"),
        "utf8",
      ),
      repl,
    );
    expect(svg).not.toMatch(/\{\{\s*[A-Z0-9_]+\s*\}\}/);
    expect(svg).toContain("15 sts");
    expect(svg).toContain("30 sts");
  });

  it("replaces every token in diagram-cardigan-round.svg with half-panel cardigan values", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const result = {
      debug: { ...baseDebug, shoulderStitches: 6 },
    } as unknown as SleevelessBackPatternResult;
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: { style: { garmentStyle: "cardigan", neckline: "round" } },
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    const svg = applyGarmentDiagramSvgReplacements(
      readFileSync(
        resolve("public/images/patterns/sleeveless/diagrams/diagram-cardigan-round.svg"),
        "utf8",
      ),
      repl,
    );
    expect(svg).not.toMatch(/\{\{\s*[A-Z0-9_]+\s*\}\}/);
    expect(repl.BUST_STS).toBe("41");
    expect(repl.NECK_STS).toBe("15");
    expect(repl.SHOULDER_BINDOFF_STS).toBe("6");
    expect(repl.PIECE_TITLE).toBe("LEFT FRONT");
    expect(svg).toContain("41sts");
    expect(svg).toContain("6");
  });

  it("cross-back label uses post-armhole body width (full pullover, half cardigan), not per-side shoulder", () => {
    const result = {
      debug: { ...baseDebug, shoulderStitches: 15 },
    } as unknown as SleevelessBackPatternResult;

    const replCardigan = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: { style: { frontStyle: "open" } },
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });
    const replPullover = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
    });

    // Pullover/back cross-back = full post-armhole width (stitchesAfterArmhole), never per-side shoulder.
    expect(replPullover.SHOULDER_STS).toBe(String(baseDebug.stitchesAfterArmhole));
    expect(replPullover.SHOULDER_STS).not.toBe("15");
    // Cardigan half front shows that panel's half of the post-armhole width (60 → 30).
    expect(replCardigan.SHOULDER_STS).toBe("30");
    // Both stitch count and inch label derive from the same post-armhole stitch count.
    expect(replPullover.SHOULDER_WIDTH).toBe(
      String(Math.round((baseDebug.stitchesAfterArmhole / baseDebug.stitchesPerInch) * 10) / 10),
    );
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

  it("provides HIP_STS, HIP_ROWS, and HIP_INCHES for diagram token replacement", () => {
    const result = { debug: { ...baseDebug } } as unknown as SleevelessBackPatternResult;
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });
    expect(repl).toHaveProperty("HIP_STS");
    expect(repl).toHaveProperty("HIP_INCHES");
    expect(repl).toHaveProperty("HIP_ROWS");
    expect(repl.HIP_ROWS).toBe("");
  });

  it("uses hipRowsFromHem 0 when hip line is at cast-on (A-line)", () => {
    const result = {
      debug: { ...baseDebug, hipRowsFromHem: 0, hemCastOnStitches: 90 },
    } as unknown as SleevelessBackPatternResult;
    const repl = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });
    expect(repl.HIP_ROWS).toBe("0");
    expect(repl.HIP_STS).toBe("90");
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

    // Half-panel convention: HIP_STS and HIP_INCHES both derive from finished_hip (44in).
    // 44 * (81/40) / 2 = 44.55 -> 45 sts, which matches 22in at gauge (45 / 2.025 ≈ 22.2in).
    expect(repl.HIP_INCHES).toBe("22");
    expect(repl.HIP_STS).toBe("45");
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

  it("SIDE_LENGTH above hem excludes hem rows from cast-on-to-armhole", () => {
    const debug = {
      ...baseDebug,
      rowsPerInch: 11,
      hemRows: 22,
      bodyRows: 143,
      rowsFromCastOnToArmholeStart: 165,
      backNeckToHem: 22,
    };
    const result = { debug } as unknown as SleevelessBackPatternResult;

    const replBack = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "back",
    });
    const replFront = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
    });
    const replCardigan = buildSleevelessGarmentDiagramReplacements(result, "in", {
      patternData: {},
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(replBack.SIDE_LENGTH_ROWS).toBe("143");
    expect(replBack.SIDE_LENGTH).toBe("13");
    expect(replFront.SIDE_LENGTH_ROWS).toBe(replBack.SIDE_LENGTH_ROWS);
    expect(replFront.SIDE_LENGTH).toBe(replBack.SIDE_LENGTH);
    expect(replCardigan.SIDE_LENGTH_ROWS).toBe(replBack.SIDE_LENGTH_ROWS);
    expect(replCardigan.SIDE_LENGTH).toBe(replBack.SIDE_LENGTH);
    expect(Number(replBack.SIDE_LENGTH_ROWS)).toBe(
      debug.rowsFromCastOnToArmholeStart - debug.hemRows,
    );
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

describe("buildDropShoulderSleeveDiagramReplacements", () => {
  it("fills drop-shoulder sleeve schematic tokens from debug", async () => {
    const { buildDropShoulderSleeveDiagramReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        rowsPerInch: 10,
        dropShoulderSleeveTotalRows: 120,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveLengthInches: 12,
        dropShoulderUpperArmInches: 16,
        dropShoulderUpperArmRows: 40,
        dropShoulderCuffDepthInches: 2,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveDiagramReplacements(result, "in");

    expect(repl.UNIT).toBe("in");
    expect(repl.ARM_LENGTH_ROWS).toBe("120");
    expect(repl.ARM_LENGTH).toBe("12");
    expect(repl.UPPER_ARM_ROWS).toBe("40");
    expect(repl.UPPER_ARM_INCHES).toBe("16");
    expect(repl.CUFF_ROWS).toBe("20");
    expect(repl.CUFF_INCHES).toBe("2");
    expect(repl.SLEEVE_CAP_STS).toBe("");
    expect(repl.WRIST_STS).toBe("");
  });

  it("fills new drop-body-sleeve.svg measurement tokens from extended debug", async () => {
    const { buildDropShoulderSleeveDiagramReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        rowsPerInch: 10,
        dropShoulderSleeveTotalRows: 120,
        dropShoulderSleeveBodyRows: 100,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveLengthInches: 12,
        dropShoulderSleeveTopStitches: 80,
        dropShoulderSleeveWristStitches: 40,
        dropShoulderWristInches: 8,
        dropShoulderUpperArmInches: 16,
        dropShoulderUpperArmRows: 40,
        dropShoulderCuffDepthInches: 2,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveDiagramReplacements(result, "in");

    expect(repl.SLEEVE_CAP_STS).toBe("80");
    expect(repl.SLEEVE_CAP_WIDTH).toBe("16");
    expect(repl.WRIST_STS).toBe("40");
    expect(repl.WRIST_WIDTH).toBe("8");
    expect(repl.SLEEVE_LENGTH_ROWS).toBe("100");
    expect(repl.CUFF_DEPTH).toBe("2");
  });

  it("derives sleeve body rows from total − cuff so remainder rows match bind-off RC", async () => {
    const { buildDropShoulderSleeveDiagramReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        rowsPerInch: 11,
        dropShoulderSleeveTotalRows: 94,
        dropShoulderSleeveBodyRows: 70,
        dropShoulderSleeveCuffRows: 22,
        dropShoulderSleeveLengthInches: 8.5,
        dropShoulderSleeveTopStitches: 42,
        dropShoulderSleeveWristStitches: 32,
        dropShoulderWristInches: 4.5,
        dropShoulderUpperArmInches: 6,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveDiagramReplacements(result, "in");

    expect(repl.SLEEVE_LENGTH_ROWS).toBe("72");
    expect(repl.SIDE_LENGTH).toBe("6.5");
    expect(repl.CUFF_ROWS).toBe("22");
    expect(repl.ARM_LENGTH_ROWS).toBe("94");
    expect(repl.ARM_LENGTH).toBe("8.5");
    expect(Number(repl.SLEEVE_LENGTH_ROWS) + Number(repl.CUFF_ROWS)).toBe(94);
  });

  it("does not fall back to full sleeve length inches on the body dimension line", async () => {
    const { buildDropShoulderSleeveDiagramReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        dropShoulderSleeveTotalRows: 94,
        dropShoulderSleeveBodyRows: 72,
        dropShoulderSleeveCuffRows: 22,
        dropShoulderSleeveLengthInches: 8.5,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveDiagramReplacements(result, "in");

    expect(repl.SLEEVE_LENGTH_ROWS).toBe("72");
    expect(repl.SIDE_LENGTH).toBe("");
    expect(repl.ARM_LENGTH).toBe("8.5");
  });

  describe("sleeve end labels follow physical diagram orientation", () => {
    const taperedDebug = {
      rowsPerInch: 10,
      dropShoulderSleeveTotalRows: 120,
      dropShoulderSleeveBodyRows: 100,
      dropShoulderSleeveCuffRows: 20,
      dropShoulderSleeveLengthInches: 12,
      dropShoulderSleeveTopStitches: 68,
      dropShoulderSleeveWristStitches: 22,
      dropShoulderWristInches: 5.3,
      dropShoulderUpperArmInches: 16.8,
      dropShoulderUpperArmRows: 40,
      dropShoulderCuffDepthInches: 2,
    };

    const reverseTaperDebug = {
      ...taperedDebug,
      dropShoulderSleeveTopStitches: 60,
      dropShoulderSleeveWristStitches: 70,
      dropShoulderWristInches: 14,
      dropShoulderUpperArmInches: 12,
    };

    const straightDebug = {
      ...taperedDebug,
      dropShoulderSleeveTopStitches: 40,
      dropShoulderSleeveWristStitches: 40,
      dropShoulderWristInches: 8,
      dropShoulderUpperArmInches: 8,
    };

    async function replFor(
      debug: Record<string, unknown>,
      direction: "cuff-up" | "top-down" = "cuff-up",
    ) {
      const { buildDropShoulderSleeveDiagramReplacements } = await import(
        "./sleevelessGarmentDiagramReplacements"
      );
      return buildDropShoulderSleeveDiagramReplacements(
        { debug } as import("./sleevelessPatternOutput").SleevelessBackPatternResult,
        "in",
        direction,
      );
    }

    /** Cuff-up: SLEEVE_CAP at top (upper arm), WRIST at bottom (cuff). */
    function expectCuffUpEnds(
      repl: Record<string, string>,
      upperArmSts: string,
      upperArmWidth: string,
      cuffSts: string,
      cuffWidth: string,
    ) {
      expect(repl.SLEEVE_CAP_STS).toBe(upperArmSts);
      expect(repl.SLEEVE_CAP_WIDTH).toBe(upperArmWidth);
      expect(repl.WRIST_STS).toBe(cuffSts);
      expect(repl.WRIST_WIDTH).toBe(cuffWidth);
    }

    /** Top-down: WRIST at top (cuff), SLEEVE_CAP at bottom (upper arm). */
    function expectTopDownEnds(
      repl: Record<string, string>,
      upperArmSts: string,
      upperArmWidth: string,
      cuffSts: string,
      cuffWidth: string,
    ) {
      expect(repl.WRIST_STS).toBe(cuffSts);
      expect(repl.WRIST_WIDTH).toBe(cuffWidth);
      expect(repl.SLEEVE_CAP_STS).toBe(upperArmSts);
      expect(repl.SLEEVE_CAP_WIDTH).toBe(upperArmWidth);
    }

    it("normal taper cuff-up: upper arm at top, cuff at bottom", async () => {
      const repl = await replFor(taperedDebug, "cuff-up");
      expectCuffUpEnds(repl, "68", "16.8", "22", "5.3");
    });

    it("normal taper top-down: cuff at top, upper arm at bottom", async () => {
      const repl = await replFor(taperedDebug, "top-down");
      expectTopDownEnds(repl, "68", "16.8", "22", "5.3");
    });

    it("reverse taper cuff-up: labels still follow physical upper-arm and cuff ends", async () => {
      const repl = await replFor(reverseTaperDebug, "cuff-up");
      expectCuffUpEnds(repl, "60", "12", "70", "14");
    });

    it("reverse taper top-down: labels follow correct ends after orientation reversal", async () => {
      const repl = await replFor(reverseTaperDebug, "top-down");
      expectTopDownEnds(repl, "60", "12", "70", "14");
    });

    it("straight sleeve: equal stitch counts do not break label placement", async () => {
      const cuffUp = await replFor(straightDebug, "cuff-up");
      const topDown = await replFor(straightDebug, "top-down");
      expectCuffUpEnds(cuffUp, "40", "8", "40", "8");
      expectTopDownEnds(topDown, "40", "8", "40", "8");
    });
  });
});

describe("buildDropShoulderSleeveJapaneseNotationReplacements", () => {
  it("fills sleeve shaping notation from the same schedule as written sleeve instructions", async () => {
    const { buildDropShoulderSleeveJapaneseNotationReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        dropShoulderSleeveBodyRows: 100,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveTopStitches: 80,
        dropShoulderSleeveWristStitches: 40,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result);

    expect(repl["jp-caston"]).toBe("co40 sts");
    expect(repl["jp-cuff"]).toBe("20r rows");
    expect(repl["jp-sleeve-shaping"]).toBe("1s-4r-20x");
    expect(repl["jp-sleeve"]).toBe("1s-4r-20x");
    expect(repl["jp-sleeve_cap_sts"]).toBe("80 sts");
  });

  it("leaves shaping blank and uses full body rows when there is no taper", async () => {
    const { buildDropShoulderSleeveJapaneseNotationReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const result = {
      debug: {
        dropShoulderSleeveBodyRows: 100,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveTopStitches: 40,
        dropShoulderSleeveWristStitches: 40,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result);

    expect(repl["jp-sleeve-shaping"]).toBe("");
    expect(repl["jp-sleeve"]).toBe("100r");
  });

  it("replaces every jp token in JP-drop-body-sleeve.svg", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { buildDropShoulderSleeveJapaneseNotationReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const {
      applyJapaneseNotationSvgReplacements,
      assertJapaneseNotationSvgFullyReplaced,
      listJapaneseNotationPlaceholdersInSvg,
    } = await import("./sleevelessJapaneseNotationSvg");

    const svgPath = resolve(
      process.cwd(),
      "public/images/patterns/drop-shoulder/JP-drop-body-sleeve.svg",
    );
    const svgText = readFileSync(svgPath, "utf8");
    const tokens = listJapaneseNotationPlaceholdersInSvg(svgText);

    expect(tokens.sort()).toEqual(
      ["jp-caston", "jp-cuff", "jp-sleeve", "jp-sleeve_cap_sts"].sort(),
    );

    const result = {
      debug: {
        dropShoulderSleeveBodyRows: 100,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveTopStitches: 80,
        dropShoulderSleeveWristStitches: 40,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result);
    expect(() => assertJapaneseNotationSvgFullyReplaced(svgText, repl)).not.toThrow();
    const out = applyJapaneseNotationSvgReplacements(svgText, repl);
    expect(out).toContain("co40 sts");
    expect(out).toContain("20r rows");
    expect(out).toContain("80 sts");
    expect(out).not.toMatch(/\{\{\s*jp-/i);
  });

  it("replaces every jp token in jp-drop-body-sleeve-top-down.svg", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const { buildDropShoulderSleeveJapaneseNotationReplacements } = await import(
      "./sleevelessGarmentDiagramReplacements"
    );
    const {
      applyJapaneseNotationSvgReplacements,
      assertJapaneseNotationSvgFullyReplaced,
      listJapaneseNotationPlaceholdersInSvg,
    } = await import("./sleevelessJapaneseNotationSvg");
    const { DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC } = await import(
      "./dropShoulderSleeveNotationSvg"
    );

    const svgPath = resolve(process.cwd(), "public" + DROP_SHOULDER_SLEEVE_NOTATION_TOP_DOWN_SRC);
    const svgText = readFileSync(svgPath, "utf8");
    const tokens = listJapaneseNotationPlaceholdersInSvg(svgText);

    expect(tokens.sort()).toEqual(
      ["jp-caston", "jp-cuff", "jp-sleeve", "jp-sleeve_cap_sts"].sort(),
    );

    const result = {
      debug: {
        dropShoulderSleeveBodyRows: 100,
        dropShoulderSleeveCuffRows: 20,
        dropShoulderSleeveTopStitches: 80,
        dropShoulderSleeveWristStitches: 40,
      },
    } as import("./sleevelessPatternOutput").SleevelessBackPatternResult;

    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result, "top-down");
    expect(() => assertJapaneseNotationSvgFullyReplaced(svgText, repl)).not.toThrow();
    const out = applyJapaneseNotationSvgReplacements(svgText, repl);
    expect(out).toContain("co80 sts");
    expect(out).toContain("20r rows");
    expect(out).toContain("40 sts");
    expect(out).not.toMatch(/\{\{\s*jp-/i);
  });
});
