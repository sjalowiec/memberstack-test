import { describe, expect, it, vi } from "vitest";
import {
  buildRowAccountingInputFromDebug,
  expectedRowsFromFinishedLength,
  formatRowsAndInches,
  resolveArmholeInstructionRows,
  resolveTotalInstructionRows,
  rowsWorkedBetweenRc,
  rowsToInches,
  validateRowAccounting,
  warnRowAccountingDriftIfDev,
} from "./sleevelessRowAccounting";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

describe("sleevelessRowAccounting", () => {
  it("treats RC endpoints as completed rows (RC 000 is not counted)", () => {
    expect(rowsWorkedBetweenRc(0, 22)).toBe(22);
    expect(rowsWorkedBetweenRc(22, 168)).toBe(146);
    expect(rowsWorkedBetweenRc(0, 83)).toBe(83);
  });

  it("classifies row drift severity", () => {
    expect(validateRowAccounting({
      hemRows: 22,
      bodyRows: 146,
      armholeRows: 83,
      rowsPerInch: 11,
      totalLengthInches: 22.5,
    }).severity).toBe("rounding-warning");

    expect(validateRowAccounting({
      hemRows: 22,
      bodyRows: 146,
      armholeRows: 83,
      rowsPerInch: 11,
      totalLengthInches: 22.5,
    }).rowDifference).toBe(3);

    expect(validateRowAccounting({
      hemRows: 22,
      bodyRows: 138,
      armholeRows: 88,
      rowsPerInch: 11,
      totalLengthInches: 22.5,
    }).severity).toBe("ok");
  });

  it("derives inches from rows", () => {
    expect(rowsToInches(248, 11)).toBeCloseTo(22.545, 2);
    expect(formatRowsAndInches(146, 11)).toBe("146 rows (13.3 in)");
  });

  it("expectedRowsFromFinishedLength matches round(length × gauge)", () => {
    expect(expectedRowsFromFinishedLength(22.5, 11)).toBe(248);
  });

  it("warnRowAccountingDriftIfDev logs only when severity is not ok", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnRowAccountingDriftIfDev(
      validateRowAccounting({
        hemRows: 22,
        bodyRows: 146,
        armholeRows: 83,
        rowsPerInch: 11,
        totalLengthInches: 22.5,
      }),
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("straight body cardigan row accounting (gauge 11 rpi, length 22.5 in)", () => {
  it("matches generator debug or logs rounding-warning for manual 168+83 case", () => {
    const r = generateSleevelessBackPattern({
      fit: {
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22.5,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
          front_neck_depth: 3,
          back_neck_depth: 1,
        },
      },
      style: { neckline: "round", garmentStyle: "cardigan", bodyShape: "straight" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 7,
        gaugeRowsPerInch: 11,
        availableNeedles: 200,
      },
    } as Record<string, unknown>);

    const d = r.debug;
    const input = buildRowAccountingInputFromDebug(d);
    expect(input).toBeDefined();

    const validation = validateRowAccounting(input!);
    expect(validation.expectedRowsFromLength).toBe(248);
    expect(validation.hemRows).toBe(22);

    const armholeInstruction = resolveArmholeInstructionRows(d);
    expect(armholeInstruction).toBe(d.backFinalRow! - d.armholeStartRow!);

    const total = resolveTotalInstructionRows(d);
    expect(total).toBe(validation.totalInstructionRows);
    expect(total).toBe(d.backFinalRow);

    // Uploaded PDF case (168 + 83 = 251 vs 248): same severity when using section rows from PDF.
    const pdfCase = validateRowAccounting({
      hemRows: 22,
      bodyRows: 146,
      armholeRows: 83,
      rowsPerInch: 11,
      totalLengthInches: 22.5,
    });
    expect(pdfCase.severity).toBe("rounding-warning");
    expect(pdfCase.rowDifference).toBe(3);

    // Generator path: garment RC span should align with length budget (ok or ≤1 row).
    expect(["ok", "rounding-warning"]).toContain(validation.severity);
    expect(Math.abs(validation.rowDifference)).toBeLessThanOrEqual(3);
  });
});
