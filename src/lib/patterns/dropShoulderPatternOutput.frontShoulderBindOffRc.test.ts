/**
 * Front shoulder completion RC must be the same in written instructions and the
 * Front Neckline Shaping Chart. After a neckline reset, that is local remaining rows.
 * When the neckline starts before the armhole marker, both stay on garment RC.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  dropShoulderFrontChartActiveSideRcStart,
  dropShoulderFrontNecklineDisplayRcOffset,
  dropShoulderFrontShoulderCompletionLocalRc,
  dropShoulderFrontTimelineShoulderBindOffLocalRc,
  dropShoulderFrontUsesLocalNecklineRc,
} from "./dropShoulderFrontNeckShapingChart";
import {
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { DROP_SHOULDER_QA_SCENARIOS } from "./testScenarios/dropShoulderPatternQaMatrix";

const KIDS_ROWS = JSON.parse(
  readFileSync(resolve("public/data/sizing_sweaters_kids.json"), "utf8"),
) as ChartRow[];
const KIDS_10 = KIDS_ROWS.find((r) => String(r.size).includes("10"));
if (!KIDS_10) throw new Error("kids sizing chart missing size 10 yr");

function frontBlockText(rows: SleevelessPatternDisplayRow[] | undefined): string {
  return (rows ?? [])
    .filter((row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block")
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n");
}

function proseShoulderBindOffLocalRc(text: string): number | undefined {
  const cardigan = text.match(
    /knit even to RC: (\d+), then bind off \d+ stitches for the shoulder/i,
  );
  if (cardigan) return Number(cardigan[1]);
  const pullover = text.match(
    /knit even to RC: (\d+) \(no further neck-edge decreases\)/i,
  );
  if (pullover) return Number(pullover[1]);
  return undefined;
}

function displayedShoulderBindOffRc(
  result: ReturnType<typeof generateDropShoulderPattern>,
): number {
  const usesLocal = dropShoulderFrontUsesLocalNecklineRc(
    result.debug.frontNecklineStartRC,
    result.debug.armholeStartRow,
  );
  const totalRows = result.debug.totalCalculatedRows ?? 0;
  if (usesLocal) {
    return dropShoulderFrontShoulderCompletionLocalRc(
      result.debug.frontNecklineStartRC ?? 0,
      totalRows,
    );
  }
  return totalRows;
}

function chartShoulderBindOffLocalRc(
  result: ReturnType<typeof generateDropShoulderPattern>,
): number | undefined {
  const displayOrigin = dropShoulderFrontNecklineDisplayRcOffset(
    result.debug.frontNecklineStartRC,
    result.debug.armholeStartRow,
  );
  const fromTimeline = dropShoulderFrontTimelineShoulderBindOffLocalRc(
    result.frontNeckShoulderTimeline,
    displayOrigin,
  );
  const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
    result.frontNeckShoulderShapingChart,
    result.debug.frontNecklineStartRC,
    result.debug.armholeStartRow,
  );
  const tableRows = buildActiveSideInstructionTableRows(
    result.frontNeckShoulderShapingChart,
    activeSideRcStart,
    { includeCenterNecklineSetupRow: true },
  );
  const lastBind = [...tableRows].reverse().find((row) => /bind off/i.test(row.action));
  expect(fromTimeline).toBe(lastBind?.rc);
  return lastBind?.rc;
}

function expectProseChartShoulderBindOffAgree(
  result: ReturnType<typeof generateDropShoulderPattern>,
): { proseRc: number; chartRc: number; sourceOfTruth: number } {
  const text = frontBlockText(result.frontDisplayRows);
  const proseRc = proseShoulderBindOffLocalRc(text);
  const chartRc = chartShoulderBindOffLocalRc(result);
  const sourceOfTruth = displayedShoulderBindOffRc(result);
  expect(proseRc).toBeDefined();
  expect(chartRc).toBeDefined();
  expect(proseRc).toBe(chartRc);
  expect(chartRc).toBe(sourceOfTruth);
  return { proseRc: proseRc!, chartRc: chartRc!, sourceOfTruth };
}

/** Men's Medium cardigan V with a V deeper than the derived armhole — Robin's 044 vs 056 split. */
function robinsMensMedDeepVCardiganPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      selectedMeasurements: {
        finished_bust_chest: 45,
        finished_hip: 45,
        back_neck_to_hem: 26,
        upper_arm: 11,
        wrist: 6.5,
        sleeve_length: 18.25,
        shoulder_width: 16.5,
        neck_opening: 6.5,
        front_neck_depth: 7,
        back_neck_depth: 1,
      },
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "men",
      neckline: "v",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 8,
      availableNeedles: 200,
    },
  };
}

function kids10YrCardiganVNeckClosePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "kids",
      selectedSize: "10 yr",
      easeChoice: "close",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(KIDS_10!, "close", {
        bodyShape: "straight",
      }),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "kids",
      neckline: "v-neck",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5.25,
      gaugeRowsPerInch: 8,
      availableNeedles: 200,
    },
  };
}

describe("Drop Shoulder front shoulder bind-off RC (prose vs chart)", () => {
  it("Robin's Men's Medium deep V cardigan: prose and chart share the neckline-reset local RC (not a 044 vs 056 split)", () => {
    const result = generateDropShoulderPattern(robinsMensMedDeepVCardiganPattern());
    expect(result.debug.frontNeckDepthRows).toBe(56);
    expect(result.debug.armholeRows).toBe(44);
    const available = dropShoulderFrontShoulderCompletionLocalRc(
      result.debug.frontNecklineStartRC ?? 0,
      result.debug.totalCalculatedRows ?? 0,
    );
    expect(available).toBe(56);

    const { proseRc, chartRc } = expectProseChartShoulderBindOffAgree(result);
    expect(proseRc).toBe(result.debug.totalCalculatedRows);
    expect(chartRc).toBe(result.debug.totalCalculatedRows);
    expect(proseRc).not.toBe(44);
    expect(proseRc).not.toBe(56);
    expect(result.frontNeckShoulderTimeline?.at(-1)?.row).toBe(result.debug.totalCalculatedRows);
  });

  it("Kids 10 yr cardigan V uses a different bind-off RC than Robin's fixture (guards against hard-coding 044/056)", () => {
    const result = generateDropShoulderPattern(kids10YrCardiganVNeckClosePattern());
    const { proseRc, chartRc } = expectProseChartShoulderBindOffAgree(result);
    expect(proseRc).toBe(28);
    expect(chartRc).toBe(28);
    expect(proseRc).not.toBe(44);
    expect(proseRc).not.toBe(56);
  });

  it("Men's Med 16/24 cardigan V (QA): prose bind-off RC equals the shaping chart", () => {
    const scenario = DROP_SHOULDER_QA_SCENARIOS.find((s) => s.id === "mens-med-16-24-cardigan-v");
    expect(scenario).toBeDefined();
    const result = generateDropShoulderPattern(scenario!.patternData);
    const { proseRc, chartRc } = expectProseChartShoulderBindOffAgree(result);
    expect(proseRc).not.toBe(56);
    expect(chartRc).toBe(proseRc);
  });

  it("pullover V-neck uses the same shared garment-shoulder local RC", () => {
    const result = generateDropShoulderPattern({
      fit: {
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 24,
          upper_arm: 16,
          wrist: 8,
          sleeve_length: 12,
          shoulder_width: 16,
          neck_opening: 7,
          back_neck_depth: 1,
          front_neck_depth: 4,
        },
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
      style: {
        construction: "drop-shoulder",
        frontStyle: "closed",
        neckline: "v",
      },
    });
    const { proseRc } = expectProseChartShoulderBindOffAgree(result);
    expect(proseRc).toBe(28);
    expect(proseRc).not.toBe(44);
    expect(proseRc).not.toBe(56);
  });
});
