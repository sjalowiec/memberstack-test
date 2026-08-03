import { describe, expect, it } from "vitest";
import {
  FIT_EASE_CM_BY_CHOICE,
  FIT_EASE_INCHES_BY_CHOICE,
  fitEaseInchesForChoice,
  formatFitEaseApproxLabel,
  formatFitEaseAboutProse,
  formatFitEaseEditDrawerLine,
} from "./fitEaseInches";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const BODY_BUST_38_ROW: ChartRow = {
  size: "M",
  bust_or_chest: 38,
};

describe("fitEaseInches", () => {
  it("defines close +1, standard +3, relaxed +5", () => {
    expect(FIT_EASE_INCHES_BY_CHOICE).toEqual({ close: 1, standard: 3, relaxed: 5 });
  });

  it("falls back to standard ease for unknown fit choices", () => {
    expect(fitEaseInchesForChoice("unknown")).toBe(3);
  });

  it("formats builder, help, and edit-drawer copy from the shared map", () => {
    expect(formatFitEaseApproxLabel("relaxed")).toBe("Approx. +5\u2033 ease");
    expect(formatFitEaseAboutProse("relaxed")).toBe("About 5\u2033 of ease.");
    expect(formatFitEaseEditDrawerLine("relaxed")).toBe(
      "Relaxed fit \u00b7 about +5\u2033 ease (applied to the chart measurements).",
    );
  });

  it("defines close 2.5 / standard 7.5 / relaxed 12.5 cm approximate ease", () => {
    expect(FIT_EASE_CM_BY_CHOICE).toEqual({ close: 2.5, standard: 7.5, relaxed: 12.5 });
  });

  it("Fit card copy shows inch ease when inches are active (default + explicit)", () => {
    expect(formatFitEaseApproxLabel("close")).toBe("Approx. +1\u2033 ease");
    expect(formatFitEaseApproxLabel("standard")).toBe("Approx. +3\u2033 ease");
    expect(formatFitEaseApproxLabel("relaxed")).toBe("Approx. +5\u2033 ease");
    expect(formatFitEaseApproxLabel("close", "in")).toBe("Approx. +1\u2033 ease");
    expect(formatFitEaseApproxLabel("standard", "in")).toBe("Approx. +3\u2033 ease");
    expect(formatFitEaseApproxLabel("relaxed", "in")).toBe("Approx. +5\u2033 ease");
  });

  it("Fit card copy shows centimeter ease when centimeters are active", () => {
    expect(formatFitEaseApproxLabel("close", "cm")).toBe("Approx. +2.5 cm ease");
    expect(formatFitEaseApproxLabel("standard", "cm")).toBe("Approx. +7.5 cm ease");
    expect(formatFitEaseApproxLabel("relaxed", "cm")).toBe("Approx. +12.5 cm ease");
  });

  it("38\" body bust produces 39 / 41 / 43 finished bust for close / standard / relaxed", () => {
    expect(computeDefaultMeasurementsFromChartRow(BODY_BUST_38_ROW, "close").finished_bust_chest).toBe(
      39,
    );
    expect(
      computeDefaultMeasurementsFromChartRow(BODY_BUST_38_ROW, "standard").finished_bust_chest,
    ).toBe(41);
    expect(
      computeDefaultMeasurementsFromChartRow(BODY_BUST_38_ROW, "relaxed").finished_bust_chest,
    ).toBe(43);
  });
});
