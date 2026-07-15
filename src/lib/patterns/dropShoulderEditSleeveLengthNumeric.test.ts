/**
 * Drop Shoulder Edit page ? numeric sleeve length (not preset picker).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCustomBuildEffectivePatternInput } from "./buildCustomBuildEffectivePatternInput";
import { buildSavePayloadFromWorkingDraft } from "./customPatternProjectClient";
import {
  isCustomBuildDiagramFieldActiveForConstruction,
  isDropShoulderDisplayOnlySummaryField,
} from "./customBuildDiagramFieldPolicy";
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

const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const dropShoulderPatternWorkspaceAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);
const editDrawerScript = readFileSync(
  resolve("src/scripts/sleevelessPatternEditDrawerPrototype.ts"),
  "utf8",
);
const measurementsPageScript = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);

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

function seedSavedDropShoulder(sleeveLengthChoice: string): void {
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
    sleeveLengthChoice,
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

function generatedSleeveLengthInches(): number | undefined {
  const genInput = buildCustomBuildEffectivePatternInput();
  const result = generateDropShoulderPattern(genInput);
  return (result.debug as Record<string, unknown>).dropShoulderSleeveLengthInches as
    | number
    | undefined;
}

/** Mirror applyChanges sleeve-length persist on the Edit page (diagram numeric field). */
function persistSleeveLengthLikeEditSave(inches: string): void {
  persistMeasurementOverrides({ sleeveLength: inches });
  markDropShoulderSleeveFieldUserEdited("sleeveLength");
  const fit = {
    ...(getCurrentPattern().fit ?? {}),
    cbMeasurementOverrides: {
      ...(getPatternData().fit as Record<string, unknown>)?.cbMeasurementOverrides,
      ...loadOverridesFromPattern(),
      sleeveLength: inches,
    },
    dropShoulderUserEditedSleeveFields: readDropShoulderUserEditedSleeveFields(),
  };
  saveCurrentPattern({ fit });
  savePatternData("fit", fit);
}

function loadOverridesFromPattern(): Record<string, string> {
  const fit = getCurrentPattern().fit ?? {};
  const raw = (fit as Record<string, unknown>).cbMeasurementOverrides;
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).filter(
      ([, v]) => typeof v === "string" && v.trim(),
    ) as [string, string][],
  );
}

describe("Drop Shoulder sleeve length ? builder vs Edit page UI", () => {
  it("1. initial builder still shows sleeve-length preset choices", () => {
    expect(dropShoulderBuilderAstro).toContain("data-ds-sleeve-length-option");
    expect(dropShoulderBuilderAstro).toContain('data-value="short"');
    expect(dropShoulderBuilderAstro).toContain('data-value="elbow"');
    expect(dropShoulderBuilderAstro).toContain('data-value="three-quarter"');
    expect(dropShoulderBuilderAstro).toContain('data-value="long"');
  });

  it("2. Edit page does not show sleeve-length preset choices", () => {
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("data-sl-edit-sleeve-length");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain('name="sl-edit-sleeve-length"');
    expect(editDrawerScript).not.toContain("persistDropShoulderSleeveLength");
  });

  it("3. Edit page shows an editable Sleeve Length numeric field on the measurement diagram", () => {
    expect(measurementsPageScript).toContain("isDropShoulderEditWorkspace");
    expect(measurementsPageScript).toContain('key === "sleeveLength" && isDropShoulderEditWorkspace()');
    expect(
      isCustomBuildDiagramFieldActiveForConstruction(
        { key: "sleeveLength", dropShoulderOnly: true },
        true,
        { dropShoulderEditWorkspace: true },
      ),
    ).toBe(true);
    expect(isDropShoulderDisplayOnlySummaryField("sleeveLength", { dropShoulderEditWorkspace: true })).toBe(
      false,
    );
  });

  it("7. no other Edit page quick-edit fields were removed", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain('name="sl-edit-garment"');
    expect(dropShoulderPatternWorkspaceAstro).toContain('name="sl-edit-neckline"');
    expect(dropShoulderPatternWorkspaceAstro).toContain("data-sl-edit-size");
    expect(dropShoulderPatternWorkspaceAstro).toContain("id=\"sl-edit-spi\"");
    expect(dropShoulderPatternWorkspaceAstro).toContain("id=\"sl-edit-rpi\"");
  });
});

describe("Drop Shoulder Edit page ? numeric sleeve length data flow", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("4. diagram field is populated with the saved (picker-scaled) sleeve length", () => {
    seedSavedDropShoulder("short");
    const display = dropShoulderEditWorkspaceSleeveLengthDisplayInches({
      overrideInches: "17",
      sleeveLengthChoice: "short",
      userEditedSleeveLength: false,
    });
    expect(display).toBe("5.5");
    expect(generatedSleeveLengthInches()).toBe(5.5);
  });

  it("5. changing the numeric value updates generated sleeve length", () => {
    seedSavedDropShoulder("long");
    writeActiveCustomPatternProjectId("proj-drop", "My Drop Shoulder");
    expect(generatedSleeveLengthInches()).toBe(17);

    syncCustomBuildToPatternStorage({ awaitCharts: false });
    persistSleeveLengthLikeEditSave("14");

    expect(generatedSleeveLengthInches()).toBe(14);
  });

  it("6. saving and reopening preserves the edited numeric sleeve length", () => {
    seedSavedDropShoulder("long");
    writeActiveCustomPatternProjectId("proj-drop", "My Drop Shoulder");
    persistSleeveLengthLikeEditSave("14");

    const payload = buildSavePayloadFromWorkingDraft("My Drop Shoulder", { family: "sleeveless" });
    const savedFit = (payload.pattern.fit ?? {}) as Record<string, unknown>;
    expect((savedFit.cbMeasurementOverrides as Record<string, string>).sleeveLength).toBe("14");
    expect(
      (savedFit.dropShoulderUserEditedSleeveFields as Record<string, boolean>).sleeveLength,
    ).toBe(true);

    localStorage.clear();
    saveCurrentPattern(payload.pattern as ReturnType<typeof getCurrentPattern>);
    savePatternData("fit", payload.pattern.fit);
    savePatternData("style", payload.pattern.style);

    const reopenedFit = getCurrentPattern().fit as Record<string, unknown>;
    expect((reopenedFit.cbMeasurementOverrides as Record<string, string>).sleeveLength).toBe("14");
    expect(
      (reopenedFit.dropShoulderUserEditedSleeveFields as Record<string, boolean>).sleeveLength,
    ).toBe(true);
    expect(
      dropShoulderEditWorkspaceSleeveLengthDisplayInches({
        overrideInches: "14",
        sleeveLengthChoice: "long",
        userEditedSleeveLength: true,
      }),
    ).toBe("14");
    expect(generatedSleeveLengthInches()).toBe(14);
  });

  it("user-edited numeric sleeve length is not re-scaled by the original preset choice", () => {
    const resolved = resolveDropShoulderSleeveInches({
      overrides: { sleeveLength: "8" },
      chartRow: null,
      fitPreference: "standard",
      selectedMeasurements: SELECTED_MEASUREMENTS,
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: true, cuffCircumference: false },
    });
    expect(resolved.sleeveLengthIn).toBe(8);
  });
});
