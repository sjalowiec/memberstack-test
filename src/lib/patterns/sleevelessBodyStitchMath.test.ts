import { describe, expect, it } from "vitest";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  resolveSleevelessBodyStitchCounts,
  sleevelessBackHalfStitchesFromCircumference,
} from "./sleevelessBodyStitchMath";

const baseMeasurements = {
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function patternData(overrides: {
  bust?: number;
  hip?: number;
  spi?: number;
  bodyShape?: string;
}): Record<string, unknown> {
  const fit: Record<string, unknown> = {
    selectedMeasurements: {
      ...baseMeasurements,
      finished_bust_chest: overrides.bust ?? 18,
      finished_hip: overrides.hip ?? 20,
    },
    cbMeasurementOverrides: {
      chestBust: String(overrides.bust ?? 18),
      hip: String(overrides.hip ?? 20),
    },
  };
  return {
    fit,
    style: { bodyShape: overrides.bodyShape ?? "aline", patternMode: "custom-build" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: overrides.spi ?? 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function extractCastOn(rows: { kind: string; paragraphs?: string[] }[]): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs) continue;
    for (const p of row.paragraphs) {
      const m = p.match(/Cast on (\d+) stitches/i);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function hasDecrease(rows: { kind: string; paragraphs?: string[] }[]): boolean {
  return rows.some(
    (row) =>
      row.kind === "block" &&
      row.paragraphs?.some((p) => /Decrease 1 stitch at each side edge/i.test(p)),
  );
}

function hasIncrease(rows: { kind: string; paragraphs?: string[] }[]): boolean {
  return rows.some(
    (row) =>
      row.kind === "block" &&
      row.paragraphs?.some((p) => /Increase 1 stitch at each side edge/i.test(p)),
  );
}

describe("sleevelessBackHalfStitchesFromCircumference", () => {
  it("uses half of circumference × gauge (even)", () => {
    expect(sleevelessBackHalfStitchesFromCircumference(20, 5)).toBe(50);
    expect(sleevelessBackHalfStitchesFromCircumference(18, 5)).toBe(46);
    expect(sleevelessBackHalfStitchesFromCircumference(20, 4)).toBe(40);
    expect(sleevelessBackHalfStitchesFromCircumference(18, 4)).toBe(36);
  });
});

describe("generateSleevelessBackPattern measurement body shaping", () => {
  it("straight style.bodyShape with bust 36 hip 40 gauge 4: decrease, cast-on 80, bust 72", () => {
    const data = patternData({ bust: 36, hip: 40, spi: 4, bodyShape: "straight" });
    const counts = resolveSleevelessBodyStitchCounts(data);
    expect(counts).toMatchObject({
      hasBodyShaping: true,
      shapingDirection: "decrease",
      bustBodyStitches: 72,
      hipCastOnStitches: 80,
    });
    const r = generateSleevelessBackPattern(data);
    expect(r.debug.hemCastOnStitches).toBe(80);
    expect(r.debug.bustBodyStitches).toBe(72);
    expect(extractCastOn(r.displayRows)).toBe(80);
    expect(hasDecrease(r.displayRows)).toBe(true);
  });

  it("equal bust and hip: no shaping, cast-on matches bust", () => {
    const data = patternData({ bust: 36, hip: 36, spi: 4, bodyShape: "straight" });
    const counts = resolveSleevelessBodyStitchCounts(data);
    expect(counts.hasBodyShaping).toBe(false);
    expect(counts.shapingDirection).toBe("straight");
    expect(counts.hipCastOnStitches).toBe(72);
    expect(counts.bustBodyStitches).toBe(72);
    const r = generateSleevelessBackPattern(data);
    expect(hasDecrease(r.displayRows)).toBe(false);
    expect(hasIncrease(r.displayRows)).toBe(false);
  });
  it("gauge 5 sts/in, bust 18, hip 20: cast-on 50, bust 45, BODY decreases", () => {
    const data = patternData({ bust: 18, hip: 20, spi: 5 });
    const counts = resolveSleevelessBodyStitchCounts(data);
    expect(counts).toMatchObject({
      effectiveBustInches: 18,
      effectiveHipInches: 20,
      stitchesPerInch: 5,
      bustBodyStitches: 46,
      hipCastOnStitches: 50,
      hasBodyShaping: true,
      shapingDirection: "decrease",
    });

    const r = generateSleevelessBackPattern(data);
    expect(r.debug.hemCastOnStitches).toBe(50);
    expect(r.debug.bustBodyStitches).toBe(46);
    expect(extractCastOn(r.displayRows)).toBe(50);
    expect(hasDecrease(r.displayRows)).toBe(true);

    const repl = buildSleevelessGarmentDiagramReplacements(r, "in", {
      patternData: data,
      measurementPiece: "back",
    });
    expect(repl.HIP_STS).toBe("50");
    expect(repl.BUST_STS).toBe("46");
    expect(repl.HIP_INCHES).toBe("10");
    expect(repl.BUST_WIDTH).toBe("9");
  });

  it("gauge 5 sts/in, bust 20, hip 18: cast-on 46, bust 50, BODY increases", () => {
    const data = patternData({ bust: 20, hip: 18, spi: 5 });
    const r = generateSleevelessBackPattern(data);
    expect(r.debug.hemCastOnStitches).toBe(46);
    expect(r.debug.bustBodyStitches).toBe(50);
    expect(extractCastOn(r.displayRows)).toBe(46);
    expect(hasIncrease(r.displayRows)).toBe(true);

    const repl = buildSleevelessGarmentDiagramReplacements(r, "in", {
      patternData: data,
      measurementPiece: "back",
    });
    expect(repl.HIP_STS).toBe("46");
    expect(repl.BUST_STS).toBe("50");
  });

  it("gauge 4 sts/in, bust 18, hip 20: counts follow gauge not stale 5 spi values", () => {
    const data = patternData({ bust: 18, hip: 20, spi: 4 });
    const r = generateSleevelessBackPattern(data);
    expect(r.debug.hemCastOnStitches).toBe(40);
    expect(r.debug.bustBodyStitches).toBe(36);

    const repl = buildSleevelessGarmentDiagramReplacements(r, "in", {
      patternData: data,
      measurementPiece: "back",
    });
    expect(repl.HIP_STS).toBe("40");
    expect(repl.BUST_STS).toBe("36");
  });
});
