import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  evenShapingGarmentRowNumbers,
  evenShapingSchedule,
  formatParentheticalShapingRowNumbers,
  shapingActionRowNumbers,
} from "./evenShapingSchedule";
import { neckDecreaseStitchesPerSideFromOpening } from "./legoBlocks/vNeckline";
import {
  calculateBackRoundNecklinePlan,
  compressHoldGroupsToSegments,
} from "./legoBlocks/roundNeckline";
import {
  roundNeckBackShallowExecutionWrittenLines,
  roundNeckPlanOneSideNeckEdgeWrittenLines,
} from "./roundNeckPlanPresentation";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const DROP_SHOULDER_PATTERN = {
  fit: {
    sizingChart: "women",
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
    neckline: "round",
  },
};

const KIDS_2YR_CARDIGAN_ROUND_PATTERN = {
  fit: {
    sizingChart: "kids",
    selectedSize: "2 yr",
    easeChoice: "standard",
    selectedMeasurements: computeDefaultMeasurementsFromChartRow(
      {
        size: "2 yr",
        bust_or_chest: 21,
        waist: 21,
        hip: "",
        garment_back_length: 18,
        armhole_depth: 4.25,
        shoulder_width: 9.25,
        neck_opening: 4,
        front_neck_depth: 2,
        back_neck_depth: 1,
        upper_arm: 6,
        wrist: 4.5,
        sleeve_length: 8.5,
      } satisfies ChartRow,
      "standard",
      { bodyShape: "straight" },
    ),
  },
  style: {
    construction: "drop-shoulder",
    constructionAuthored: "drop-shoulder",
    recipientCategory: "kids",
    neckline: "round",
    bodyShape: "straight",
    frontStyle: "open",
    garmentStyle: "cardigan",
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 7,
    gaugeRowsPerInch: 11,
    availableNeedles: 200,
  },
};

function blockText(rows: readonly SleevelessPatternDisplayRow[]): string {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])])
    .join("\n");
}

function frontBlockParagraphs(rows: SleevelessPatternDisplayRow[]): string[] {
  return rows
    .filter(
      (row): row is Extract<SleevelessPatternDisplayRow, { kind: "block" }> => row.kind === "block",
    )
    .flatMap((row) => [...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? [])]);
}

describe("drop-shoulder neckline shaping row lists", () => {
  it("back shallow hold bullets include every-other-row local RC lists after reset", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: result.debug.necklineStitches!,
      necklineDepthRows: result.debug.backNeckDepthRows!,
    });
    const rightSegments = compressHoldGroupsToSegments(plan.right.holdGroups);
    let rc = 0;
    for (const seg of rightSegments) {
      const expected = formatParentheticalShapingRowNumbers(
        shapingActionRowNumbers(rc, seg.repeatCount, 2),
      );
      expect(blockText(result.displayRows)).toContain(
        `Put ${seg.stitchCount} needles into hold every other row ${seg.repeatCount} time${seg.repeatCount === 1 ? "" : "s"}. ${expected}`,
      );
      rc += 2 * seg.repeatCount;
    }
  });

  it("pullover round front shaping lines include local row lists in the neckline section", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_PATTERN);
    const neckBlock = result.frontDisplayRows.find(
      (row) => row.kind === "block" && row.rc === "RC: 000",
    );
    expect(neckBlock?.kind).toBe("block");

    const sectionStart = result.frontDisplayRows.findIndex(
      (row) => row.kind === "section" && /FRONT NECKLINE/i.test(String(row.title ?? "")),
    );
    const necklineText: string[] = [];
    for (let i = sectionStart + 1; i < result.frontDisplayRows.length; i++) {
      const row = result.frontDisplayRows[i]!;
      if (row.kind === "section" || row.kind === "piece") break;
      if (row.kind === "block") {
        necklineText.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
      }
    }

    const shapingLines = necklineText.filter((p) => /<em>\(RC: \d+/i.test(p));
    expect(shapingLines.length).toBeGreaterThan(0);
    for (const line of shapingLines) {
      expect(line).toMatch(/<em>\(RC: \d+(?:, \d+)*\)<\/em>/);
      expect(line).not.toMatch(/<em>\(RC: 1[0-9]{2}/);
    }
  });

  it("cardigan round front shaping includes local row lists on alternate-row bind-off and decrease lines", () => {
    const result = generateDropShoulderPattern(KIDS_2YR_CARDIGAN_ROUND_PATTERN);
    const neckStartRc = result.debug.frontNecklineStartRC!;
    const necklineLocalTotalRows =
      result.debug.totalCalculatedRows! - neckStartRc;
    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");

    const stairLine = frontBlockParagraphs(result.frontDisplayRows).find((p) =>
      /on alternate \(neck-edge\) rows\./i.test(p),
    );
    expect(stairLine).toBeDefined();
    expect(stairLine).toMatch(/<em>\(RC: \d+(?:, \d+)*\)<\/em>/);

    const decreaseLine = frontBlockParagraphs(result.frontDisplayRows).find((p) =>
      /Decrease 1 stitch at the neck edge every other row/i.test(p),
    );
    expect(decreaseLine).toBeDefined();
    expect(decreaseLine).toContain(
      formatParentheticalShapingRowNumbers(
        shapingActionRowNumbers(0 + 2 * (2 + 1), 5, 2),
      ),
    );
    expect(text).toMatch(
      new RegExp(
        `When 28 stitches remain, knit even to RC: ${String(necklineLocalTotalRows).padStart(3, "0")}`,
      ),
    );
  });

  it("pullover V-neck decrease line includes local RC list before the stitch-count note", () => {
    const pattern = {
      ...DROP_SHOULDER_PATTERN,
      style: { ...DROP_SHOULDER_PATTERN.style, neckline: "v" },
    };
    const result = generateDropShoulderPattern(pattern);
    const perSide = neckDecreaseStitchesPerSideFromOpening(result.debug.necklineStitches!);
    const sched = evenShapingSchedule(perSide, result.debug.frontNeckDepthRows!);
    const rowList = formatParentheticalShapingRowNumbers(
      evenShapingGarmentRowNumbers(0, sched),
    );

    const text = frontBlockParagraphs(result.frontDisplayRows).join("\n");
    expect(text).toContain(
      `At the neck edge, decrease 1 stitch every row ${sched.count} times ${rowList} (${perSide} stitches removed per side).`,
    );
  });

  it("roundNeckPlanPresentation keeps lines unchanged when necklineStartRc is omitted", () => {
    const plan = calculateBackRoundNecklinePlan({
      necklineStitches: 24,
      necklineDepthRows: 7,
    });
    expect(
      roundNeckPlanOneSideNeckEdgeWrittenLines(plan, "right"),
    ).toEqual([
      "At the neck edge, put 2 stitches in hold every other row 2 times.",
      "At the neck edge, put 1 stitch in hold every other row 2 times.",
    ]);
    expect(
      roundNeckBackShallowExecutionWrittenLines(plan, { bodyWidthStitches: 100 }).join("\n"),
    ).not.toMatch(/<em>\(RC: \d+, \d+/);
  });
});
