import { describe, expect, it } from "vitest";
import {
  buildDropShoulderSleeveShapingChartRows,
  DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE,
  DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN,
  dropShoulderSleeveNeedsShapingChart,
  dropShoulderSleevePreShapingSpan,
  dropShoulderSleeveShapingRcSequence,
  dropShoulderSleeveShapingSchedule,
} from "./dropShoulderSleeveShapingChart";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingPlanForDirection,
  formatDropShoulderSleeveShapingWrittenLines,
} from "./dropShoulderSleeveShaping";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";
import { buildDropShoulderSleeveJapaneseNotationReplacements } from "./sleevelessGarmentDiagramReplacements";
import {
  dropShoulderEditWorkspaceCuffCircumferenceDisplayInches,
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const size7Row: ChartRow = {
  size: 7,
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function dropShoulderPatternData(
  sleeveLength: string,
  overrides?: Record<string, string>,
) {
  return {
    style: withDropShoulderConstructionAuthored(
      { frontStyle: "closed", neckline: "round", patternMode: "custom-build" },
      sleeveLength,
    ),
    fit: {
      selectedSize: "7",
      easeChoice: "standard",
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 12,
        wrist: 6,
        sleeve_length: 17,
      },
      cbMeasurementOverrides: {
        upperArm: "12",
        wrist: "6",
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

describe("Drop Shoulder short preset  straight sleeve (zero taper)", () => {
  const shortResolved = resolveDropShoulderSleeveInches({
    overrides: {},
    chartRow: size7Row,
    fitPreference: "standard",
    sleeveLengthChoice: "short",
  });

  it("short preset resolves cuff circumference to upper arm (Size 7)", () => {
    expect(shortResolved.upperArmIn).toBe(12);
    expect(shortResolved.wristIn).toBe(12);
    expect(shortResolved.sleeveLengthIn).toBe(5.5);
  });

  it("1. short sleeve cuff-up produces a valid straight sleeve with no shaping instructions", () => {
    const result = generateDropShoulderPattern(dropShoulderPatternData("short"), {
      sleeveDirection: "cuff-up",
    });
    const d = result.debug as Record<string, unknown>;
    const text = sleeveInstructionText(result.sleeveDisplayRows);

    expect(d.dropShoulderSleeveTopStitches).toBe(60);
    expect(d.dropShoulderSleeveWristStitches).toBe(60);
    expect(d.dropShoulderWristInches).toBe(12);
    assertAllDebugFinite(d);

    expect(text).toContain("Cast on 60 stitches for the sleeve cuff.");
    expect(text).toContain("Knit 14 rows even.");
    expect(text).toContain("Knit 25 rows in pattern.");
    expect(text).toContain(DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN);
    expect(text).not.toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(text).not.toMatch(/Increase 1 stitch at each side/i);
    expect(text).not.toMatch(/Decrease 1 stitch at each side/i);
    expect(text).not.toContain("Knit 0 rows even.");
  });

  it("2. short sleeve top-down produces a valid straight sleeve with no shaping instructions", () => {
    const result = generateDropShoulderPattern(dropShoulderPatternData("short"), {
      sleeveDirection: "top-down",
    });
    const d = result.debug as Record<string, unknown>;
    const text = sleeveInstructionText(result.sleeveDisplayRows);

    expect(d.dropShoulderSleeveTopStitches).toBe(60);
    expect(d.dropShoulderSleeveWristStitches).toBe(60);
    assertAllDebugFinite(d);

    expect(text).toContain("Cast on or pick up 60 stitches.");
    expect(text).toContain("Knit 25 rows in pattern.");
    expect(text).toContain("Knit 14 rows even.");
    expect(text).toContain(DROP_SHOULDER_SLEEVE_NO_SHAPING_NOTE_PLAIN);
    expect(text).not.toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
    expect(text).not.toMatch(/Increase 1 stitch at each side/i);
    expect(text).not.toMatch(/Decrease 1 stitch at each side/i);
  });

  it("3. zero shaping events produce empty schedules, RC sequences, and chart rows", () => {
    const chartInput = {
      topSts: 60,
      wristSts: 60,
      cuffRows: 14,
      sleeveBodyRows: 25,
      sleeveTotalRows: 39,
      direction: "cuff-up" as const,
    };
    const plan = dropShoulderSleeveShapingPlanForDirection(
      { topSts: 60, wristSts: 60, sleeveBodyRows: 25 },
      "cuff-up",
    );
    const schedule = dropShoulderSleeveShapingSchedule(chartInput);

    expect(plan.noShaping).toBe(true);
    expect(plan.steps).toEqual([]);
    expect(plan.remainderRows).toBe(25);
    expect(schedule).toEqual({ interval: 0, count: 0, remainderRows: 25 });
    expect(dropShoulderSleeveShapingRcSequence(chartInput)).toEqual([]);
    expect(buildDropShoulderSleeveShapingChartRows(chartInput)).toEqual([]);
    expect(formatDropShoulderSleeveShapingWrittenLines(plan.shapingDirection, plan.steps)).toEqual(
      [],
    );
    expect(dropShoulderSleeveNeedsShapingChart(chartInput)).toBe(false);
    expect(dropShoulderSleevePreShapingSpan(chartInput).firstShapingRc).toBeUndefined();
  });

  it("4. no divide-by-zero or non-finite values in short-sleeve generation", () => {
    for (const direction of ["cuff-up", "top-down"] as const) {
      const result = generateDropShoulderPattern(dropShoulderPatternData("short"), {
        sleeveDirection: direction,
      });
      assertAllDebugFinite(result.debug as Record<string, unknown>);
      const jp = buildDropShoulderSleeveJapaneseNotationReplacements(result, direction);
      expect(jp["jp-sleeve-shaping"]).toBe("");
      expect(jp["jp-sleeve"]).toBe("25r");
      expect(jp["jp-sleeve_cap_sts"]).toBe("60 sts");
    }
  });

  it("edit workspace and generator agree on short-sleeve cuff circumference", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: {},
      chartRow: size7Row,
      fitPreference: "standard",
      sleeveLengthChoice: "short",
    });
    const display = dropShoulderEditWorkspaceCuffCircumferenceDisplayInches({
      overrideInches: "6",
      upperArmInches: "12",
      sleeveLengthChoice: "short",
      userEditedCuffCircumference: false,
    });
    const generated = generateDropShoulderPattern(dropShoulderPatternData("short"));
    expect(display).toBe("12");
    expect(resolved.wristIn).toBe(12);
    expect(generated.debug.dropShoulderWristInches).toBe(12);
  });
});

describe("Drop Shoulder tapered presets  shaping still works", () => {
  it("5. Long, Three-quarter, and Elbow still require sleeve shaping", () => {
    for (const preset of ["long", "three-quarter", "elbow"] as const) {
      const result = generateDropShoulderPattern(dropShoulderPatternData(preset));
      const d = result.debug as Record<string, unknown>;
      const text = sleeveInstructionText(result.sleeveDisplayRows);
      const topSts = d.dropShoulderSleeveTopStitches as number;
      const wristSts = d.dropShoulderSleeveWristStitches as number;

      expect(topSts).toBeGreaterThan(wristSts);
      expect(text).toContain(DROP_SHOULDER_SLEEVE_BEGIN_SHAPING_LINE);
      expect(text).toMatch(/Increase 1 stitch at each side/i);
      expect(dropShoulderSleeveNeedsShapingChart({
        topSts,
        wristSts,
        cuffRows: d.dropShoulderSleeveCuffRows as number,
        sleeveBodyRows: d.dropShoulderSleeveBodyRows as number,
        sleeveTotalRows: d.dropShoulderSleeveTotalRows as number,
        direction: "cuff-up",
      })).toBe(true);
    }
  });

  it("equal top and wrist still marks no shaping in the plan helper", () => {
    const plan = dropShoulderSleeveShapingPlan({ topSts: 60, wristSts: 60, sleeveBodyRows: 25 });
    expect(plan.noShaping).toBe(true);
  });
});
