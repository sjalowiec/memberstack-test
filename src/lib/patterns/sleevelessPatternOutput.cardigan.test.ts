import { describe, expect, it } from "vitest";
import { formatCastOnNotation } from "./sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
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

function cardiganPattern(neckline: string): Record<string, unknown> {
  return {
    fit: { selectedMeasurements: baseMeasurements() },
    style: { neckline, garmentStyle: "cardigan", frontStyle: "open" },
    yarnGaugeMachine: gauge(),
  } as Record<string, unknown>;
}

function castOnFromJpNotation(token: string): number {
  const m = token.match(/^co(\d+)$/);
  return Number(m?.[1] ?? NaN);
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

  it.each(["round", "v-neck"] as const)(
    "writes left front cast-on as half of back cast-on for %s cardigan",
    (neckline) => {
      const patternData = cardiganPattern(neckline);
      const r = generateSleevelessBackPattern(patternData);

      const backCastOn = extractCastOnFromRows(r.displayRows);
      const frontCastOn = extractCastOnFromRows(r.frontDisplayRows);
      expect(backCastOn).toBeDefined();
      expect(frontCastOn).toBeDefined();
      expect(r.debug.backStitches).toBe(backCastOn);
      expect(frontCastOn).toBe(Math.ceil((r.debug.backStitches ?? 0) / 2));
      expect(r.debug.cardiganHalfLeftCastOnSts).toBe(frontCastOn);
      expect(pieceTitle(r.frontDisplayRows)).toBe("LEFT FRONT");
    },
  );

  it.each(["round", "v-neck"] as const)(
    "front written cast-on matches diagram HIP_STS and jp-caston for %s cardigan",
    (neckline) => {
      const patternData = cardiganPattern(neckline);
      const r = generateSleevelessBackPattern(patternData);
      const frontWritten = extractCastOnFromRows(r.frontDisplayRows);
      const diagramRepl = buildSleevelessGarmentDiagramReplacements(r, "in", {
        patternData,
        measurementPiece: "front",
      });
      const jpRepl = buildFrontJapaneseNotationReplacements(r, patternData);

      expect(frontWritten).toBe(Number(diagramRepl.HIP_STS));
      expect(frontWritten).toBe(castOnFromJpNotation(jpRepl["jp-caston"]));
      expect(frontWritten).toBe(r.debug.cardiganHalfLeftCastOnSts);
      expect(formatCastOnNotation(frontWritten!)).toBe(jpRepl["jp-caston"]);
    },
  );

  it.each(["round", "v-neck"] as const)(
    "back written cast-on stays full width for %s cardigan",
    (neckline) => {
      const r = generateSleevelessBackPattern(cardiganPattern(neckline));
      const backCastOn = extractCastOnFromRows(r.displayRows);
      const frontCastOn = extractCastOnFromRows(r.frontDisplayRows);

      expect(backCastOn).toBe(r.debug.backStitches);
      expect(frontCastOn).toBe(r.debug.cardiganHalfLeftCastOnSts);
      expect(backCastOn).not.toBe(frontCastOn);
    },
  );

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
  it.each(["round", "v-neck"] as const)(
    "BUST_STS uses half bust/body width; HIP_STS uses half hem cast-on (%s cardigan)",
    (neckline) => {
      const patternData = cardiganPattern(neckline);
      const r = generateSleevelessBackPattern(patternData);

      expect(r.debug.cardiganHalfLeftCastOnSts).toBeDefined();
      expect(r.debug.cardiganHalfLeftBustBodySts).toBeDefined();

      const repl = buildSleevelessGarmentDiagramReplacements(r, "in", {
        patternData,
        measurementPiece: "front",
        cardiganHalfSide: "left",
      });
      const frontWritten = extractCastOnFromRows(r.frontDisplayRows);

      expect(repl.BUST_STS).toBe(String(r.debug.cardiganHalfLeftBustBodySts));
      expect(repl.HIP_STS).toBe(String(r.debug.cardiganHalfLeftCastOnSts));
      expect(frontWritten).toBe(Number(repl.HIP_STS));
      // Cross-back label on a cardigan front shows that panel's post-armhole body width.
      expect(repl.SHOULDER_STS).toBe(String(r.debug.cardiganHalfLeftStitchesAfterArmhole));
    },
  );
});
