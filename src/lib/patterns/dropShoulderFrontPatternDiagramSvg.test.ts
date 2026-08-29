import { describe, expect, it } from "vitest";
import {
  buildDropShoulderFrontStitchesRowsSvg,
  tryBuildLiveDropShoulderFrontStsRowsDiagramSvg,
} from "./dropShoulderFrontPatternDiagramSvg";
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
    expect(svg).toContain('data-ds-front-sts-rows-generated="true"');
    expect(svg).toContain('data-neckline="round"');
    expect(svg).toContain('data-garment="pullover"');
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain("FRONT");
    expect(svg).toContain('width="100%"');
    expect(svg).toContain('height="auto"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(svg).not.toContain("generated preview");
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

describe("tryBuildLiveDropShoulderFrontStsRowsDiagramSvg", () => {
  it("returns live generated SVG for pullover round, V-neck, and cardigan", () => {
    const round = kids10YrRelaxedArmhole36Pattern();
    expect(
      tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
        generateDropShoulderPattern(round),
        round,
        "in",
      ),
    ).toContain('data-neckline="round"');

    const vneck = withStyle(round, { neckline: "v-neck" });
    expect(
      tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
        generateDropShoulderPattern(vneck),
        vneck,
        "in",
      ),
    ).toContain('data-neckline="v"');

    const cardigan = withStyle(round, { frontStyle: "open", garmentStyle: "cardigan" });
    const cardiganSvg = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
      generateDropShoulderPattern(cardigan),
      cardigan,
      "in",
    );
    expect(cardiganSvg).toContain('data-garment="cardigan"');
    expect(cardiganSvg).toContain("LEFT FRONT");
  });

  it("returns live generated SVG for A-line body", () => {
    const aline = withStyle(kids10YrRelaxedArmhole36Pattern(), { bodyShape: "aline" });
    const withHip = {
      ...aline,
      fit: {
        ...(aline.fit as Record<string, unknown>),
        selectedMeasurements: {
          ...((aline.fit as { selectedMeasurements?: Record<string, number> }).selectedMeasurements ??
            {}),
          finished_hip: 32,
          finished_bust_chest: 28,
        },
      },
    };
    const live = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(
      generateDropShoulderPattern(withHip),
      withHip,
      "in",
    );
    expect(live).toBeTruthy();
    expect(live).toContain('data-body-shape="aline"');
    const hem = Number(/data-hem-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    const body = Number(/data-body-width-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    expect(hem).toBeGreaterThan(body);
  });

  it("returns live generated SVG for shaped body (hem narrower than bust)", () => {
    const shaped = withStyle(kids10YrRelaxedArmhole36Pattern(), { bodyShape: "shaped" });
    const withHip = {
      ...shaped,
      fit: {
        ...(shaped.fit as Record<string, unknown>),
        selectedMeasurements: {
          ...((shaped.fit as { selectedMeasurements?: Record<string, number> }).selectedMeasurements ??
            {}),
          finished_hip: 24,
          finished_bust_chest: 28,
        },
      },
    };
    const result = generateDropShoulderPattern(withHip);
    const live = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, withHip, "in");
    expect(live).toBeTruthy();
    expect(live).toContain('data-ds-front-sts-rows-generated="true"');
    expect(live).toContain('data-body-shape="shaped"');
    const hem = Number(/data-hem-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    const body = Number(/data-body-width-stitches="(\d+)"/.exec(live ?? "")?.[1]);
    expect(hem).toBeGreaterThan(0);
    expect(hem).toBeLessThan(body);
  });
});
