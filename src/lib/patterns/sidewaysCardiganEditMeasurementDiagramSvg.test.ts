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

  it("derives fronts, back, and shoulders from bust/4 and bust/2 garment sections", () => {
    const derived = derivedSidewaysSummaryInches({
      ...BASE,
      finishedBustInches: 40,
      neckOpeningWidthInches: 7,
      finishedUpperArmInches: 14,
    });
    expect(derived.halfNeckOpeningInches).toBe(3.5);
    expect(derived.armholeDepthInches).toBe(7);
    expect(derived.shoulderSectionInches).toBe(6.5);
    expect(derived.frontSectionInches).toBe(10);
    expect(derived.backSectionInches).toBe(20);
    expect(derived.frontSectionInches).toBe(derived.halfNeckOpeningInches + derived.shoulderSectionInches);
    expect(derived.backSectionInches).toBe(2 * derived.frontSectionInches);
    expect(2 * derived.backSectionInches).toBe(40);
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
    expect(svg).toContain('data-derived-inches="10"');
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.backSection}"`);
    expect(svg).toContain('data-derived-inches="20"');
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection}"`);
    expect(svg).toContain('data-derived-inches="6.5"');
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
    expect(widerNeck).toContain('data-derived-inches="6"');
    expect(widerNeck).toContain('data-derived-inches="10"');
    expect(widerNeck).toContain('data-derived-inches="20"');
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

  it("labels front, back, and shoulder sections on both Cardigan and Pullover", () => {
    const measurements = {
      ...BASE,
      finishedBustInches: 40,
      neckOpeningWidthInches: 7,
      finishedUpperArmInches: 14,
    };
    const cardigan = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements,
    });
    const pullover = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements,
    });
    for (const svg of [cardigan, pullover]) {
      expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.frontSection}"`);
      expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.backSection}"`);
      expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection}"`);
      expect(svg).toContain('data-derived-inches="10"');
      expect(svg).toContain('data-derived-inches="20"');
      expect(svg).toContain('data-derived-inches="6.5"');
      expect(svg).toContain("dim-front-section");
      expect(svg).toContain("dim-back-section");
      expect(svg).toContain("dim-shoulder-section");
      expect(diagramGeometryStaysInsideViewBox(svg)).toBe(true);
    }
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

  it("keeps Cardigan width dimensions in outer/inner lanes with independent end caps", () => {
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: {
        ...BASE,
        finishedBustInches: 40,
        finishedLengthInches: 16.75,
        neckOpeningWidthInches: 7,
        finishedUpperArmInches: 14,
      },
    });
    const hemX = Number(/data-role="center-front-start"[^>]*x1="([^"]+)"/.exec(svg)?.[1]);
    const firstArmholeY = Number(/data-role="first-front"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const secondArmholeY = Number(/data-role="back-panel"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const bust = dimLineFromGroup(dimGroup(svg, "dim-finished-bust"));
    const front1 = dimLineFromGroup(dimGroup(svg, "dim-front-section", "first"));
    const back = dimLineFromGroup(dimGroup(svg, "dim-back-section"));
    const front2 = dimLineFromGroup(dimGroup(svg, "dim-front-section", "second"));
    expect(hemX).toBeGreaterThan(0);
    expect(bust).not.toBeNull();
    expect(front1).not.toBeNull();
    expect(back).not.toBeNull();
    expect(front2).not.toBeNull();
    expect(endCapCount(dimGroup(svg, "dim-finished-bust"))).toBe(2);
    expect(endCapCount(dimGroup(svg, "dim-front-section", "first"))).toBe(2);
    expect(endCapCount(dimGroup(svg, "dim-back-section"))).toBe(2);
    expect(endCapCount(dimGroup(svg, "dim-front-section", "second"))).toBe(2);
    expect(front1!.x1).toBe(back!.x1);
    expect(front2!.x1).toBe(back!.x1);
    expect(front1!.x1).toBeLessThan(hemX);
    expect(bust!.x1).toBeLessThan(front1!.x1);
    expect(front1!.y2).toBeLessThan(back!.y1);
    expect(back!.y2).toBeLessThan(front2!.y1);
    expect(back!.y1 - front1!.y2).toBeGreaterThanOrEqual(8);
    expect(front2!.y1 - back!.y2).toBeGreaterThanOrEqual(8);
    expect(front1!.y2).toBeLessThan(firstArmholeY);
    expect(back!.y1).toBeGreaterThan(firstArmholeY);
    expect(back!.y2).toBeLessThan(secondArmholeY);
    expect(front2!.y1).toBeGreaterThan(secondArmholeY);
    expect(svg).toContain('data-role="dim-extension"');
    expect(svg).toContain('data-derived-inches="10"');
    expect(svg).toContain('data-derived-inches="20"');

    const frontXs = [...svg.matchAll(/data-role="derived-front-section"[^>]*x="([^"]+)"/g)].map(
      (m) => m[1],
    );
    const backMatch = /data-role="derived-back-section"[^>]*x="([^"]+)"/.exec(svg);
    const backAnchor = /data-role="derived-back-section"[^>]*text-anchor="([^"]+)"/.exec(svg);
    const frontAnchor = /data-role="derived-front-section"[^>]*text-anchor="([^"]+)"/.exec(svg);
    expect(frontXs.length).toBeGreaterThanOrEqual(2);
    expect(backMatch?.[1]).toBe(frontXs[0]);
    expect(frontXs[0]).toBe(frontXs[1]);
    expect(backAnchor?.[1]).toBe(frontAnchor?.[1]);
    expect(Number(frontXs[0])).toBeLessThan(hemX + 20);
    const bodyMidX =
      (hemX + Number(/data-role="first-front"[^>]*x2="([^"]+)"/.exec(svg)?.[1])) / 2;
    expect(Number(backMatch?.[1])).toBeLessThan(bodyMidX - 40);
  });

  it("draws Finished back length as a separate hem-to-neck dimension below the body", () => {
    const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "cardigan",
      measurements: {
        ...BASE,
        finishedBustInches: 40,
        finishedLengthInches: 16.75,
        neckOpeningWidthInches: 7,
        finishedUpperArmInches: 14,
      },
    });
    const hemX = Number(/data-role="center-front-start"[^>]*x1="([^"]+)"/.exec(svg)?.[1]);
    const neckX = Number(/data-role="first-front"[^>]*x2="([^"]+)"/.exec(svg)?.[1]);
    const bottomY = Number(/data-role="center-front-end"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const topY = Number(/data-role="center-front-start"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const firstArmholeY = Number(/data-role="first-front"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const secondArmholeY = Number(/data-role="back-panel"[^>]*y1="([^"]+)"/.exec(svg)?.[1]);
    const group = dimGroup(svg, "dim-finished-back-length");
    const length = dimLineFromGroup(group);
    expect(length).not.toBeNull();
    expect(endCapCount(group)).toBe(2);
    expect(length!.y1).toBe(length!.y2);
    expect(length!.x1).toBeCloseTo(hemX, 1);
    expect(length!.x2).toBeCloseTo(neckX, 1);
    expect(length!.y1).toBeGreaterThan(bottomY + 8);
    expect(length!.y1).not.toBe(topY);
    expect(length!.y1).not.toBe(firstArmholeY);
    expect(length!.y1).not.toBe(secondArmholeY);
    expect(length!.y1).not.toBe(bottomY);
    const target = new RegExp(
      `<circle id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedLength}" cx="([^"]+)" cy="([^"]+)"`,
    ).exec(svg);
    expect(Number(target?.[1])).toBeCloseTo((hemX + neckX) / 2, 1);
    expect(Number(target?.[2])).toBeCloseTo(length!.y1, 1);
  });
});

function dimGroup(svg: string, role: string, side?: string): string {
  const sideAttr = side ? ` data-side="${side}"` : "";
  const re = new RegExp(
    `<g class="ds-edit-dim" data-role="${role}"${sideAttr}[\\s\\S]*?</g>`,
  );
  return re.exec(svg)?.[0] ?? "";
}

function dimLineFromGroup(group: string): { x1: number; y1: number; x2: number; y2: number } | null {
  const m = /<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(group);
  if (!m) return null;
  const x1 = Number(m[1]);
  const y1 = Number(m[2]);
  const x2 = Number(m[3]);
  const y2 = Number(m[4]);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  return { x1, y1, x2, y2 };
}

function endCapCount(group: string): number {
  return (group.match(/<rect /g) ?? []).length;
}

function dimSegment(svg: string, role: string): { length: number } | null {
  const line = dimLineFromGroup(dimGroup(svg, role));
  if (!line) return null;
  return { length: Math.hypot(line.x2 - line.x1, line.y2 - line.y1) };
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

