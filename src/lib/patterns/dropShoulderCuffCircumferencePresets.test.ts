import { describe, expect, it } from "vitest";
import { resolveEffectiveCuffDepthInches } from "./customBuildEffectiveCuffDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  dropShoulderEditWorkspaceCuffCircumferenceDisplayInches,
  resolveDropShoulderSleeveInches,
  scaleDropShoulderCuffCircumferenceInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

/** Size 7 (women): upper arm 12?, wrist 6?, full sleeve length 17?. */
const size7Row: ChartRow = {
  size: 7,
  label: "Size 7 (Bust 40?)",
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function dropShoulderPatternData(sleeveLength: string, overrides?: Record<string, string>) {
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

describe("Drop Shoulder cuff circumference scales with sleeve-length presets", () => {
  const resolveBase = {
    overrides: {},
    chartRow: size7Row,
    fitPreference: "standard",
  } as const;

  it("scaleDropShoulderCuffCircumferenceInches linearly tapers from upper arm to wrist", () => {
    // opening = upperArm + (wrist ? upperArm)  proportion
    expect(scaleDropShoulderCuffCircumferenceInches(12, 6, "long")).toBe(6);
    expect(scaleDropShoulderCuffCircumferenceInches(12, 6, "three-quarter")).toBe(7.5);
    expect(scaleDropShoulderCuffCircumferenceInches(12, 6, "elbow")).toBe(9);
    expect(scaleDropShoulderCuffCircumferenceInches(12, 6, "short")).toBe(12); // 12 ? 60.33 ? 10.02 ? ?
  });

  it("resolveDropShoulderSleeveInches uses wrist for long and wider openings for shorter presets", () => {
    expect(resolveDropShoulderSleeveInches({ ...resolveBase }).wristIn).toBe(6);
    expect(
      resolveDropShoulderSleeveInches({ ...resolveBase, sleeveLengthChoice: "three-quarter" })
        .wristIn,
    ).toBe(7.5);
    expect(
      resolveDropShoulderSleeveInches({ ...resolveBase, sleeveLengthChoice: "elbow" }).wristIn,
    ).toBe(9);
    expect(
      resolveDropShoulderSleeveInches({ ...resolveBase, sleeveLengthChoice: "short" }).wristIn,
    ).toBe(12);
    const short = resolveDropShoulderSleeveInches({
      ...resolveBase,
      sleeveLengthChoice: "short",
    });
    expect(short.wristIn).toBe(short.upperArmIn);
    expect(short.wristIn).not.toBe(6);
  });

  it("user-edited cuff circumference skips taper scaling", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { wrist: "8" },
      chartRow: size7Row,
      fitPreference: "standard",
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: true },
    });
    expect(resolved.wristIn).toBe(8);
  });

  it("edit workspace diagram shows the same resolved cuff circ as the generator", () => {
    const shortResolved = resolveDropShoulderSleeveInches({
      ...resolveBase,
      sleeveLengthChoice: "short",
    });
    const display = dropShoulderEditWorkspaceCuffCircumferenceDisplayInches({
      overrideInches: "6",
      upperArmInches: "12",
      sleeveLengthChoice: "short",
      userEditedCuffCircumference: false,
    });
    expect(display).toBe("12");
    expect(shortResolved.wristIn).toBe(12);
    expect(generateDropShoulderPattern(dropShoulderPatternData("short")).debug.dropShoulderWristInches).toBe(
      12,
    );
    expect(
      dropShoulderEditWorkspaceCuffCircumferenceDisplayInches({
        overrideInches: "8",
        upperArmInches: "12",
        sleeveLengthChoice: "short",
        userEditedCuffCircumference: true,
      }),
    ).toBe("8");
  });

  it("generator uses taper-derived cuff circumference per preset", () => {
    const long = generateDropShoulderPattern(dropShoulderPatternData("long"));
    const short = generateDropShoulderPattern(dropShoulderPatternData("short"));
    const threeQuarter = generateDropShoulderPattern(dropShoulderPatternData("three-quarter"));
    const elbow = generateDropShoulderPattern(dropShoulderPatternData("elbow"));

    expect(long.debug.dropShoulderWristInches).toBe(6);
    expect(threeQuarter.debug.dropShoulderWristInches).toBe(7.5);
    expect(elbow.debug.dropShoulderWristInches).toBe(9);
    expect(short.debug.dropShoulderWristInches).toBe(12);
    expect(short.debug.dropShoulderWristInches).not.toBe(long.debug.dropShoulderWristInches);
  });

  it("cuff depth is not scaled by sleeve-length preset", () => {
    expect(resolveEffectiveCuffDepthInches(dropShoulderPatternData("long"), "women")).toBe(2);
    expect(resolveEffectiveCuffDepthInches(dropShoulderPatternData("short"), "women")).toBe(2);
    expect(resolveEffectiveCuffDepthInches(dropShoulderPatternData("elbow"), "women")).toBe(2);
    const short = generateDropShoulderPattern(dropShoulderPatternData("short"));
    const long = generateDropShoulderPattern(dropShoulderPatternData("long"));
    expect(short.debug.dropShoulderCuffDepthInches).toBe(2);
    expect(long.debug.dropShoulderCuffDepthInches).toBe(2);
  });
});
