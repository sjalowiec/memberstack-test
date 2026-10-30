import { describe, expect, it } from "vitest";
import { calculateCuffRowsFromInches, getDefaultCuffLengthInches } from "../hemDefaults";
import { calculateDropShoulderSleevePieceNumbers } from "../dropShoulderSleevePieceNumbers";
import {
  cuffDepthInchesThatFitFinishedSleeveLength,
  resolveCuffUpSweaterSleevePiece,
} from "./sweaterSleeveCuff";

describe("sweater sleeve cuff lego", () => {
  it("keeps a normal cuff inside the requested sleeve length", () => {
    const sleeveLengthInches = 17;
    const rowsPerInch = 7;
    const cuffDepthInches = getDefaultCuffLengthInches("misses");
    expect(
      cuffDepthInchesThatFitFinishedSleeveLength(cuffDepthInches, sleeveLengthInches, rowsPerInch),
    ).toBe(cuffDepthInches);
    const piece = resolveCuffUpSweaterSleevePiece({
      patternData: { style: { patternMode: "express" } },
      audience: "misses",
      finishedUpperArmInches: 14,
      finishedWristInches: 8,
      sleeveLengthInches,
      stitchesPerInch: 5,
      rowsPerInch,
      keepRequestedSleeveLength: true,
    });
    const requestedRows = Math.round(sleeveLengthInches * rowsPerInch);
    expect(piece.cuffDepthInches).toBe(2);
    expect(piece.cuffRows).toBe(calculateCuffRowsFromInches(rowsPerInch, 2));
    expect(piece.sleeveTotalRows).toBe(requestedRows);
    expect(piece.sleeveBodyRows).toBe(requestedRows - piece.cuffRows);
    expect(piece).toEqual({
      ...calculateDropShoulderSleevePieceNumbers({
        finishedUpperArmInches: 14,
        finishedWristInches: 8,
        sleeveLengthInches,
        stitchesPerInch: 5,
        rowsPerInch,
        cuffDepthInches: 2,
      }),
      cuffDepthInches: 2,
    });
  });

  it("shortens a cuff that would make the finished sleeve longer than requested", () => {
    const sleeveLengthInches = 17;
    const rowsPerInch = 7;
    const fitted = cuffDepthInchesThatFitFinishedSleeveLength(20, sleeveLengthInches, rowsPerInch);
    expect(fitted).toBeLessThan(20);
    const piece = calculateDropShoulderSleevePieceNumbers({
      finishedUpperArmInches: 14,
      finishedWristInches: 8,
      sleeveLengthInches,
      stitchesPerInch: 5,
      rowsPerInch,
      cuffDepthInches: fitted,
    });
    expect(piece.sleeveTotalRows).toBe(Math.round(sleeveLengthInches * rowsPerInch));
    expect(piece.sleeveBodyRows).toBe(piece.sleeveTotalRows - piece.cuffRows);
    expect(piece.cuffRows).toBeGreaterThan(0);
  });

  it("reads a custom-build cuff override and ignores it on an express pattern", () => {
    const shared = {
      finishedUpperArmInches: 14,
      finishedWristInches: 8,
      sleeveLengthInches: 17,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      keepRequestedSleeveLength: true,
    };
    const custom = resolveCuffUpSweaterSleevePiece({
      ...shared,
      audience: "misses",
      patternData: {
        style: { patternMode: "custom-build" },
        fit: { cbMeasurementOverrides: { cuffDepth: "3.5" } },
      },
    });
    const express = resolveCuffUpSweaterSleevePiece({
      ...shared,
      audience: "misses",
      patternData: {
        style: { patternMode: "express" },
        fit: { cbMeasurementOverrides: { cuffDepth: "3.5" } },
      },
    });
    expect(custom.cuffDepthInches).toBe(3.5);
    expect(custom.cuffRows).toBe(calculateCuffRowsFromInches(7, 3.5));
    expect(custom.sleeveTotalRows).toBe(express.sleeveTotalRows);
    expect(custom.sleeveBodyRows).toBeLessThan(express.sleeveBodyRows);
    expect(express.cuffDepthInches).toBe(2);
  });

  it("honors a stored cuff, including zero, on every sleeved sweater", () => {
    const shared = {
      finishedUpperArmInches: 14,
      finishedWristInches: 8,
      sleeveLengthInches: 17,
      stitchesPerInch: 5,
      rowsPerInch: 7,
      keepRequestedSleeveLength: true,
    };
    for (const construction of ["drop-shoulder", "set-in-sleeve", "sideways-cardigan"] as const) {
      const deeper = resolveCuffUpSweaterSleevePiece({
        ...shared,
        audience: "misses",
        patternData: {
          style: { patternMode: "express", construction, constructionAuthored: construction },
          fit: { cbMeasurementOverrides: { cuffDepth: "3.5" } },
        },
      });
      const none = resolveCuffUpSweaterSleevePiece({
        ...shared,
        audience: "misses",
        patternData: {
          style: { patternMode: "express", construction, constructionAuthored: construction },
          fit: { cbMeasurementOverrides: { cuffDepth: "0" } },
        },
      });
      const untouched = resolveCuffUpSweaterSleevePiece({
        ...shared,
        audience: "misses",
        patternData: {
          style: { patternMode: "express", construction, constructionAuthored: construction },
          fit: { cbMeasurementOverrides: {} },
        },
      });
      expect(deeper.cuffDepthInches, construction).toBe(3.5);
      expect(deeper.sleeveTotalRows, construction).toBe(untouched.sleeveTotalRows);
      expect(deeper.sleeveBodyRows, construction).toBeLessThan(untouched.sleeveBodyRows);
      expect(none.cuffDepthInches, construction).toBe(0);
      expect(none.cuffRows, construction).toBe(0);
      expect(none.sleeveTotalRows, construction).toBe(untouched.sleeveTotalRows);
      expect(none.sleeveBodyRows, construction).toBe(none.sleeveTotalRows);
      expect(untouched.cuffDepthInches, construction).toBe(2);
    }
  });
});
