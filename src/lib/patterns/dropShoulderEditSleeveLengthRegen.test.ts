/**
 * Regression: editing a saved Drop Shoulder pattern's sleeve length via the numeric diagram field
 * must flow through save + regeneration.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  dropShoulderEditWorkspaceSleeveLengthDisplayInches,
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import {
  markDropShoulderSleeveFieldUserEdited,
  readDropShoulderUserEditedSleeveFields,
} from "./dropShoulderUserEditedSleeveFields";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import { persistMeasurementOverrides } from "./sleevelessCustomMeasurementStorage";
import { writeActiveCustomPatternProjectId } from "./customPatternProjectActiveId";
import { stubLocalStorage } from "./test/stubLocalStorage";

const SELECTED_MEASUREMENTS = {
  finished_bust_chest: 40,
  back_neck_to_hem: 24,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
  shoulder_width: 16,
  neck_opening_width: 7,
  back_neck_depth: 1,
  front_neck_depth: 4,
};

function seedSavedDropShoulder(sleeveLength: string): void {
  localStorage.setItem(
    SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
    JSON.stringify({
      values: {
        who: "women",
        selectedSize: "7",
        fit: "standard",
        neckline: "round",
        front: "closed",
        style: "straight-pullover",
      },
    }),
  );
  const style = withDropShoulderConstructionAuthored(
    { frontStyle: "closed", neckline: "round", patternMode: "express" },
    sleeveLength,
  );
  saveCurrentPattern({
    id: "pattern-drop",
    style,
    fit: {
      selectedSize: "7",
      easeChoice: "standard",
      sizingChart: "women",
      selectedMeasurements: { ...SELECTED_MEASUREMENTS },
      cbMeasurementOverrides: { upperArm: "12", wrist: "6", sleeveLength: "17" },
    },
    yarnGauge: { stitchGauge: "5", rowGauge: "7", gaugeRawUnit: "in" },
    machine: { availableNeedles: "200" },
  });
  savePatternData("style", style);
  savePatternData("fit", {
    selectedSize: "7",
    easeChoice: "standard",
    sizingChart: "women",
    selectedMeasurements: { ...SELECTED_MEASUREMENTS },
    cbMeasurementOverrides: { upperArm: "12", wrist: "6", sleeveLength: "17" },
  });
  savePatternData("yarnGaugeMachine", {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: "200",
  });
}

function persistNumericSleeveLengthLikeEditSave(inches: string): void {
  persistMeasurementOverrides({ sleeveLength: inches });
  markDropShoulderSleeveFieldUserEdited("sleeveLength");
  const fit = {
    ...(getCurrentPattern().fit ?? {}),
    cbMeasurementOverrides: {
      upperArm: "12",
      wrist: "6",
      sleeveLength: inches,
    },
    dropShoulderUserEditedSleeveFields: readDropShoulderUserEditedSleeveFields(),
  };
  saveCurrentPattern({ fit });
  savePatternData("fit", fit);
}

function generatedSleeveLengthInches(): number | undefined {
  const genInput = buildCustomBuildEffectivePatternInput();
  const result = generateDropShoulderPattern(genInput);
  return (result.debug as Record<string, unknown>).dropShoulderSleeveLengthInches as
    | number
    | undefined;
}

describe("Drop Shoulder edit ? numeric sleeve length persists through save + regen", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Long build regenerates at full length before numeric edit", () => {
    seedSavedDropShoulder("long");
    expect(generatedSleeveLengthInches()).toBe(17);
  });

  it("short preset shows scaled length in the edit diagram until user saves a numeric value", () => {
    seedSavedDropShoulder("short");
    const display = dropShoulderEditWorkspaceSleeveLengthDisplayInches({
      overrideInches: "17",
      sleeveLengthChoice: "short",
      userEditedSleeveLength: false,
    });
    expect(display).toBe("5.5");
    expect(generatedSleeveLengthInches()).toBe(5.5);
  });

  it("changing the numeric field to 8? regenerates at 8? (full applyChanges sequence)", () => {
    seedSavedDropShoulder("long");
    writeActiveCustomPatternProjectId("proj-drop-shoulder", "My Drop Shoulder");

    syncCustomBuildToPatternStorage({ awaitCharts: false });
    persistNumericSleeveLengthLikeEditSave("8");
    saveCurrentPattern({
      yarnGauge: { stitchGauge: 5, rowGauge: 7, gaugeUnits: "per_inch", gaugeRawUnit: "in" },
      machine: { availableNeedles: "200" },
    });
    savePatternData("yarnGauge", {
      stitchGauge: 5,
      rowGauge: 7,
      gaugeUnits: "per_inch",
      gaugeRawUnit: "in",
    });

    const payload = buildSavePayloadFromWorkingDraft("My Drop Shoulder", { family: "sleeveless" });
    expect(
      ((payload.pattern.fit as Record<string, unknown>).cbMeasurementOverrides as Record<string, string>)
        .sleeveLength,
    ).toBe("8");

    expect(generatedSleeveLengthInches()).toBe(8);
  });

  it("summary/edit display sleeve length matches the generated value after numeric edit", () => {
    const userEdited = { upperArm: false, sleeveLength: true, cuffCircumference: false };
    const resolverArgs = {
      overrides: { sleeveLength: "8" },
      chartRow: null,
      fitPreference: "standard",
      userEdited,
      selectedMeasurements: SELECTED_MEASUREMENTS,
    } as const;

    const generator = resolveDropShoulderSleeveInches({
      ...resolverArgs,
      sleeveLengthChoice: "long",
    }).sleeveLengthIn;
    expect(generator).toBe(8);

    const display = dropShoulderEditWorkspaceSleeveLengthDisplayInches({
      overrideInches: "8",
      sleeveLengthChoice: "long",
      userEditedSleeveLength: true,
    });
    expect(display).toBe("8");
    expect(Number(display)).toBe(generator);
  });
});
