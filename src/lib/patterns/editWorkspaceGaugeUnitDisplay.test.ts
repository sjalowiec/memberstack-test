import { describe, expect, it } from "vitest";
import { convertGaugeSwatchDisplayBetweenUnits } from "./editWorkspaceGaugeUnitDisplay";
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";

/** Per-inch gauge the engine actually uses for a given swatch count + basis. */
function perInch(value: string, unit: "in" | "cm"): number {
  return parseFloat(rawSwatchToPerInch(value, value, unit).gaugeStitchesPerInch);
}

describe("convertGaugeSwatchDisplayBetweenUnits", () => {
  it("returns the value unchanged when the unit does not change", () => {
    expect(convertGaugeSwatchDisplayBetweenUnits("28", "in", "in")).toBe("28");
    expect(convertGaugeSwatchDisplayBetweenUnits("27.5", "cm", "cm")).toBe("27.5");
  });

  it("converts an over-4\" count to the equivalent over-10cm count (same physical gauge)", () => {
    // 28 sts / 4" = 7 sts/in = 27.56 sts / 10 cm — presentation changes, physical gauge does not.
    const cm = convertGaugeSwatchDisplayBetweenUnits("28", "in", "cm");
    expect(cm).toBe("27.56");
    // Equal to the precision of the displayed swatch count (2 decimals); no meaningful drift.
    expect(perInch("28", "in")).toBeCloseTo(perInch(cm, "cm"), 2);
  });

  it("converts an over-10cm count back to the equivalent over-4\" count", () => {
    const inches = convertGaugeSwatchDisplayBetweenUnits("27.56", "cm", "in");
    expect(perInch("27.56", "cm")).toBeCloseTo(perInch(inches, "in"), 3);
  });

  it("switching repeatedly does not drift and never changes the resulting calculation", () => {
    const enginePerInch = perInch("28", "in");
    let value = "28";
    let unit: "in" | "cm" = "in";
    for (let i = 0; i < 6; i += 1) {
      const next: "in" | "cm" = unit === "in" ? "cm" : "in";
      value = convertGaugeSwatchDisplayBetweenUnits(value, unit, next);
      unit = next;
      // Every hop preserves the physical gauge the pattern engine consumes.
      expect(perInch(value, unit)).toBeCloseTo(enginePerInch, 3);
    }
  });

  it("keeps an empty or unparseable in-progress value as-is (no discard / misconvert)", () => {
    expect(convertGaugeSwatchDisplayBetweenUnits("", "in", "cm")).toBe("");
    expect(convertGaugeSwatchDisplayBetweenUnits("   ", "in", "cm")).toBe("");
    expect(convertGaugeSwatchDisplayBetweenUnits("abc", "in", "cm")).toBe("abc");
    expect(convertGaugeSwatchDisplayBetweenUnits("0", "in", "cm")).toBe("0");
  });
});
