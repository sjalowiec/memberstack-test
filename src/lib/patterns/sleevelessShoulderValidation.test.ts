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

function assertDiagramShoulderStitchLabels(
  result: ReturnType<typeof generateSleevelessBackPattern>,
  scenario: SleevelessPatternScenario,
): void {
  const perSide = shoulderStitchesPerSideForDiagram(result.debug);
  expect(perSide, `${scenario.id}: shoulder stitch budget`).toBeDefined();

  const replBack = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData: scenario.patternData,
    measurementPiece: "back",
  });
  const replFront = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData: scenario.patternData,
    measurementPiece: "front",
    ...(scenario.id.startsWith("cardigan-") ? { cardiganHalfSide: "left" as const } : {}),
  });

  expect(replBack.SHOULDER_STS, `${scenario.id}: back diagram shoulder sts`).toBe(String(perSide));
  expect(replFront.SHOULDER_STS, `${scenario.id}: front diagram shoulder sts`).toBe(String(perSide));
  expect(Number(replBack.SHOULDER_STS)).not.toBe(result.debug.stitchesAfterArmhole);
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

    it("stitches/rows diagram SHOULDER_STS labels match per-side shoulder count on back and front", () => {
      assertDiagramShoulderStitchLabels(result, scenario);
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
