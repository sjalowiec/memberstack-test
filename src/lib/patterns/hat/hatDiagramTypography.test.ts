import { describe, expect, it } from "vitest";
import {
  HAT_DIAGRAM_FONT_FAMILY,
  HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH,
  HAT_DIAGRAM_SECTION_WEIGHT,
  HAT_DIAGRAM_TYPE,
  hatDiagramFontSize,
  hatDiagramTypographyForViewBox,
} from "./hatDiagramTypography";
import {
  HAT_SHAPING_NOTATION_TYPE,
  HAT_SHAPING_NOTATION_VIEWBOX,
  buildHatShapingNotationDiagramSvg,
} from "./hatShapingNotationDiagramSvg";
import { buildHatPatternDiagramSvg } from "./hatPatternDiagramSvg";
import { calculateHatPattern, buildFourWedgeCrownSetup } from "./hatMath";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
};

function calcFor(overrides: Partial<Parameters<typeof calculateHatPattern>[0]> = {}) {
  return calculateHatPattern({
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
    ...overrides,
  });
}

describe("hatDiagramTypography", () => {
  it("uses Poppins stack and section weight 600 as shared tokens", () => {
    expect(HAT_DIAGRAM_FONT_FAMILY).toContain("Poppins");
    expect(HAT_DIAGRAM_SECTION_WEIGHT).toBe(600);
    expect(HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH).toBe(430);
  });

  it("keeps Stitches & Rows sizes as the canonical reference", () => {
    const sts = hatDiagramTypographyForViewBox(HAT_DIAGRAM_REFERENCE_VIEWBOX_WIDTH);
    expect(sts.section).toBe(23);
    expect(sts.crownTitle).toBe(21);
    expect(sts.measure).toBe(21);
    expect(sts.detail).toBe(18);
    expect(sts.gore).toBe(20);
    expect(sts.small).toBe(18);
    expect(sts.sectionWeight).toBe(600);
  });

  it("scales shaping-notation sizes so visual size matches at width:100%", () => {
    const jpW = HAT_SHAPING_NOTATION_VIEWBOX.width;
    expect(jpW).toBe(400);
    // visual ∝ fontSize / viewBoxWidth — equal visuals ⇒ jp = sts * (400/430)
    expect(hatDiagramFontSize("section", jpW)).toBe(Math.round(23 * (400 / 430)));
    expect(hatDiagramFontSize("crownTitle", jpW)).toBe(Math.round(21 * (400 / 430)));
    expect(hatDiagramFontSize("measure", jpW)).toBe(Math.round(21 * (400 / 430)));
    expect(hatDiagramFontSize("detail", jpW)).toBe(Math.round(18 * (400 / 430)));
    expect(hatDiagramFontSize("gore", jpW)).toBe(Math.round(20 * (400 / 430)));
    expect(hatDiagramFontSize("small", jpW)).toBe(Math.round(18 * (400 / 430)));

    expect(HAT_SHAPING_NOTATION_TYPE.section).toBe(hatDiagramFontSize("section", jpW));
    expect(HAT_SHAPING_NOTATION_TYPE.crownTitle).toBe(hatDiagramFontSize("crownTitle", jpW));
    expect(HAT_SHAPING_NOTATION_TYPE.measure).toBe(hatDiagramFontSize("measure", jpW));
    expect(HAT_SHAPING_NOTATION_TYPE.detail).toBe(hatDiagramFontSize("detail", jpW));
    expect(HAT_SHAPING_NOTATION_TYPE.gore).toBe(hatDiagramFontSize("gore", jpW));
    expect(HAT_SHAPING_NOTATION_TYPE.fontFamily).toBe(HAT_DIAGRAM_FONT_FAMILY);
  });

  it("keeps hierarchy: section ≥ crownTitle ≥ gore ≥ detail", () => {
    const t = HAT_SHAPING_NOTATION_TYPE;
    expect(t.section).toBeGreaterThanOrEqual(t.crownTitle);
    expect(t.crownTitle).toBeGreaterThanOrEqual(t.gore);
    expect(t.gore).toBeGreaterThanOrEqual(t.detail);
    expect(t.measure).toBeGreaterThanOrEqual(t.detail);
    // Essential labels must not sit at the old tiny annotation sizes.
    expect(t.section).toBeGreaterThan(18);
    expect(t.gore).toBeGreaterThan(14);
    expect(t.measure).toBeGreaterThan(14);
  });
});

describe("hat diagram SVG typography parity", () => {
  it("embeds matching family/weight and scaled sizes on equivalent labels", () => {
    const calc = calcFor({ crown: "wedge-4-decrease", brimType: "single" });
    calc.fourWedgeCrownSetup = buildFourWedgeCrownSetup({
      castOnSts: calc.castOnSts,
      crown: calc.crown,
      brimRows: calc.brimRows,
      bodyRows: calc.bodyRows,
    });
    const sts = buildHatPatternDiagramSvg(calc, "inches", formatters);
    const shaping = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const jp = HAT_SHAPING_NOTATION_TYPE;

    expect(sts).toContain(`font-family="${HAT_DIAGRAM_FONT_FAMILY}"`);
    expect(shaping).toContain(`font-family="${HAT_DIAGRAM_FONT_FAMILY}"`);

    expect(sts).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.section}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Body<`,
      ),
    );
    expect(shaping).toMatch(
      new RegExp(`font-size="${jp.section}" font-weight="${jp.sectionWeight}">Body<`),
    );

    expect(sts).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.section}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Brim<`,
      ),
    );
    expect(shaping).toMatch(
      new RegExp(
        `font-size="${jp.section}" font-weight="${jp.sectionWeight}">Single Layer<`,
      ),
    );

    expect(sts).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.crownTitle}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Crown · 4 gores<`,
      ),
    );
    // Four-gore shaping uses instruction lines (measure), not a Crown · title —
    // gathered/swirl still use crownTitle; gore numbers use gore size.
    expect(shaping).toMatch(new RegExp(`font-size="${jp.gore}"[^>]*>#1<`));
    expect(sts).toMatch(new RegExp(`font-size="${HAT_DIAGRAM_TYPE.gore}"[^>]*>#1<`));

    expect(shaping).toMatch(
      new RegExp(`hat-shaping-diagram__gore-start[^>]*font-size="${jp.detail}"`),
    );
    expect(shaping).toMatch(
      new RegExp(`hat-shaping-diagram__cast-on[^>]*font-size="${jp.measure}"`),
    );
    expect(shaping).toMatch(
      new RegExp(`hat-shaping-diagram__crown-begin-rc[^>]*font-size="${jp.measure}"`),
    );
    expect(shaping).toContain(`font-size="${jp.measure}"`);
    // No leftover tiny annotation sizes for essential labels.
    expect(shaping).not.toMatch(/font-size="13"/);
    expect(shaping).not.toMatch(/font-size="14"/);
  });

  it("gathered crown heading uses crownTitle scale on both diagrams", () => {
    const calc = calcFor({ crown: "gathered" });
    const sts = buildHatPatternDiagramSvg(calc, "inches", formatters);
    const shaping = buildHatShapingNotationDiagramSvg(calc, "inches", formatters);
    const jp = HAT_SHAPING_NOTATION_TYPE;

    expect(sts).toMatch(
      new RegExp(
        `font-size="${HAT_DIAGRAM_TYPE.crownTitle}" font-weight="${HAT_DIAGRAM_SECTION_WEIGHT}">Gather<`,
      ),
    );
    expect(shaping).toMatch(
      new RegExp(
        `font-size="${jp.crownTitle}" font-weight="${jp.sectionWeight}">Crown<`,
      ),
    );
  });
});
