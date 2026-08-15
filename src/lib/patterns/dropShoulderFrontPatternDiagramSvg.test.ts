import { describe, expect, it } from "vitest";
import { buildDropShoulderFrontStitchesRowsSvg } from "./dropShoulderFrontPatternDiagramSvg";
import {
  kids10YrRelaxedArmhole36Pattern,
} from "./dropShoulderDiagramReviewFixtures";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderFrontStitchesRowsModel } from "./dropShoulderPatternDiagramModel";

function withStyle(
  base: Record<string, unknown>,
  styleOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const style = (base.style ?? {}) as Record<string, unknown>;
  return { ...base, style: { ...style, ...styleOverrides } };
}

describe("buildDropShoulderFrontStitchesRowsModel", () => {
  it("keeps front neck rows inside the armhole span", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.necklineRowsInsideArmhole + model.armholeEvenRows).toBe(model.armholeRows);
    expect(model.frontNeckDepthRows).toBe(result.debug.frontNeckDepthRows);
    expect(model.necklineRowsInsideArmhole).toBeLessThanOrEqual(model.armholeRows);
  });

  it("uses half-panel stitch counts from debug for cardigan", () => {
    const pattern = withStyle(kids10YrRelaxedArmhole36Pattern(), {
      frontStyle: "open",
      garmentStyle: "cardigan",
    });
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.garment).toBe("cardigan");
    expect(model.hemStitches).toBe(result.debug.cardiganHalfLeftCastOnSts);
    expect(model.bodyWidthStitches).toBe(result.debug.cardiganHalfLeftStitchesAfterArmhole);
    expect(model.hemStitches).toBeLessThan(result.debug.hemCastOnStitches ?? result.debug.backStitches);
  });
});

describe("buildDropShoulderFrontStitchesRowsSvg", () => {
  it("round pullover reads as round and uses the live renderer", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(svg).toContain('data-ds-front-diagram="sts-rows"');
    expect(svg).toContain('data-neckline="round"');
    expect(svg).toContain('data-garment="pullover"');
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain("FRONT");
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("V-neck pullover geometry is tagged as v", () => {
    const pattern = withStyle(kids10YrRelaxedArmhole36Pattern(), { neckline: "v-neck" });
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.neckline).toBe("v");
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(svg).toContain('data-neckline="v"');
    expect(svg).toContain("FRONT");
    expect(svg).not.toContain("LEFT FRONT");
  });

  it("cardigan V-neck shows a half panel with CF", () => {
    const pattern = withStyle(kids10YrRelaxedArmhole36Pattern(), {
      neckline: "v-neck",
      frontStyle: "open",
      garmentStyle: "cardigan",
    });
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(svg).toContain('data-garment="cardigan"');
    expect(svg).toContain('data-neckline="v"');
    expect(svg).toContain("LEFT FRONT");
    expect(svg).toContain(">CF<");
  });

  it("does not change Drop Shoulder calculation output", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const a = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(a, pattern, "in")!;
    buildDropShoulderFrontStitchesRowsSvg(model);
    const b = generateDropShoulderPattern(pattern);
    expect(b.debug).toEqual(a.debug);
    expect(b.lines).toEqual(a.lines);
  });
});
