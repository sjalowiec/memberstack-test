import { describe, expect, it } from "vitest";
import { FIT_EASE_INCHES_BY_CHOICE } from "./fitEaseInches";
import { resolveDropShoulderFinishedUpperArmInches } from "./dropShoulderSleeveEase";
import {
  finishedUpperArmInchesForSidewaysCardigan,
  sidewaysCardiganCalcInputFromChartRow,
} from "./sidewaysCardiganFinishedMeasurements";

describe("sidewaysCardiganFinishedMeasurements", () => {
  const missesRow = {
    size: 8,
    bust_or_chest: 42,
    garment_back_length: 25,
    neck_opening: 7.5,
    front_neck_depth: 5,
    back_neck_depth: 1,
    upper_arm: 12.5,
  };

  it("applies existing sweater ease to finished bust", () => {
    const input = sidewaysCardiganCalcInputFromChartRow({
      row: missesRow,
      chartAudience: "misses",
      fitPreference: "standard",
      vNeckDepthInches: 8,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    expect(input?.finishedBustCircumferenceInches).toBe(
      42 + FIT_EASE_INCHES_BY_CHOICE.standard,
    );
    expect(input?.backNeckDepthInches).toBe(1);
  });

  it("uses full finished upper arm (body + adult sleeve ease), not half", () => {
    const finished = finishedUpperArmInchesForSidewaysCardigan({
      chartAudience: "plus",
      fitPreference: "standard",
      bodyUpperArmIn: 13,
    });
    const expected = resolveDropShoulderFinishedUpperArmInches({
      chartAudience: "plus",
      fit: "standard",
      bodyUpperArmIn: 13,
    });
    expect(finished).toBe(expected);
    expect(finished).toBe(15);
    expect(finished).not.toBe(13 / 2);
  });

  it("honors an explicit upper-arm override", () => {
    expect(
      finishedUpperArmInchesForSidewaysCardigan({
        chartAudience: "misses",
        fitPreference: "close",
        bodyUpperArmIn: 12.5,
        overrideUpperArmIn: 16,
      }),
    ).toBe(16);
  });
});
