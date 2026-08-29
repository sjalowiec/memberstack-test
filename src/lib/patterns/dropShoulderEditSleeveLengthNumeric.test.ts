/**
 * Drop Shoulder Edit page — sleeve-length picker plus numeric fine-tune.
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
  dropShoulderEditWorkspaceCuffCircumferenceDisplayInches,
  dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker,
  dropShoulderEditWorkspaceSleeveLengthDisplayInches,
  mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues,
  reconcileDropShoulderSleeveOverridesForSizeChange,
  resolveDropShoulderSleeveInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { syncCustomBuildToPatternStorage } from "./syncCustomBuildToPatternStorage";
import {
  DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY,
  markDropShoulderSleeveFieldUserEdited,
  readDropShoulderUserEditedSleeveFields,
  readEffectiveDropShoulderUserEditedSleeveFields,
  writeDropShoulderUserEditedSleeveFields,
  type DropShoulderUserEditedSleeveFields,
} from "./dropShoulderUserEditedSleeveFields";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
  SLEEVELESS_EXPRESS_BUILDER_STORAGE_KEY,
} from "./patternStorage";
import {
  DROP_SHOULDER_SLEEVE_LENGTH_CHOICES,
  normalizeDropShoulderSleeveLengthChoice,
  readDropShoulderSleeveLengthChoice,
  withDropShoulderConstructionAuthored,
} from "./patternConstructionIdentity";
import {
  loadMeasurementOverrides,
  persistMeasurementOverrides,
} from "./sleevelessCustomMeasurementStorage";
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
const editWorkspaceGaugeFieldsAstro = readFileSync(
  resolve("src/components/patterns/EditWorkspaceGaugeFields.astro"),
  "utf8",
);
const sleevelessPatternWorkspaceAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
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

function writeDropShoulderEditUserEditedSleeveFlagsToFit(
  flags: DropShoulderUserEditedSleeveFields,
): void {
  const prevFit = { ...(getCurrentPattern().fit ?? {}) } as Record<string, unknown>;
  prevFit[DROP_SHOULDER_USER_EDITED_SLEEVE_FIELDS_KEY] = flags;
  saveCurrentPattern({ fit: prevFit });
  savePatternData("fit", prevFit);
}

const SIZE_7_CHART_ROW = {
  size: 7,
  bust_or_chest: 40,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

/** Mirror Edit Pattern Quick Edits sleeve-length picker change (drawer handler). */
function applyEditPageSleeveLengthPicker(choice: string): void {
  const canonicalStyle = (getCurrentPattern().style ?? {}) as Record<string, unknown>;
  const pbStyle = (getPatternData().style ?? {}) as Record<string, unknown>;
  const style = withDropShoulderConstructionAuthored({ ...canonicalStyle, ...pbStyle }, choice);
  saveCurrentPattern({ style });
  savePatternData("style", style);
  const nextFlags = {
    ...readEffectiveDropShoulderUserEditedSleeveFields(getCurrentPattern().fit),
    sleeveLength: false,
    cuffCircumference: false,
  };
  writeDropShoulderUserEditedSleeveFields(nextFlags);
  writeDropShoulderEditUserEditedSleeveFlagsToFit(nextFlags);
  persistMeasurementOverrides(
    reconcileDropShoulderSleeveOverridesForSizeChange(
      loadMeasurementOverrides(),
      SIZE_7_CHART_ROW,
      "standard",
      nextFlags,
    ),
  );
}

function displayedSleeveAndCuff(choice: string, flags: DropShoulderUserEditedSleeveFields) {
  const overrides = loadMeasurementOverrides();
  return {
    sleeveLength: dropShoulderEditWorkspaceSleeveLengthDisplayInches({
      overrideInches: overrides.sleeveLength ?? "",
      sleeveLengthChoice: choice,
      userEditedSleeveLength: flags.sleeveLength,
    }),
    cuffCircumference: dropShoulderEditWorkspaceCuffCircumferenceDisplayInches({
      overrideInches: overrides.wrist ?? "",
      upperArmInches: overrides.upperArm ?? "",
      sleeveLengthChoice: choice,
      userEditedCuffCircumference: flags.cuffCircumference,
    }),
  };
}

describe("Drop Shoulder sleeve length ? builder vs Edit page UI", () => {
  it("1. initial builder still shows sleeve-length preset choices", () => {
    expect(dropShoulderBuilderAstro).toContain("data-ds-sleeve-length-option");
    expect(dropShoulderBuilderAstro).toContain('data-value="short"');
    expect(dropShoulderBuilderAstro).toContain('data-value="elbow"');
    expect(dropShoulderBuilderAstro).toContain('data-value="three-quarter"');
    expect(dropShoulderBuilderAstro).toContain('data-value="long"');
  });

  it("2. Edit page hydrates Long / 3/4 / Elbow / Short from style.sleeveLength", () => {
    expect(DROP_SHOULDER_SLEEVE_LENGTH_CHOICES).toEqual(["long", "three-quarter", "elbow", "short"]);
    expect(dropShoulderPatternWorkspaceAstro).toContain('name="sl-edit-sleeve-length"');
    expect(dropShoulderPatternWorkspaceAstro).toContain("Choose your sleeve length");
    for (const value of DROP_SHOULDER_SLEEVE_LENGTH_CHOICES) {
      expect(dropShoulderPatternWorkspaceAstro).toContain(`value="${value}"`);
    }
    expect(editDrawerScript).toContain("setRadio(");
    expect(editDrawerScript).toContain('"sl-edit-sleeve-length"');
    expect(editDrawerScript).toContain("readDropShoulderSleeveLengthChoice");
    expect(sleevelessPatternWorkspaceAstro).not.toContain('name="sl-edit-sleeve-length"');
    expect(sleevelessPatternWorkspaceAstro).not.toContain("Choose your sleeve length");
  });

  it("3. Edit page keeps an editable Sleeve Length numeric field on the measurement diagram", () => {
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
    expect(dropShoulderPatternWorkspaceAstro).toContain("EditWorkspaceGaugeFields");
    expect(editWorkspaceGaugeFieldsAstro).toContain('id="sl-edit-spi"');
    expect(editWorkspaceGaugeFieldsAstro).toContain('id="sl-edit-rpi"');
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

  it("hydrates Long / 3/4 / Elbow / Short from the saved style.sleeveLength", () => {
    for (const choice of DROP_SHOULDER_SLEEVE_LENGTH_CHOICES) {
      seedSavedDropShoulder(choice);
      expect(normalizeDropShoulderSleeveLengthChoice(readDropShoulderSleeveLengthChoice())).toBe(
        choice,
      );
    }
  });

  it("picker change updates live Sleeve preview chips from picker-derived defaults", () => {
    seedSavedDropShoulder("long");
    expect(displayedSleeveAndCuff("long", readDropShoulderUserEditedSleeveFields())).toEqual({
      sleeveLength: "17",
      cuffCircumference: "6",
    });
    expect(generatedSleeveLengthInches()).toBe(17);

    applyEditPageSleeveLengthPicker("short");
    expect(normalizeDropShoulderSleeveLengthChoice(readDropShoulderSleeveLengthChoice())).toBe(
      "short",
    );
    expect(displayedSleeveAndCuff("short", readDropShoulderUserEditedSleeveFields())).toEqual({
      sleeveLength: "5.5",
      cuffCircumference: "12",
    });
    expect(generatedSleeveLengthInches()).toBe(5.5);
    expect(loadMeasurementOverrides().sleeveLength).toBe("17");
    expect(loadMeasurementOverrides().wrist).toBe("6");
    expect(editDrawerScript).toContain("refreshDropShoulderWorkspaceMeasurementSummary");
  });

  it("picker change resets user-edited sleeve length and cuff flags", () => {
    seedSavedDropShoulder("long");
    writeDropShoulderUserEditedSleeveFields({
      upperArm: true,
      sleeveLength: true,
      cuffCircumference: true,
    });
    writeDropShoulderEditUserEditedSleeveFlagsToFit({
      upperArm: true,
      sleeveLength: true,
      cuffCircumference: true,
    });

    applyEditPageSleeveLengthPicker("elbow");

    expect(readEffectiveDropShoulderUserEditedSleeveFields(getCurrentPattern().fit)).toEqual({
      upperArm: true,
      sleeveLength: false,
      cuffCircumference: false,
    });
  });

  it("numeric fine-tune still wins after a manual chip edit", () => {
    seedSavedDropShoulder("long");
    persistSleeveLengthLikeEditSave("14");
    expect(readDropShoulderUserEditedSleeveFields().sleeveLength).toBe(true);
    expect(
      dropShoulderEditWorkspaceSleeveLengthDisplayInches({
        overrideInches: "14",
        sleeveLengthChoice: "long",
        userEditedSleeveLength: true,
      }),
    ).toBe("14");
    expect(generatedSleeveLengthInches()).toBe(14);
  });

  it("picker change after a manual edit resets back to picker-derived defaults", () => {
    seedSavedDropShoulder("long");
    persistSleeveLengthLikeEditSave("14");
    persistMeasurementOverrides({ ...loadMeasurementOverrides(), wrist: "7.5" });
    markDropShoulderSleeveFieldUserEdited("cuffCircumference");
    writeDropShoulderEditUserEditedSleeveFlagsToFit(readDropShoulderUserEditedSleeveFields());

    applyEditPageSleeveLengthPicker("three-quarter");

    expect(readEffectiveDropShoulderUserEditedSleeveFields(getCurrentPattern().fit)).toEqual({
      upperArm: false,
      sleeveLength: false,
      cuffCircumference: false,
    });
    expect(loadMeasurementOverrides().sleeveLength).toBe("17");
    expect(loadMeasurementOverrides().wrist).toBe("6");
    expect(
      displayedSleeveAndCuff("three-quarter", readDropShoulderUserEditedSleeveFields()),
    ).toEqual({
      sleeveLength: "12.75",
      cuffCircumference: "7.5",
    });
    expect(generatedSleeveLengthInches()).toBe(12.75);
  });

  it("Save Changes does not convert picker-derived chip values into numeric overrides", () => {
    seedSavedDropShoulder("short");
    const stored = { upperArm: "12", wrist: "6", sleeveLength: "17" };
    const incoming = { upperArm: "12", wrist: "12", sleeveLength: "5.5" };
    const merged = mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues({
      incoming,
      stored,
      sleeveLengthChoice: "short",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: false },
    });
    expect(merged.sleeveLength).toBe("17");
    expect(merged.wrist).toBe("6");
    expect(
      dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker({
        displayedSleeveLengthInches: "5.5",
        displayedWristInches: "12",
        storedOverrides: stored,
        sleeveLengthChoice: "short",
      }),
    ).toEqual({ sleeveLength: false, cuffCircumference: false });

    persistMeasurementOverrides(merged);
    expect(loadMeasurementOverrides().sleeveLength).toBe("17");
    expect(readDropShoulderUserEditedSleeveFields().sleeveLength).toBe(false);
    expect(readDropShoulderUserEditedSleeveFields().cuffCircumference).toBe(false);
  });
});
