import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DROP_SHOULDER_EDIT_PREVIEW_DEFAULT_TAB,
  DROP_SHOULDER_EDIT_PREVIEW_TABS,
  DROP_SHOULDER_EDIT_SLEEVE_FIELD_KEYS,
  DROP_SHOULDER_UPPER_ARM_INPUT_SELECTOR,
  dropShoulderEditPreviewTabForField,
  focusDropShoulderUpperArmMeasurement,
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
    expect(measurementsPageSrc).toContain("setDropShoulderEditPreviewTab");
    const helper = measurementsPageSrc.match(
      /function setDropShoulderEditPreviewTab\([\s\S]*?\n\}/,
    )?.[0];
    expect(helper).toBeTruthy();
    expect(helper).toContain("sleevelessMeasurementArtRefreshImpl?.()");
    expect(helper).not.toContain("persistFromRoot");
    const tabClick = measurementsPageSrc.match(
      /tablist\.addEventListener\("click", \(ev: Event\) => \{[\s\S]*?\}\);/,
    )?.[0];
    expect(tabClick).toBeTruthy();
    expect(tabClick).toContain("setDropShoulderEditPreviewTab(tablist, overlay, nextTab)");
    expect(tabClick).not.toContain("persistFromRoot");
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

  it("scrolls nearest and focuses Upper Arm without a forced page jump", () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const input = {
      focus,
      closest: () => ({ scrollIntoView }),
    };
    const root = {
      querySelector: (sel: string) => (sel === DROP_SHOULDER_UPPER_ARM_INPUT_SELECTOR ? input : null),
    };
    expect(focusDropShoulderUpperArmMeasurement(root as unknown as ParentNode)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("returns false when the Upper Arm input is missing", () => {
    const root = { querySelector: () => null };
    expect(focusDropShoulderUpperArmMeasurement(root as unknown as ParentNode)).toBe(false);
  });

  it("wires Drop Shoulder armhole-depth help to the shared measurements diagram", () => {
    expect(measurementsPageSrc).toContain("data-ds-armhole-depth-help-trigger");
    expect(measurementsPageSrc).toContain("promptDropShoulderArmholeDepthHelp");
    expect(measurementsPageSrc).toContain("focusDropShoulderUpperArmMeasurement");
    expect(measurementsPageSrc).toContain("goToDropShoulderUpperArmMeasurement");
    expect(measurementsPageSrc).toContain('interactiveHelp: !readOnly && field.key === "armholeDepth"');
    expect(measurementsPageSrc).toContain("if (!readOnly) wireDropShoulderArmholeDepthHelp(wrap)");
    expect(measurementsPageSrc).not.toMatch(/data-cb-measure-input="armholeDepth"/);
    expect(measurementsCss).toContain("express-mbp-box--armhole-help");
  });

  it("makes [hidden] override overlay display:flex so Body chips cannot leak on Sleeve", () => {
    expect(measurementsCss).toContain(
      '.cb-measure-page[data-express-construction="drop-shoulder"] .express-mbp-box[hidden]',
    );
    expect(measurementsCss).toContain("display: none !important");
    const previewSrc = readFileSync(
      resolve("src/lib/patterns/dropShoulderEditMeasurementPreview.ts"),
      "utf8",
    );
    expect(previewSrc).toContain("node.hidden = !visible");
    expect(previewSrc).toContain('node.style.left = ""');
    expect(previewSrc).toContain('node.style.top = ""');
  });
});
