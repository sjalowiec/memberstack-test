import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import {
  SIDEWAYS_CARDIGAN_CONSTRUCTION,
  SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS,
} from "./sidewaysCardiganConstructionIdentity";
import { resolveSidewaysCardiganBodyCalcInputFromPattern } from "./sidewaysCardiganFinishedMeasurements";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import { buildSidewaysCardiganWorkspaceSummary } from "./sidewaysCardiganWorkspaceSummary";
import { SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF } from "./customPatternProjectNavigation";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";

const missesRow: SidewaysCardiganWomenChartRow = {
  size: 8,
  bust_or_chest: 42,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  upper_arm: 12.5,
  wrist: 6.5,
  sleeve_length: 17,
  chartAudience: "misses",
};

const plusRow: SidewaysCardiganWomenChartRow = {
  size: "X",
  bust_or_chest: 39,
  garment_back_length: 16.75,
  neck_opening: 7,
  front_neck_depth: 5,
  upper_arm: 13,
  wrist: 7,
  sleeve_length: 17,
  chartAudience: "plus",
};

function mergedDraft(): Record<string, unknown> {
  const canonical = getCurrentPattern() as unknown as Record<string, unknown>;
  const pb = getPatternData();
  return {
    ...canonical,
    ...pb,
    style: { ...(canonical.style as object), ...(pb.style as object) },
    fit: { ...(canonical.fit as object), ...(pb.fit as object) },
    yarnGauge: { ...(canonical.yarnGauge as object), ...(pb.yarnGauge as object) },
    yarnGaugeMachine: pb.yarnGaugeMachine,
  };
}

describe("sideways cardigan builder-to-workspace flow", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves and restores all three sleeve directions", () => {
    for (const sleeveDirection of SIDEWAYS_CARDIGAN_SLEEVE_DIRECTIONS) {
      syncSidewaysCardiganBuilderToPatternStorage(
        {
          selectedSize: "8",
          chartAudience: "misses",
          fit: "standard",
          styleMeasurements: {
            finishedLength: "25",
            vNeckDepth: "8",
            neckOpeningWidth: "7.5",
            finishedUpperArm: "14.5",
            sleeveLength: "17",
            wrist: "7.25",
          },
          gaugeStitchRaw: "20",
          gaugeRowRaw: "28",
          availableNeedles: "200",
          unit: "in",
          sleeveDirection,
        },
        missesRow,
      );
      expect(getCurrentPattern().style.sleeveDirection).toBe(sleeveDirection);
      expect(getPatternData().style?.sleeveDirection).toBe(sleeveDirection);
    }
  });

  it("sends user measurement overrides to the calculator", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      {
        selectedSize: "8",
        chartAudience: "misses",
        fit: "standard",
        styleMeasurements: {
          finishedLength: "23.5",
          vNeckDepth: "9",
          neckOpeningWidth: "8",
          finishedUpperArm: "16",
          sleeveLength: "18",
          wrist: "7",
        },
        gaugeStitchRaw: "20",
        gaugeRowRaw: "28",
        availableNeedles: "200",
        unit: "in",
        sleeveDirection: "top-down",
      },
      missesRow,
    );
    const input = resolveSidewaysCardiganBodyCalcInputFromPattern(mergedDraft());
    expect(input?.garmentLengthInches).toBe(23.5);
    expect(input?.vNeckDepthInches).toBe(9);
    expect(input?.neckOpeningWidthInches).toBe(8);
    expect(input?.finishedUpperArmInches).toBe(16);
  });

  it("creates a Sideways Cardigan draft that opens a valid workspace summary", () => {
    syncSidewaysCardiganBuilderToPatternStorage(
      {
        selectedSize: "X",
        chartAudience: "plus",
        fit: "standard",
        styleMeasurements: {
          finishedLength: "22",
          vNeckDepth: "8",
          neckOpeningWidth: "7",
          finishedUpperArm: "15",
          sleeveLength: "17",
          wrist: "8",
        },
        gaugeStitchRaw: "20",
        gaugeRowRaw: "28",
        availableNeedles: "200",
        unit: "in",
        sleeveDirection: "sideways",
      },
      plusRow,
    );

    const pattern = mergedDraft();
    expect(pattern.style).toMatchObject({
      construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      constructionAuthored: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      garmentStyle: "cardigan",
      neckline: "v",
      armholeStyle: "drop-shoulder",
      sleeveDirection: "sideways",
      recipientCategory: "plus",
    });
    expect(SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF).toBe(
      "/patterns/sideways-cardigan/pattern/?generated=1",
    );

    const input = resolveSidewaysCardiganBodyCalcInputFromPattern(pattern);
    expect(input).not.toBeNull();
    const result = calculateSidewaysCardiganBody(input!);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);

    const summary = buildSidewaysCardiganWorkspaceSummary({
      calc: result.calc,
      input: input!,
      sleeveDirection: "sideways",
    });
    expect(summary.rows.map((row) => row.term)).toEqual([
      "Garment length",
      "V-neck depth",
      "Armhole slit depth",
      "Requested finished bust",
      "Actual finished bust",
      "Neck-opening width",
      "Each shoulder section",
      "Sleeve direction",
    ]);
    expect(summary.rows.find((row) => row.term === "Sleeve direction")?.def).toBe("Sideways");
    expect(summary.rows.find((row) => row.term === "Garment length")?.def).toMatch(/stitches/);
    expect(JSON.stringify(summary)).not.toMatch(/0\.166666/);
  });
});
