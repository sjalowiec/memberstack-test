import { describe, expect, it } from "vitest";
import { calculateSidewaysCardiganBody } from "./sidewaysCardiganBodyCalc";
import {
  buildSidewaysCardiganPatternDiagramModel,
  buildSidewaysCardiganPatternDiagramSvg,
} from "./sidewaysCardiganPatternDiagramSvg";
import { formatInchesWithUnit } from "./sidewaysCardiganDisplayFormat";
import { formatMeasurementDisplayFromInches } from "./patternMeasurementDisplayUnit";
import {
  formatPatternDiagramCountLabel,
  formatPatternDiagramMeasurement,
} from "./patternStitchesRowsDiagramLabel";

describe("Stitches & Rows measurement labels", () => {
  it("keeps a count and a finished measurement distinct", () => {
    expect(formatPatternDiagramCountLabel(162, "sts", "27 in")).toBe("162 sts (27 in)");
    expect(formatPatternDiagramCountLabel(98, "rows", "14 in")).toBe("98 rows (14 in)");
  });

  it("switches units with the Summary / Edit display rounding", () => {
    expect(formatPatternDiagramMeasurement(27, "in")).toBe("27 in");
    expect(formatPatternDiagramMeasurement(27, "cm")).toBe(
      `${formatMeasurementDisplayFromInches(27, "cm")} cm`,
    );
    expect(formatPatternDiagramCountLabel(162, "sts", formatPatternDiagramMeasurement(27, "cm"))).toBe(
      `162 sts (${formatMeasurementDisplayFromInches(27, "cm")} cm)`,
    );
  });

  it("omits a measurement that was not supplied", () => {
    expect(formatPatternDiagramCountLabel(40, "sts")).toBe("40 sts");
    expect(formatPatternDiagramCountLabel(12, "rows", "")).toBe("12 rows");
    expect(formatPatternDiagramCountLabel(12, "rows", "   ")).toBe("12 rows");
    expect(formatPatternDiagramMeasurement(undefined, "in")).toBe("");
    expect(formatPatternDiagramMeasurement(Number.NaN, "cm")).toBe("");
  });
});

describe("Sideways Stitches & Rows measurement labels", () => {
  const input = {
    garmentLengthInches: 22,
    vNeckDepthInches: 8,
    finishedBustCircumferenceInches: 40,
    finishedUpperArmInches: 14,
    neckOpeningWidthInches: 7,
    backNeckDepthInches: 1,
    stitchesPerInch: 5,
    rowsPerInch: 7,
  };

  function svg(unit: "in" | "cm" = "in") {
    const result = calculateSidewaysCardiganBody(input);
    if (!result.ok) throw new Error(result.error.message);
    const model = buildSidewaysCardiganPatternDiagramModel({
      garmentStyle: "cardigan",
      calc: result.calc,
      input,
      sleeveCalc: null,
      displayUnit: unit,
    });
    return buildSidewaysCardiganPatternDiagramSvg(model);
  }

  it("places the finished length beside the garment-length stitch count", () => {
    const diagram = svg("in");
    const length = formatPatternDiagramMeasurement(input.garmentLengthInches, "in");
    expect(diagram).toContain(`sts (${length})`);
    expect(diagram).toContain(`CO `);
    expect(diagram).toContain(`BO `);
    expect(diagram).toContain(formatInchesWithUnit(input.garmentLengthInches).replace(" in", ""));
  });

  it("uses centimeters when that is the selected unit", () => {
    const diagram = svg("cm");
    const length = formatPatternDiagramMeasurement(input.garmentLengthInches, "cm");
    expect(diagram).toContain(`sts (${length})`);
    expect(diagram).not.toContain(`sts (${formatPatternDiagramMeasurement(input.garmentLengthInches, "in")})`);
  });
});
