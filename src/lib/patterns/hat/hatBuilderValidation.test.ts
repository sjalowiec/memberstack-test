import { describe, expect, it } from "vitest";
import {
  HAT_BUILDER_INCOMPLETE_MESSAGE,
  isHatBuilderBrimComplete,
  isHatBuilderCrownComplete,
  isHatBuilderGaugeComplete,
  isHatBuilderInputComplete,
  isHatBuilderLengthComplete,
  isHatBuilderSizeComplete,
  hatBuilderStepComplete,
} from "./hatBuilderValidation";
import {
  buildFitPresetOptionLabel,
  buildHatSizeOptionLabel,
  buildHatSizingBuilderRows,
  formatFinishedInchesForLabel,
} from "./hatBuilderSizingLabels";
import {
  draftUnitFromToggleDetail,
  HAT_GAUGE_IN_TO_CM_FACTOR,
  maybeFillHatGaugeSlotFromOtherUnit,
} from "./hatBuilderGaugeUnits";
import { roundFinishedHatSizeFromHead } from "./hatMath";

const sizingRows = [
  {
    size: "adult_woman",
    finishedSizeInches: roundFinishedHatSizeFromHead(22.5),
  },
];

const completeFields = {
  sizeSel: "adult_woman",
  customCircumference: "",
  brimType: "single",
  brimLength: "2",
  crownShaping: "gathered",
  fit: "watchcap",
  customHatLength: "",
  stitchGauge: "5",
  rowGauge: "7",
};

describe("hatBuilderValidation", () => {
  it("requires size, brim, crown, length, and gauge for Create My Pattern", () => {
    expect(isHatBuilderInputComplete(completeFields, sizingRows)).toBe(true);
    expect(
      isHatBuilderInputComplete({ ...completeFields, brimLength: "" }, sizingRows),
    ).toBe(false);
    expect(
      isHatBuilderInputComplete({ ...completeFields, crownShaping: "wedge-4" }, sizingRows),
    ).toBe(false);
  });

  it("accepts custom size and custom length when values are positive", () => {
    expect(
      isHatBuilderSizeComplete(
        { sizeSel: "custom", customCircumference: "20" },
        sizingRows,
      ),
    ).toBe(true);
    expect(
      isHatBuilderLengthComplete({ fit: "custom", customHatLength: "9.5" }),
    ).toBe(true);
    expect(
      isHatBuilderLengthComplete({ fit: "custom", customHatLength: "0" }),
    ).toBe(false);
  });

  it("accepts release crowns and both brim types", () => {
    expect(isHatBuilderCrownComplete({ crownShaping: "gathered" })).toBe(true);
    expect(isHatBuilderCrownComplete({ crownShaping: "wedge-4-decrease" })).toBe(true);
    expect(isHatBuilderCrownComplete({ crownShaping: "spiral" })).toBe(true);
    expect(isHatBuilderBrimComplete({ brimType: "folded", brimLength: "1.5" })).toBe(
      true,
    );
    expect(isHatBuilderGaugeComplete({ stitchGauge: "5", rowGauge: "7" })).toBe(true);
  });

  it("reports step completion for accordion locking", () => {
    expect(hatBuilderStepComplete(1, completeFields, sizingRows)).toBe(true);
    expect(hatBuilderStepComplete(4, completeFields, sizingRows)).toBe(true);
    expect(
      hatBuilderStepComplete(
        5,
        { ...completeFields, stitchGauge: "" },
        sizingRows,
      ),
    ).toBe(false);
  });

  it("exposes the incomplete CTA message from the working hat page", () => {
    expect(HAT_BUILDER_INCOMPLETE_MESSAGE).toMatch(/Finish the required sections/i);
  });
});

describe("hatBuilderSizingLabels", () => {
  it("builds finished-size option labels with ease rounding", () => {
    const finished = roundFinishedHatSizeFromHead(22.5);
    expect(finished).toBe(20.5);
    expect(formatFinishedInchesForLabel(finished)).toBe("20.5");
    const rows = buildHatSizingBuilderRows([
      {
        size: "adult_woman",
        label: "Adult Woman",
        extended_label: "Adult Woman (approx. 22–23″ head)",
        circumference: 22.5,
      },
    ]);
    expect(rows[0].optionLabel).toContain("20.5");
    expect(
      buildHatSizeOptionLabel(rows[0], rows[0].finishedSizeInches, "cm"),
    ).toMatch(/cm finished/);
  });

  it("labels fit presets with unit-aware finished length", () => {
    expect(buildFitPresetOptionLabel("watchcap", 8.5, "inches")).toBe(
      'Classic (8.5" finished hat length)',
    );
    expect(buildFitPresetOptionLabel("beanie", 7, "cm")).toMatch(/Beanie \(/);
  });
});

describe("hatBuilderGaugeUnits", () => {
  it("converts empty cm slot from inches without overwriting", () => {
    const filled = maybeFillHatGaugeSlotFromOtherUnit(
      {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "", row: "" },
      },
      "inches",
      "cm",
    );
    expect(filled.cm.stitch).toBe((5 * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1));
    expect(filled.cm.row).toBe((7 * HAT_GAUGE_IN_TO_CM_FACTOR).toFixed(1));

    const kept = maybeFillHatGaugeSlotFromOtherUnit(
      {
        inches: { stitch: "5", row: "7" },
        cm: { stitch: "12", row: "18" },
      },
      "inches",
      "cm",
    );
    expect(kept.cm).toEqual({ stitch: "12", row: "18" });
  });

  it("maps UnitToggle detail units to draft units", () => {
    expect(draftUnitFromToggleDetail("cm")).toBe("cm");
    expect(draftUnitFromToggleDetail("in")).toBe("inches");
  });
});
