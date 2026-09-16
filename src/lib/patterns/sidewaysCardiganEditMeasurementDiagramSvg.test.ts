import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSidewaysCardiganEditMeasurementDiagramSvg,
  derivedSidewaysSummaryInches,
  SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";

const rendererSrc = readFileSync(
  resolve("src/lib/patterns/sidewaysCardiganEditMeasurementDiagramSvg.ts"),
  "utf8",
);

const BASE = {
  finishedBustInches: 42,
  finishedLengthInches: 25,
  neckOpeningWidthInches: 7.5,
  vNeckDepthInches: 8,
  finishedUpperArmInches: 14,
  sleeveLengthInches: 17,
  wristInches: 7,
};

describe("Sideways Summary/Edit measurement SVG", () => {
  it("sizes the drawing from finished inches, not stitch or row counts", () => {
    const src = rendererSrc;
    expect(src).not.toMatch(/stitchesPerInch|rowsPerInch|garmentLengthStitches/);
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: BASE,
    });
    expect(svg).toContain("viewBox=");
    expect(svg).toContain("preserveAspectRatio=\"xMidYMid meet\"");
    expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
    expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
  });

  it("keeps extreme sizes recognizable by normalizing into a viewBox", () => {
    const tiny = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: { ...BASE, finishedBustInches: 18, finishedLengthInches: 10 },
    });
    const huge = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: { ...BASE, finishedBustInches: 70, finishedLengthInches: 40 },
    });
    expect(tiny).toContain("viewBox=");
    expect(huge).toContain("viewBox=");
    expect(tiny).toContain("data-sideways-edit-diagram=\"cardigan\"");
    expect(huge).toContain("data-sideways-edit-diagram=\"cardigan\"");
  });

  it("updates derived armhole depth when upper arm changes", () => {
    const shallow = derivedSidewaysSummaryInches({ ...BASE, finishedUpperArmInches: 12 });
    const deep = derivedSidewaysSummaryInches({ ...BASE, finishedUpperArmInches: 18 });
    expect(shallow.armholeDepthInches).toBe(6);
    expect(deep.armholeDepthInches).toBe(9);
    expect(shallow.halfNeckOpeningInches).toBe(3.75);
  });
});

