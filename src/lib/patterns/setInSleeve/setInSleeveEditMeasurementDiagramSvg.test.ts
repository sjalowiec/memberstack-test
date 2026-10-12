import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDropShoulderEditSleeveFrameFromMeasurements } from "../dropShoulderEditMeasurementDiagramSvg";
import { DS_VB_H, DS_VB_W } from "../dropShoulderPatternDiagramSvgShared";
import { dropShoulderSleeveBodyPath } from "../dropShoulderSleeveDiagramSvgShared";
import { SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS } from "../sleevelessEditMeasurementDiagramSvg";
import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "../patternSummaryMeasurementOverlay";
import {
  SET_IN_SLEEVE_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS,
  buildSetInSleeveEditSleeveMeasurementDiagramSvg,
} from "./setInSleeveEditMeasurementDiagramSvg";

const measurementsPageSrc = readFileSync(
  resolve("src/scripts/sleeveless-custom-build-measurements-page.ts"),
  "utf8",
);
const measurementsCss = readFileSync(
  resolve("src/styles/sleeveless-custom-build-measurements.css"),
  "utf8",
);

const SLEEVE = {
  upperArmInches: 14,
  cuffCircumferenceInches: 8,
  sleeveLengthInches: 17,
};

function sleeveOutlineD(svg: string): string {
  const match = svg.match(/data-role="sleeve-outline"[^>]*d="([^"]+)"/);
  return match?.[1] ?? "";
}

describe("Set-In Sleeve edit measurement diagram — Sleeve tab", () => {
  it("draws one full-width sleeve with the three editable targets and no cuff length", () => {
    const svg = buildSetInSleeveEditSleeveMeasurementDiagramSvg(SLEEVE);
    const frame = buildDropShoulderEditSleeveFrameFromMeasurements({
      bustInches: 40,
      hipInches: 40,
      garmentLengthInches: 22,
      armholeDepthInches: 8,
      neckOpeningInches: 7,
      neckDepthInches: 3,
      hemDepthInches: 2,
      upperArmInches: SLEEVE.upperArmInches,
      cuffCircumferenceInches: SLEEVE.cuffCircumferenceInches,
      sleeveLengthInches: SLEEVE.sleeveLengthInches,
      cuffDepthInches: 0,
    });
    expect(svg).toContain('data-set-in-sleeve-edit-piece="sleeve"');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain(`viewBox="0 0 ${DS_VB_W} ${DS_VB_H}"`);
    expect(svg).toContain('data-sleeve-cap="false"');
    expect(sleeveOutlineD(svg)).toBe(dropShoulderSleeveBodyPath(frame));
    expect(svg).not.toContain('data-role="body-outline"');
    expect(svg).not.toContain("dim-cuff-depth");
    expect(svg).not.toContain("target_cuff_depth");
    for (const id of SET_IN_SLEEVE_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference}"`);
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svg).not.toContain(`id="${id}"`);
    }
  });
});

describe("Set-In Sleeve edit measurement diagram — Body / Sleeve preview", () => {
  it("reuses the Drop Shoulder tabs and shows one piece at a time", () => {
    expect(measurementsPageSrc).toContain("usesBodySleeveEditPreview");
    expect(measurementsPageSrc).toContain("createDropShoulderEditPreviewTablist");
    expect(measurementsPageSrc).toContain("applyDropShoulderEditPreviewChipVisibility");
    expect(measurementsPageSrc).toContain("adoptSetInSleeveGeneratedMeasurementArt");
    expect(measurementsPageSrc).toContain("buildSetInSleeveEditSleeveMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("includeSetInSleeveMeasurements: false");
    expect(measurementsPageSrc).toContain("stampSetInSleeveMeasurementPageShell");
    expect(measurementsPageSrc).toContain(
      "if (dropShoulder || isSetInSleeveWorkspaceMeasurementSummaryPage())",
    );
    const refresh = measurementsPageSrc.match(
      /const refreshSetInSleeveEditPreviewArt = \(\): void => \{[\s\S]*?\n  \};/,
    )?.[0];
    expect(refresh).toBeTruthy();
    expect(refresh).toContain("collectValues(root");
    expect(refresh).toContain("dropShoulderEditPreviewTab");
    expect(refresh).toContain("replaceSleevelessMeasurementArtOnly");
    expect(refresh).toContain("visibleOverlayAnchorsForCurrentPreview");
    expect(refresh).not.toContain("persistFromRoot");
    expect(refresh).not.toContain("persistMeasurementOverrides");
    const tabClick = measurementsPageSrc.match(
      /tablist\.addEventListener\("click", \(ev: Event\) => \{[\s\S]*?\}\);/,
    )?.[0];
    expect(tabClick).toContain("setDropShoulderEditPreviewTab(tablist, overlay, nextTab)");
    expect(tabClick).not.toContain("persistFromRoot");
  });

  it("styles the shared tabs and hides the inactive piece on desktop and mobile", () => {
    expect(measurementsCss).toContain(
      '.cb-measure-page[data-express-construction="set-in-sleeve"] .ds-edit-preview-tabs',
    );
    expect(measurementsCss).toContain(
      '.cb-measure-page[data-express-construction="set-in-sleeve"] .express-mbp-box[hidden]',
    );
    expect(measurementsCss).toContain("display: none !important");
  });
});
