import { describe, expect, it } from "vitest";
import {
  buildDropShoulderSleeveShapingChartRows,
  DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
  DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN,
  dropShoulderSleeveNeedsShapingChart,
  dropShoulderSleeveShapingRcSequence,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingBreakdown,
  dropShoulderSleeveShapingPlanForDirection,
} from "./dropShoulderSleeveShaping";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { buildDropShoulderSleeveJapaneseNotationReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveDropShoulderSleeveInches } from "./dropShoulderSleeveMeasurementOverrides";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const size7Row: ChartRow = {
  size: 7,
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function reverseTaperPatternData(overrides?: Record<string, string>) {
  return {
    style: withDropShoulderConstructionAuthored(
      { frontStyle: "closed", neckline: "round", patternMode: "custom-build" },
      "long",
    ),
    fit: {
      selectedSize: "7",
      easeChoice: "standard",
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 12,
        wrist: 14,
        sleeve_length: 17,
      },
      cbMeasurementOverrides: {
        upperArm: "12",
        wrist: "14",
        sleeveLength: "17",
        cuffDepth: "2",
        ...overrides,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function sleeveInstructionText(rows: readonly SleevelessPatternDisplayRow[]): string {
  const parts: string[] = [];
  for (const row of rows) {
    if (row.kind !== "block") continue;
    parts.push(...(row.trustedParagraphs ?? []), ...(row.paragraphs ?? []));
  }
  return parts.join("\n");
}

function assertAllDebugFinite(debug: Record<string, unknown>): void {
  for (const [key, val] of Object.entries(debug)) {
    if (typeof val === "number") {
      expect(Number.isFinite(val), `${key} should be finite`).toBe(true);
    }
  }
}

describe("Drop Shoulder reverse-taper sleeve (cuff circ > upper arm)", () => {
  const topSts = 60;
  const wristSts = 70;
  const cuffRows = 14;
  const sleeveBodyRows = 105;
  const sleeveTotalRows = 119;

  it("preserves user-entered cuff circumference exactly", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { wrist: "14" },
      chartRow: size7Row,
      fitPreference: "standard",
      sleeveLengthChoice: "long",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: true },
    });
    expect(resolved.wristIn).toBe(14);
    expect(resolved.upperArmIn).toBe(12);
  });

  it("cuff-up decreases from the larger cuff toward the smaller upper arm", () => {
    const plan = dropShoulderSleeveShapingPlanForDirection(
      { topSts, wristSts, sleeveBodyRows },
      "cuff-up",
    );
    const breakdown = dropShoulderSleeveShapingBreakdown(
      { topSts, wristSts, direction: "cuff-up" },
      plan.steps,
    );

    expect(plan.shapingDirection).toBe("decrease");
    expect(plan.steps).toEqual([{ sts: 1, rows: 20, times: 5 }]);
    expect(breakdown).toHaveLength(5);
    expect(breakdown[0]?.stitchesAfter).toBe(68);
    expect(breakdown[4]?.stitchesAfter).toBe(60);

    const result = generateDropShoulderPattern(reverseTaperPatternData(), {
      sleeveDirection: "cuff-up",
    });
    const text = sleeveInstructionText(result.sleeveDisplayRows);
    const d = result.debug as Record<string, unknown>;

    expect(d.dropShoulderSleeveTopStitches).toBe(60);
    expect(d.dropShoulderSleeveWristStitches).toBe(70);
    expect(d.dropShoulderWristInches).toBe(14);
    expect(d.dropShoulderUpperArmInches).toBe(12);
    assertAllDebugFinite(d);

    expect(text).toContain("Cast on 70 stitches for the sleeve cuff.");
    expect(text).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(text).toMatch(/Decrease 1 stitch at each side every 20 rows 5 times/i);
    expect(text).toMatch(/After the final decrease, knit 5 rows even in pattern, then bind off at RC: 119/i);
    expect(text).not.toMatch(/Increase 1 stitch at each side/i);
    expect(text).not.toContain(DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN);
  });

  it("top-down increases from the smaller upper arm toward the larger cuff", () => {
    const plan = dropShoulderSleeveShapingPlanForDirection(
      { topSts, wristSts, sleeveBodyRows },
      "top-down",
    );
    const breakdown = dropShoulderSleeveShapingBreakdown(
      { topSts, wristSts, direction: "top-down" },
      plan.steps,
    );

    expect(plan.shapingDirection).toBe("increase");
    expect(breakdown).toHaveLength(5);
    expect(breakdown[0]?.stitchesAfter).toBe(62);
    expect(breakdown[4]?.stitchesAfter).toBe(70);

    const result = generateDropShoulderPattern(reverseTaperPatternData(), {
      sleeveDirection: "top-down",
    });
    const text = sleeveInstructionText(result.sleeveDisplayRows);

    expect(text).toContain("Cast on or pick up 60 stitches.");
    expect(text).toMatch(/Increase 1 stitch at each side every 20 rows 5 times/i);
    expect(text).not.toMatch(/Decrease 1 stitch at each side/i);
  });

  it("shaping chart and RC sequence use the correct reverse-taper direction", () => {
    const chartInput = {
      topSts,
      wristSts,
      cuffRows,
      sleeveBodyRows,
      sleeveTotalRows,
      direction: "cuff-up" as const,
    };
    const chartRows = buildDropShoulderSleeveShapingChartRows(chartInput);
    const rcs = dropShoulderSleeveShapingRcSequence(chartInput);

    expect(dropShoulderSleeveNeedsShapingChart(chartInput)).toBe(true);
    expect(chartRows.filter((r) => /decrease/i.test(r.action))).toHaveLength(5);
    expect(chartRows.filter((r) => /increase/i.test(r.action))).toHaveLength(0);
    expect(rcs).toEqual([34, 54, 74, 94, 114]);
    expect(chartRows[chartRows.length - 1]?.stitchesRemaining).toBe(0);
  });

  it("Japanese notation reflects reverse-taper decreases for cuff-up", () => {
    const result = generateDropShoulderPattern(reverseTaperPatternData(), {
      sleeveDirection: "cuff-up",
    });
    const jp = buildDropShoulderSleeveJapaneseNotationReplacements(result, "cuff-up");
    expect(jp["jp-sleeve-shaping"]).toBe("1s-20r-5x");
    expect(jp["jp-caston"]).toBe("co70 sts");
    expect(jp["jp-sleeve_cap_sts"]).toBe("60 sts");
  });

  it("normal taper and straight sleeves remain unchanged", () => {
    const normal = generateDropShoulderPattern({
      ...reverseTaperPatternData(),
      fit: {
        ...reverseTaperPatternData().fit,
        selectedMeasurements: {
          ...reverseTaperPatternData().fit.selectedMeasurements,
          wrist: 6,
        },
        cbMeasurementOverrides: {
          upperArm: "12",
          wrist: "6",
          sleeveLength: "17",
          cuffDepth: "2",
        },
      },
    });
    const straight = generateDropShoulderPattern({
      ...reverseTaperPatternData(),
      style: withDropShoulderConstructionAuthored(
        { frontStyle: "closed", neckline: "round", patternMode: "custom-build" },
        "short",
      ),
    });
    const normalText = sleeveInstructionText(normal.sleeveDisplayRows);
    const straightText = sleeveInstructionText(straight.sleeveDisplayRows);

    expect(normalText).toMatch(/Increase 1 stitch at each side/i);
    expect(straightText).toContain(DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN);
    expect(straight.debug.dropShoulderSleeveTopStitches).toBe(
      straight.debug.dropShoulderSleeveWristStitches,
    );
  });
});
