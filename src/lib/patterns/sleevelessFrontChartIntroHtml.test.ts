import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  renderSleevelessFrontChartIntroHtml,
  renderSleevelessFrontPrintChartHtml,
  renderSleevelessPatternTabFrontChartTableHtml,
  sleevelessFrontChartIntroLocalStartLabel,
} from "./sleevelessFrontChartIntroHtml";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import {
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
 * Women's Sleeveless 4.pdf: size 8, close fit, straight, cardigan, V-neck,
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

function stripChartComposition(
  result: SleevelessBackPatternResult,
): SleevelessBackPatternResult {
  const { frontVNeckArmholeComposition: _removed, ...chart } = result.frontNeckShoulderShapingChart;
  return { ...result, frontNeckShoulderShapingChart: chart };
}

function assertFrontIntroDoesNotLabel077AsArmholeRc(html: string): void {
  expect(html).toContain(EXPECTED);
  expect(html).not.toContain(PDF_OLD);
  expect(html).not.toMatch(/When Armhole RC reaches 077/i);
  expect(html).not.toMatch(/Armhole RC reaches 077/i);
  expect(html).not.toMatch(/Armhole RC:?\s*077/i);
}

describe("sleeveless Front chart intro — Women's Sleeveless 4.pdf pattern-tab path", () => {
  const r = generateSleevelessBackPattern(womenSize8CloseCardiganDeepV16x24Pattern());

  it("matches the printed pattern math (V 077, armhole 102, continuous Front RC)", () => {
    expect(r.debug.frontVNeckShapingTimingCase).toBe("before-armhole");
    expect(r.debug.armholeStartRow).toBe(102);
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBe(77);
    expect(r.debug.frontArmholeNecklineOverlap?.divideGarmentRc).toBeLessThan(r.debug.armholeStartRow!);
    expect(r.frontNeckShoulderShapingChart.sleevelessCardiganFront).toBe(true);
  });

  it("the live pattern-tab window.print HTML uses At RC 077, not Armhole RC 077", () => {
    const html = renderSleevelessPatternTabFrontChartTableHtml(r);
    expect(html).toContain("ns-shaping-chart-front");
    expect(html).toContain("Center-front edge");
    assertFrontIntroDoesNotLabel077AsArmholeRc(html);
  });

  it("still uses At RC 077 when the chart composition flag is omitted (debug timing remains)", () => {
    const stripped = stripChartComposition(r);
    expect(sleevelessFrontChartIntroLocalStartLabel(stripped)).toBe("RC:077");
    assertFrontIntroDoesNotLabel077AsArmholeRc(
      renderSleevelessPatternTabFrontChartTableHtml(stripped),
    );
    assertFrontIntroDoesNotLabel077AsArmholeRc(
      renderSleevelessFrontChartIntroHtml(stripped, "page"),
    );
  });

  it("print helper uses the same sentence", () => {
    const html = renderSleevelessFrontPrintChartHtml(r);
    assertFrontIntroDoesNotLabel077AsArmholeRc(html);
  });

  it("pattern-tab script injects Front chart HTML from the shared table renderer", () => {
    const page = readFileSync(resolve("src/scripts/sleevelessPatternPageShared.ts"), "utf8");
    expect(page).toMatch(
      /frontChartTableHost\.innerHTML = renderSleevelessPatternTabFrontChartTableHtml\(\s*result,/,
    );
    expect(page).not.toMatch(/renderSleevelessFrontChartIntroHtml\(\s*frontResult/);
    expect(page).not.toMatch(/neckShoulderChartHelpRowHtml\(\s*frontIntroStartLabel/);
  });
});
