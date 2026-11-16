import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { computeShallowBackNeckNeedleLayout } from "./legoBlocks/shallowBackNeckNeedleLayout";
import { calculateRoundNecklinePlan } from "./legoBlocks/roundNeckline";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import {
  ARMHOLE_MARKER_BESIDE_NECKLINE_SENTENCE,
  buildActiveSideInstructionTableRows,
  buildSecondShoulderInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import {
  dropShoulderFrontChartActiveSideRcStart,
  dropShoulderFrontNeckChartTableOptions,
} from "./dropShoulderFrontNeckShapingChart";
import {
  renderNeckShoulderShapingChartTableOnlyHtml,
  renderNeckShoulderShapingPrintInstructionTableHtml,
} from "./neckShoulderShapingChartHtml";
import {
  DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID,
  DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID,
} from "./dropShoulderHoldPositionVideoTip";

const WOMENS_SIZE_1: ChartRow = {
  size: 1,
  bust_or_chest: 31.5,
  waist: 22.5,
  hip: 33.5,
  garment_back_length: 21,
  armhole_depth: 7,
  shoulder_width: 12,
  neck_opening: 6,
  front_neck_depth: 4,
  back_neck_depth: 1,
  upper_arm: 9.75,
  wrist: 5.25,
  sleeve_length: 16.25,
};

function size1Pattern(frontNeckDepthInches: number): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(WOMENS_SIZE_1, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 1,
      easeChoice: "standard",
      selectedMeasurements: { ...measurements, front_neck_depth: frontNeckDepthInches },
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: "round",
      bodyShape: "straight",
      frontStyle: "closed",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 7,
      gaugeRowsPerInch: 11,
      availableNeedles: 200,
    },
  };
}

function plain(rows: readonly SleevelessPatternDisplayRow[]): string {
  return rows
    .filter((row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block")
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ");
}

describe("deep round neckline that starts on the armhole row", () => {
  it("uses one straight-shoulder block when the front neck depth equals the armhole", () => {
    const armholeInches = 9.75 / 2;
    const result = generateDropShoulderPattern(size1Pattern(armholeInches));
    const shoulder = result.debug.shoulderStitches!;
    const neck = result.debug.necklineStitches!;
    const center = result.debug.frontCenterNeckBindOffStitches!;
    expect(result.debug.armholeDepth).toBe(armholeInches);
    expect(result.debug.frontNeckDepthRows).toBe(54);
    expect(result.debug.armholeStartRow).toBe(177);
    expect(result.debug.frontNecklineStartRC).toBe(177);
    expect(result.debug.totalCalculatedRows).toBe(231);
    expect(result.debug.frontNeckRoundNecklineStrategy).toBe("deep-round");
    expect(result.debug.backNeckRoundNecklineStrategy).toBe("shallow-round");
    expect(neck).toBe(42);
    expect(center).toBe(14);
    expect(shoulder).toBe(40);

    const plan = calculateRoundNecklinePlan({ necklineStitches: neck, necklineDepthRows: 54 });
    const layout = computeShallowBackNeckNeedleLayout(122, center);
    const edge = plan.right.stairSteps.reduce((sum, step) => sum + step, 0) + plan.right.singleDecreaseCount;
    expect(layout.stitchCounts.center + edge + edge + shoulder + shoulder).toBe(122);
    expect(layout.stitchCounts.rightShoulder - edge).toBe(shoulder);
    expect(layout.stitchCounts.leftShoulder - edge).toBe(shoulder);

    const front = plain(result.frontDisplayRows);
    expect(front).toContain("Begin the front neckline on this same row.");
    expect(front).toContain("After the row counter resets to RC 000, use that counter");
    expect(front).toContain("Put needles L61 through L8 into hold (54 stitches total).");
    expect(front).toContain("Bind off center neckline needles L7 through R7 (14 stitches total).");
    expect(front).toContain("Start this bind-off with the carriage and the working yarn at L7.");
    expect(front).toContain("These center stitches are removed from work and finished.");
    expect(front).toContain("Place the carriage at the shoulder edge without knitting a row.");
    expect(front).toContain("Work needles R8 through R61 (54 stitches total).");
    expect(front).toContain("work each action below before knitting that row");
    expect(front).toContain("Bind off 3 stitches every other row 1 time. (RC: 001)");
    expect(front).toContain("Bind off 2 stitches every other row 2 times. (RC: 003, 005)");
    expect(front).toContain(
      "Decrease 1 stitch at the neck edge, fully fashioned, every other row 7 times. (RC: 007, 009, 011, 013, 015, 017, 019)",
    );
    expect(front).toContain("40 stitches remain on the working shoulder. Knit even to RC: 054.");
    expect(front).toContain("Scrap off or bind off the remaining shoulder stitches.");
    expect(front).toContain("Break the yarn.");
    expect(front).toContain("Reset the row counter to RC: 000.");
    expect(front).toContain("Attach the yarn at the neck edge.");
    expect(front).toContain("The center neckline stitches are already bound off.");
    expect(front).toContain("The second shoulder is complete.");
    expect(front).not.toMatch(/\(RC: 002, 004, 006\)/);
    expect(front).toContain("there is no shoulder shaping");

    const markerAt = result.frontDisplayRows.findIndex(
      (row) => row.kind === "block" && plain([row]).includes("Begin the front neckline on this same row"),
    );
    const resetAt = result.frontDisplayRows.findIndex(
      (row) => row.kind === "block" && row.rowCounterReset,
    );
    const shapingAt = result.frontDisplayRows.findIndex(
      (row) => row.kind === "block" && plain([row]).includes("Begin front neckline shaping"),
    );
    expect(markerAt).toBeGreaterThanOrEqual(0);
    expect(resetAt).toBeGreaterThan(markerAt);
    expect(shapingAt).toBeGreaterThan(resetAt);

    const holdBlock = result.frontDisplayRows.find(
      (row) => row.kind === "block" && row.tipId === DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID,
    );
    expect(holdBlock?.kind).toBe("block");
    if (holdBlock?.kind === "block") {
      expect(plain([holdBlock])).toMatch(/into hold/i);
      expect(holdBlock.tipHtml).toContain(`data-content-id="${DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID}"`);
    }

    const chart = neckShoulderShapingChartFromRows(
      neckShoulderChartRowsFromTimeline(result.frontNeckShoulderTimeline ?? []),
      { timeline: result.frontNeckShoulderTimeline },
    );
    const rcStart = dropShoulderFrontChartActiveSideRcStart(
      chart,
      result.debug.frontNecklineStartRC,
      result.debug.armholeStartRow,
    );
    const checklist = buildActiveSideInstructionTableRows(chart, rcStart);
    const neckRows = checklist.filter((row) => row.edge === "Neck" && /^(Bind off|Decrease)/.test(row.action));
    expect(neckRows.map((row) => `${row.rc}:${row.action}`)).toEqual([
      "1:Bind off 3 sts",
      "3:Bind off 2 sts",
      "5:Bind off 2 sts",
      "7:Decrease 1 st",
      "9:Decrease 1 st",
      "11:Decrease 1 st",
      "13:Decrease 1 st",
      "15:Decrease 1 st",
      "17:Decrease 1 st",
      "19:Decrease 1 st",
    ]);
    expect(neckRows.every((row) => row.rc % 2 === 1)).toBe(true);

    const back = plain(result.displayRows);
    expect(back).toContain("Put needles L61 through R10 into hold");
    expect(back).toContain("Decrease 1 stitch at the neck edge, fully fashioned, every other row 1 time. (RC: 011)");
    expect(back).not.toContain("Bind off center neckline needles");
  });

  it("keeps the armhole marker at RC 177 when the displayed 5-inch neck starts at RC 175", () => {
    const result = generateDropShoulderPattern(size1Pattern(5));
    expect(result.debug.armholeDepth).toBe(9.75 / 2);
    expect(result.debug.armholeStartRow).toBe(177);
    expect(result.debug.armholeRows).toBe(54);
    expect(result.debug.frontNeckDepth).toBe(5);
    expect(result.debug.frontNeckDepthRows).toBe(56);
    expect(result.debug.frontNecklineStartRC).toBe(175);
    expect(result.debug.frontNeckRoundNecklineStrategy).toBe("deep-round");

    const front = plain(result.frontDisplayRows);
    const lifelineAt = front.indexOf("Optional: Add a lifeline before dividing the neckline.");
    const centerAt = front.indexOf("Bind off the center 14 stitches for the neck.");
    const markerAt = front.indexOf("Place a marker at each end of this row to mark the base of the armhole.");
    const stairAt = front.indexOf("(RC: 177, 179, 181)");
    const singlesAt = front.indexOf("(RC: 183, 185, 187, 189, 191, 193, 195)");
    expect(lifelineAt).toBeGreaterThanOrEqual(0);
    expect(centerAt).toBeGreaterThan(lifelineAt);
    expect(markerAt).toBeGreaterThan(centerAt);
    expect(stairAt).toBeGreaterThan(markerAt);
    expect(singlesAt).toBeGreaterThan(stairAt);
    expect(front).not.toContain("stitches. for the neck");
    expect(front).not.toContain("Begin the front neckline on this same row.");

    const markerBlock = result.frontDisplayRows.find(
      (row) => row.kind === "block" && row.rc === "RC: 177",
    );
    expect(markerBlock?.kind).toBe("block");
    if (markerBlock?.kind === "block") {
      expect(markerBlock.paragraphs?.[0]).toMatch(/^Place a marker at each end/i);
      expect(plain([markerBlock])).toContain("bind off 3, then 2, then 2 stitches");
      expect(plain([markerBlock])).toContain("(RC: 177, 179, 181)");
    }

    const chart = neckShoulderShapingChartFromRows(
      neckShoulderChartRowsFromTimeline(result.frontNeckShoulderTimeline ?? []),
      { timeline: result.frontNeckShoulderTimeline },
    );
    const rcStart = dropShoulderFrontChartActiveSideRcStart(
      chart,
      result.debug.frontNecklineStartRC,
      result.debug.armholeStartRow,
    );
    const options = dropShoulderFrontNeckChartTableOptions(rcStart, chart, result.debug.armholeStartRow);
    const checklist = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
      armholeMarkerWithNecklineRc: result.debug.armholeStartRow,
    });
    const markerRow = checklist.find((row) => row.rc === 177);
    expect(markerRow?.action).toBe(`${ARMHOLE_MARKER_BESIDE_NECKLINE_SENTENCE} Bind off 3 sts`);
    const second = buildSecondShoulderInstructionTableRows(checklist);
    expect(second.find((row) => row.rc === 177)?.action).toBe("Bind off 3 sts");
    expect(second.some((row) => row.action.includes("Place a marker"))).toBe(false);

    const online = renderNeckShoulderShapingChartTableOnlyHtml(chart, "deep-before-marker", undefined, options);
    const printed = renderNeckShoulderShapingPrintInstructionTableHtml(
      chart,
      "deep-before-marker-print",
      "",
      options,
    );
    expect(online).toContain(`${ARMHOLE_MARKER_BESIDE_NECKLINE_SENTENCE} Bind off 3 sts`);
    expect(printed.replace(/\u00a0/g, " ")).toContain(
      `${ARMHOLE_MARKER_BESIDE_NECKLINE_SENTENCE} Bind off 3 sts`,
    );
    expect(online.indexOf(ARMHOLE_MARKER_BESIDE_NECKLINE_SENTENCE)).toBeLessThan(
      online.indexOf("Bind off 2 sts"),
    );
  });

  it("leaves the default 4-inch deep front and the 1-inch shallow front on their approved paths", () => {
    const deep = generateDropShoulderPattern(size1Pattern(4));
    expect(deep.debug.frontNecklineStartRC).not.toBe(deep.debug.armholeStartRow);
    const deepFront = plain(deep.frontDisplayRows);
    expect(deepFront).toMatch(/bind off the center/i);
    expect(deepFront).toMatch(/\(RC: 002, 004, 006\)/);
    expect(deepFront).not.toContain("Begin the front neckline on this same row");

    const shallow = generateDropShoulderPattern(size1Pattern(1));
    expect(shallow.debug.frontNeckRoundNecklineStrategy).toBe("shallow-round");
    const shallowFront = plain(shallow.frontDisplayRows);
    expect(shallowFront).toContain("Put needles L61 through R10 into hold");
    expect(shallowFront).toContain("(RC: 001, 003, 005, 007, 009)");
    expect(shallowFront).not.toContain("Bind off center neckline needles");
    expect(shallow.debug.shoulderStitches).toBe(deep.debug.shoulderStitches);
  });
});
