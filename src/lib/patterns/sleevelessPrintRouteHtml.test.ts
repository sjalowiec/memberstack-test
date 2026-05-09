/** Composed HTML for `/patterns/sleeveless/print` — mirrors `src/scripts/sleeveless-print-page.ts`. */
import { describe, expect, it } from "vitest";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";
import {
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import { renderSleevelessPrintPieceHtml, splitRowsBeforeNeckShoulderChartMount } from "./sleevelessPatternPrintRender";

const REAL_PATTERN_FIXTURE: Record<string, unknown> = {
  fit: {
    sizingChart: "misses",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 22,
      armhole_depth: 8,
      neck_opening: 3,
      shoulder_width: 4.25,
      back_neck_depth: 1,
      front_neck_depth: 3,
    },
  },
  style: { recipientCategory: "misses" },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
};

function composeContinuationLikePrintRoute(
  displayRows: readonly SleevelessPatternDisplayRow[],
  neckChartHtml: string,
): string {
  const { continuationRows } = splitRowsBeforeNeckShoulderChartMount(displayRows);
  if (continuationRows.length === 0) return "";
  return renderSleevelessPrintPieceHtml(continuationRows, neckChartHtml);
}

const NOTATION_FRAGMENTS = [
  "ns-shaping-mini__diagram-notation-help",
  "<strong>Shaping notation:</strong> stitches, rows, times",
  "1s-2r-3x = decrease 1 stitch every 2 rows, 3 times",
] as const;

describe("sleeveless print route HTML (composed like sleeveless-print-page.ts)", () => {
  it("injects shaping notation into BACK continuation HTML when a chart mount exists", () => {
    const result = generateSleevelessBackPattern(REAL_PATTERN_FIXTURE);
    const backLocalStartRc = Number.isFinite(result?.debug?.backNecklineStartLocalRC)
      ? Math.max(0, Math.floor(result.debug.backNecklineStartLocalRC ?? 0))
      : 0;
    const backLocalStartLabel = `RC:${String(backLocalStartRc).padStart(3, "0")}`;

    const backChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      result.neckShoulderShapingChart,
      "ns-shaping-chart-print-back",
      renderActiveShoulderChartIntroHtml({
        localStartRcLabel: backLocalStartLabel,
        centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.neckShoulderShapingChart),
        wrapperClass: "print-chart-intro",
        layout: "compact",
      }),
      { activeSideRcStart: 0 },
    );

    const composed = composeContinuationLikePrintRoute(result.displayRows ?? [], backChartHtml);
    expect(composed.length).toBeGreaterThan(0);
    expect(composed).toContain("print-chart-wrap");
    expect(composed).toContain("Neckline / Shoulder Diagram");
    for (const frag of NOTATION_FRAGMENTS) {
      expect(composed).toContain(frag);
    }
    expect(composed).toMatch(
      /Neckline \/ Shoulder Diagram[\s\S]*ns-shaping-mini__diagram-block[\s\S]*ns-shaping-mini__diagram-notation-help/,
    );
  });

  it("injects shaping notation into FRONT continuation HTML when a chart mount exists", () => {
    const result = generateSleevelessBackPattern(REAL_PATTERN_FIXTURE);
    const frontLocalStartRc = Number.isFinite(result?.debug?.frontNecklineStartLocalRC)
      ? Math.max(0, Math.floor(result.debug.frontNecklineStartLocalRC ?? 0))
      : 0;
    const frontLocalStartLabel = `RC:${String(frontLocalStartRc).padStart(3, "0")}`;

    const frontChartHtml = renderNeckShoulderShapingPrintInstructionTableHtml(
      result.frontNeckShoulderShapingChart,
      "ns-shaping-chart-print-front",
      renderActiveShoulderChartIntroHtml({
        localStartRcLabel: frontLocalStartLabel,
        centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(result.frontNeckShoulderShapingChart),
        wrapperClass: "print-chart-intro",
        layout: "compact",
      }),
      { activeSideRcStart: 0 },
    );

    const composed = composeContinuationLikePrintRoute(result.frontDisplayRows ?? [], frontChartHtml);
    expect(composed.length).toBeGreaterThan(0);
    expect(composed).toContain("Neckline / Shoulder Diagram");
    for (const frag of NOTATION_FRAGMENTS) {
      expect(composed).toContain(frag);
    }
  });
});
