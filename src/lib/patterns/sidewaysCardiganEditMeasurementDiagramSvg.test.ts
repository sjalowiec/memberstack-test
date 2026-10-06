import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDiagramTypographyForViewBox } from "./buildDiagramTypography";
import {
  buildSidewaysCardiganEditMeasurementDiagramSvg,
  buildSidewaysCardiganEditMeasurementFrame,
  drawPulloverMarkers,
  viewBoxFor,
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
    expect(src).toContain("sidewaysProportionalSleeveLocalFrame");
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
    expect(pullover).not.toContain('data-role="sleeve-outline"');
    expect(pullover).not.toContain("dim-sleeve-length");
    expect(pullover).not.toContain("dim-wrist");
    expect(pullover).not.toContain("dim-upper-arm");
    expect(pullover).toContain('data-role="underarm-start"');
    expect(pullover).toContain('data-role="v-neck"');
    expect(pullover).toContain('data-closed-front="true"');
  });

  it("scales the Pullover body from bust and length and leaves sleeve measurements off the body diagram", () => {
    const pullover = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: BASE,
    });
    const bodyPath = /data-role="body-outline"[^>]* d="([^"]+)"/;
    expect(pullover).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
    expect(pullover).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedLength}"`);
    expect(pullover).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.neckOpeningWidth}"`);
    expect(pullover).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth}"`);
    expect(pullover).toContain(">Shoulder<");
    expect(pullover).toContain(">½ neck opening<");
    expect(pullover).toContain(">Front<");
    expect(pullover).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    expect(pullover).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(pullover).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist}"`);

    const longerSleeve = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: { ...BASE, sleeveLengthInches: 24, wristInches: 9 },
    });
    expect(bodyPath.exec(longerSleeve)?.[1]).toBe(bodyPath.exec(pullover)?.[1]);

    const longerBody = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: { ...BASE, finishedLengthInches: 30 },
    });
    expect(bodyPath.exec(longerBody)?.[1]).not.toBe(bodyPath.exec(pullover)?.[1]);

    const bust = dimSegment(pullover, "dim-finished-bust");
    const length = dimSegment(pullover, "dim-finished-back-length");
    expect(bust).not.toBeNull();
    expect(length).not.toBeNull();
    expect(bust!.length / BASE.finishedBustInches).toBeCloseTo(
      length!.length / BASE.finishedLengthInches,
      2,
    );
    expect(diagramGeometryStaysInsideViewBox(pullover)).toBe(true);
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

  it("keeps the Cardigan Finished bust/chest lane, end caps, and chip target inside the viewBox", () => {
    const sizes = [
      { ...BASE, finishedBustInches: 40, finishedLengthInches: 16.75 },
      { ...BASE, finishedBustInches: 18, finishedLengthInches: 10 },
      { ...BASE, finishedBustInches: 70, finishedLengthInches: 40 },
    ];
    for (const measurements of sizes) {
      const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
        garmentStyle: "cardigan",
        measurements,
      });
      const vb = parseViewBox(svg);
      expect(vb).not.toBeNull();
      const bustGroup = dimGroup(svg, "dim-finished-bust");
      const bust = dimLineFromGroup(bustGroup);
      const inner = dimLineFromGroup(dimGroup(svg, "dim-back-section"));
      const target = new RegExp(
        `<circle id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}" cx="([^"]+)" cy="([^"]+)"`,
      ).exec(svg);
      expect(bust).not.toBeNull();
      expect(inner).not.toBeNull();
      expect(endCapCount(bustGroup)).toBe(2);
      expect(bust!.x1).toBeLessThan(inner!.x1);
      expect(bust!.x1 - vb!.x).toBeGreaterThanOrEqual(160);
      expect(Number(target?.[1])).toBeCloseTo(bust!.x1, 1);
      const capXs = [...bustGroup.matchAll(/\b(?:x|x1|x2|cx)="([^"]+)"/g)].map((m) => Number(m[1]));
      for (const x of capXs) {
        expect(x).toBeGreaterThanOrEqual(vb!.x);
        expect(x).toBeLessThanOrEqual(vb!.x + vb!.width);
      }
      expect(diagramGeometryStaysInsideViewBox(svg)).toBe(true);
    }
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

  it("scales Sideways body labels from the shared Build/Edit typography helper", () => {
    expect(rendererSrc).not.toContain('font-size="11"');
    const samples = [
      { garmentStyle: "cardigan" as const, measurements: BASE },
      { garmentStyle: "pullover" as const, measurements: BASE },
      {
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 34, finishedLengthInches: 20 },
      },
      {
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 54, finishedLengthInches: 28 },
      },
    ];
    for (const input of samples) {
      const frame = buildSidewaysCardiganEditMeasurementFrame(input, {
        includeAttachedSleeve: false,
      });
      const geometry = viewBoxFor(frame);
      const type = buildDiagramTypographyForViewBox(geometry.width);
      const svg = buildSidewaysCardiganEditMeasurementDiagramSvg(input);
      const vb = parseViewBox(svg);
      expect(svg).toContain(`data-build-diagram-type-width="${geometry.width}"`);
      expect(vb && vb.width).toBeGreaterThanOrEqual(geometry.width);
      expect(type.value).toBeGreaterThan(type.name);
      expect(type.name).toBeGreaterThan(type.support);
      expect(svg).toContain(
        `data-build-type-role="name" font-size="${type.name}" font-weight="${type.nameWeight}"`,
      );
      expect(svg).toContain(
        `data-build-type-role="value" font-size="${type.value}" font-weight="${type.valueWeight}"`,
      );
      expect(svg).toContain(`dy="${type.valueLineGap}"`);
      expect(svg).toContain(">Front<");
      expect(svg).toContain(">Back<");
      expect(svg).toContain(">Shoulder<");
      expect(svg).toContain(">½ neck opening<");
      expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
      expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedLength}"`);
      expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.neckOpeningWidth}"`);
      expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth}"`);
      expect(svg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.armholeDepth}"`);
      expect(svg).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    }
    const pullover = buildSidewaysCardiganEditMeasurementDiagramSvg({
      garmentStyle: "pullover",
      measurements: BASE,
    });
    const pulloverType = buildDiagramTypographyForViewBox(
      viewBoxFor(
        buildSidewaysCardiganEditMeasurementFrame(
          { garmentStyle: "pullover", measurements: BASE },
          { includeAttachedSleeve: false },
        ),
      ).width,
    );
    expect(pullover).toMatch(
      new RegExp(
        `data-build-type-role="support"[^>]*font-size="${pulloverType.support}"[^>]*>Armhole depth<`,
      ),
    );
    expect(pullover).toContain(">Start at underarm<");
    expect(pullover).toContain(">scrap on / graft<");
    expect(pullover).toMatch(
      new RegExp(`data-build-type-role="support"[^>]*font-size="${pulloverType.support}"`),
    );
    expect(pullover).toContain('data-derived-inches="10.5"');
  });

  it("keeps finished-pattern pullover markers free of the body measurement caption", () => {
    const frame = buildSidewaysCardiganEditMeasurementFrame({
      garmentStyle: "pullover",
      measurements: BASE,
    });
    const markers = drawPulloverMarkers(frame, { includeStartLabel: false });
    expect(markers).toContain('data-role="underarm-start"');
    expect(markers).not.toContain("font-size");
    expect(markers).not.toContain("data-build-type-role");
    expect(markers).not.toContain("Start at underarm");
  });

  it("keeps body label ink inside the viewBox at small and large sizes", () => {
    const samples = [
      { label: "typical cardigan", garmentStyle: "cardigan" as const, measurements: BASE },
      { label: "typical pullover", garmentStyle: "pullover" as const, measurements: BASE },
      {
        label: "small cardigan",
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 34, finishedLengthInches: 20, neckOpeningWidthInches: 6.5 },
      },
      {
        label: "large cardigan",
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 54, finishedLengthInches: 28, neckOpeningWidthInches: 8 },
      },
      {
        label: "tiny cardigan",
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 18, finishedLengthInches: 10 },
      },
      {
        label: "huge cardigan",
        garmentStyle: "cardigan" as const,
        measurements: { ...BASE, finishedBustInches: 70, finishedLengthInches: 40 },
      },
      {
        label: "typical cardigan cm",
        garmentStyle: "cardigan" as const,
        measurements: BASE,
        displayUnit: "cm" as const,
      },
    ];
    const clips: string[] = [];
    const overlaps: string[] = [];
    for (const sample of samples) {
      const svg = buildSidewaysCardiganEditMeasurementDiagramSvg({
        garmentStyle: sample.garmentStyle,
        measurements: sample.measurements,
        displayUnit: sample.displayUnit,
      });
      const vb = parseViewBox(svg);
      expect(vb).not.toBeNull();
      const boxes = textLineBoxes(svg);
      for (const box of boxes) {
        if (
          box.left < vb!.x - 0.5 ||
          box.right > vb!.x + vb!.width + 0.5 ||
          box.top < vb!.y - 0.5 ||
          box.bottom > vb!.y + vb!.height + 0.5
        ) {
          clips.push(`${sample.label}: "${box.text}"`);
        }
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          if (a.group === b.group) continue;
          const overlapX = a.left < b.right - 2 && a.right > b.left + 2;
          const overlapY = a.top < b.bottom - 2 && a.bottom > b.top + 2;
          if (overlapX && overlapY) overlaps.push(`${sample.label}: "${a.text}" × "${b.text}"`);
        }
      }
    }
    expect(clips).toEqual([]);
    expect(overlaps).toEqual([]);
  });
});

const SLEEVE_EXAMPLE = {
  ...BASE,
  finishedUpperArmInches: 18,
  wristInches: 8.5,
  sleeveLengthInches: 16.75,
};

function sleeveDiagram(
  measurements: typeof SLEEVE_EXAMPLE,
  garmentStyle: "cardigan" | "pullover" = "cardigan",
) {
  return buildSidewaysCardiganEditMeasurementDiagramSvg(
    { garmentStyle, measurements },
    "sleeve",
  );
}

describe("Sideways sleeve Build/Edit proportional geometry", () => {
  it("draws 18 in upper arm, 8.5 in wrist, and 16.75 in length on one scale", () => {
    const svg = sleeveDiagram(SLEEVE_EXAMPLE);
    const shape = sleeveSilhouette(svg);
    const vb = parseViewBox(svg);
    expect(svg).toContain('data-sleeve-geometry="proportional"');
    expect(svg).toContain('data-finished-upper-arm-inches="18"');
    expect(svg).toContain('data-wrist-inches="8.5"');
    expect(svg).toContain('data-sleeve-length-inches="16.75"');
    expect(svg).not.toContain('viewBox="0 0 430 520"');
    expect(shape.upperWidth / shape.wristWidth).toBeCloseTo(18 / 8.5, 4);
    expect(shape.length / shape.upperWidth).toBeCloseTo(16.75 / 18, 4);
    expect(shape.length / 16.75).toBeCloseTo(shape.upperWidth / 18, 4);
    expect(shape.wristWidth / 8.5).toBeCloseTo(shape.upperWidth / 18, 4);
    expect(dimSegment(svg, "dim-upper-arm")!.length).toBeCloseTo(shape.upperWidth, 2);
    expect(dimSegment(svg, "dim-wrist")!.length).toBeCloseTo(shape.wristWidth, 2);
    expect(dimSegment(svg, "dim-sleeve-length")!.length).toBeCloseTo(shape.length, 2);
    expect(vb).not.toBeNull();
    expect(shape.midX).toBeCloseTo(vb!.x + vb!.width / 2, 2);
    expect(shape.upperWidth).toBeLessThan(vb!.width);
    expect(shape.length).toBeLessThan(vb!.height);
    expect(diagramGeometryStaysInsideViewBox(svg)).toBe(true);
  });

  it("keeps sleeve-length, upper-arm, and wrist chip targets on their dimension lines", () => {
    const svg = sleeveDiagram(SLEEVE_EXAMPLE);
    const vb = parseViewBox(svg)!;
    const upper = dimLineFromGroup(dimGroup(svg, "dim-upper-arm"))!;
    const wrist = dimLineFromGroup(dimGroup(svg, "dim-wrist"))!;
    const length = dimLineFromGroup(dimGroup(svg, "dim-sleeve-length"))!;
    const upperTarget = targetPoint(svg, SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm);
    const wristTarget = targetPoint(svg, SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist);
    const lengthTarget = targetPoint(svg, SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength);
    expect(upperTarget.cx).toBeCloseTo((upper.x1 + upper.x2) / 2, 2);
    expect(upperTarget.cy).toBeCloseTo(upper.y1, 2);
    expect(wristTarget.cx).toBeCloseTo((wrist.x1 + wrist.x2) / 2, 2);
    expect(wristTarget.cy).toBeCloseTo(wrist.y1, 2);
    expect(lengthTarget.cx).toBeCloseTo(length.x1, 2);
    expect(lengthTarget.cy).toBeCloseTo((length.y1 + length.y2) / 2, 2);
    expect(length.x1 - vb.x).toBeGreaterThanOrEqual(90);
    expect(vb.x + vb.width - upperTarget.cx).toBeGreaterThanOrEqual(160);
    expect(upper.y1 - vb.y).toBeGreaterThanOrEqual(40);
    expect(vb.y + vb.height - wrist.y1).toBeGreaterThanOrEqual(56);
    expect(svg).toContain('data-role="dim-extension"');
    expect(svg).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
  });

  it("changes only the matching edge when upper arm, wrist, or sleeve length changes", () => {
    const base = sleeveSilhouette(sleeveDiagram(SLEEVE_EXAMPLE));
    const wider = sleeveSilhouette(
      sleeveDiagram({ ...SLEEVE_EXAMPLE, finishedUpperArmInches: 22 }),
    );
    const tighter = sleeveSilhouette(sleeveDiagram({ ...SLEEVE_EXAMPLE, wristInches: 6.5 }));
    const longer = sleeveSilhouette(
      sleeveDiagram({ ...SLEEVE_EXAMPLE, sleeveLengthInches: 20.75 }),
    );
    expect(wider.upperWidth / base.upperWidth).toBeCloseTo(22 / 18, 4);
    expect(wider.wristWidth).toBeCloseTo(base.wristWidth, 2);
    expect(wider.length).toBeCloseTo(base.length, 2);
    expect(wider.length / 16.75).toBeCloseTo(wider.upperWidth / 22, 4);

    expect(tighter.wristWidth / base.wristWidth).toBeCloseTo(6.5 / 8.5, 4);
    expect(tighter.upperWidth).toBeCloseTo(base.upperWidth, 2);
    expect(tighter.length).toBeCloseTo(base.length, 2);
    expect(tighter.upperWidth / 18).toBeCloseTo(tighter.wristWidth / 6.5, 4);

    expect(longer.length / base.length).toBeCloseTo(20.75 / 16.75, 4);
    expect(longer.upperWidth).toBeCloseTo(base.upperWidth, 2);
    expect(longer.wristWidth).toBeCloseTo(base.wristWidth, 2);
    expect(longer.upperWidth / 18).toBeCloseTo(longer.length / 20.75, 4);
  });

  it("grows the viewBox with the sleeve instead of refitting a fixed canvas", () => {
    const sleeveFn = rendererSrc.slice(
      rendererSrc.indexOf("function buildSidewaysSleeveLayout"),
      rendererSrc.indexOf("function sleeveLengthDimX"),
    );
    const geometrySrc = readFileSync(
      resolve("src/lib/patterns/sidewaysSleeveProportionalGeometry.ts"),
      "utf8",
    );
    expect(sleeveFn).toContain("sidewaysProportionalSleeveLocalFrame");
    expect(geometrySrc).toContain("upperArmInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(geometrySrc).toContain("wristInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(geometrySrc).toContain("sleeveLengthInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(geometrySrc).toContain("cuffDepthInches * SIDEWAYS_SLEEVE_PX_PER_INCH");
    expect(sleeveFn).not.toContain("/ 2");
    expect(sleeveFn).not.toContain("DS_VB_");
    expect(sleeveFn).not.toContain("DS_SLEEVE_REF_");
    expect(geometrySrc).not.toContain("/ 2");
    expect(geometrySrc).not.toContain("DS_VB_");
    expect(geometrySrc).not.toContain("DS_SLEEVE_REF_");
    const shortBox = parseViewBox(sleeveDiagram(SLEEVE_EXAMPLE))!;
    const longBox = parseViewBox(
      sleeveDiagram({ ...SLEEVE_EXAMPLE, sleeveLengthInches: 20.75 }),
    )!;
    const shortShape = sleeveSilhouette(sleeveDiagram(SLEEVE_EXAMPLE));
    const longShape = sleeveSilhouette(
      sleeveDiagram({ ...SLEEVE_EXAMPLE, sleeveLengthInches: 20.75 }),
    );
    expect(longBox.height - shortBox.height).toBeCloseTo(longShape.length - shortShape.length, 2);
    expect(longBox.width).toBeCloseTo(shortBox.width, 2);
    expect(longBox.height / longBox.width).not.toBeCloseTo(shortBox.height / shortBox.width, 2);
    const cardigan = sleeveSilhouette(sleeveDiagram(SLEEVE_EXAMPLE, "cardigan"));
    const pullover = sleeveSilhouette(sleeveDiagram(SLEEVE_EXAMPLE, "pullover"));
    expect(pullover.upperWidth).toBeCloseTo(cardigan.upperWidth, 4);
    expect(pullover.wristWidth).toBeCloseTo(cardigan.wristWidth, 4);
    expect(pullover.length).toBeCloseTo(cardigan.length, 4);
  });
});

function sleeveSilhouette(svg: string): {
  upperWidth: number;
  wristWidth: number;
  length: number;
  midX: number;
} {
  const d = /data-role="sleeve-outline"[^>]*\bd="([^"]+)"/.exec(svg)?.[1] ?? "";
  const nums = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i];
    const y = nums[i + 1];
    if (x === undefined || y === undefined) continue;
    points.push({ x, y });
  }
  const ys = points.map((point) => point.y);
  const top = Math.min(...ys);
  const bottom = Math.max(...ys);
  const topPts = points.filter((point) => Math.abs(point.y - top) < 0.05);
  const bottomPts = points.filter((point) => Math.abs(point.y - bottom) < 0.05);
  const upperLeft = Math.min(...topPts.map((point) => point.x));
  const upperRight = Math.max(...topPts.map((point) => point.x));
  return {
    upperWidth: upperRight - upperLeft,
    wristWidth: Math.max(...bottomPts.map((point) => point.x)) - Math.min(...bottomPts.map((point) => point.x)),
    length: bottom - top,
    midX: (upperLeft + upperRight) / 2,
  };
}

function targetPoint(svg: string, id: string): { cx: number; cy: number } {
  const match = new RegExp(`<circle id="${id}" cx="([^"]+)" cy="([^"]+)"`).exec(svg);
  return { cx: Number(match?.[1]), cy: Number(match?.[2]) };
}

function parseViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const vb = /viewBox="([^"]+)"/.exec(svg);
  if (!vb) return null;
  const parts = vb[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [x, y, width, height] = parts;
  if (!(width > 0) || !(height > 0)) return null;
  return { x, y, width, height };
}

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

function textLineBoxes(svg: string): Array<{
  group: number;
  text: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}> {
  const boxes = [];
  let group = 0;
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = match[1] ?? "";
    const inner = match[2] ?? "";
    const anchor = /text-anchor="([^"]+)"/.exec(attrs)?.[1] ?? "start";
    const baseSize = Number(/font-size="([^"]+)"/.exec(attrs)?.[1]) || 16;
    const baseX = Number(/\bx="([^"]+)"/.exec(attrs)?.[1]);
    let y = Number(/\by="([^"]+)"/.exec(attrs)?.[1]);
    const tspans = [...inner.matchAll(/<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g)];
    const lines = tspans.length
      ? tspans.map((span) => {
          const spanAttrs = span[1] ?? "";
          y += Number(/dy="([^"]+)"/.exec(spanAttrs)?.[1]) || 0;
          return {
            text: (span[2] ?? "").replace(/<[^>]+>/g, "").trim(),
            x: Number(/\bx="([^"]+)"/.exec(spanAttrs)?.[1]) || baseX,
            y,
            size: Number(/font-size="([^"]+)"/.exec(spanAttrs)?.[1]) || baseSize,
          };
        })
      : [{ text: inner.replace(/<[^>]+>/g, "").trim(), x: baseX, y, size: baseSize }];
    for (const line of lines) {
      const width = line.text.length * line.size * 0.55;
      const left = anchor === "end" ? line.x - width : anchor === "middle" ? line.x - width / 2 : line.x;
      boxes.push({
        group,
        text: line.text,
        left,
        right: left + width,
        top: line.y - line.size * 0.85,
        bottom: line.y + line.size * 0.25,
      });
    }
    group += 1;
  }
  return boxes;
}

function diagramGeometryStaysInsideViewBox(svg: string): boolean {
  const vb = parseViewBox(svg);
  if (!vb) return false;
  const pad = 0.5;
  const attrs = [...svg.matchAll(/\b(?:x|x1|x2|cx)="([^"]+)"/g)];
  const ys = [...svg.matchAll(/\b(?:y|y1|y2|cy)="([^"]+)"/g)];
  for (const m of attrs) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < vb.x - pad || n > vb.x + vb.width + pad) return false;
  }
  for (const m of ys) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < vb.y - pad || n > vb.y + vb.height + pad) return false;
  }
  return true;
}

