import { describe, expect, it } from "vitest";
import { buildBackJapaneseNotationReplacements } from "./sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import { isSleevelessCardiganGarmentStyle } from "./sleevelessFrontDiagramSrc";
import {
  buildActiveSideInstructionTableRows,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import {
  collectCompleteShoulderShapingPoints,
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import { demoSleevelessBackPattern, generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const roundPulloverInput: Record<string, unknown> = {
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
  style: { recipientCategory: "misses" },
  yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
};

describe("shoulder shaping notation (canonical)", () => {
  it("pullover round neck: front and back jp-shoulder-shaping use the same timeline rule without bo prefix", () => {
    const result = demoSleevelessBackPattern();
    const backRepl = buildBackJapaneseNotationReplacements(result, {});
    const frontRepl = buildFrontJapaneseNotationReplacements(result, {});

    const backTimeline = result.backNeckShoulderTimeline ?? [];
    const frontTimeline = result.frontNeckShoulderTimeline ?? [];
    const backLines = shoulderShapingNotationLinesFromTimeline(backTimeline, "right");
    const frontLines = shoulderShapingNotationLinesFromTimeline(frontTimeline, "right");

    expect(backRepl["jp-shoulder-shaping"]).toBe(backLines.join("\n"));
    expect(frontRepl["jp-shoulder-shaping"]).toBe(frontLines.join("\n"));
    expect(backRepl["jp-shoulder-shaping"]).not.toMatch(/^bo/i);
    expect(frontRepl["jp-shoulder-shaping"]).not.toMatch(/\nbo/i);
  });

  it("notation stitch totals reconcile to shoulder stitches per side", () => {
    const result = demoSleevelessBackPattern();
    const shoulderSts = result.debug.shoulderStitches;
    expect(shoulderSts).toBeGreaterThan(0);

    const backLines = shoulderShapingNotationLinesFromTimeline(
      result.backNeckShoulderTimeline ?? [],
      "right",
    );
    const frontLines = shoulderShapingNotationLinesFromTimeline(
      result.frontNeckShoulderTimeline ?? [],
      "right",
    );

    expect(totalStitchesFromShapingNotationLines(backLines)).toBe(shoulderSts);
    expect(totalStitchesFromShapingNotationLines(frontLines)).toBe(shoulderSts);
  });

  it("does not emit duplicate Bind off remaining prose when final shoulder is in the checklist", () => {
    const result = demoSleevelessBackPattern();
    const backHtml = renderNeckShoulderShapingChartTableOnlyHtml(result.neckShoulderShapingChart, "test", "", {
      activeSideOnly: true,
    });
    const frontHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      result.frontNeckShoulderShapingChart,
      "test-front",
      "",
      { activeSideOnly: true },
    );

    expect(backHtml).not.toMatch(/Bind off remaining \d+ stitches?/i);
    expect(frontHtml).not.toMatch(/Bind off remaining \d+ stitches?/i);

    const backRows = buildActiveSideInstructionTableRows(result.neckShoulderShapingChart);
    const frontRows = buildActiveSideInstructionTableRows(result.frontNeckShoulderShapingChart);
    expect(backRows[backRows.length - 1]?.stitchesRemaining).toBe(0);
    expect(frontRows[frontRows.length - 1]?.stitchesRemaining).toBe(0);
  });

  it("V-neck pullover: complete shoulder notation and no duplicate remaining prose", () => {
    const result = generateSleevelessBackPattern({
      ...roundPulloverInput,
      style: { recipientCategory: "misses", neckline: "v-neck" },
    });
    const shoulderSts = result.debug.shoulderStitches;
    expect(shoulderSts).toBeGreaterThan(0);

    const frontLines = shoulderShapingNotationLinesFromTimeline(
      result.frontNeckShoulderTimeline ?? [],
      "right",
    );
    expect(totalStitchesFromShapingNotationLines(frontLines)).toBe(shoulderSts);

    const frontHtml = renderNeckShoulderShapingChartTableOnlyHtml(
      result.frontNeckShoulderShapingChart,
      "v-front",
      "",
      { activeSideOnly: true },
    );
    expect(frontHtml).not.toMatch(/Bind off remaining \d+ stitches?/i);
  });

  it("cardigan: Japanese notation stays empty (unsupported)", () => {
    const result = generateSleevelessBackPattern({
      ...roundPulloverInput,
      style: { garmentStyle: "cardigan", recipientCategory: "misses" },
    });
    const patternData = { style: { garmentStyle: "cardigan" } };
    expect(isSleevelessCardiganGarmentStyle(patternData)).toBe(true);

    const backRepl = buildBackJapaneseNotationReplacements(result, patternData);
    const frontRepl = buildFrontJapaneseNotationReplacements(result, patternData);
    expect(backRepl["jp-shoulder-shaping"]).toBe("");
    expect(frontRepl["jp-shoulder-shaping"]).toBe("");
  });

  it("append final remainder to complete points when timeline ends with stitches on the active side", () => {
    const timeline = [
      {
        row: 8,
        events: [{ kind: "bindOff" as const, side: "right" as const, edge: "outer" as const, amount: 5 }],
        stitchesL: 10,
        stitchesR: 14,
        netChangeL: -5,
        netChangeR: -5,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 15,
      },
      {
        row: 10,
        events: [{ kind: "bindOff" as const, side: "right" as const, edge: "outer" as const, amount: 5 }],
        stitchesL: 10,
        stitchesR: 9,
        netChangeL: 0,
        netChangeR: -5,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 10,
      },
      {
        row: 12,
        events: [],
        stitchesL: 10,
        stitchesR: 4,
        netChangeL: 0,
        netChangeR: 0,
        isSplit: true,
        centerWidth: 0,
        leftOuterEdge: 1,
        leftInnerEdge: 1,
        rightInnerEdge: 2,
        rightOuterEdge: 10,
      },
    ];
    const complete = collectCompleteShoulderShapingPoints(timeline, "right");
    expect(complete.map((p) => p.amount)).toEqual([5, 5, 4]);
    expect(totalStitchesFromShapingNotationLines(shoulderShapingNotationLinesFromTimeline(timeline, "right"))).toBe(
      14,
    );
  });
});
