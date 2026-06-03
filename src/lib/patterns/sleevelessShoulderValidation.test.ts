import { describe, expect, it } from "vitest";
import {
  buildBackJapaneseNotationReplacements,
} from "./sleevelessBackJapaneseNotation";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import { isSleevelessCardiganFrontNeckShoulderChart } from "./neckShoulderShapingChart";
import { isSleevelessVNeckChoice } from "./sleevelessFrontDiagramSrc";
import {
  buildSleevelessGarmentDiagramReplacements,
  shoulderStitchesPerSideForDiagram,
} from "./sleevelessGarmentDiagramReplacements";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "./shoulderShapingNotation";
import {
  SLEEVELESS_PATTERN_SCENARIOS,
  type SleevelessPatternScenario,
} from "./testScenarios/sleevelessPatternScenarios";
import {
  expectedShoulderStitchesPerSide,
  expectedShoulderStitchesPerSideForPiece,
  shoulderNotationLinesForPiece,
} from "./testScenarios/sleevelessShoulderShapingAssertions";

const SHOULDER_DIAGRAM_SIDE = "right" as const;

function assertDiagramCrossBackStitchLabels(
  result: ReturnType<typeof generateSleevelessBackPattern>,
  scenario: SleevelessPatternScenario,
): void {
  const isCardigan = scenario.id.startsWith("cardigan-");
  const fullCrossBack = Math.round(result.debug.stitchesAfterArmhole ?? Number.NaN);
  expect(Number.isFinite(fullCrossBack), `${scenario.id}: post-armhole width`).toBe(true);
  // Cardigan fronts are drawn one panel at a time, so the front shows half the cross-back width.
  const expectedFrontCrossBack = isCardigan
    ? result.debug.cardiganHalfLeftStitchesAfterArmhole
    : fullCrossBack;

  const replBack = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData: scenario.patternData,
    measurementPiece: "back",
  });
  const replFront = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData: scenario.patternData,
    measurementPiece: "front",
    ...(isCardigan ? { cardiganHalfSide: "left" as const } : {}),
  });

  // The cross-back dimension line above the armhole = body width remaining after armhole shaping.
  expect(replBack.SHOULDER_STS, `${scenario.id}: back diagram cross-back sts`).toBe(
    String(fullCrossBack),
  );
  expect(replFront.SHOULDER_STS, `${scenario.id}: front diagram cross-back sts`).toBe(
    String(expectedFrontCrossBack),
  );
  // It must NOT be the per-side shoulder bind-off budget (the original bug).
  const perSide = shoulderStitchesPerSideForDiagram(result.debug);
  expect(perSide, `${scenario.id}: shoulder stitch budget`).toBeDefined();
  expect(Number(replBack.SHOULDER_STS)).not.toBe(perSide);
}

function assertShoulderShapingMatchesBudget(
  result: ReturnType<typeof generateSleevelessBackPattern>,
  piece: "back" | "front",
): void {
  const budget = expectedShoulderStitchesPerSideForPiece(result, piece);
  const lines = shoulderNotationLinesForPiece(result, piece);
  expect(totalStitchesFromShapingNotationLines(lines)).toBe(budget);
}

describe("sleeveless shoulder validation", () => {
  describe.each(SLEEVELESS_PATTERN_SCENARIOS)("$label ($id)", (scenario) => {
    const result = generateSleevelessBackPattern(scenario.patternData);

    it("frontShoulderStitches === backShoulderStitches (per-side budget)", () => {
      expect(expectedShoulderStitchesPerSideForPiece(result, "front")).toBe(
        expectedShoulderStitchesPerSide(result),
      );
    });

    it("frontShoulderShapingNotation === backShoulderShapingNotation", () => {
      const backLines = shoulderNotationLinesForPiece(result, "back");
      const frontLines = shoulderNotationLinesForPiece(result, "front");
      expect(frontLines.join("\n")).toBe(backLines.join("\n"));
    });

    it("stitches/rows diagram cross-back SHOULDER_STS labels match post-armhole body width on back and front", () => {
      assertDiagramCrossBackStitchLabels(result, scenario);
    });

    it("shoulder shaping notation totals match displayed shoulder stitch count", () => {
      assertShoulderShapingMatchesBudget(result, "back");
      assertShoulderShapingMatchesBudget(result, "front");
    });

    if (scenario.shoulderQa.garmentOverviewNotation) {
      it("jp-shoulder-shaping tokens match timeline notation for back and front", () => {
        const backTimeline = result.backNeckShoulderTimeline ?? [];
        const frontTimeline = result.frontNeckShoulderTimeline ?? [];
        const backLines = shoulderShapingNotationLinesFromTimeline(
          backTimeline,
          SHOULDER_DIAGRAM_SIDE,
        );
        const frontLines = shoulderShapingNotationLinesFromTimeline(
          frontTimeline,
          SHOULDER_DIAGRAM_SIDE,
        );
        const backRepl = buildBackJapaneseNotationReplacements(result, scenario.patternData);
        const frontRepl = buildFrontJapaneseNotationReplacements(result, scenario.patternData);
        const isCardiganRoundFrontJp =
          isSleevelessCardiganFrontNeckShoulderChart(result.frontNeckShoulderShapingChart) &&
          !isSleevelessVNeckChoice(scenario.patternData);

        expect(backRepl["jp-shoulder-shaping"]).toBe(backLines.join("\n"));
        if (isCardiganRoundFrontJp) {
          expect(frontRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
        } else {
          expect(frontRepl["jp-shoulder-shaping"]).toBe(frontLines.join("\n"));
        }
      });
    }
  });
});
