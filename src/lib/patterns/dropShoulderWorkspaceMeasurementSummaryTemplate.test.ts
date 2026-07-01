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

  it("loads the edit drawer script that rehydrates measurements on size change", () => {
    expect(dropShoulderPatternWorkspaceAstro).toContain("sleevelessPatternEditDrawerPrototype.ts");
    expect(editDrawerScript).toContain("rehydrateDropShoulderWorkspaceMeasurementDiagramFromQuickEdit");
    expect(editDrawerScript).toContain('sizeSelect.addEventListener("change"');
    expect(editDrawerScript).toContain("readDropShoulderWorkspaceQuickEditSizingFromDom");
    expect(editDrawerScript).toContain("isDropShoulderWorkspaceMeasurementSummaryPage");
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
});

describe("Sleeveless Edit Pattern workspace", () => {
  it("supports Drop Shoulder saved projects in the shared edit workspace", () => {
    expect(sleevelessPatternWorkspaceAstro).toContain("Save Changes");
    expect(sleevelessPatternWorkspaceAstro).not.toContain("data-drop-shoulder-workspace-measure-summary");
    expect(sleevelessPatternWorkspaceAstro).not.toContain("drop-shoulder-refresh-measurements");
  });
});
