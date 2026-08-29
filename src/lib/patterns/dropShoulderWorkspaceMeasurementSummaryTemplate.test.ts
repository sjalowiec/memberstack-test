import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dropShoulderPatternWorkspaceAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
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
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);
const measurementStorageScript = readFileSync(
  resolve("src/lib/patterns/sleevelessCustomMeasurementStorage.ts"),
  "utf8",
);

describe("Drop Shoulder Edit Pattern workspace (pattern/index.astro)", () => {
  it("contains Save Changes, Quick edits Size, and measurement diagram markers", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain("Save Changes");
    expect(dropShoulderPatternWorkspaceAstro).toContain("Quick edits");
    expect(dropShoulderPatternWorkspaceAstro).toContain("data-sl-edit-size");
    expect(dropShoulderPatternWorkspaceAstro).toContain("data-cb-measure-diagram");
    expect(dropShoulderPatternWorkspaceAstro).toContain("data-drop-shoulder-workspace-measure-summary");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("drop-shoulder-refresh-measurements");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("Refresh measurements");
  });

  it("renders Choose your sleeve length in Quick edits after Neckline", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain("Choose your sleeve length");
    expect(dropShoulderPatternWorkspaceAstro).toContain('name="sl-edit-sleeve-length"');
    expect(dropShoulderPatternWorkspaceAstro).toContain('value="long"');
    expect(dropShoulderPatternWorkspaceAstro).toContain('value="three-quarter"');
    expect(dropShoulderPatternWorkspaceAstro).toContain('value="elbow"');
    expect(dropShoulderPatternWorkspaceAstro).toContain('value="short"');
    const neckIdx = dropShoulderPatternWorkspaceAstro.indexOf('name="sl-edit-neckline"');
    const sleeveIdx = dropShoulderPatternWorkspaceAstro.indexOf('name="sl-edit-sleeve-length"');
    const gaugeIdx = dropShoulderPatternWorkspaceAstro.indexOf("sl-edit-gauge-heading");
    expect(neckIdx).toBeGreaterThan(-1);
    expect(sleeveIdx).toBeGreaterThan(neckIdx);
    expect(gaugeIdx).toBeGreaterThan(sleeveIdx);
  });

  it("does not render interactive Fit choices on the edit workspace", () => {
    expect(dropShoulderPatternWorkspaceAstro).not.toContain('name="sl-edit-fit"');
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("data-sl-edit-ease");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain('aria-label="Fit"');
  });

  it("loads the edit drawer script that rehydrates measurements on size change", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain("sleevelessPatternEditDrawerPrototype.ts");
    expect(editDrawerScript).toContain("rehydrateDropShoulderWorkspaceMeasurementDiagramFromQuickEdit");
    expect(editDrawerScript).toContain('sizeSelect.addEventListener("change"');
    expect(editDrawerScript).toContain("readDropShoulderWorkspaceQuickEditSizingFromDom");
    expect(editDrawerScript).toContain("isDropShoulderWorkspaceMeasurementSummaryPage");
  });

  it("does not wire fit-change listeners or live fit recalculation in the edit drawer", () => {
    expect(editDrawerScript).not.toContain("handleDropShoulderQuickEditFitChanged");
    expect(editDrawerScript).not.toContain('input[name="sl-edit-fit"]');
    expect(editDrawerScript).not.toContain("recalcFitDerivedMeasurements");
    expect(editDrawerScript).toContain("readStoredFitPreference");
  });

  it("hydrates and persists sleeve-length picker from style.sleeveLength without duplicating math", () => {
    expect(editDrawerScript).toContain("persistDropShoulderEditSleeveLengthChoice");
    expect(editDrawerScript).toContain("readDropShoulderSleeveLengthChoice");
    expect(editDrawerScript).toContain("normalizeDropShoulderSleeveLengthChoice");
    expect(editDrawerScript).toContain("withDropShoulderConstructionAuthored");
    expect(editDrawerScript).toContain("handleDropShoulderQuickEditSleeveLengthChanged");
    expect(editDrawerScript).toContain("refreshDropShoulderWorkspaceMeasurementSummary");
    expect(editDrawerScript).toContain('input[name="sl-edit-sleeve-length"]');
    expect(editDrawerScript).toContain("setRadio(");
    expect(editDrawerScript).toContain('"sl-edit-sleeve-length"');
  });

  it("clears user-edited sleeve length and cuff flags when the picker changes", () => {
    expect(editDrawerScript).toContain("sleeveLength: false");
    expect(editDrawerScript).toContain("cuffCircumference: false");
    expect(editDrawerScript).toContain("reconcileDropShoulderSleeveOverridesForSizeChange");
    expect(editDrawerScript).not.toContain("persistDropShoulderSleeveLength");
  });

  it("does not mark picker-derived sleeve chips user-edited on Save Changes", () => {
    expect(editDrawerScript).toContain("dropShoulderEditWorkspaceDisplayedSleeveDiffersFromPicker");
    expect(measurementStorageScript).toContain(
      "mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues",
    );
    expect(measurementsPageScript).toContain(
      "mergeDropShoulderEditSleeveOverridesWithoutScalingPickerValues",
    );
    expect(editDrawerScript).not.toMatch(
      /if \(sleeveInput\?\.value\.trim\(\)\) \{\s*markDropShoulderSleeveFieldUserEdited\("sleeveLength"\)/,
    );
  });

  it("marks numeric sleeve length user-edited only when the chip differs from the picker default", () => {
    expect(editDrawerScript).toContain('markDropShoulderSleeveFieldUserEdited("sleeveLength")');
    expect(editDrawerScript).toContain('[data-cb-measure-input="sleeveLength"]');
    expect(editDrawerScript).toContain('markDropShoulderSleeveFieldUserEdited("cuffCircumference")');
  });

  it("still supports measurement edit and save via the existing apply pipeline", () => {
    expect(editDrawerScript).toContain("async function applyChanges");
    expect(editDrawerScript).toContain("flushCustomBuildMeasurementOverridesToCanonical");
    expect(editDrawerScript).toContain("syncCustomBuildToPatternStorage");
    expect(editDrawerScript).toContain("loadMeasurementOverrides");
  });

  it("keeps the Body / Sleeve tabbed preview wiring", () => {
    expect(measurementsPageScript).toContain("createDropShoulderEditPreviewTablist");
    expect(measurementsPageScript).toContain("applyDropShoulderEditPreviewChipVisibility");
  });
});

describe("Drop Shoulder workspace measurement rehydrate", () => {
  it("exports rehydrate helper that uses quick-edit sizing", () => {
    expect(measurementsPageScript).toContain(
      "export async function rehydrateDropShoulderWorkspaceMeasurementDiagramFromQuickEdit",
    );
    expect(measurementsPageScript).toContain(
      "forceRefreshDropShoulderSummaryMeasurementsForQuickEditSizing",
    );
    expect(measurementsPageScript).toContain(
      "export function readDropShoulderWorkspaceQuickEditSizingFromDom",
    );
  });

  it("reads fit from stored pattern data, not edit-workspace Fit controls", () => {
    expect(measurementsPageScript).toContain("resolveFitPreference(expressValues, fit)");
    expect(measurementsPageScript).not.toContain('input[name="sl-edit-fit"]:checked');
  });
});

describe("Sleeveless Edit Pattern workspace", () => {
  it("supports Drop Shoulder saved projects in the shared edit workspace", () => {
    expect(sleevelessPatternWorkspaceAstro).toContain("Save Changes");
    expect(sleevelessPatternWorkspaceAstro).not.toContain("data-drop-shoulder-workspace-measure-summary");
    expect(sleevelessPatternWorkspaceAstro).not.toContain("drop-shoulder-refresh-measurements");
  });

  it("does not render Drop Shoulder sleeve-length picker on Sleeveless edit", () => {
    expect(sleevelessPatternWorkspaceAstro).not.toContain('name="sl-edit-sleeve-length"');
    expect(sleevelessPatternWorkspaceAstro).not.toContain("Choose your sleeve length");
  });

  it("does not render interactive Fit choices on the edit workspace", () => {
    expect(sleevelessPatternWorkspaceAstro).not.toContain('name="sl-edit-fit"');
    expect(sleevelessPatternWorkspaceAstro).not.toContain("data-sl-edit-ease");
  });
});

describe("Drop Shoulder builder Fit step (unchanged)", () => {
  it("still renders builder Fit choices for new patterns", () => {
    expect(dropShoulderBuilderAstro).toContain('data-field="fit"');
    expect(dropShoulderBuilderAstro).toContain('data-value="close"');
    expect(dropShoulderBuilderAstro).toContain('data-value="standard"');
    expect(dropShoulderBuilderAstro).toContain('data-value="relaxed"');
    expect(dropShoulderBuilderAstro).toContain("formatFitEaseApproxLabel");
  });

  it("uses the starting-fit heading on the builder", () => {
    expect(dropShoulderBuilderAstro).toContain("Choose a starting fit");
  });
});
