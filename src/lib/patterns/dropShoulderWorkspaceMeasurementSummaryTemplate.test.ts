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

  it("does not render sleeve-length preset choices on the edit workspace", () => {
    expect(dropShoulderPatternWorkspaceAstro).not.toContain("data-sl-edit-sleeve-length");
    expect(dropShoulderPatternWorkspaceAstro).not.toContain('name="sl-edit-sleeve-length"');
    expect(editDrawerScript).not.toContain("persistDropShoulderSleeveLength");
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

  it("marks numeric sleeve length user-edited on save from the diagram field", () => {
    expect(editDrawerScript).toContain('markDropShoulderSleeveFieldUserEdited("sleeveLength")');
    expect(editDrawerScript).toContain('[data-cb-measure-input="sleeveLength"]');
  });

  it("still supports measurement edit and save via the existing apply pipeline", () => {
    expect(editDrawerScript).toContain("async function applyChanges");
    expect(editDrawerScript).toContain("flushCustomBuildMeasurementOverridesToCanonical");
    expect(editDrawerScript).toContain("syncCustomBuildToPatternStorage");
    expect(editDrawerScript).toContain("loadMeasurementOverrides");
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
