/**
 * Front neckline/shoulder chart intro used by the Sleeveless pattern page and print route.
 * Shared so tests can exercise the same label + renderer path the knitter sees.
 */

import type { FrontArmholeNecklineOverlap } from "./frontArmholeNecklineComposition";
import {
  resolveFrontVNeckShapingTimingCase,
  sleevelessPulloverVNeckBeginDisplayRc,
} from "./frontArmholeNecklineComposition";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  isSleevelessPulloverVNeckFrontChart,
  renderActiveShoulderChartIntroHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import { centerBindOffStitchesFromNeckShoulderChart } from "./sleevelessPatternOutput";
import type { SleevelessBackPatternResult } from "./sleevelessPatternOutput";

function paddedRcColonLabel(rc: number): string {
  return `RC:${String(Math.max(0, Math.floor(rc))).padStart(3, "0")}`;
}

/**
 * Armhole-local / garment RC shown on the Front chart intro, matching the live page and print
 * route. Cardigan V that starts before the armhole uses the overlap divide garment RC (same
 * number as “Begin V-neck shaping” in the written Front).
 */
export function sleevelessFrontChartIntroLocalStartLabel(
  result: Pick<SleevelessBackPatternResult, "debug" | "frontNeckShoulderShapingChart">,
): string {
  const overlap = result.debug.frontArmholeNecklineOverlap;
  const chart = result.frontNeckShoulderShapingChart;
  const timing = resolveFrontVNeckShapingTimingCase(overlap);

  if (isSleevelessPulloverVNeckFrontChart(chart)) {
    const rc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap,
      frontNecklineStartLocalRC: result.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: result.debug.frontNecklineCenterDivideLocalRC,
    });
    if (rc !== undefined) return paddedRcColonLabel(rc);
  }

  if (timing === "before-armhole" && overlap) {
    return paddedRcColonLabel(overlap.divideGarmentRc);
  }

  const fallback =
    Number.isFinite(result.debug.frontNecklineCenterDivideLocalRC)
      ? Math.max(0, Math.floor(result.debug.frontNecklineCenterDivideLocalRC ?? 0))
      : Number.isFinite(result.debug.frontNecklineShapingBeginLocalRC)
        ? Math.max(0, Math.floor(result.debug.frontNecklineShapingBeginLocalRC ?? 0))
        : Number.isFinite(result.debug.frontNecklineStartLocalRC) &&
            (result.debug.frontNecklineStartLocalRC ?? 0) >= 0
          ? Math.floor(result.debug.frontNecklineStartLocalRC ?? 0)
          : 0;
  return paddedRcColonLabel(fallback);
}

export type SleevelessFrontChartIntroVariant = "page" | "print";

/**
 * Chart intro HTML for the Front piece — same renderer and label as the live Sleeveless page
 * (`page`) or dedicated print route (`print`).
 */
export function renderSleevelessFrontChartIntroHtml(
  result: Pick<SleevelessBackPatternResult, "debug" | "frontNeckShoulderShapingChart">,
  variant: SleevelessFrontChartIntroVariant = "page",
): string {
  const chart = result.frontNeckShoulderShapingChart;
  const overlap: FrontArmholeNecklineOverlap | undefined =
    chart.frontVNeckArmholeComposition ?? result.debug.frontArmholeNecklineOverlap;
  return renderActiveShoulderChartIntroHtml({
    localStartRcLabel: sleevelessFrontChartIntroLocalStartLabel(result),
    centerBindOffStitches: centerBindOffStitchesFromNeckShoulderChart(chart),
    chart,
    frontArmholeNecklineOverlap: overlap,
    wrapperClass: variant === "print" ? "print-chart-intro" : "pattern-shaping-intro",
    layout: variant === "print" ? "compact" : "labeled",
    includeWorkflowSteps: variant === "page",
  });
}

/** Front print chart block: intro + compact instruction table (dedicated print route). */
export function renderSleevelessFrontPrintChartHtml(
  result: Pick<SleevelessBackPatternResult, "debug" | "frontNeckShoulderShapingChart">,
): string {
  const chart = result.frontNeckShoulderShapingChart;
  const introHtml = renderSleevelessFrontChartIntroHtml(result, "print");
  const frontUsesShoulderTabs = isSleevelessPulloverVNeckFrontChart(chart);
  return renderNeckShoulderShapingPrintInstructionTableHtml(
    chart,
    "ns-shaping-chart-print-front",
    introHtml,
    {
      activeSideRcStart: armholeLocalRcActiveShoulderChecklistStart(
        chart,
        result.debug.armholeStartRow,
        { includeCenterNecklineSetupRow: true },
      ),
      includeCenterNecklineSetupRow: true,
      ...(frontUsesShoulderTabs
        ? { showSecondShoulderChecklist: true, sequentialShoulderHeadings: true }
        : {}),
    },
  );
}
