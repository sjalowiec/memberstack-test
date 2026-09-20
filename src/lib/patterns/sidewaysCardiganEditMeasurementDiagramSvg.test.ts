import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSidewaysCardiganEditMeasurementDiagramSvg,
  derivedSidewaysSummaryInches,
  SIDEWAYS_SUMMARY_DERIVED_ROLES,
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
    expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.armholeDepth}"`);
    expect(svg).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    expect(svg).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist}"`);
    const sleeve = buildSidewaysCardiganEditMeasurementDiagramSvg(
      { garmentStyle: "cardigan", measurements: BASE },
      "sleeve",
    );
    expect(sleeve).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    expect(sleeve).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(sleeve).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist}"`);
    expect(sleeve).toContain('data-sideways-edit-piece="sleeve"');
    expect(src).toContain("buildDropShoulderMeasurementSleeveFrame");
    expect(src).toContain("dropShoulderSleeveBodyPath");
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

  it("derives ½ neck, fronts, and back from the seven-section bust math — not bust/2 and bust/4", () => {
    const derived = derivedSidewaysSummaryInches({
      ...BASE,
      finishedBustInches: 40,
      neckOpeningWidthInches: 7,
      finishedUpperArmInches: 14,
    });
    expect(derived.halfNeckOpeningInches).toBe(3.5);
    expect(derived.armholeDepthInches).toBe(7);
    expect(derived.shoulderSectionInches).toBe(4.75);
    expect(derived.frontSectionInches).toBe(11.75);
    expect(derived.backSectionInches).toBe(16.5);
    expect(derived.frontSectionInches).not.toBe(10);
    expect(derived.backSectionInches).not.toBe(20);
    expect(2 * derived.frontSectionInches + derived.backSectionInches).toBe(40);
  });

  it("shows display-only ½ neck, front, and back values and keeps them off editable chips", () => {
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: {
        ...BASE,
        finishedBustInches: 40,
        neckOpeningWidthInches: 7,
        finishedUpperArmInches: 14,
      },
    });
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.halfNeckOpening}"`);
    expect(svg).toContain('data-derived-inches="3.5"');
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.frontSection}"`);
    expect(svg).toContain('data-derived-inches="11.75"');
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.backSection}"`);
    expect(svg).toContain('data-derived-inches="16.5"');
    expect(svg).toContain("dim-half-neck-opening");
    expect(svg).toContain("dim-front-section");
    expect(svg).toContain("dim-back-section");
    expect(svg).not.toMatch(/>Armhole depth</);
    expect((svg.match(/data-role="dim-armhole-depth"/g) ?? []).length).toBe(1);
  });

  it("updates derived display values when parent measurements change", () => {
    const widerNeck = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: { ...BASE, finishedBustInches: 40, neckOpeningWidthInches: 8 },
    });
    expect(widerNeck).toContain('data-derived-inches="4"');
    expect(widerNeck).toContain('data-derived-inches="12"');
    expect(widerNeck).toContain('data-derived-inches="16"');
  });

  it("draws equal-length dimension lines for equal inch measurements", () => {
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: {
        ...BASE,
        finishedBustInches: 40,
        finishedLengthInches: 25,
        neckOpeningWidthInches: 7,
        finishedUpperArmInches: 14,
      },
    });
    const neck = dimSegment(svg, "dim-neck-opening");
    const armhole = dimSegment(svg, "dim-armhole-depth");
    const halfNeck = dimSegment(svg, "dim-half-neck-opening");
    expect(neck).not.toBeNull();
    expect(armhole).not.toBeNull();
    expect(halfNeck).not.toBeNull();
    expect(armhole!.length).toBeCloseTo(neck!.length, 1);
    expect(halfNeck!.length).toBeCloseTo(neck!.length / 2, 1);
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
    expect(cardigan).not.toContain("dim-sleeve-length");
    expect(cardigan).not.toContain("dim-wrist");
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

function dimSegment(svg: string, role: string): { length: number } | null {
  const re = new RegExp(
    `data-role="${role}"[\\s\\S]*?<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"`,
  );
  const m = re.exec(svg);
  if (!m) return null;
  const x1 = Number(m[1]);
  const y1 = Number(m[2]);
  const x2 = Number(m[3]);
  const y2 = Number(m[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return { length: Math.hypot(x2 - x1, y2 - y1) };
}

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

