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
import { tryBuildLiveDropShoulderBackStsRowsDiagramSvg } from "./dropShoulderBackPatternDiagramSvg";
import {
  buildDropShoulderFrontCardiganLeftFrame,
  buildDropShoulderFrontFullWidthFrame,
  dropShoulderFrontNecklineDeepestY,
  dropShoulderFrontPulloverRoundNeckControlY,
  dropShoulderYAtGarmentRc,
  endCap,
  fmtNum,
} from "./dropShoulderPatternDiagramSvgShared";

function withStyle(
  base: Record<string, unknown>,
  styleOverrides: Record<string, unknown>,
): Record<string, unknown> {
  const style = (base.style ?? {}) as Record<string, unknown>;
  return { ...base, style: { ...style, ...styleOverrides } };
}

describe("buildDropShoulderFrontStitchesRowsModel", () => {
  it("labels the actual Front neck rows (shallow necks still sit inside the armhole span)", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.necklineRowsInsideArmhole).toBe(model.frontNeckDepthRows);
    expect(model.frontNeckDepthRows).toBe(result.debug.frontNeckDepthRows);
    expect(model.armholeEvenRows).toBe(Math.max(0, model.armholeRows - model.frontNeckDepthRows));
    expect(model.frontNeckDepthRows).toBeLessThanOrEqual(model.armholeRows);
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

function neckDepthGroup(svg: string): string {
  return /<g data-neckline-depth-dim="true"[^>]*>[\s\S]*?<\/g>/.exec(svg)?.[0] ?? "";
}

function castOnGroup(svg: string): string {
  return /<g[^>]*data-cast-on-width="true"[^>]*>[\s\S]*?<\/g>/.exec(svg)?.[0] ?? "";
}

function deepFrontPattern(neckline: string = "round", extras: Record<string, unknown> = {}) {
  return {
    fit: {
      sizingChart: "women",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 24,
        upper_arm: 16,
        wrist: 8,
        sleeve_length: 12,
        shoulder_width: 16,
        neck_opening: 7,
        back_neck_depth: 1,
        front_neck_depth: 12,
      },
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
    style: {
      construction: "drop-shoulder",
      frontStyle: extras.frontStyle ?? "closed",
      garmentStyle: extras.garmentStyle ?? "pullover",
      neckline,
    },
  };
}

describe("Front Stitches & Rows neckline depth and cast-on placement", () => {
  it("neckline-depth dimension uses the same deepest Y as the drawn round neck", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    const deepest = dropShoulderFrontNecklineDeepestY(frame, "pullover", "round");
    const group = neckDepthGroup(svg);
    expect(group).toContain(`data-neck-depth-top-y="${fmtNum(frame.top)}"`);
    expect(group).toContain(`data-neck-depth-bottom-y="${fmtNum(deepest)}"`);
    expect(group).toContain(`y2="${fmtNum(deepest)}"`);
    expect(deepest).toBeCloseTo(frame.neckBottomY, 5);
    expect(svg).toContain(
      `Q ${fmtNum(frame.midX)} ${fmtNum(dropShoulderFrontPulloverRoundNeckControlY(frame))}`,
    );
  });

  it("attaches the neckline depth label to the neckline dimension, not a mid-body width line", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.necklineDepthLabel).toMatch(/72 rows \/ 12 in/);
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    const group = neckDepthGroup(svg);
    expect(group).toContain("72 rows / 12 in");
    expect(group).toContain("data-neckline-depth-label");
    expect(group).toContain("rotate(-90)");
    expect(svg).not.toContain('data-body-width="true"');
    expect(svg).not.toMatch(/data-body-width="true"[\s\S]{0,400}72 rows \/ 12 in/);
  });

  it("renders cast-on width at the bottom edge and does not keep a mid-body width dim", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    const group = castOnGroup(svg);
    expect(group.length).toBeGreaterThan(0);
    expect(group).toContain(model.hemStitchesLabel);
    const y = Number(/data-cast-on-y="([^"]+)"/.exec(group)?.[1]);
    expect(y).toBeGreaterThan(frame.bottom);
    expect(svg).not.toContain('class="ds-diagram__body-width"');
    expect(group).toContain("<rect");
    expect(group).not.toContain("polygon");
  });

  it("deep 12-inch Front still reports 72 rows / 12 in", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.frontNeckDepthRows).toBe(72);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    expect(model.necklineDepthLabel).toBe("72 rows / 12 in");
    expect(buildDropShoulderFrontStitchesRowsSvg(model)).toContain("72 rows / 12 in");
  });

  it("round scoop deepest Y equals row-scaled neckBottomY for the 72-row / 12-in Front", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const totalRows = model.hemRows + model.bodyRowsToArmhole + model.armholeRows;
    const neckStartRc = totalRows - model.frontNeckDepthRows;
    const expectedY = dropShoulderYAtGarmentRc(neckStartRc, {
      hemRows: model.hemRows,
      bodyRowsToArmhole: model.bodyRowsToArmhole,
      armholeRows: model.armholeRows,
      top: frame.top,
      armholeMarkerY: frame.armholeMarkerY,
      hemTopY: frame.hemTopY,
      bottom: frame.bottom,
    });
    const deepest = dropShoulderFrontNecklineDeepestY(frame, "pullover", "round");
    expect(model.frontNeckDepthRows).toBe(72);
    expect(frame.neckBottomY).toBeCloseTo(expectedY, 5);
    expect(deepest).toBeCloseTo(frame.neckBottomY, 5);
    expect(neckDepthGroup(buildDropShoulderFrontStitchesRowsSvg(model))).toContain(
      `data-neck-depth-bottom-y="${fmtNum(deepest)}"`,
    );
  });

  it("does not change Back round scoop control (legacy 1.15 Q)", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const back = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, pattern, "in")!;
    const front = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in")!;
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const frontCtrl = dropShoulderFrontPulloverRoundNeckControlY(frame);
    const backCtrl = frame.top + (frame.neckBottomY - frame.top) * 1.15;
    expect(front).toContain(`Q ${fmtNum(frame.midX)} ${fmtNum(frontCtrl)}`);
    expect(back).not.toContain(`Q ${fmtNum(frame.midX)} ${fmtNum(frontCtrl)}`);
    expect(frontCtrl).not.toBeCloseTo(backCtrl, 2);
  });

  it("shallower Front neckline still lays out with along-line depth and bottom cast-on", () => {
    const pattern = kids10YrRelaxedArmhole36Pattern();
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(model.frontNeckDepthRows).toBeLessThanOrEqual(model.armholeRows);
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const deepest = dropShoulderFrontNecklineDeepestY(frame, "pullover", "round");
    expect(deepest).toBeCloseTo(frame.neckBottomY, 5);
    expect(neckDepthGroup(svg)).toContain(`data-neck-depth-bottom-y="${fmtNum(deepest)}"`);
    expect(neckDepthGroup(svg)).toContain("rotate(-90)");
    expect(neckDepthGroup(svg)).toContain(model.necklineDepthLabel);
    expect(castOnGroup(svg)).toContain(model.hemStitchesLabel);
    expect(svg).not.toContain('data-body-width="true"');
  });

  it("V-neck depth dim ends at the drawn V point (neckBottomY)", () => {
    const pattern = deepFrontPattern("v-neck");
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontFullWidthFrame(model);
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(model.neckline).toBe("v");
    const deepest = dropShoulderFrontNecklineDeepestY(frame, "pullover", "v");
    expect(deepest).toBe(frame.neckBottomY);
    expect(neckDepthGroup(svg)).toContain(`data-neck-depth-bottom-y="${fmtNum(deepest)}"`);
    expect(svg).toContain(`L ${fmtNum(frame.midX)} ${fmtNum(frame.neckBottomY)}`);
  });

  it("cardigan Front keeps CF layout with neck depth on the opening and cast-on at the hem", () => {
    const pattern = deepFrontPattern("round", { frontStyle: "open", garmentStyle: "cardigan" });
    const result = generateDropShoulderPattern(pattern);
    const model = buildDropShoulderFrontStitchesRowsModel(result, pattern, "in")!;
    const frame = buildDropShoulderFrontCardiganLeftFrame(model, model.shoulderStitchesEach);
    const svg = buildDropShoulderFrontStitchesRowsSvg(model);
    expect(svg).toContain("LEFT FRONT");
    expect(svg).toContain(">CF<");
    const deepest = dropShoulderFrontNecklineDeepestY(frame, "cardigan", "round");
    expect(deepest).toBe(frame.neckBottomY);
    expect(neckDepthGroup(svg)).toContain(`data-neck-depth-bottom-y="${fmtNum(deepest)}"`);
    expect(castOnGroup(svg)).toContain(model.hemStitchesLabel);
    expect(svg).not.toContain('data-body-width="true"');
  });

  it("does not change Back: mid-body width dim and default neck-depth label placement remain", () => {
    const pattern = deepFrontPattern();
    const result = generateDropShoulderPattern(pattern);
    const back = tryBuildLiveDropShoulderBackStsRowsDiagramSvg(result, pattern, "in")!;
    const front = tryBuildLiveDropShoulderFrontStsRowsDiagramSvg(result, pattern, "in")!;
    expect(back).toContain('data-body-width="true"');
    expect(front).not.toContain('data-body-width="true"');
    const backDepth = neckDepthGroup(back);
    expect(backDepth).not.toContain("rotate(-90)");
    expect(backDepth).toContain("data-neckline-depth-label");
    expect(endCap(10, 20, true)).toContain("<rect");
    expect(neckDepthGroup(front)).toContain("<rect");
  });
});
