import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "../sleevelessPatternOutput";

/**
 * Math-only checks for the sleeveless back pipeline. Entry point:
 * {@link generateSleevelessBackPattern} (uses {@link calculateBasicPatternNumbers},
 * armhole shaping, and {@link buildNeckShoulderTimelineAndChartRows} → `buildTimeline`).
 */

describe("sleeveless pattern math (basic misses / straight body / round neck)", () => {
  const basicMissesStraightRoundNeck: Record<string, unknown> = {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        /** Finished circumference — treat as standard ease when taken from the misses chart. */
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 2,
        shoulder_width: 4.25,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };

  it("produces consistent positive stitch math and balanced neckline chart rows", () => {
    const result = generateSleevelessBackPattern(basicMissesStraightRoundNeck);
    const d = result.debug;

    expect(d.backStitches, "cast-on stitches").toBeGreaterThan(0);
    expect(d.stitchesAfterArmhole, "stitches after armhole (B)").toBeDefined();
    expect(d.stitchesAfterArmhole!).toBeGreaterThan(0);
    expect(d.necklineStitches, "neckline stitches (N)").toBeDefined();
    expect(d.necklineStitches!).toBeGreaterThan(0);
    expect(d.centerNeckBindOffStitches, "initial center neck bind-off").toBeDefined();
    expect(d.centerNeckBindOffStitches!).toBeGreaterThan(0);

    expect(d.shoulderStitches, "shoulder sts per side").toBeDefined();
    expect(d.shoulderStitches!).toBeGreaterThan(0);

    const B = d.stitchesAfterArmhole!;
    const N = d.necklineStitches!;
    const stitchesAfterNeckline = B - N;
    expect(stitchesAfterNeckline).toBe(d.shoulderStitches! * 2);

    expect(result.neckShoulderChartUsesLiveRows).toBe(true);
    expect(result.neckShoulderShapingChart.rows.length).toBeGreaterThan(0);

    for (const row of result.neckShoulderShapingChart.rows) {
      expect(row.leftStitchCount, `row ${row.row} left`).toBeGreaterThanOrEqual(0);
      expect(row.rightStitchCount, `row ${row.row} right`).toBeGreaterThanOrEqual(0);
    }

    const tl = result.backNeckShoulderTimeline;
    expect(tl).toBeDefined();
    expect(tl!.length).toBeGreaterThan(0);

    const last = tl![tl!.length - 1]!;
    expect(last.stitchesL).toBe(last.stitchesR);

    const chartLast = result.neckShoulderShapingChart.rows[result.neckShoulderShapingChart.rows.length - 1]!;
    expect(chartLast.leftStitchCount).toBe(chartLast.rightStitchCount);
  });

  /** Snapshot from {@link generateSleevelessBackPattern} for {@link basicMissesStraightRoundNeck} — fails if math drifts. */
  it("known-answer: fixed misses / straight / round-neck garment math", () => {
    const result = generateSleevelessBackPattern(basicMissesStraightRoundNeck);
    const d = result.debug;
    const chartRows = result.neckShoulderShapingChart.rows;
    const lastChart = chartRows[chartRows.length - 1]!;
    const lastTl = result.backNeckShoulderTimeline!.at(-1)!;

    expect(d.backStitches).toBe(100);
    expect(d.stitchesAfterArmhole).toBe(22);
    expect(d.necklineStitches).toBe(10);
    expect(d.centerNeckBindOffStitches).toBe(2);
    expect(d.shoulderStitches).toBe(6);
    expect(chartRows.length).toBe(7);
    expect(lastChart.leftStitchCount).toBe(0);
    expect(lastChart.rightStitchCount).toBe(0);
    expect(lastTl.stitchesL).toBe(0);
    expect(lastTl.stitchesR).toBe(0);
  });

  /**
   * Very shallow back neck: `back_neck_depth` small enough to collapse the row budget to a single
   * timeline row at 7 rows/in (no hard-coded expected numbers — invariants only).
   */
  it("edge case: very shallow back neck depth still produces valid chart math", () => {
    const shallowBackNeck: Record<string, unknown> = {
      ...basicMissesStraightRoundNeck,
      fit: {
        ...(basicMissesStraightRoundNeck.fit as object),
        selectedMeasurements: {
          ...(
            basicMissesStraightRoundNeck.fit as {
              selectedMeasurements: Record<string, unknown>;
            }
          ).selectedMeasurements,
          /** ~1" / 7 ≈ one row of depth at 7 rpi — forces minimal neckline/shoulder row span. */
          back_neck_depth: 1 / 7,
        },
      },
    };

    const result = generateSleevelessBackPattern(shallowBackNeck);
    const d = result.debug;

    expect(d.backStitches).toBeGreaterThan(0);
    expect(d.stitchesAfterArmhole).toBeDefined();
    expect(d.stitchesAfterArmhole!).toBeGreaterThan(0);
    expect(d.necklineStitches).toBeDefined();
    expect(d.necklineStitches!).toBeGreaterThan(0);
    expect(d.centerNeckBindOffStitches).toBeDefined();
    expect(d.centerNeckBindOffStitches!).toBeGreaterThan(0);
    expect(d.shoulderStitches).toBeDefined();
    expect(d.shoulderStitches!).toBeGreaterThan(0);

    expect(result.neckShoulderShapingChart.rows.length).toBeGreaterThan(0);
    for (const row of result.neckShoulderShapingChart.rows) {
      expect(row.leftStitchCount).toBeGreaterThanOrEqual(0);
      expect(row.rightStitchCount).toBeGreaterThanOrEqual(0);
    }

    const tl = result.backNeckShoulderTimeline;
    expect(tl?.length).toBeGreaterThan(0);
    const lastTl = tl!.at(-1)!;
    expect(lastTl.stitchesL).toBe(lastTl.stitchesR);

    const lastChart = result.neckShoulderShapingChart.rows.at(-1)!;
    expect(lastChart.leftStitchCount).toBe(lastChart.rightStitchCount);

    expect(typeof result.neckShoulderChartUsesLiveRows).toBe("boolean");
    expect(typeof result.frontNeckShoulderChartUsesLiveRows).toBe("boolean");
    // When live chart rows are unavailable, both sides use the bundled demo chart (see result type doc).
    if (!result.neckShoulderChartUsesLiveRows) {
      expect(result.frontNeckShoulderChartUsesLiveRows).toBe(false);
    }
  });

  /**
   * Odd raw stitch count from inches × gauge: 2.2" × 5 sts/in → 11 (odd); pipeline should snap to an even N.
   */
  it("odd neck opening inches normalize to an even necklineStitches count", () => {
    const oddRawNeckStitches: Record<string, unknown> = {
      ...basicMissesStraightRoundNeck,
      fit: {
        ...(basicMissesStraightRoundNeck.fit as object),
        selectedMeasurements: {
          ...(
            basicMissesStraightRoundNeck.fit as {
              selectedMeasurements: Record<string, unknown>;
            }
          ).selectedMeasurements,
          neck_opening: 2.2,
        },
      },
    };

    expect(Math.round(2.2 * 5)).toBe(11);

    const result = generateSleevelessBackPattern(oddRawNeckStitches);
    const d = result.debug;

    expect(d.necklineStitches).toBeDefined();
    expect(d.necklineStitches!).toBeGreaterThan(0);
    expect(d.necklineStitches! % 2).toBe(0);

    expect(d.centerNeckBindOffStitches).toBeDefined();
    expect(d.centerNeckBindOffStitches!).toBeGreaterThan(0);
    expect(d.shoulderStitches).toBeDefined();
    expect(d.shoulderStitches!).toBeGreaterThan(0);

    const lastChart = result.neckShoulderShapingChart.rows.at(-1)!;
    const lastTl = result.backNeckShoulderTimeline!.at(-1)!;
    expect(lastChart.leftStitchCount).toBe(lastChart.rightStitchCount);
    expect(lastTl.stitchesL).toBe(lastTl.stitchesR);

    for (const row of result.neckShoulderShapingChart.rows) {
      expect(row.leftStitchCount).toBeGreaterThanOrEqual(0);
      expect(row.rightStitchCount).toBeGreaterThanOrEqual(0);
    }
  });
});
