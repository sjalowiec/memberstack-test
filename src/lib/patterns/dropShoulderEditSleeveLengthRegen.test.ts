/**
 * Regression: editing a saved Drop Shoulder pattern's sleeve length (Long ? Short) must flow
 * through save + regeneration. Mirrors the Edit Pattern drawer persist path.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  resolveDropShoulderSleeveInches,
  scaleDropShoulderSleeveLengthInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
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

/** Mirror of sleevelessPatternEditDrawerPrototype.persistDropShoulderSleeveLength. */
function persistSleeveLengthLikeDrawer(choice: string): void {
  const mergedStyle = withDropShoulderConstructionAuthored(
    { ...(getCurrentPattern().style ?? {}), ...(getPatternData().style ?? {}) },
    choice,
  );
  saveCurrentPattern({ style: mergedStyle });
  savePatternData("style", mergedStyle);
}

function generatedSleeveLengthInches(): number | undefined {
  const genInput = buildCustomBuildEffectivePatternInput();
  const result = generateDropShoulderPattern(genInput);
  return (result.debug as Record<string, unknown>).dropShoulderSleeveLengthInches as
    | number
    | undefined;
}

describe("Drop Shoulder edit ? sleeve length persists through save + regen", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Long build regenerates at full length", () => {
    seedSavedDropShoulder("long");
    expect(generatedSleeveLengthInches()).toBe(17);
  });

  it("changing to Short in the drawer regenerates at ~1/3 length (full applyChanges sequence)", () => {
    seedSavedDropShoulder("long");
    writeActiveCustomPatternProjectId("proj-drop-shoulder", "My Drop Shoulder");

    // Mirror applyChanges order: sync (step 5) ? persist sleeve length (step 6) ? gauge (step 7).
    syncCustomBuildToPatternStorage({ awaitCharts: false });
    persistSleeveLengthLikeDrawer("short");
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

    expect(getCurrentPattern().style?.sleeveLength).toBe("short");
    expect(getPatternData().style?.sleeveLength).toBe("short");

    const payload = buildSavePayloadFromWorkingDraft("My Drop Shoulder", { family: "sleeveless" });
    expect((payload.pattern.style as Record<string, unknown>).sleeveLength).toBe("short");

    expect(generatedSleeveLengthInches()).toBe(5.5);
  });

  it("summary/edit display sleeve length matches the generated (scaled) value: Long 16.5\" -> Short ~5.5\"", () => {
    // The measurement-summary diagram is display-only and picker-driven. It renders the FULL length
    // (choice-independent, kept full so persistence never round-trips a scaled value) scaled once by
    // the saved sleeveLengthChoice ù via the SAME helper the generator uses. This guards the display
    // rehydration bug where the summary showed a stale/full length after editing Long -> Short.
    const userEdited = { upperArm: false, sleeveLength: true, cuffCircumference: false };
    const resolverArgs = {
      overrides: { sleeveLength: "16.5" },
      chartRow: null,
      fitPreference: "standard",
      userEdited,
    } as const;

    // Full length surfaced for "long" (what the diagram/data source holds, unscaled).
    const fullInches = resolveDropShoulderSleeveInches({
      ...resolverArgs,
      sleeveLengthChoice: "long",
    }).sleeveLengthIn;
    expect(fullInches).toBe(16.5);

    // Display for each choice = full length scaled once by the picker choice.
    expect(scaleDropShoulderSleeveLengthInches(fullInches, "long")).toBe(16.5);
    expect(scaleDropShoulderSleeveLengthInches(fullInches, "three-quarter")).toBe(12.5); // 16.5 ◊ 0.75 = 12.375 ? nearest º?
    expect(scaleDropShoulderSleeveLengthInches(fullInches, "elbow")).toBe(8.25); // 16.5 ◊ 0.5

    const displayShort = scaleDropShoulderSleeveLengthInches(fullInches, "short");
    expect(displayShort).toBe(5.5);

    // Generator/summary numeric resolver agrees exactly ù no double-scaling.
    const generatorShort = resolveDropShoulderSleeveInches({
      ...resolverArgs,
      sleeveLengthChoice: "short",
    }).sleeveLengthIn;
    expect(generatorShort).toBe(5.5);
    expect(displayShort).toBe(generatorShort);
  });
});
