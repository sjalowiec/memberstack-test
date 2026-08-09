/**
 * Regression: Kids' Drop Shoulder · 10 yr · cardigan · V-neck · close fit
 * (customer PDF "Kids' Drop Shoulder.pdf" — written every-row ×16 vs diagram 1s-2r-8x).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderFrontJapaneseNotationReplacements } from "./dropShoulderBodyJapaneseNotation";
import {
  dropShoulderFrontChartActiveSideRcStart,
  dropShoulderFrontNeckChartTableOptions,
} from "./dropShoulderFrontNeckShapingChart";
import {
  evenShapingGarmentRowNumbers,
  evenShapingSchedule,
  formatParentheticalShapingRowNumbers,
} from "./evenShapingSchedule";
import { CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE } from "./neckShoulderActiveIntroCopy";
import {
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import {
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderActiveShoulderChartIntroHtml,
} from "./neckShoulderShapingChartHtml";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

const KIDS_ROWS = JSON.parse(
  readFileSync(resolve("public/data/sizing_sweaters_kids.json"), "utf8"),
) as ChartRow[];

const KIDS_10 = KIDS_ROWS.find((r) => String(r.size).includes("10"));
if (!KIDS_10) throw new Error("kids sizing chart missing size 10 yr");

/** Matches the customer PDF gauge: 21 sts / 32 rows over 4 in. */
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

function frontBlockText(rows: SleevelessPatternDisplayRow[]): string {
  return rows
    .filter((row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block")
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n");
}

describe("Drop Shoulder cardigan V-neck alignment (Kids 10 yr · close)", () => {
  const pattern = kids10YrCardiganVNeckClosePattern();
  const result = generateDropShoulderPattern(pattern);
  const neckPerFront = Math.round((result.debug.necklineStitches ?? 0) / 2);
  const depth = result.debug.frontNeckDepthRows ?? 0;
  const shoulder = result.debug.shoulderStitches ?? 0;
  const sched = evenShapingSchedule(neckPerFront, depth);
  const expectedRcs = evenShapingGarmentRowNumbers(0, sched);

  it("reproduces the confirmed customer geometry", () => {
    expect(result.debug.necklineStitches).toBe(32);
    expect(neckPerFront).toBe(16);
    expect(shoulder).toBe(22);
    expect(depth).toBe(28);
    expect(result.debug.cardiganHalfLeftCastOnSts).toBe(38);
    expect(sched).toEqual({ interval: 1, count: 16, remainderRows: 12 });
    expect(expectedRcs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("written instructions match every-row ×16 on RC 1–16, even to RC 028, BO 22", () => {
    const text = frontBlockText(result.frontDisplayRows);
    expect(text).toMatch(/Begin the V-neck shaping at the center-front edge/i);
    expect(text).toContain(
      `Decrease 1 stitch at the center-front (neck) edge every row 16 times ${formatParentheticalShapingRowNumbers(
        expectedRcs,
      )} (16 stitches removed).`,
    );
    expect(text).toMatch(
      /When 22 stitches remain, knit even to RC: 028, then bind off 22 stitches for the shoulder/,
    );
    expect(text).toMatch(/Work the RIGHT FRONT to match, reversing the neckline shaping/i);
    expect(text).not.toMatch(/return the \d+ held stitches for the second shoulder/i);
  });

  it("Japanese notation is 1s-1r-16x (not double-halved 1s-2r-8x)", () => {
    const jp = buildDropShoulderFrontJapaneseNotationReplacements(result, pattern);
    expect(jp["jp-neckline-shaping"]).toBe("1s-1r-16x");
    expect(jp["jp-neckline-shaping"]).not.toBe("1s-2r-8x");
    expect(jp["jp-neckline-bo"]).toBe("");
  });

  it("chart plots 16 decreases on RC 1–16 and leaves 22 stitches", () => {
    expect(result.frontNeckShoulderChartUsesLiveRows).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessCardiganFront).toBe(true);
    expect(result.frontNeckShoulderShapingChart.sleevelessFullWidthVNeckFront).toBe(true);

    const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
      result.frontNeckShoulderShapingChart,
      result.debug.frontNecklineStartRC,
    );
    const tableRows = buildActiveSideInstructionTableRows(
      result.frontNeckShoulderShapingChart,
      activeSideRcStart,
      { includeCenterNecklineSetupRow: true },
    );
    const neckDecreases = tableRows.filter(
      (row) =>
        !isCenterNecklineSetupChecklistRow(row) &&
        /decrease/i.test(row.action) &&
        /neck/i.test(row.edge),
    );
    expect(neckDecreases).toHaveLength(16);
    expect(neckDecreases.map((r) => r.rc)).toEqual(expectedRcs);

    const lastDecrease = neckDecreases[neckDecreases.length - 1]!;
    expect(lastDecrease.stitchesRemaining).toBe(22);

    const html = renderNeckShoulderShapingChartTableOnlyHtml(
      result.frontNeckShoulderShapingChart,
      "kids-10-cardigan-v",
      undefined,
      dropShoulderFrontNeckChartTableOptions(activeSideRcStart),
    );
    expect(html).not.toMatch(/return the \d+ held stitches for the second shoulder/i);
    expect(html).toContain(CARDIGAN_FRONT_OPPOSITE_FRONT_SENTENCE);

    const intro = renderActiveShoulderChartIntroHtml({
      chart: result.frontNeckShoulderShapingChart,
      wrapperClass: "test-intro",
      layout: "compact",
      shouldersShaped: false,
    });
    expect(intro).not.toMatch(/return the \d+ held stitches for the second shoulder/i);
  });
});

describe("Drop Shoulder V-neck scope — pullover JP is not double-halved", () => {
  it("pullover V-neck JP uses one halving of the full opening", () => {
    const pattern = {
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
        frontStyle: "closed",
        garmentStyle: "pullover",
      },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5.25,
        gaugeRowsPerInch: 8,
        availableNeedles: 200,
      },
    };
    const result = generateDropShoulderPattern(pattern);
    const perSide = Math.floor((result.debug.necklineStitches ?? 0) / 2);
    const depth = result.debug.frontNeckDepthRows ?? 0;
    const sched = evenShapingSchedule(perSide, depth);
    const jp = buildDropShoulderFrontJapaneseNotationReplacements(result, pattern);
    expect(jp["jp-neckline-shaping"]).toBe(
      `1s-${sched.interval}r-${sched.count}x`,
    );
    expect(jp["jp-neckline-shaping"]).not.toMatch(/^1s-2r-8x$/);

    const activeSideRcStart = dropShoulderFrontChartActiveSideRcStart(
      result.frontNeckShoulderShapingChart,
      result.debug.frontNecklineStartRC,
    );
    const tableRows = buildActiveSideInstructionTableRows(
      result.frontNeckShoulderShapingChart,
      activeSideRcStart,
      { includeCenterNecklineSetupRow: true },
    );
    const neckDecreases = tableRows.filter(
      (row) =>
        !isCenterNecklineSetupChecklistRow(row) &&
        /decrease/i.test(row.action) &&
        /neck/i.test(row.edge),
    );
    expect(neckDecreases).toHaveLength(sched.count);
    expect(neckDecreases.map((r) => r.rc)).toEqual(evenShapingGarmentRowNumbers(0, sched));
  });
});
