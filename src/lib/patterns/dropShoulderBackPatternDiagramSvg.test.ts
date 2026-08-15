import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDropShoulderBackStitchesRowsSvg } from "./dropShoulderBackPatternDiagramSvg";
import {
  kids10YrRelaxedArmhole36Pattern,
  kids10YrRelaxedDropShoulderPattern,
} from "./dropShoulderDiagramReviewFixtures";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBackStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import { lengthFromRowsForDiagram } from "./sleevelessRowAccounting";

const WOMEN_STRAIGHT = {
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
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

describe("buildDropShoulderBackStitchesRowsModel", () => {
  it("copies stitch and row counts from the pattern result (no new math)", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const model = buildDropShoulderBackStitchesRowsModel(result, "in");
    expect(model).not.toBeNull();
    expect(model!.hemStitches).toBe(
      Math.round(result.debug.hemCastOnStitches || result.debug.backStitches),
    );
    expect(model!.bodyWidthStitches).toBe(Math.round(result.debug.backStitches));
    expect(model!.necklineStitches).toBe(Math.round(result.debug.necklineStitches ?? 0));
    expect(model!.shoulderStitchesEach).toBe(Math.round(result.debug.shoulderStitches ?? 0));
    expect(model!.hemRows).toBe(Math.round(result.debug.hemRows));
    expect(model!.bodyRowsToArmhole).toBe(Math.round(result.debug.bodyRows));
    expect(model!.armholeRows).toBe(Math.round(result.debug.armholeRows));
    expect(model!.backNeckDepthRows).toBe(Math.round(result.debug.backNeckDepthRows));
  });

  it("keeps post-reset neckline rows inside the armhole span", () => {
    const result = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    expect(model.necklineRowsInsideArmhole + model.armholeEvenRows).toBe(model.armholeRows);
    expect(model.necklineRowsInsideArmhole).toBe(model.backNeckDepthRows);
    expect(model.necklineRowsInsideArmhole).toBeLessThan(model.armholeRows);
  });
});

describe("buildDropShoulderBackStitchesRowsSvg", () => {
  it("Kids 10 relaxed at 21/32 over 4 in: armhole span uses full debug.armholeRows", () => {
    const result = generateDropShoulderPattern(kids10YrRelaxedDropShoulderPattern());
    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    const svg = buildDropShoulderBackStitchesRowsSvg(model);

    expect(model.armholeRows).toBe(result.debug.armholeRows);
    expect(svg).toContain(`data-armhole-rows="${result.debug.armholeRows}"`);
    expect(model.necklineRowsInsideArmhole + model.armholeEvenRows).toBe(model.armholeRows);
    expect(svg).toContain(`data-neckline-rows-inside-armhole="${model.necklineRowsInsideArmhole}"`);
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain(model.armholeDepthLabel);
    expect(svg).toContain(`data-hem-stitches="${result.debug.hemCastOnStitches ?? result.debug.backStitches}"`);
    expect(svg).toContain(`data-neckline-stitches="${Math.round(result.debug.necklineStitches ?? 0)}"`);
    expect(svg).toContain(`data-shoulder-stitches="${Math.round(result.debug.shoulderStitches ?? 0)}"`);
    expect(svg).toContain(`data-hem-rows="${Math.round(result.debug.hemRows)}"`);
    expect(svg).toContain(`data-body-rows="${Math.round(result.debug.bodyRows)}"`);
    expect(svg).toContain(model.hemStitchesLabel);
    expect(svg).toContain(model.shoulderStitchesLabel);
    expect(svg).not.toMatch(/\bNaN\b/);
  });

  it("review example: Armhole depth 36 rows / 4.5 in as one span with neckline inside", () => {
    const result = generateDropShoulderPattern(kids10YrRelaxedArmhole36Pattern());
    expect(result.debug.armholeRows).toBe(36);
    expect(result.debug.rowsPerInch).toBe(8);
    expect(lengthFromRowsForDiagram(36, 8, "in")).toBe(4.5);
    expect(result.debug.backNeckDepthRows).toBe(8);

    const model = buildDropShoulderBackStitchesRowsModel(result, "in")!;
    expect(model.armholeRows).toBe(36);
    expect(model.necklineRowsInsideArmhole).toBe(8);
    expect(model.armholeEvenRows).toBe(28);
    expect(model.armholeDepthLabel).toBe("36 rows / 4.5 in");

    const svg = buildDropShoulderBackStitchesRowsSvg(model);
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain("36 rows / 4.5 in");
    expect(svg).toContain('data-armhole-rows="36"');
    expect(svg).toContain('data-neckline-rows-inside-armhole="8"');
    expect(svg).toContain('data-armhole-even-rows="28"');
    expect(svg).toContain('data-armhole-marker="true"');
    expect(svg).toContain('data-body-width="true"');
    expect(svg).toContain('data-neckline-width-dim="true"');
    expect(svg).toContain('data-neckline-depth-dim="true"');
    expect(svg).toContain(model.bodyWidthLabel);
    expect(svg).toContain(model.necklineWidthLabel);
    expect(svg).toContain(model.necklineDepthLabel);
  });

  it("does not change Drop Shoulder calculation output", () => {
    const a = generateDropShoulderPattern(WOMEN_STRAIGHT);
    const b = generateDropShoulderPattern(WOMEN_STRAIGHT);
    expect(a.debug).toEqual(b.debug);
    expect(a.lines).toEqual(b.lines);
    const model = buildDropShoulderBackStitchesRowsModel(a, "in")!;
    buildDropShoulderBackStitchesRowsSvg(model);
    const c = generateDropShoulderPattern(WOMEN_STRAIGHT);
    expect(c.debug).toEqual(a.debug);
    expect(c.lines).toEqual(a.lines);
  });
});

describe("Drop Shoulder pattern page wiring (Stage 1)", () => {
  it("mounts the generated Back Stitches & Rows SVG beside the legacy diagram", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    expect(pageScript).toContain("buildDropShoulderBackStitchesRowsModel");
    expect(pageScript).toContain("buildDropShoulderBackStitchesRowsSvg");
    expect(pageScript).toContain("buildDropShoulderFrontStitchesRowsModel");
    expect(pageScript).toContain("buildDropShoulderFrontStitchesRowsSvg");
    expect(pageScript).toContain("appendGeneratedDropShoulderFrontStsRowsCompare");
    expect(pageScript).toContain("data-ds-generated-front-compare");
    expect(pageScript).toContain("no-print");
  });
});
