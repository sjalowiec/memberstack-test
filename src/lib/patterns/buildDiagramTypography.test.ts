import { describe, expect, it } from "vitest";
import { calculateHatPattern, buildFourWedgeCrownSetup } from "./hat/hatMath";
import {
  HAT_DIAGRAM_FONT_FAMILY,
  HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH,
  HAT_DIAGRAM_SECTION_WEIGHT,
  HAT_DIAGRAM_TYPE,
  hatDiagramFontSize,
} from "./hat/hatDiagramTypography";
import { buildHatPatternDiagramSvg } from "./hat/hatPatternDiagramSvg";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../components/wizards/utils/unitHelpers";
import {
  BUILD_DIAGRAM_DESKTOP_ART_PX,
  BUILD_DIAGRAM_TYPE_FLOOR,
  BUILD_DIAGRAM_TYPE_WEIGHT,
  buildDiagramFontSize,
  buildDiagramOnScreenPx,
  buildDiagramTypographyForViewBox,
} from "./buildDiagramTypography";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

describe("build diagram typography", () => {
  it("uses larger Build/Edit floors than Hat and keeps value above name above support", () => {
    expect(BUILD_DIAGRAM_TYPE_FLOOR.value).toBeGreaterThan(HAT_DIAGRAM_TYPE.measure);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.name).toBeGreaterThan(HAT_DIAGRAM_TYPE.small);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.support).toBeGreaterThanOrEqual(HAT_DIAGRAM_TYPE.small);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.value).toBe(44);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.name).toBe(32);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.support).toBe(24);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.section).toBe(BUILD_DIAGRAM_TYPE_FLOOR.name);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.value).toBeGreaterThan(BUILD_DIAGRAM_TYPE_FLOOR.name);
    expect(BUILD_DIAGRAM_TYPE_FLOOR.name).toBeGreaterThan(BUILD_DIAGRAM_TYPE_FLOOR.support);

    const atReference = buildDiagramTypographyForViewBox(HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH);
    expect(atReference.fontFamily).toBe(HAT_DIAGRAM_FONT_FAMILY);
    expect(atReference.value).toBe(44);
    expect(atReference.name).toBe(32);
    expect(atReference.support).toBe(24);
    expect(atReference.section).toBe(32);
    expect(atReference.valueWeight).toBe(BUILD_DIAGRAM_TYPE_WEIGHT.value);
    expect(atReference.nameWeight).toBe(BUILD_DIAGRAM_TYPE_WEIGHT.name);
    expect(atReference.supportWeight).toBe(BUILD_DIAGRAM_TYPE_WEIGHT.support);
    expect(atReference.valueWeight).toBeGreaterThan(atReference.nameWeight);
    expect(atReference.nameWeight).toBeGreaterThan(atReference.supportWeight);
    expect(atReference.value).toBeGreaterThan(atReference.name);
    expect(atReference.name).toBeGreaterThan(atReference.support);
    expect(atReference.valueLineGap).toBeGreaterThan(atReference.name);
  });

  it("scales each role with the Hat viewBox formula, not Hat's role floors", () => {
    for (const width of [400, 430, 550, 696, 860]) {
      const type = buildDiagramTypographyForViewBox(width);
      expect(buildDiagramFontSize("value", width)).toBe(
        Math.max(1, Math.round(BUILD_DIAGRAM_TYPE_FLOOR.value * (width / HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH))) ||
          BUILD_DIAGRAM_TYPE_FLOOR.value,
      );
      if (width === HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH) {
        expect(type.value).toBe(BUILD_DIAGRAM_TYPE_FLOOR.value);
      } else {
        expect(type.value).toBe(
          Math.max(1, Math.round((BUILD_DIAGRAM_TYPE_FLOOR.value * width) / HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH)),
        );
      }
      expect(type.value).toBeGreaterThan(type.name);
      expect(type.name).toBeGreaterThan(type.support);
      expect(type.section).toBe(type.name);
      expect(type.value).toBeGreaterThan(hatDiagramFontSize("measure", width));
      expect(type.name).toBeGreaterThan(hatDiagramFontSize("small", width));
    }
  });

  it("reads larger than Hat on a desktop diagram width", () => {
    const type = buildDiagramTypographyForViewBox(HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH);
    const valuePx = buildDiagramOnScreenPx(type.value, type.viewBoxWidth);
    const namePx = buildDiagramOnScreenPx(type.name, type.viewBoxWidth);
    const supportPx = buildDiagramOnScreenPx(type.support, type.viewBoxWidth);
    const hatValuePx = buildDiagramOnScreenPx(HAT_DIAGRAM_TYPE.measure, HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH);
    expect(valuePx).toBeGreaterThan(hatValuePx);
    expect(valuePx).toBeGreaterThan(namePx);
    expect(namePx).toBeGreaterThan(supportPx);
    expect(supportPx).toBeGreaterThan(16);
    expect(BUILD_DIAGRAM_DESKTOP_ART_PX).toBe(750);
  });

  it("leaves Hat diagram output on the original role sizes", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 2,
      brimType: "single",
      crown: "wedge-4-decrease",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    calc.fourWedgeCrownSetup = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    const svg = buildHatPatternDiagramSvg(calc, "inches", formatters);
    expect(svg).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.section}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Body<`,
      ),
    );
    expect(svg).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.section}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Brim<`,
      ),
    );
    expect(svg).toMatch(new RegExp(`font-size="${HAT_DIAGRAM_TYPE.measure}"`));
    expect(svg).not.toContain("data-build-type-role");
    expect(svg).not.toContain("data-build-diagram-type-width");
  });
});
