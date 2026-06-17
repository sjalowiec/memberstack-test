import { expect } from "vitest";
import {
  buildActiveSideInstructionTableRows,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "../neckShoulderShapingChartHtml";
import type { NeckShoulderShapingChart } from "../neckShoulderShapingChart";
import { isSleevelessCardiganFrontNeckShoulderChart } from "../neckShoulderShapingChart";
import {
  buildBackJapaneseNotationReplacements,
  isBackJapaneseNotationSupported,
} from "../sleevelessBackJapaneseNotation";
import { isSleevelessVNeckChoice } from "../sleevelessFrontDiagramSrc";
import {
  buildFrontJapaneseNotationReplacements,
  isFrontJapaneseNotationSupported,
} from "../sleevelessFrontJapaneseNotation";
import {
  generateSleevelessBackPattern,
  type SleevelessBackPatternResult,
} from "../sleevelessPatternOutput";
import {
  shoulderShapingNotationLinesFromTimeline,
  totalStitchesFromShapingNotationLines,
} from "../shoulderShapingNotation";
import type { SleevelessScenarioPiece } from "./sleevelessPatternScenarios";

/** Preferred compact shoulder segment (`5s-2r-4x`) — no `bo` prefix. */
export const COMPACT_SHOULDER_NOTATION_LINE = /^(\d+)s-(\d+)r-(\d+)x$/i;

const SHOULDER_NOTATION_SIDE = "right" as const;

export function buildSleevelessPatternForScenario(
  patternData: Record<string, unknown>,
): SleevelessBackPatternResult {
  return generateSleevelessBackPattern(patternData);
}

export function expectedShoulderStitchesPerSide(result: SleevelessBackPatternResult): number {
  const shoulderSts = result.debug.shoulderStitches;
  expect(shoulderSts, "pattern must define shoulderStitches").toBeDefined();
  expect(shoulderSts, "shoulderStitches must be positive").toBeGreaterThan(0);
  return shoulderSts!;
}

/**
 * Per-piece shoulder stitch budget for notation reconciliation.
 * Round cardigan left-front uses half the post-armhole width, so its shoulder timeline
 * represents half the per-side bind-off total while `debug.shoulderStitches` stays the full back value.
 */
export function expectedShoulderStitchesPerSideForPiece(
  result: SleevelessBackPatternResult,
  piece: SleevelessScenarioPiece,
): number {
  const full = expectedShoulderStitchesPerSide(result);
  if (piece !== "front") return full;

  const neckHalf =
    result.debug.necklineStitches !== undefined
      ? Math.max(1, Math.round(result.debug.necklineStitches / 2))
      : undefined;
  const postArmhole =
    result.debug.cardiganFrontPostArmholeSts ?? result.debug.cardiganHalfLeftStitchesAfterArmhole;
  if (postArmhole !== undefined && neckHalf !== undefined && postArmhole > neckHalf) {
    return Math.max(1, postArmhole - neckHalf);
  }
  return full;
}

export function timelineForPiece(
  result: SleevelessBackPatternResult,
  piece: SleevelessScenarioPiece,
): readonly import("../shapingTimeline").RowEntry[] {
  return piece === "back"
    ? (result.backNeckShoulderTimeline ?? [])
    : (result.frontNeckShoulderTimeline ?? []);
}

export function chartForPiece(
  result: SleevelessBackPatternResult,
  piece: SleevelessScenarioPiece,
): NeckShoulderShapingChart {
  return piece === "back" ? result.neckShoulderShapingChart : result.frontNeckShoulderShapingChart;
}

export function shoulderNotationLinesForPiece(
  result: SleevelessBackPatternResult,
  piece: SleevelessScenarioPiece,
): string[] {
  const timeline = timelineForPiece(result, piece);
  expect(timeline.length, `${piece} neck/shoulder timeline`).toBeGreaterThan(0);
  return shoulderShapingNotationLinesFromTimeline(timeline, SHOULDER_NOTATION_SIDE, undefined, {
    shoulderStitchesBudget: expectedShoulderStitchesPerSideForPiece(result, piece),
  });
}

export function assertShoulderNotationReconciles(
  result: SleevelessBackPatternResult,
  piece: SleevelessScenarioPiece,
): void {
  const shoulderSts = expectedShoulderStitchesPerSideForPiece(result, piece);
  const lines = shoulderNotationLinesForPiece(result, piece);
  expect(totalStitchesFromShapingNotationLines(lines)).toBe(shoulderSts);
}

export function assertCompactShoulderNotationFormat(lines: readonly string[]): void {
  const nonEmpty = lines.filter((line) => line.trim().length > 0);
  expect(nonEmpty.length, "at least one shoulder notation segment").toBeGreaterThan(0);
  for (const line of nonEmpty) {
    expect(line, "no bo prefix on shoulder shaping").not.toMatch(/^bo/i);
    expect(line.trim(), "compact Ns-Mr-Kx segment").toMatch(COMPACT_SHOULDER_NOTATION_LINE);
  }
}

/**
 * Front and back use the same canonical timeline-derived shoulder rule; JP tokens mirror that when supported.
 */
export function assertFrontBackCanonicalShoulderNotation(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
  garmentOverviewNotation: boolean,
): void {
  const backLines = shoulderNotationLinesForPiece(result, "back");
  const frontLines = shoulderNotationLinesForPiece(result, "front");
  expect(backLines.join("\n"), "front/back shoulder notation lines match").toBe(frontLines.join("\n"));

  if (garmentOverviewNotation) {
    const backRepl = buildBackJapaneseNotationReplacements(result, patternData);
    const frontRepl = buildFrontJapaneseNotationReplacements(result, patternData);
    const isCardiganRoundFrontJp =
      isSleevelessCardiganFrontNeckShoulderChart(result.frontNeckShoulderShapingChart) &&
      !isSleevelessVNeckChoice(patternData);

    expect(backRepl["jp-shoulder-shaping"]).toBe(backLines.join("\n"));
    if (isCardiganRoundFrontJp) {
      expect(frontRepl["jp-shoulder-shaping"]).toBe(backRepl["jp-shoulder-shaping"]);
    } else {
      expect(frontRepl["jp-shoulder-shaping"]).toBe(frontLines.join("\n"));
    }
    expect(backRepl["jp-shoulder-shaping"]).not.toMatch(/^bo/i);
    expect(frontRepl["jp-shoulder-shaping"]).not.toMatch(/\nbo/i);
  }
}

export function assertNoDuplicateBindOffRemainingProse(
  chart: NeckShoulderShapingChart,
  chartId: string,
): void {
  const html = renderNeckShoulderShapingChartTableOnlyHtml(chart, chartId, "", {
    activeSideOnly: true,
  });
  expect(html).not.toMatch(/Bind off remaining \d+ stitches?/i);

  const rows = buildActiveSideInstructionTableRows(chart);
  expect(rows.length, "active-side checklist rows").toBeGreaterThan(0);
  expect(rows[rows.length - 1]?.stitchesRemaining).toBe(0);
}

/** Cardigan back uses the same JP back diagram/tokens as pullover; front uses cardigan front assets. */
export function assertCardiganBackJapaneseNotationSupported(
  result: SleevelessBackPatternResult,
  patternData: Record<string, unknown>,
): void {
  expect(isBackJapaneseNotationSupported(patternData, result)).toBe(true);
  expect(isFrontJapaneseNotationSupported(patternData, result)).toBe(true);

  const backRepl = buildBackJapaneseNotationReplacements(result, patternData);
  const frontRepl = buildFrontJapaneseNotationReplacements(result, patternData);
  expect(backRepl["jp-caston"].length).toBeGreaterThan(0);
  expect(backRepl["jp-shoulder-shaping"].length).toBeGreaterThan(0);
  expect(frontRepl["jp-caston"].length).toBeGreaterThan(0);
}

export function assertLiveNeckShoulderCharts(
  result: SleevelessBackPatternResult,
  pieces: readonly SleevelessScenarioPiece[],
): void {
  if (pieces.includes("back")) {
    expect(result.neckShoulderChartUsesLiveRows).toBe(true);
    expect(result.neckShoulderShapingChart.rows.length).toBeGreaterThan(0);
  }
  if (pieces.includes("front")) {
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.rows.length).toBeGreaterThan(0);
  }
}
