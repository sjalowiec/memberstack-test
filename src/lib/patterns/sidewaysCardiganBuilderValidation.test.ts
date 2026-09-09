import { describe, expect, it } from "vitest";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  requiredNeedlesForSidewaysCardiganBody,
  validateSidewaysCardiganBuilder,
  validateSidewaysCardiganNeedles,
} from "./sidewaysCardiganBuilderValidation";
import { formatBustAdjustmentMessage, formatInchesForDisplay } from "./sidewaysCardiganDisplayFormat";

const VALID = {
  chartAudience: "misses",
  selectedSize: "8",
  fit: "standard",
  sleeveDirection: "cuff-up",
  finishedLengthInches: 25,
  vNeckDepthInches: 8,
  neckOpeningWidthInches: 7.5,
  finishedUpperArmInches: 14.5,
  sleeveLengthInches: 17,
  wristInches: 7.25,
  finishedBustInches: 45,
  stitchesPerInch: 5,
  rowsPerInch: 7,
  availableNeedles: 200,
};

describe("sideways cardigan display formatting", () => {
  it("caps inches at two decimal places", () => {
    expect(formatInchesForDisplay(-0.16666666666666666)).toBe("-0.17");
    expect(formatInchesForDisplay(22)).toBe("22");
    expect(formatInchesForDisplay(7.5)).toBe("7.5");
  });

  it("uses friendly bust-adjustment wording and hides a zero adjustment", () => {
    expect(formatBustAdjustmentMessage(0, 0)).toBeNull();
    expect(formatBustAdjustmentMessage(-1, -0.16666666666666666)).toBe(
      "1 row smaller (0.17 inches smaller)",
    );
    expect(formatBustAdjustmentMessage(2, 0.3333)).toBe("2 rows larger (0.33 inches larger)");
  });
});

describe("sideways cardigan builder validation", () => {
  it("blocks pattern creation when required values are missing", () => {
    const error = validateSidewaysCardiganBuilder({
      ...VALID,
      selectedSize: "",
    });
    expect(error?.code).toBe("missing-required");
    expect(error?.message).toMatch(/gauge/i);
  });

  it("requires V-neck depth to be shorter than garment length", () => {
    const error = validateSidewaysCardiganBuilder({
      ...VALID,
      vNeckDepthInches: 25,
    });
    expect(error?.code).toBe("v-neck-not-shorter-than-length");
    expect(error?.message).toMatch(/V-neck depth must be shorter/i);
  });

  it("requires the armhole slit to be shorter than garment length", () => {
    const error = validateSidewaysCardiganBuilder({
      ...VALID,
      finishedUpperArmInches: 60,
    });
    expect(error?.code).toBe("armhole-not-shorter-than-length");
    expect(error?.message).toMatch(/armhole slit/i);
  });

  it("explains when the neck opening leaves no shoulder rows", () => {
    const error = validateSidewaysCardiganBuilder({
      ...VALID,
      finishedBustInches: 20,
      neckOpeningWidthInches: 10,
    });
    expect(error?.code).toBe("non-positive-shoulder-rows");
    expect(error?.message).toMatch(/neck opening is too wide/i);
  });

  it("uses garment-length stitches for the needle requirement, not bust stitches", () => {
    const result = calculateSidewaysCardiganBody({
      garmentLengthInches: 22,
      vNeckDepthInches: 8,
      finishedBustCircumferenceInches: 40,
      finishedUpperArmInches: 14,
      neckOpeningWidthInches: 7,
      stitchesPerInch: 5,
      rowsPerInch: 7,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(requiredNeedlesForSidewaysCardiganBody(result.calc)).toBe(
      evenPositiveBodyStitches(22 * 5),
    );
    expect(requiredNeedlesForSidewaysCardiganBody(result.calc)).toBe(110);
    expect(requiredNeedlesForSidewaysCardiganBody(result.calc)).not.toBe(
      result.calc.bust.actualTotalBustRows,
    );
    expect(validateSidewaysCardiganNeedles({ requiredNeedles: 110, availableNeedles: 100 })?.code).toBe(
      "needles-exceeded",
    );
    expect(validateSidewaysCardiganNeedles({ requiredNeedles: 110, availableNeedles: 200 })).toBeNull();
  });

  it("blocks creation when garment-length stitches exceed available needles", () => {
    const error = validateSidewaysCardiganBuilder({
      ...VALID,
      availableNeedles: 40,
    });
    expect(error?.code).toBe("needles-exceeded");
    expect(error?.message).toMatch(/garment length in stitches/i);
  });

  it("allows a complete, valid builder submission", () => {
    expect(validateSidewaysCardiganBuilder(VALID)).toBeNull();
  });
});
