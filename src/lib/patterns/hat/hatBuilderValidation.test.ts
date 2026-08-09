import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HAT_BUILDER_INCOMPLETE_MESSAGE,
  evaluateHatBuilderNeedleCapacity,
  hatBuilderChoiceFieldAdvances,
  isHatBuilderBrimComplete,
  isHatBuilderCrownComplete,
  isHatBuilderGaugeComplete,
  isHatBuilderInputComplete,
  isHatBuilderLengthComplete,
  isHatBuilderReadyToCreatePattern,
  isHatBuilderSizeComplete,
  hatBuilderStepComplete,
  nextHatBuilderOpenStepAfterFieldChange,
  resolveHatBuilderRequiredNeedles,
} from "./hatBuilderValidation";
import {
  buildHatNeedleCapacityMessage,
  resolveHatRequiredNeedles,
  validateHatNeedleCapacity,
} from "./hatAvailableNeedles";
import { applyHatCrownCastOnAdjustment } from "./hatMath";
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
import { nextBrimLengthAfterBrimTypeChange, roundFinishedHatSizeFromHead } from "./hatMath";

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
  availableNeedles: "200",
};

describe("hatBuilderValidation", () => {
  it("requires size, brim, crown, length, gauge, and available needles for Create My Pattern", () => {
    expect(isHatBuilderInputComplete(completeFields, sizingRows)).toBe(true);
    expect(
      isHatBuilderInputComplete({ ...completeFields, brimLength: "" }, sizingRows),
    ).toBe(false);
    expect(
      isHatBuilderInputComplete({ ...completeFields, crownShaping: "wedge-4" }, sizingRows),
    ).toBe(false);
    expect(
      isHatBuilderInputComplete({ ...completeFields, availableNeedles: "" }, sizingRows),
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

  it("accepts release crowns and all three brim types", () => {
    expect(isHatBuilderCrownComplete({ crownShaping: "gathered" })).toBe(true);
    expect(isHatBuilderCrownComplete({ crownShaping: "wedge-4-decrease" })).toBe(true);
    expect(isHatBuilderCrownComplete({ crownShaping: "spiral" })).toBe(true);
    expect(isHatBuilderBrimComplete({ brimType: "rolled", brimLength: "1" })).toBe(true);
    expect(isHatBuilderBrimComplete({ brimType: "folded", brimLength: "1.5" })).toBe(
      true,
    );
    expect(isHatBuilderBrimComplete({ brimType: "single", brimLength: "2" })).toBe(true);
    expect(isHatBuilderBrimComplete({ brimType: "unknown", brimLength: "2" })).toBe(false);
    expect(
      isHatBuilderGaugeComplete({
        stitchGauge: "5",
        rowGauge: "7",
        availableNeedles: "150",
      }),
    ).toBe(true);
    expect(
      isHatBuilderGaugeComplete({
        stitchGauge: "5",
        rowGauge: "7",
        availableNeedles: "",
      }),
    ).toBe(false);
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

describe("hat available needles capacity", () => {
  it("passes when the hat fits within entered needle capacity", () => {
    const required = resolveHatBuilderRequiredNeedles(completeFields, sizingRows, "inches");
    expect(required).toBeGreaterThan(0);
    expect(
      isHatBuilderReadyToCreatePattern(
        { ...completeFields, availableNeedles: String(required) },
        sizingRows,
        "inches",
      ),
    ).toBe(true);
    const check = validateHatNeedleCapacity(String(required), required);
    expect(check.ok).toBe(true);
  });

  it("blocks Create My Pattern when the hat needs more needles than available", () => {
    const required = resolveHatBuilderRequiredNeedles(completeFields, sizingRows, "inches");
    const available = Math.max(1, required - 1);
    expect(
      isHatBuilderReadyToCreatePattern(
        { ...completeFields, availableNeedles: String(available) },
        sizingRows,
        "inches",
      ),
    ).toBe(false);
    const capacity = evaluateHatBuilderNeedleCapacity(
      { ...completeFields, availableNeedles: String(available) },
      sizingRows,
      "inches",
    );
    expect(capacity.ok).toBe(false);
  });

  it("reports both required and available needle counts in the error", () => {
    const message = buildHatNeedleCapacityMessage(168, 150);
    expect(message).toBe(
      "This hat requires 168 needles, but your machine has 150 available.",
    );
    const check = validateHatNeedleCapacity("150", 168);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("168");
    expect(check.message).toContain("150");
    expect(check.requiredNeedles).toBe(168);
    expect(check.availableNeedles).toBe(150);
  });

  it("uses the final rounded crown-adjusted stitch count", () => {
    const wedgeFields = { ...completeFields, crownShaping: "wedge-4-decrease" };
    const required = resolveHatBuilderRequiredNeedles(wedgeFields, sizingRows, "inches");
    // Adult woman 20.5" @ 5 sts/4" → even-up 26 → wedge-4-decrease → 28
    expect(applyHatCrownCastOnAdjustment(26, "wedge-4-decrease")).toBe(28);
    expect(required).toBe(28);
    expect(
      resolveHatRequiredNeedles({
        finishedHatCircInches: 20.5,
        stitchGaugeDisplay: 5,
        displayUnit: "inches",
        crown: "wedge-4-decrease",
      }),
    ).toBe(28);
  });

  it("revalidates when size, circumference, gauge, or available needles change", () => {
    const baseRequired = resolveHatBuilderRequiredNeedles(completeFields, sizingRows, "inches");
    const tighterGauge = resolveHatBuilderRequiredNeedles(
      { ...completeFields, stitchGauge: "8" },
      sizingRows,
      "inches",
    );
    expect(tighterGauge).toBeGreaterThan(baseRequired);

    const customCirc = resolveHatBuilderRequiredNeedles(
      { ...completeFields, sizeSel: "custom", customCircumference: "30" },
      sizingRows,
      "inches",
    );
    expect(customCirc).toBeGreaterThan(baseRequired);

    const lowNeedles = evaluateHatBuilderNeedleCapacity(
      { ...completeFields, availableNeedles: "10" },
      sizingRows,
      "inches",
    );
    expect(lowNeedles.ok).toBe(false);

    const highNeedles = evaluateHatBuilderNeedleCapacity(
      { ...completeFields, availableNeedles: "200" },
      sizingRows,
      "inches",
    );
    expect(highNeedles.ok).toBe(true);
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
      'Standard (8.5" finished hat length)',
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

describe("hat builder brim section stays open after picker selection", () => {
  const builderScript = readFileSync(
    resolve("src/scripts/hat-builder-page.ts"),
    "utf8",
  );

  it("does not auto-advance when a brim picker image is selected", () => {
    expect(hatBuilderChoiceFieldAdvances("brimType")).toBe(false);
    expect(hatBuilderChoiceFieldAdvances("fit")).toBe(true);
    expect(hatBuilderChoiceFieldAdvances("crown")).toBe(true);
    expect(builderScript).toContain(
      "onFieldChanged({ advance: hatBuilderChoiceFieldAdvances(field) })",
    );

    // Even when selecting Rolled Brim completes the step via the 1" default,
    // advance:false keeps step 3 open so the height field stays visible.
    const afterRolledPick = nextHatBuilderOpenStepAfterFieldChange({
      advance: hatBuilderChoiceFieldAdvances("brimType"),
      openStep: 3,
      maxReachableAfter: 4,
      prevMaxReachable: 3,
      currentStepComplete: isHatBuilderBrimComplete({
        brimType: "rolled",
        brimLength: "1",
      }),
    });
    expect(afterRolledPick).toBe(3);
    expect(
      isHatBuilderBrimComplete({ brimType: "rolled", brimLength: "1" }),
    ).toBe(true);
  });

  it("keeps the brim-height field available after type selection (section stays on step 3)", () => {
    for (const brimType of ["rolled", "single", "folded"] as const) {
      const length =
        brimType === "rolled"
          ? nextBrimLengthAfterBrimTypeChange({
              previousBrimType: "single",
              nextBrimType: "rolled",
              unit: "inches",
            })!
          : "2";
      const open = nextHatBuilderOpenStepAfterFieldChange({
        advance: false,
        openStep: 3,
        maxReachableAfter: isHatBuilderBrimComplete({ brimType, brimLength: length })
          ? 4
          : 3,
        prevMaxReachable: 3,
        currentStepComplete: isHatBuilderBrimComplete({ brimType, brimLength: length }),
      });
      expect(open).toBe(3);
    }
  });

  it("applies the rolled-brim default only when newly selecting Rolled Brim", () => {
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "single",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBe("1");
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "folded",
        nextBrimType: "rolled",
        unit: "cm",
      }),
    ).toBe("2.5");
  });

  it("does not overwrite a user-entered height when reselecting the current brim type", () => {
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "rolled",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBeNull();
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "single",
        nextBrimType: "single",
        unit: "inches",
      }),
    ).toBeNull();
  });

  it("still advances after an explicit brim-height completion (Continue/Next via length change)", () => {
    // Brim length `change` wires advance:true — once height is set, step 3 may advance.
    expect(builderScript).toMatch(
      /brimLengthInput\?\.addEventListener\("change",\s*\(\)\s*=>\s*onFieldChanged\(\{\s*advance:\s*true\s*\}\)/,
    );
    const afterHeightCommit = nextHatBuilderOpenStepAfterFieldChange({
      advance: true,
      openStep: 3,
      maxReachableAfter: 4,
      prevMaxReachable: 3,
      currentStepComplete: true,
    });
    expect(afterHeightCommit).toBe(4);

    // Returning to edit brim and changing type still does not auto-advance.
    const returnEdit = nextHatBuilderOpenStepAfterFieldChange({
      advance: hatBuilderChoiceFieldAdvances("brimType"),
      openStep: 3,
      maxReachableAfter: 5,
      prevMaxReachable: 5,
      currentStepComplete: true,
    });
    expect(returnEdit).toBe(3);
  });
});
