import { describe, expect, it } from "vitest";
import { parseDecreaseCellChart } from "./neckShoulderShapingChart";
import { formatBindOffNotation } from "./sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import {
  buildActiveSideInstructionTableRows,
  armholeLocalRcActiveShoulderChecklistStart,
} from "./neckShoulderActiveSideChecklist";
import {
  initialBackCenterNeckStitches,
  initialCenterNeckStitches,
} from "./legoBlocks/roundNeckline";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
  initialNeckBindOffFromNeckShoulderChart,
} from "./sleevelessPatternOutput";
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

  it("starts active-shoulder table from post-armhole piece stitches after one-edge armhole shaping", () => {
    const postArmhole =
      d.cardiganFrontPostArmholeSts ?? postArmholeFromFrontArmholeRows(result.frontDisplayRows);
    expect(postArmhole).toBeDefined();
    expect(postArmhole).toBe(d.cardiganHalfLeftStitchesAfterArmhole);
    expect(d.cardiganFrontPostArmholeSts).toBe(postArmhole);

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
      (r) => r.edge === "Shoulder" && /bind off/i.test(r.action),
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
      if (row.edge !== "Shoulder" || !/bind off/i.test(row.action)) continue;
      const prev = i > 0 ? activeRows[i - 1]!.stitchesRemaining : postArmhole;
      shoulderBound += Math.max(0, prev - row.stitchesRemaining);
    }
    const notationTotal = totalStitchesFromShapingNotationLines(
      shoulderShapingNotationLinesFromTimeline(timeline!, "right"),
    );
    expect(shoulderBound).toBe(shoulderSts);
    expect(notationTotal).toBe(shoulderSts);
  });

  it("initial CF-edge neckline bind-off is half-panel math, not pullover center bind-off", () => {
    const neckFull = d.necklineStitches!;
    // Cardigan CF-edge first bind-off is half of the *front* deep-round center, not back shallow.
    const pulloverFrontCenter = initialCenterNeckStitches(neckFull);
    // debug.centerNeckBindOffStitches is the back / full-neckline shallow center (always).
    const backCenter = initialBackCenterNeckStitches(neckFull);
    const cardiganInitial = initialNeckBindOffFromNeckShoulderChart(chart, {
      fullNecklineStitches: neckFull,
    });
    const chartCenterColumn = centerBindOffStitchesFromNeckShoulderChart(chart);

    expect(cardiganInitial).toBe(Math.max(1, Math.round(pulloverFrontCenter / 2)));
    expect(cardiganInitial).toBe(d.cardiganFrontInitialNeckBindOffStitches);
    expect(chartCenterColumn).toBe(0);
    expect(d.centerNeckBindOffStitches).toBe(backCenter);
    expect(d.centerNeckBindOffStitches).not.toBe(cardiganInitial);

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, result.firstArmholeGarmentRc);
    const firstNeck = buildActiveSideInstructionTableRows(chart, rcStart).find(
      (row) => row.edge === "Neck" && /bind off/i.test(row.action),
    );
    expect(firstNeck?.action).toMatch(new RegExp(`Bind off ${cardiganInitial} sts`, "i"));

    const repl = buildFrontJapaneseNotationReplacements(result, cardiganRoundPattern());
    expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(cardiganInitial));
    expect(repl["jp-neckline-bo"]).not.toBe(formatBindOffNotation(pulloverFrontCenter));

    const pulloverPattern = {
      ...cardiganRoundPattern(),
      style: {
        ...(cardiganRoundPattern().style as Record<string, unknown>),
        garmentStyle: "pullover",
        frontStyle: "closed",
      },
    };
    const pulloverShaping = buildFrontJapaneseNotationReplacements(
      generateSleevelessBackPattern(pulloverPattern),
      pulloverPattern,
    )["jp-neckline-shaping"];
    expect(pulloverShaping.length).toBeGreaterThan(0);
    expect(repl["jp-neckline-shaping"]).toBe(pulloverShaping);
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
