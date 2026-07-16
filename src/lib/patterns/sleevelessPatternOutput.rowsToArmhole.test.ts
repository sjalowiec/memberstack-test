import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

function extractBodyPlainRowCount(rows: readonly SleevelessPatternDisplayRow[]): number | undefined {
  let inBody = false;
  for (const row of rows) {
    if (row.kind === "section" && row.title === "BODY") {
      inBody = true;
      continue;
    }
    if (row.kind === "section") {
      inBody = false;
    }
    if (!inBody || row.kind !== "block") continue;
    const p0 = (row.paragraphs?.[0] ?? row.trustedParagraphs?.[0] ?? "").trim();
    const m1 = p0.match(/^Knit in pattern for (\d+) rows\.?$/i);
    if (m1) return parseInt(m1[1], 10);
    // Preferred wording: "Knit to RC N." with block header `RC: 014` (space after colon).
    const m2 = p0.match(/^Knit to RC:?\s*(\d+)\.?$/i);
    if (m2 && row.rc) {
      const rm = row.rc.match(/^RC:\s*(\d+)$/);
      const start = rm ? parseInt(rm[1], 10) : NaN;
      const target = parseInt(m2[1], 10);
      if (Number.isFinite(start) && Number.isFinite(target) && target > start) return target - start;
    }
    return undefined;
  }
  return undefined;
}

function baseFit(overrides: Record<string, unknown> = {}) {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
    ...overrides,
  };
}

describe("rows from cast-on to armhole start (canonical)", () => {
  it("round neck: back and front BODY row counts match debug.bodyRows", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseFit() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    } as Record<string, unknown>);

    const backBody = extractBodyPlainRowCount(r.displayRows);
    const frontBody = extractBodyPlainRowCount(r.frontDisplayRows);
    expect(backBody).toBe(r.debug.bodyRows);
    expect(frontBody).toBe(r.debug.bodyRows);
    expect(r.debug.rowsFromCastOnToArmholeStart).toBe(r.debug.hemRows + r.debug.bodyRows);
  });

  it("round neck: deep front neck still keeps front BODY rows equal to back (clamp uses armhole-local RC)", () => {
    const r = generateSleevelessBackPattern({
      fit: {
        selectedMeasurements: baseFit({
          front_neck_depth: 7,
          armhole_depth: 8,
        }),
      },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    } as Record<string, unknown>);

    expect(extractBodyPlainRowCount(r.frontDisplayRows)).toBe(extractBodyPlainRowCount(r.displayRows));
    expect(extractBodyPlainRowCount(r.displayRows)).toBe(r.debug.bodyRows);
  });

  it("V-neck: back and front BODY row counts match", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseFit() },
      style: { neckline: "v-neck", frontStyle: "closed" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    } as Record<string, unknown>);

    expect(extractBodyPlainRowCount(r.frontDisplayRows)).toBe(extractBodyPlainRowCount(r.displayRows));
  });

  it("round cardigan left front: BODY rows match back", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseFit() },
      style: { neckline: "round", frontStyle: "open" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    } as Record<string, unknown>);

    expect(extractBodyPlainRowCount(r.frontDisplayRows)).toBe(extractBodyPlainRowCount(r.displayRows));
  });

  it("V cardigan (full-width front path): BODY rows match back", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseFit() },
      style: { neckline: "v-neck", garmentStyle: "cardigan" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    } as Record<string, unknown>);

    expect(extractBodyPlainRowCount(r.frontDisplayRows)).toBe(extractBodyPlainRowCount(r.displayRows));
  });
});
