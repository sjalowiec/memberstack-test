import { describe, expect, it } from "vitest";

import { calculateRoundNecklinePractice } from "./roundNecklinePractice";
import {
  expandRoundNecklinePracticeTimeline,
  validateRoundNecklinePracticeRowAccounting,
} from "./roundNecklinePracticeTimeline";

describe("roundNecklinePracticeTimeline", () => {
  it("expands 16/24 gauge timeline with 7 shaping rows and 11 even shoulder rows", () => {
    const result = calculateRoundNecklinePractice({
      stitchesPerFourInches: 16,
      rowsPerFourInches: 24,
    })!;

    expect(result.rowsBeforeNeckline).toBe(18);
    expect(result.neckDepthRows).toBe(18);
    expect(result.neckShapingRows).toBe(7);
    expect(result.rowsRemainingAfterFinalNecklineShaping).toBe(11);
    expect(result.neckShapingRows + result.rowsRemainingAfterFinalNecklineShaping).toBe(
      result.neckDepthRows,
    );

    const accounting = validateRoundNecklinePracticeRowAccounting(result);
    expect(accounting.shoulderEvenRows).toBe(11);
    expect(accounting.validationLines.some((l) => l.includes("Japanese notation matches"))).toBe(
      true,
    );

    const timeline = expandRoundNecklinePracticeTimeline(result);
    expect(timeline.find((e) => e.absoluteRow === 19)?.label).toMatch(/Bind off 8 \(center\)/);
    expect(timeline.find((e) => e.absoluteRow === 20)?.label).toBe("Bind off 3");
    expect(timeline.some((e) => e.label === "Rows 26-36: Knit even")).toBe(true);
    expect(timeline.at(-1)?.label).toBe("Bind off 18 shoulder stitches");
    expect(timeline.at(-1)?.absoluteRow).toBe(37);
  });

  it("expands 28/44 gauge deep-round timeline with matching JP notation counts", () => {
    const result = calculateRoundNecklinePractice({
      stitchesPerFourInches: 28,
      rowsPerFourInches: 44,
    })!;

    expect(result.neckShapingRows).toBe(14);
    expect(result.rowsRemainingAfterFinalNecklineShaping).toBe(19);
    expect(result.japaneseNotationLines).toEqual(["bo12", "3s-2r-2x", "1s-2r-6x"]);

    const accounting = validateRoundNecklinePracticeRowAccounting(result);
    expect(accounting.validationLines.some((l) => l.includes("WARNING"))).toBe(false);
    expect(accounting.japaneseNotationChecks.some((l) => l.includes("Stair bind-off segment repeats = 2"))).toBe(
      true,
    );
    expect(accounting.japaneseNotationChecks.some((l) => l.includes("Single-decrease segment repeats = 6"))).toBe(
      true,
    );
  });

  it("accounts for every knitted row exactly once through body, neck zone, and bind-off", () => {
    const result = calculateRoundNecklinePractice({
      stitchesPerFourInches: 28,
      rowsPerFourInches: 44,
    })!;

    const accounting = validateRoundNecklinePracticeRowAccounting(result);
    const covered = new Set<number>();

    for (const entry of accounting.timeline) {
      if (entry.phase === "body-even" && entry.label.startsWith("Rows 1-")) {
        for (let row = 1; row <= result.rowsBeforeNeckline; row += 1) {
          covered.add(row);
        }
      } else if (entry.label.startsWith("Rows ") && entry.label.includes("-")) {
        const match = /Rows (\d+)-(\d+)/.exec(entry.label);
        if (match) {
          for (let row = Number(match[1]); row <= Number(match[2]); row += 1) {
            covered.add(row);
          }
        }
      } else if (entry.neckZoneRow !== undefined || entry.phase === "center-bind-off") {
        covered.add(entry.absoluteRow);
      }
    }

    for (let row = 1; row <= result.totalRows; row += 1) {
      expect(covered.has(row)).toBe(true);
    }
    expect(covered.size).toBe(result.totalRows);
  });

  it("derives written instruction row counts from the same accounting object", () => {
    const result = calculateRoundNecklinePractice({
      stitchesPerFourInches: 16,
      rowsPerFourInches: 24,
    })!;

    expect(result.worksheetSteps[1]).toBe(`Knit ${result.rowsBeforeNeckline} rows even.`);
    expect(result.worksheetSteps[5]).toBe(
      `Knit ${result.rowsRemainingAfterFinalNecklineShaping} rows even to the shoulder.`,
    );

    const accounting = validateRoundNecklinePracticeRowAccounting(result);
    expect(accounting.bodyRows).toBe(result.rowsBeforeNeckline);
    expect(accounting.shoulderEvenRows).toBe(result.rowsRemainingAfterFinalNecklineShaping);
  });
});
