import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS } from "../sleevelessEditMeasurementDiagramSvg";
import { PATTERN_SUMMARY_MEASUREMENT_TARGETS } from "../patternSummaryMeasurementOverlay";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { withSetInSleeveConstructionAuthored } from "../setInSleeveConstructionIdentity";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";
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
  cuffDepthInches: 2,
};

function sleeveOutlineD(svg: string): string {
  const match = svg.match(/data-role="sleeve-outline"[^>]*d="([^"]+)"/);
  return match?.[1] ?? "";
}

function attr(svg: string, name: string): number {
  return Number(svg.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
}

describe("Set-In Sleeve edit measurement diagram — Sleeve tab", () => {
  it("draws the cuff inside the requested sleeve length at one scale for width and length", () => {
    const svg = buildSetInSleeveEditSleeveMeasurementDiagramSvg(SLEEVE);
    const shallow = buildSetInSleeveEditSleeveMeasurementDiagramSvg({ ...SLEEVE, cuffDepthInches: 1 });
    const deep = buildSetInSleeveEditSleeveMeasurementDiagramSvg({ ...SLEEVE, cuffDepthInches: 3 });
    const px = attr(svg, "data-sleeve-px-per-inch");
    expect(svg).toContain('data-set-in-sleeve-edit-piece="sleeve"');
    expect(svg).toContain('data-sleeve-geometry="flat"');
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).not.toContain('viewBox="0 0 430 520"');
    expect(svg).toContain('data-sleeve-cap="false"');
    expect(svg).toContain('data-sleeve-cuff-join="true"');
    expect(svg).toContain('data-role="dim-cuff-depth"');
    expect(svg).not.toContain('data-role="body-outline"');
    expect(attr(svg, "data-upper-width") / (SLEEVE.upperArmInches / 2)).toBeCloseTo(px, 4);
    expect(attr(svg, "data-wrist-width") / (SLEEVE.cuffCircumferenceInches / 2)).toBeCloseTo(px, 4);
    expect(attr(svg, "data-sleeve-length-px") / SLEEVE.sleeveLengthInches).toBeCloseTo(px, 4);
    expect(attr(svg, "data-cuff-depth-px") / SLEEVE.cuffDepthInches).toBeCloseTo(px, 4);
    expect(attr(deep, "data-sleeve-length-px")).toBeCloseTo(attr(shallow, "data-sleeve-length-px"), 4);
    expect(attr(deep, "data-cuff-depth-px")).toBeGreaterThan(attr(shallow, "data-cuff-depth-px"));
    for (const id of SET_IN_SLEEVE_EDIT_SLEEVE_MEASUREMENT_TARGET_IDS) {
      expect(svg).toContain(`id="${id}"`);
    }
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.armLength}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffCircumference}"`);
    expect(svg).toContain(`id="${PATTERN_SUMMARY_MEASUREMENT_TARGETS.cuffDepth}"`);
    for (const id of SLEEVELESS_EDIT_MEASUREMENT_TARGET_IDS) {
      expect(svg).not.toContain(`id="${id}"`);
    }
  });

  it("draws the generated set-in cap above the cuff-to-underarm sleeve", () => {
    const row: ChartRow = {
      bust_or_chest: 40,
      waist: 32,
      hip: 42,
      garment_back_length: 24.5,
      armhole_depth: 7.75,
      shoulder_width: 13.75,
      neck_opening: 7.5,
      front_neck_depth: 5,
      back_neck_depth: 1,
      upper_arm: 14,
      wrist: 6.75,
      sleeve_length: 17,
    };
    const generated = generateSetInSleevePattern({
      fit: {
        sizingChart: "misses",
        easeChoice: "standard",
        selectedMeasurements: computeDefaultMeasurementsFromChartRow(row, "standard", {
          bodyShape: "straight",
        }),
        cbMeasurementOverrides: { sleeveLength: "17", cuffDepth: "2", upperArm: "14", wrist: "6.75" },
      },
      style: withSetInSleeveConstructionAuthored(
        {
          recipientCategory: "misses",
          garmentStyle: "pullover",
          neckline: "round",
          bodyShape: "straight",
          patternMode: "custom-build",
        },
        "long",
      ),
      yarnGaugeMachine: { gaugeStitchesPerInch: 7, gaugeRowsPerInch: 10 },
    });
    const cap = generated.sleeveCap;
    expect(cap?.ok).toBe(true);
    const svg = buildSetInSleeveEditSleeveMeasurementDiagramSvg({
      ...SLEEVE,
      cap,
    });
    const underarmY = Number(svg.match(/data-underarm-y="([^"]+)"/)?.[1]);
    const capTopY = Number(svg.match(/data-cap-top-y="([^"]+)"/)?.[1]);
    const length = svg.match(/data-role="dim-sleeve-length"[\s\S]*?<line[^>]*y1="([^"]+)"[^>]*y2="([^"]+)"/);
    const outline = sleeveOutlineD(svg);
    const capYs = [...outline.matchAll(/L -?[\d.]+ (-?[\d.]+)/g)].map((match) => Number(match[1]));
    const underarmXs = [...outline.matchAll(/L (-?[\d.]+) (-?[\d.]+)/g)]
      .filter((match) => Math.abs(Number(match[2]) - underarmY) < 0.2)
      .map((match) => Number(match[1]));
    const px = attr(svg, "data-sleeve-px-per-inch");
    const upperInches = cap!.sleeve.finishedUpperArmInches;
    const capInches = cap!.totals.capHeightInches;
    expect(svg).toContain('data-sleeve-cap="true"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(capTopY).toBeLessThan(underarmY);
    expect(Math.min(...capYs)).toBeCloseTo(capTopY, 1);
    expect(new Set(underarmXs.map((x) => x.toFixed(2))).size).toBeGreaterThan(2);
    expect(Number(length?.[1])).toBeCloseTo(underarmY, 1);
    expect(Number(length?.[2])).toBeCloseTo(underarmY + SLEEVE.sleeveLengthInches * px, 1);
    expect(attr(svg, "data-upper-width") / (upperInches / 2)).toBeCloseTo(px, 4);
    expect(attr(svg, "data-sleeve-length-px") / SLEEVE.sleeveLengthInches).toBeCloseTo(px, 4);
    expect(attr(svg, "data-cap-height-px") / capInches).toBeCloseTo(px, 4);
    expect(attr(svg, "data-cuff-depth-px") / SLEEVE.cuffDepthInches).toBeCloseTo(px, 4);
    const pxPerStitch = attr(svg, "data-upper-width") / cap!.sleeve.upperArmStitches;
    const pxPerRow = attr(svg, "data-cap-height-px") / cap!.totals.capRows;
    expect(pxPerStitch).not.toBeCloseTo(pxPerRow, 1);
    expect(pxPerStitch * 7 * 2).toBeCloseTo(pxPerRow * 10, 1);
  });
});

describe("Set-In Sleeve edit measurement diagram — example flat sleeve", () => {
  it("draws 13 by 6.5 by 17 inches as a 6.5 by 3.25 flat sleeve at one scale", () => {
    const svg = buildSetInSleeveEditSleeveMeasurementDiagramSvg({
      upperArmInches: 13,
      cuffCircumferenceInches: 6.5,
      sleeveLengthInches: 17,
      cuffDepthInches: 2,
    });
    const px = attr(svg, "data-sleeve-px-per-inch");
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1]?.split(/\s+/).map(Number) ?? [];
    expect(attr(svg, "data-upper-width")).toBeCloseTo(6.5 * px, 4);
    expect(attr(svg, "data-wrist-width")).toBeCloseTo(3.25 * px, 4);
    expect(attr(svg, "data-sleeve-length-px")).toBeCloseTo(17 * px, 4);
    expect(attr(svg, "data-cuff-depth-px")).toBeCloseTo(2 * px, 4);
    expect(viewBox[2]! / viewBox[3]!).toBeGreaterThan(0);
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).toContain('height="auto"');
  });
});

describe("Set-In Sleeve edit measurement diagram — Body / Sleeve preview", () => {
  it("reuses the Drop Shoulder tabs and shows one piece at a time", () => {
    expect(measurementsPageSrc).toContain("usesBodySleeveEditPreview");
    expect(measurementsPageSrc).toContain("createDropShoulderEditPreviewTablist");
    expect(measurementsPageSrc).toContain("applyDropShoulderEditPreviewChipVisibility");
    expect(measurementsPageSrc).toContain("adoptSetInSleeveGeneratedMeasurementArt");
    expect(measurementsPageSrc).toContain("buildSetInSleeveEditSleeveMeasurementDiagramSvg");
    expect(measurementsPageSrc).toContain("SLEEVE_CUFF_RIBBING_DEPTH_LABEL");
    expect(measurementsPageSrc).toContain("SLEEVE_CUFF_RIBBING_DEPTH_ERROR");
    expect(measurementsPageSrc).toContain('anchorTransform: "translate(calc(-100% - 10px), -50%)"');
    expect(measurementsPageSrc).toContain("lab.htmlFor = `cb-measure-${field.key}`");
    expect(measurementsPageSrc).toContain(
      "formatEditableSleeveCuffDepthDisplay(parseCuffDepthOverrideInches(valueInches), unit)",
    );
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
