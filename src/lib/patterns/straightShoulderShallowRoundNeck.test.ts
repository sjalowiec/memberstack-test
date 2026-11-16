import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { computeShallowBackNeckNeedleLayout } from "./legoBlocks/shallowBackNeckNeedleLayout";
import { alignShallowHoldGroupsToShoulderSections } from "./straightShoulderShallowRoundNeck";
import { calculateDocumentedShallowRoundNecklineShaping } from "./legoBlocks/roundNeckline";
import { buildTimeline, type RowEntry } from "./shapingTimeline";
import {
  neckShoulderChartRowsFromTimeline,
} from "./neckShoulderShapingChartRows";
import { neckShoulderShapingChartFromRows } from "./neckShoulderShapingChart";
import { buildActiveSideInstructionTableRows } from "./neckShoulderActiveSideChecklist";
import { dropShoulderFrontChartActiveSideRcStart } from "./dropShoulderFrontNeckShapingChart";
import { DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID, DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID } from "./dropShoulderHoldPositionVideoTip";

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

function sectionText(
  rows: readonly SleevelessPatternDisplayRow[],
  title: string,
): string {
  const start = rows.findIndex((row) => row.kind === "section" && row.title === title);
  const lines: string[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.kind === "section" || row.kind === "piece") break;
    if (row.kind === "block") {
      lines.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
    }
  }
  return lines.join("\n").replace(/<[^>]+>/g, "");
}

function innerEvents(timeline: readonly RowEntry[], origin: number) {
  return timeline.flatMap((entry) =>
    entry.events
      .filter((event) => event.edge === "inner" && event.amount > 0)
      .map((event) => ({
        local: entry.row - origin,
        kind: event.kind,
        side: event.side,
        amount: event.amount,
      })),
  );
}

describe("straight-shoulder shallow round neck", () => {
  it("moves the extra edge stitches onto the larger shoulder when the center is odd", () => {
    const leftGroups = [2, 2, 2, 2, 1, 1];
    const rightGroups = [2, 2, 2, 2, 2, 1];
    const layout = computeShallowBackNeckNeedleLayout(114, 21);
    expect(layout.stitchCounts.rightShoulder).toBe(46);
    expect(layout.stitchCounts.leftShoulder).toBe(47);
    expect(layout.stitchCounts.center).toBe(21);

    const aligned = alignShallowHoldGroupsToShoulderSections(114, 21, leftGroups, rightGroups);
    const sum = (groups: readonly number[]) => groups.reduce((total, group) => total + group, 0);
    expect(layout.stitchCounts.rightShoulder - sum(aligned.rightGroups)).toBe(36);
    expect(layout.stitchCounts.leftShoulder - sum(aligned.leftGroups)).toBe(36);
    expect(sum(aligned.rightGroups)).toBe(10);
    expect(sum(aligned.leftGroups)).toBe(11);
  });

  it("keeps an even center on matching shoulders without swapping", () => {
    const plan = calculateDocumentedShallowRoundNecklineShaping({
      necklineStitches: 42,
      necklineDepthRows: 12,
    });
    expect(plan.centerBindOff).toBe(20);
    const aligned = alignShallowHoldGroupsToShoulderSections(
      122,
      plan.centerBindOff,
      plan.left.holdGroups,
      plan.right.holdGroups,
    );
    expect(aligned.leftGroups).toEqual(plan.left.holdGroups);
    expect(aligned.rightGroups).toEqual(plan.right.holdGroups);
    const layout = computeShallowBackNeckNeedleLayout(122, plan.centerBindOff);
    const edge = aligned.rightGroups.reduce((total, group) => total + group, 0);
    expect(layout.stitchCounts.rightShoulder - edge).toBe(40);
    expect(layout.stitchCounts.leftShoulder - edge).toBe(40);
  });

  it("changes neck-edge event kinds only when the drop-shoulder option is on", () => {
    const inputs = {
      firstShapingRow: 0,
      shoulderStitchesPerSide: 40,
      centerNeckBindOff: 42,
      neckDepthRows: 12,
      neckProfile: "back" as const,
      stitchesAfterArmhole: 122,
      shoulderBindoffRows: 11,
    };
    const holds = innerEvents(buildTimeline(inputs, { straightShoulders: true }), 0);
    const shaped = innerEvents(
      buildTimeline(inputs, { straightShoulders: true, straightShoulderShallowNeckEdge: true }),
      0,
    );
    expect(holds.filter((event) => event.side === "right" && event.kind === "hold").length).toBeGreaterThan(0);
    expect(shaped.filter((event) => event.side !== "center" && event.kind === "hold")).toEqual([]);
    expect(shaped.filter((event) => event.kind === "bindOff" && event.amount === 2).map((event) => event.local)).toEqual([
      1, 1, 3, 3, 5, 5, 7, 7, 9, 9,
    ]);
    expect(shaped.filter((event) => event.kind === "decrease").map((event) => event.local)).toEqual([11, 11]);
    const center = buildTimeline(inputs, {
      straightShoulders: true,
      straightShoulderShallowNeckEdge: true,
    })[0]?.events.find((event) => event.side === "center");
    expect(center).toMatchObject({ kind: "hold", edge: "center", amount: 20 });
  });

  it("writes the Women's size 1 back at 7 stitches and 11 rows per 4 inches", () => {
    const result = generateDropShoulderPattern(size1Pattern(4));
    expect(result.debug.necklineStitches).toBe(42);
    expect(result.debug.shoulderStitches).toBe(40);
    expect(result.debug.backNeckDepthRows).toBe(12);
    expect(result.debug.backNeckRoundNecklineStrategy).toBe("shallow-round");
    expect(result.debug.frontNeckRoundNecklineStrategy).toBe("deep-round");

    const back = sectionText(result.displayRows, "BACK NECKLINE & SHOULDERS");
    expect(back).toContain("Put needles L61 through R10 into hold (71 stitches total).");
    expect(back).toContain("Work needles R11 through R61 (51 stitches total).");
    expect(back).toContain("Before knitting this row, the carriage is at the shoulder edge.");
    expect(back).toContain("work each action below before knitting that row");
    expect(back).toContain("Bind off 2 stitches every other row 5 times. (RC: 001, 003, 005, 007, 009)");
    expect(back).toContain(
      "Decrease 1 stitch at the neck edge, fully fashioned, every other row 1 time. (RC: 011)",
    );
    expect(back).toContain("The first shoulder is complete.");
    expect(back).toContain("Scrap off or bind off the remaining shoulder stitches.");
    expect(back).toContain("Break yarn and move the carriage to the opposite side.");
    expect(back).toContain("Reset the row counter to RC: 000.");
    expect(back).toContain("Return needles L61 through L11 to working position (51 stitches total).");
    expect(back).toContain("Leave center neckline needles L10 through R10 in hold (20 stitches total).");
    expect(back).toContain("The second shoulder is complete.");
    expect(back).toContain("Scrap off or bind off the center neckline stitches left in hold.");
    expect(back).not.toMatch(/Put \d+ needles into hold every other row/);
    expect(back).toContain("there is no shoulder shaping");

    const holdBlock = result.displayRows.find(
      (row) => row.kind === "block" && row.tipId === DROP_SHOULDER_HOLD_POSITION_VIDEO_TIP_ID,
    );
    expect(holdBlock?.kind).toBe("block");
    if (holdBlock?.kind === "block") {
      expect(holdBlock.trustedParagraphs?.join("\n")).toMatch(/into hold/i);
      expect(holdBlock.tipHtml).toContain(`data-content-id="${DROP_SHOULDER_HOLD_POSITION_VIDEO_CONTENT_ID}"`);
    }

    const completion = result.displayRows.filter(
      (row) => row.kind === "block" && row.stitchCount === 40 && /shoulder is complete/i.test((row.trustedParagraphs ?? []).join(" ")),
    );
    expect(completion).toHaveLength(2);

    const origin = result.debug.backNecklineStartRC!;
    const neck = innerEvents(result.backNeckShoulderTimeline ?? [], origin).filter((event) => event.side !== "center");
    expect(neck.every((event) => event.local % 2 === 1)).toBe(true);
    const outerBeforeFinish = (result.backNeckShoulderTimeline ?? []).filter((entry) =>
      entry.events.some((event) => event.edge === "outer" && event.amount > 0 && entry.row - origin < 12),
    );
    expect(outerBeforeFinish).toEqual([]);

    const front = sectionText(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS");
    expect(front).toMatch(/bind off the center/i);
    expect(front).toMatch(/knit even to RC: 044/i);
    expect(front).not.toContain("fully fashioned");
    expect(front).not.toContain("RIGHT SIDE");
  });

  it("uses the same block for a 1-inch Drop Shoulder front", () => {
    const result = generateDropShoulderPattern(size1Pattern(1));
    expect(result.debug.frontNeckDepthRows).toBe(12);
    expect(result.debug.frontNeckRoundNecklineStrategy).toBe("shallow-round");

    const back = sectionText(result.displayRows, "BACK NECKLINE & SHOULDERS");
    const front = sectionText(result.frontDisplayRows, "FRONT NECKLINE & SHOULDERS");
    expect(front).toContain("Begin front neckline shaping.");
    expect(front).toContain("Bind off 2 stitches every other row 5 times. (RC: 001, 003, 005, 007, 009)");
    expect(front).toContain(
      "Decrease 1 stitch at the neck edge, fully fashioned, every other row 1 time. (RC: 011)",
    );
    expect(front).toContain("Reset the row counter to RC: 000.");
    expect(front).toContain("Scrap off or bind off the center neckline stitches left in hold.");
    expect(front).toContain("Put needles L61 through R10 into hold (71 stitches total).");
    expect(front).not.toMatch(/knit even to RC/i);

    expect(front).toContain("Work needles R11 through R61 (51 stitches total).");
    expect(back).toContain("Work needles R11 through R61 (51 stitches total).");
    expect(front).toContain("Leave center neckline needles L10 through R10 in hold (20 stitches total).");

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
      "1:Bind off 2 sts",
      "3:Bind off 2 sts",
      "5:Bind off 2 sts",
      "7:Bind off 2 sts",
      "9:Bind off 2 sts",
      "11:Decrease 1 st",
    ]);
    expect(neckRows.every((row) => row.rc % 2 === 1)).toBe(true);
  });
});
