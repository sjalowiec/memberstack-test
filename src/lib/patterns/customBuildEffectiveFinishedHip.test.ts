import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { resolveEffectiveFinishedHipInches } from "./customBuildEffectiveFinishedHip";

const baseMeasurements = {
  finished_bust_chest: 20,
  finished_hip: 20,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  neck_opening: 3,
  shoulder_width: 4.25,
  front_neck_depth: 3,
  back_neck_depth: 1,
};

function patternData(overrides: {
  patternMode?: string;
  hipOverride?: string;
  chestBustOverride?: string;
  chartFinishedHip?: number;
  chartFinishedBust?: number;
  bodyShape?: string;
} = {}): Record<string, unknown> {
  const fit: Record<string, unknown> = {
    selectedMeasurements: {
      ...baseMeasurements,
      finished_hip: overrides.chartFinishedHip ?? baseMeasurements.finished_hip,
      finished_bust_chest:
        overrides.chartFinishedBust ?? baseMeasurements.finished_bust_chest,
    },
  };
  if (overrides.hipOverride !== undefined || overrides.chestBustOverride !== undefined) {
    fit.cbMeasurementOverrides = {
      ...(overrides.hipOverride !== undefined ? { hip: overrides.hipOverride } : {}),
      ...(overrides.chestBustOverride !== undefined
        ? { chestBust: overrides.chestBustOverride }
        : {}),
    };
  }
  return {
    fit,
    style: {
      bodyShape: overrides.bodyShape ?? "aline",
      patternMode: overrides.patternMode ?? "express",
    },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("resolveEffectiveFinishedHipInches", () => {
  it("uses cbMeasurementOverrides.hip for Express when set", () => {
    expect(
      resolveEffectiveFinishedHipInches(
        patternData({ patternMode: "express", hipOverride: "22", chartFinishedHip: 20 }),
      ),
    ).toBe(22);
  });

  it("uses chart finished_hip for Express when no override", () => {
    expect(
      resolveEffectiveFinishedHipInches(patternData({ patternMode: "express", chartFinishedHip: 21 })),
    ).toBe(21);
  });
});

function extractCastOnFromRows(
  rows: { kind: string; paragraphs?: string[] }[],
): number | undefined {
  for (const row of rows) {
    if (row.kind !== "block" || !row.paragraphs) continue;
    for (const p of row.paragraphs) {
      const m = p.match(/Cast on (\d+) stitches/i);
      if (m) return Number(m[1]);
    }
  }
  return undefined;
}

function hasBodyShapingInstruction(
  rows: { kind: string; paragraphs?: string[]; trustedParagraphs?: string[] }[],
  pattern: RegExp,
): boolean {
  return rows.some((row) => {
    if (row.kind !== "block") return false;
    const paras = [...(row.paragraphs ?? []), ...(row.trustedParagraphs ?? [])];
    return paras.some((p) => pattern.test(p));
  });
}

describe("generateSleevelessBackPattern A-line body shaping", () => {
  it("casts on hip width and emits decrease rows when hip is wider than bust", () => {
    const r = generateSleevelessBackPattern(
      patternData({
        bodyShape: "aline",
        hipOverride: "28.8",
        chartFinishedHip: 20,
      }),
    );
    expect(r.debug.hemCastOnStitches).toBe(72);
    expect(r.debug.bustBodyStitches).toBe(50);
    expect(extractCastOnFromRows(r.displayRows)).toBe(72);
    expect(
      hasBodyShapingInstruction(
        r.displayRows,
        /1 stitch at each side edge \d+ times evenly across/,
      ),
    ).toBe(true);
  });

  it("casts on hip width with no shaping when hip matches bust", () => {
    const r = generateSleevelessBackPattern(
      patternData({ bodyShape: "aline", hipOverride: "20", chartFinishedHip: 20 }),
    );
    expect(r.debug.hemCastOnStitches).toBe(r.debug.bustBodyStitches);
    expect(extractCastOnFromRows(r.displayRows)).toBe(r.debug.bustBodyStitches);
    expect(
      hasBodyShapingInstruction(
        r.displayRows,
        /Decrease 1 stitch at each side edge|Increase 1 stitch at each side edge/,
      ),
    ).toBe(false);
  });
});

describe("generateSleevelessBackPattern hip cast-on (Express review overrides)", () => {
  it("casts on more stitches when hip is wider than bust (20 vs 22)", () => {
    const straight = generateSleevelessBackPattern(
      patternData({ hipOverride: "20", chartFinishedHip: 20 }),
    );
    const flared = generateSleevelessBackPattern(
      patternData({ hipOverride: "22", chartFinishedHip: 20 }),
    );

    expect(flared.debug.hemCastOnStitches).toBeGreaterThan(straight.debug.hemCastOnStitches!);
    expect(straight.debug.hemCastOnStitches).toBe(straight.debug.bustBodyStitches);
    expect(flared.debug.bustBodyStitches).toBe(straight.debug.bustBodyStitches);
  });

  it("uses hip cast-on when bodyShape is straight but review hip exceeds bust (38 vs 44)", () => {
    const r = generateSleevelessBackPattern(
      patternData({
        bodyShape: "straight",
        patternMode: "express",
        chestBustOverride: "38",
        hipOverride: "44",
        chartFinishedBust: 38,
        chartFinishedHip: 38,
      }),
    );
    expect(r.debug.bustBodyStitches).toBe(96);
    expect(r.debug.hemCastOnStitches).toBe(110);
    expect(r.debug.hemCastOnStitches).toBeGreaterThan(r.debug.bustBodyStitches!);
    expect(extractCastOnFromRows(r.displayRows)).toBe(110);
    expect(
      hasBodyShapingInstruction(
        r.displayRows,
        /1 stitch at each side edge \d+ times evenly across/,
      ),
    ).toBe(true);
  });

  it("stays straight when bust and hip match within tolerance (40 vs 40)", () => {
    const r = generateSleevelessBackPattern(
      patternData({
        bodyShape: "straight",
        patternMode: "express",
        chestBustOverride: "40",
        hipOverride: "40",
        chartFinishedBust: 40,
        chartFinishedHip: 40,
      }),
    );
    expect(r.debug.hemCastOnStitches).toBe(r.debug.bustBodyStitches);
    expect(
      hasBodyShapingInstruction(
        r.displayRows,
        /Decrease 1 stitch at each side edge|Increase 1 stitch at each side edge/,
      ),
    ).toBe(false);
  });

  it("uses hip cast-on for custom-build when review hip exceeds bust (overrides style straight)", () => {
    const r = generateSleevelessBackPattern(
      patternData({
        bodyShape: "straight",
        patternMode: "custom-build",
        chestBustOverride: "38",
        hipOverride: "44",
        chartFinishedBust: 38,
        chartFinishedHip: 38,
      }),
    );
    expect(r.debug.hemCastOnStitches).toBe(110);
    expect(r.debug.hemCastOnStitches).toBeGreaterThan(r.debug.bustBodyStitches!);
    expect(
      hasBodyShapingInstruction(
        r.displayRows,
        /1 stitch at each side edge \d+ times evenly across/,
      ),
    ).toBe(true);
  });

  it("honors explicit custom-build straight when hip matches bust", () => {
    const r = generateSleevelessBackPattern(
      patternData({
        bodyShape: "straight",
        patternMode: "custom-build",
        chestBustOverride: "40",
        hipOverride: "40",
        chartFinishedBust: 40,
        chartFinishedHip: 40,
      }),
    );
    expect(r.debug.hemCastOnStitches).toBe(r.debug.bustBodyStitches);
  });
});
