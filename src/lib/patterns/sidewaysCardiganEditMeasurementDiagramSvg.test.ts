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

  it("uses the corrected Cardigan front-back-front structure without a sleeve silhouette", () => {
    const cardigan = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: BASE,
    });
    const pullover = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: BASE,
    });
    expect(cardigan).toContain('data-cardigan-structure="front-back-front"');
    expect(cardigan).toContain('data-role="first-front"');
    expect(cardigan).toContain('data-role="back-panel"');
    expect(cardigan).toContain('data-role="second-front"');
    expect(cardigan).toContain('data-role="center-front-start"');
    expect(cardigan).toContain('data-role="v-neck"');
    expect(cardigan).toContain("dim-finished-back-length");
    expect(cardigan).toContain("dim-vneck-depth");
    expect(cardigan).not.toContain('data-role="sleeve-outline"');
    expect(pullover).toContain('data-role="sleeve-outline"');
    expect(pullover).toContain('data-role="underarm-start"');
  });

  it("keeps Cardigan labels, dimension lines, and chip targets inside the viewBox", () => {
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: BASE,
    });
    const tiny = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: { ...BASE, finishedBustInches: 18, finishedLengthInches: 10 },
    });
    const huge = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: { ...BASE, finishedBustInches: 70, finishedLengthInches: 40 },
    });
    for (const drawing of [svg, tiny, huge]) {
      expect(diagramGeometryStaysInsideViewBox(drawing)).toBe(true);
    }
  });
});

function diagramGeometryStaysInsideViewBox(svg: string): boolean {
  const vb = /viewBox="0 0 ([^" ]+) ([^"]+)"/.exec(svg);
  if (!vb) return false;
  const width = Number(vb[1]);
  const height = Number(vb[2]);
  if (!(width > 0) || !(height > 0)) return false;
  const pad = 0.5;
  const attrs = [
    ...svg.matchAll(/\b(?:x|x1|x2|cx)="([^"]+)"/g),
  ];
  const ys = [...svg.matchAll(/\b(?:y|y1|y2|cy)="([^"]+)"/g)];
  for (const m of attrs) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < -pad || n > width + pad) return false;
  }
  for (const m of ys) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < -pad || n > height + pad) return false;
  }
  return true;
}

