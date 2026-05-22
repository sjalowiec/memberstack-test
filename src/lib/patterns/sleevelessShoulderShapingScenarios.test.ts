import { describe, expect, it } from "vitest";
import {
  SLEEVELESS_PATTERN_SCENARIOS,
  SLEEVELESS_SCENARIOS_WITHOUT_GARMENT_OVERVIEW_NOTATION,
  SLEEVELESS_SCENARIOS_WITH_GARMENT_OVERVIEW_NOTATION,
  type SleevelessPatternScenario,
  type SleevelessScenarioPiece,
} from "./testScenarios/sleevelessPatternScenarios";
import {
  assertCompactShoulderNotationFormat,
  assertFrontBackCanonicalShoulderNotation,
  assertGarmentOverviewNotationExplicitlyUnsupported,
  assertLiveNeckShoulderCharts,
  assertNoDuplicateBindOffRemainingProse,
  assertShoulderNotationReconciles,
  buildSleevelessPatternForScenario,
  chartForPiece,
  shoulderNotationLinesForPiece,
} from "./testScenarios/sleevelessShoulderShapingAssertions";
import {
  collectCompleteShoulderShapingPoints,
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import type { RowEntry } from "./shapingTimeline";

function buildResult(scenario: SleevelessPatternScenario) {
  return buildSleevelessPatternForScenario(scenario.patternData);
}

describe.each(SLEEVELESS_PATTERN_SCENARIOS)("$label ($id)", (scenario) => {
  const result = buildResult(scenario);
  const { shoulderQa } = scenario;

  it("builds live neck/shoulder charts for configured pieces", () => {
    assertLiveNeckShoulderCharts(result, shoulderQa.pieces);
  });

  if (shoulderQa.shoulderReconciliation) {
    it.each(shoulderQa.pieces)("%s: shoulder notation stitch total reconciles to shoulderStitches", (piece) => {
      assertShoulderNotationReconciles(result, piece as SleevelessScenarioPiece);
    });
  }

  if (shoulderQa.frontBackCanonicalRule) {
    it("front and back use the same canonical shoulder timeline notation rule", () => {
      assertFrontBackCanonicalShoulderNotation(
        result,
        scenario.patternData,
        shoulderQa.garmentOverviewNotation,
      );
    });
  }

  if (shoulderQa.noDuplicateBindOffRemainingProse) {
    it.each(shoulderQa.pieces)(
      "%s: chart prose does not duplicate final bind-off remaining sentence",
      (piece) => {
        assertNoDuplicateBindOffRemainingProse(
          chartForPiece(result, piece as SleevelessScenarioPiece),
          `${scenario.id}-${piece}`,
        );
      },
    );
  }
});

describe.each(SLEEVELESS_SCENARIOS_WITH_GARMENT_OVERVIEW_NOTATION)(
  "garment overview compact notation ($id)",
  (scenario) => {
    const result = buildResult(scenario);

    it.each(scenario.shoulderQa.pieces)("%s: shoulder segments use Ns-Mr-Kx without bo prefix", (piece) => {
      const lines = shoulderNotationLinesForPiece(result, piece as SleevelessScenarioPiece);
      assertCompactShoulderNotationFormat(lines);
    });
  },
);

describe.each(SLEEVELESS_SCENARIOS_WITHOUT_GARMENT_OVERVIEW_NOTATION)(
  "garment overview notation unsupported ($id)",
  (scenario) => {
    const result = buildResult(scenario);

    it("explicitly does not emit Japanese shoulder overview tokens", () => {
      assertGarmentOverviewNotationExplicitlyUnsupported(result, scenario.patternData);
      expect(scenario.garmentOverviewUnsupportedReason?.length).toBeGreaterThan(0);
    });

    it("still reconciles shoulder notation from timelines (written chart QA)", () => {
      for (const piece of scenario.shoulderQa.pieces) {
        assertShoulderNotationReconciles(result, piece);
      }
    });
  },
);

describe("shoulder shaping notation (unit)", () => {
  it("append final remainder to complete points when timeline ends with stitches on the active side", () => {
    const timeline: RowEntry[] = [
      {
        row: 8,
        events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 5 }],
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
        events: [{ kind: "bindOff", side: "right", edge: "outer", amount: 5 }],
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
