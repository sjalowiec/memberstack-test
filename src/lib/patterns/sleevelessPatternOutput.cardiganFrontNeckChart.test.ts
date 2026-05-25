import { describe, expect, it } from "vitest";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { parseDecreaseCellChart } from "./neckShoulderShapingChart";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { totalStitchesFromShapingNotationLines } from "./shoulderShapingNotation";
import { shoulderShapingNotationLinesFromTimeline } from "./shoulderShapingNotation";

function cardiganRoundPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function postArmholeFromFrontArmholeRows(
  rows: ReturnType<typeof generateSleevelessBackPattern>["frontDisplayRows"],
): number | undefined {
  let last: number | undefined;
  for (const row of rows) {
    if (row.kind !== "block") continue;
    if (!row.rc?.includes("ARMHOLE") && row.rc !== "RC:000" && row.rc !== "RC:001" && row.rc !== "RC:002") {
      continue;
    }
    if (row.stitchCount !== undefined) last = row.stitchCount;
  }
  return last;
}

describe("round cardigan front neckline / shoulder chart stitch counts", () => {
  const result = generateSleevelessBackPattern(cardiganRoundPattern());
  const chart = result.frontNeckShoulderShapingChart;
  const timeline = result.frontNeckShoulderTimeline;
  const d = result.debug;

  it("uses live cardigan front chart with no center divide row", () => {
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(chart.sleevelessCardiganFront).toBe(true);
    expect(timeline?.length).toBeGreaterThan(0);
    const centerEvents =
      timeline?.[0]?.events.filter((e) => e.side === "center" && e.kind === "bindOff") ?? [];
    expect(centerEvents.length).toBe(0);
  });

  it("starts active-shoulder table from post-armhole piece stitches, not half-shoulder after divide", () => {
    const postArmhole =
      d.cardiganFrontPostArmholeSts ?? postArmholeFromFrontArmholeRows(result.frontDisplayRows);
    expect(postArmhole).toBeDefined();
    expect(postArmhole).toBeGreaterThan(d.cardiganHalfLeftStitchesAfterArmhole ?? 0);

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.firstArmholeGarmentRc);
    const rows = buildActiveSideInstructionTableRows(chart, rcStart);
    expect(rows.length).toBeGreaterThan(0);
    expect(Math.max(...rows.map((r) => r.stitchesRemaining))).toBe(postArmhole);
  });

  it("neckline shaping reduces toward shoulder stitch count at armhole edge", () => {
    const postArmhole = d.cardiganFrontPostArmholeSts!;
    const neckHalf = Math.max(1, Math.round(d.necklineStitches! / 2));
    const shoulderAtArmhole = postArmhole - neckHalf;

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.firstArmholeGarmentRc);
    const activeRows = buildActiveSideInstructionTableRows(chart, rcStart);
    const neckRows = activeRows.filter((r) => r.edge === "Neck" && /decrease|bind off/i.test(r.action));
    expect(neckRows.length).toBeGreaterThan(0);

    const firstShoulderIdx = activeRows.findIndex(
      (r) => r.edge === "Armhole" && /bind off/i.test(r.action),
    );
    expect(firstShoulderIdx).toBeGreaterThan(0);
    const stitchesBeforeShoulder =
      firstShoulderIdx > 0
        ? activeRows[firstShoulderIdx - 1]!.stitchesRemaining
        : postArmhole;
    expect(stitchesBeforeShoulder).toBe(shoulderAtArmhole);
  });

  it("shoulder bind-offs total the full front shoulder stitch count", () => {
    const postArmhole = d.cardiganFrontPostArmholeSts!;
    const neckHalf = Math.max(1, Math.round(d.necklineStitches! / 2));
    const shoulderSts = postArmhole - neckHalf;

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.firstArmholeGarmentRc);
    const activeRows = buildActiveSideInstructionTableRows(chart, rcStart);
    let shoulderBound = 0;
    for (let i = 0; i < activeRows.length; i++) {
      const row = activeRows[i]!;
      if (row.edge !== "Armhole" || !/bind off/i.test(row.action)) continue;
      const prev = i > 0 ? activeRows[i - 1]!.stitchesRemaining : postArmhole;
      shoulderBound += Math.max(0, prev - row.stitchesRemaining);
    }
    const notationTotal = totalStitchesFromShapingNotationLines(
      shoulderShapingNotationLinesFromTimeline(timeline!, "right"),
    );
    expect(shoulderBound).toBe(shoulderSts);
    expect(notationTotal).toBe(shoulderSts);
  });

  it("chart first-row stitch counts match post-armhole width (not pullover active-shoulder half)", () => {
    const postArmhole = d.cardiganFrontPostArmholeSts!;
    const first = chart.rows[0]!;
    const firstBeforeShaping = Math.max(first.leftStitchCount, first.rightStitchCount);
    const neckOnFirst =
      parseDecreaseCellChart(first.leftNeck) +
      parseDecreaseCellChart(first.rightNeck) +
      parseDecreaseCellChart(first.centerNeck);
    expect(firstBeforeShaping + neckOnFirst).toBeGreaterThanOrEqual(postArmhole - 2);
    expect(firstBeforeShaping + neckOnFirst).toBeLessThanOrEqual(postArmhole + 2);
  });
});
