import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

function baseMeasurements() {
  return {
    finished_bust_chest: 40,
    back_neck_to_hem: 22,
    armhole_depth: 8,
    neck_opening: 3,
    shoulder_width: 4.25,
    front_neck_depth: 3,
    back_neck_depth: 1,
  };
}

function gauge() {
  return {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  };
}

function extractCastOnFromRows(rows: readonly SleevelessPatternDisplayRow[]): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs) continue;
    for (const p of row.paragraphs) {
      const m = p.match(/Cast on (\d+) stitches/i);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function pieceTitle(rows: readonly SleevelessPatternDisplayRow[]): string | undefined {
  const p = rows.find((r) => r.kind === "piece");
  return p?.kind === "piece" ? p.title : undefined;
}

describe("generateSleevelessBackPattern cardigan (round neck, open front)", () => {
  it("writes left front cast-on as half of back cast-on", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "open" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    const backCastOn = extractCastOnFromRows(r.displayRows);
    const frontCastOn = extractCastOnFromRows(r.frontDisplayRows);
    expect(backCastOn).toBeDefined();
    expect(frontCastOn).toBeDefined();
    expect(r.debug.backStitches).toBe(backCastOn);
    expect(frontCastOn).toBe(Math.ceil((r.debug.backStitches ?? 0) / 2));
    expect(r.debug.cardiganHalfLeftCastOnSts).toBe(frontCastOn);
    expect(pieceTitle(r.frontDisplayRows)).toBe("LEFT FRONT");
  });

  it("keeps pullover closed front cast-on equal to back cast-on", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "closed" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    const backCastOn = extractCastOnFromRows(r.displayRows);
    const frontCastOn = extractCastOnFromRows(r.frontDisplayRows);
    expect(backCastOn).toBe(frontCastOn);
    expect(r.debug.cardiganHalfLeftCastOnSts).toBeUndefined();
    expect(pieceTitle(r.frontDisplayRows)).toBe("FRONT");
  });

  it("matches cardigan front total rows and shoulder stitches to back", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "open" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    expect(r.debug.frontFinalRow).toBe(r.debug.backFinalRow);
    expect(r.debug.expectedGarmentRows).toBe(r.debug.backFinalRow);
    expect(r.debug.stitchesAfterArmhole).toBeGreaterThan(
      r.debug.cardiganHalfLeftStitchesAfterArmhole ?? 0,
    );
    expect(r.debug.cardiganHalfLeftStitchesAfterArmhole).toBe(
      r.debug.stitchesAfterArmhole !== undefined ? r.debug.stitchesAfterArmhole / 2 : undefined,
    );
  });

  it("does not halve front cast-on for V-neck cardigan (V cardigan logic deferred)", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "v-neck", garmentStyle: "cardigan" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    const backCastOn = extractCastOnFromRows(r.displayRows);
    const frontCastOn = extractCastOnFromRows(r.frontDisplayRows);
    expect(frontCastOn).toBe(backCastOn);
    expect(r.debug.cardiganHalfLeftCastOnSts).toBeUndefined();
  });

  it("halves round-neck front when garmentStyle is cardigan (round neckline)", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", garmentStyle: "cardigan" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    expect(r.debug.cardiganHalfLeftCastOnSts).toBeDefined();
    expect(extractCastOnFromRows(r.frontDisplayRows)).toBe(r.debug.cardiganHalfLeftCastOnSts);
  });
});

describe("diagram vs written cardigan left front", () => {
  it("BUST_STS matches debug.cardiganHalfLeftCastOnSts when present", () => {
    const r = generateSleevelessBackPattern({
      fit: { selectedMeasurements: baseMeasurements() },
      style: { neckline: "round", frontStyle: "open" },
      yarnGaugeMachine: gauge(),
    } as Record<string, unknown>);

    const written = r.debug.cardiganHalfLeftCastOnSts;
    expect(written).toBeDefined();

    const repl = buildSleevelessGarmentDiagramReplacements(r, "in", {
      patternData: { style: { neckline: "round", frontStyle: "open" } },
      measurementPiece: "front",
      cardiganHalfSide: "left",
    });

    expect(repl.BUST_STS).toBe(String(written));
    expect(repl.SHOULDER_STS).toBe(
      r.debug.stitchesAfterArmhole !== undefined ? String(Math.round(r.debug.stitchesAfterArmhole)) : "",
    );
  });
});
