import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderActiveShoulderChartIntroHtml } from "./neckShoulderShapingChartHtml";
import {
  renderSleevelessFrontChartIntroHtml,
  renderSleevelessFrontPrintChartHtml,
  sleevelessFrontChartIntroLocalStartLabel,
} from "./sleevelessFrontChartIntroHtml";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
  centerBindOffStitchesFromNeckShoulderChart,
  generateSleevelessBackPattern,
  type SleevelessBackPatternResult,
} from "./sleevelessPatternOutput";

/** Misses size 8 — matches `public/data/sizing_sweaters_misses.json`. */
const MISSES_8_CHART_ROW: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  waist: 33,
  hip: 44,
  garment_back_length: 25,
  armhole_depth: 8,
  shoulder_width: 14.25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12.5,
  wrist: 6.25,
  sleeve_length: 17,
};

/**
 * Women's Sleeveless 3.pdf: size 8, close fit, straight, cardigan, V-neck,
 * 16 sts / 24 rows over 4 in (4 spi / 6 rpi), V at garment RC 077, armhole at 102.
 * Chart front neck is 5"; this case is the 12" deep V that actually starts at 077.
 */
function womenSize8CloseCardiganDeepV16x24Pattern(): Record<string, unknown> {
  const selectedMeasurements = {
    ...computeDefaultMeasurementsFromChartRow(MISSES_8_CHART_ROW, "close", {
      bodyShape: "straight",
    }),
    front_neck_depth: 12,
  };
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "close",
      selectedMeasurements,
    },
    style: {
      recipientCategory: "misses",
      neckline: "v-neck",
      garmentStyle: "cardigan",
      frontStyle: "open",
      bodyShape: "straight",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
  };
}

const EXPECTED = "At RC 077, begin V-neck shaping at the center-front edge.";
const PDF_OLD = "When Armhole RC reaches 077, begin neckline shaping at the center-front edge.";

/** The window.print intro the live PDF actually ran: chart object only, no debug overlap. */
function patternTabIntroWithoutHelper(
  result: Pick<SleevelessBackPatternResult, "debug" | "frontNeckShoulderShapingChart">,
): string {
  const chart = result.frontNeckShoulderShapingChart;
  return renderActiveShoulderChartIntroHtml({
    localStartRcLabel: sleevelessFrontChartIntroLocalStartLabel(result),
    centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(chart),
    chart,
    wrapperClass: "pattern-shaping-intro",
    layout: "labeled",
    includeWorkflowSteps: true,
  });
}

function stripChartComposition(
  result: SleevelessBackPatternResult,
): SleevelessBackPatternResult {
  const { frontVNeckArmholeComposition: _removed, ...chart } = result.frontNeckShoulderShapingChart;
  return { ...result, frontNeckShoulderShapingChart: chart };
}

describe("sleeveless Front chart intro — Women's Sleeveless 3.pdf path", () => {
  const r = generateSleevelessBackPattern(womenSize8CloseCardiganDeepV16x24Pattern());

  it("matches the printed pattern math (V 077, armhole 102, continuous Front RC)", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
    expect(r.debug.armholeStartRow).toBe(102);
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBe(77);
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBeLessThan(r.debug.armholeStartRow!);
    expect(r.frontNeckShoulderShapingChart.sleevelessCardiganFront).toBe(true);
  });

  it("the live PDF path (pattern-tab renderer, chart flag omitted, overlap not passed) still emits the old sentence", () => {
    const stripped = stripChartComposition(r);
    const html = patternTabIntroWithoutHelper(stripped);
    expect(html).toContain(PDF_OLD);
    expect(html).not.toContain(EXPECTED);
  });

  it("the shared helper the pattern tab now calls emits At RC 077 even when the chart flag is omitted", () => {
    const stripped = stripChartComposition(r);
    expect(sleevelessFrontChartIntroLocalStartLabel(stripped)).toBe("RC:077");
    const html = renderSleevelessFrontChartIntroHtml(stripped, "page");
    expect(html).toContain(EXPECTED);
    expect(html).not.toMatch(/When Armhole RC reaches/i);
    expect(html).not.toMatch(/begin neckline shaping at the center-front edge/i);
  });

  it("print helper uses the same sentence", () => {
    const html = renderSleevelessFrontPrintChartHtml(r);
    expect(html).toContain(EXPECTED);
    expect(html).not.toMatch(/When Armhole RC reaches/i);
  });

  it("pattern-tab script calls renderSleevelessFrontChartIntroHtml with the generator result", () => {
    const page = readFileSync(resolve("src/scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(page).toMatch(/renderSleevelessFrontChartIntroHtml\(\s*frontResult,\s*"page"\s*\)/);
    expect(page).toMatch(/neckShoulderChartHelpRowHtml\([\s\S]*?true,\s*result,/);
  });
});
