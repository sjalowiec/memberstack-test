import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB,
  DROP_SHOULDER_EDIT_PREVIEW_TABS,
  DROP_SHOULDER_EDIT_SLEEVE_FIELD_KEYS,
  dropShoulderEditPreviewTabForField,
  isDropShoulderEditPreviewTab,
} from "./dropShoulderEditMeasurementPreview";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);
const measurementsCss = readFileSync(
  resolve("src/styles/sleeveless-custom-build-measurements.css"),
  "utf8",
);
const workspaceCss = readFileSync(
  resolve("src/styles/patterns/pattern-summary-edit-workspace.css"),
  "utf8",
);

describe("Drop Shoulder edit preview tabs", () => {
  it("defaults to the Body tab", () => {
    expect(DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB).toBe("body");
    expect(DROP_SHOULDER_EDIT_PREVIEW_TABS).toEqual(["body", "sleeve"]);
    expect(isDropShoulderEditPreviewTab("body")).toBe(true);
    expect(isDropShoulderEditPreviewTab("sleeve")).toBe(true);
    expect(isDropShoulderEditPreviewTab("front")).toBe(false);
  });

  it("maps overlay fields to the tab that owns their targets", () => {
    expect(dropShoulderEditPreviewTabForField("chestBust")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("finishedLength")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("armholeDepth")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("hip")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("hemDepth")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("finishedNeckOpeningWidth")).toBe("body");
    expect(dropShoulderEditPreviewTabForField("neckDepth")).toBe("body");
    for (const key of DROP_SHOULDER_EDIT_SLEEVE_FIELD_KEYS) {
      expect(dropShoulderEditPreviewTabForField(key)).toBe("sleeve");
    }
  });

  it("resets to Body when the edit page initializes and does not persist on tab switch", () => {
    expect(measurementsPageSrc).toContain(
      "dropShoulderEditPreviewTab = DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB",
    );
    expect(measurementsPageSrc).toContain("createDropShoulderEditPreviewTablist");
    expect(measurementsPageSrc).toContain("stampDropShoulderPreviewTab");
    expect(measurementsPageSrc).toContain("applyDropShoulderEditPreviewChipVisibility");
    const tabClick = measurementsPageSrc.match(
      /tablist\.addEventListener\("click", \(ev: Event\) => \{[\s\S]*?\}\);/,
    )?.[0];
    expect(tabClick).toBeTruthy();
    expect(tabClick).not.toContain("persistFromRoot");
    expect(tabClick).toContain("sleevelessMeasurementArtRefreshImpl?.()");
    expect(tabClick).toContain("dropShoulderEditPreviewTab = nextTab");
  });

  it("refreshes both tabs from the same live edit-page measurement state", () => {
    const dsRefresh = measurementsPageSrc.match(
      /const refreshDropShoulderEditPreviewArt = \(\): void => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(dsRefresh).toBeTruthy();
    expect(dsRefresh).toContain("collectValues(root");
    expect(dsRefresh).toContain("dropShoulderEditWorkspaceMergedForDiagram");
    expect(dsRefresh).toContain("dropShoulderEditPreviewTab");
    expect(dsRefresh).toContain("visibleOverlayAnchorsForCurrentPreview");
    expect(dsRefresh).not.toContain("persistFromRoot");
    expect(measurementsPageSrc).toContain("adoptDropShoulderGeneratedMeasurementArt(");
    expect(measurementsPageSrc).toMatch(
      /adoptDropShoulderGeneratedMeasurementArt\([\s\S]*dropShoulderEditPreviewTab/,
    );
  });

  it("does not add garment-name tab styles to the shared edit workspace CSS", () => {
    expect(workspaceCss).not.toContain("ds-edit-preview-tabs");
    expect(measurementsCss).toContain(
      '.cb-measure-page[data-express-construction="drop-shoulder"] .ds-edit-preview-tabs',
    );
  });
});
