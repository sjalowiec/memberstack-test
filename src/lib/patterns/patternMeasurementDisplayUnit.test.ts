import { beforeEach, describe, expect, it } from "vitest";
import {
  formatMeasurementDisplayFromInches,
  parseMeasurementInputToInches,
  resolveMeasurementDisplayUnitFromPatternData,
  resolveSavedPatternMeasurementDisplayUnit,
  type MeasurementDisplayUnit,
} from "./patternMeasurementDisplayUnit";
import {
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";

/**
 * Models the Summary/Edit form boundary exactly as `sleeveless-custom-build-measurements-page.ts`
 * does: canonical inches ? visible field text on load, visible field text ? canonical inches on
 * save. Canonical storage is always inch decimal strings.
 */
function loadFieldDisplay(storedInches: string, unit: MeasurementDisplayUnit): string {
  const inches = parseMeasurementInputToInches(storedInches, "in");
  return formatMeasurementDisplayFromInches(inches, unit);
}

function saveFieldInches(displayText: string, unit: MeasurementDisplayUnit): string {
  const inches = parseMeasurementInputToInches(displayText, unit);
  return inches === undefined ? "" : formatMeasurementDisplayFromInches(inches, "in");
}

/**
 * Models a LIVE unit switch on the Edit page diagram exactly as the measurement editor does when
 * the Inches/Centimeters control changes: read the visible field text as canonical inches in the
 * OLD unit, then re-display in the NEW unit. Preserves unsaved edits; canonical inches unchanged.
 */
function switchDisplayedUnit(
  displayText: string,
  from: MeasurementDisplayUnit,
  to: MeasurementDisplayUnit,
): string {
  const inches = parseMeasurementInputToInches(displayText, from);
  return formatMeasurementDisplayFromInches(inches, to);
}

/** Seed a saved pattern's gauge so the persisted build unit (`gaugeRawUnit`) is `unit`. */
function seedGaugeUnit(unit: MeasurementDisplayUnit | null, family: "sleeveless" | "drop-shoulder" = "sleeveless"): void {
  const gaugeBase = { gaugeStitchRaw: "28", gaugeRowRaw: "44", gaugeStitchesPerInch: "7", gaugeRowsPerInch: "11" };
  const gauge = unit ? { ...gaugeBase, gaugeRawUnit: unit } : gaugeBase;
  savePatternData("yarnGaugeMachine", { ...gauge, availableNeedles: "200" });
  saveCurrentPattern({
    yarnGauge: unit ? { ...gaugeBase, gaugeRawUnit: unit } : gaugeBase,
    style: {
      patternMode: "custom-build",
      constructionFamily: family === "drop-shoulder" ? "drop-shoulder" : undefined,
    },
  });
}

describe("patternMeasurementDisplayUnit", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  // Scenario 1: a pattern built in inches displays and saves inches.
  it("inches: displays and saves inch values unchanged", () => {
    seedGaugeUnit("in");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("in");
    expect(loadFieldDisplay("40", "in")).toBe("40");
    expect(loadFieldDisplay("8.25", "in")).toBe("8.25");
    expect(saveFieldInches("40", "in")).toBe("40");
    expect(saveFieldInches("8.25", "in")).toBe("8.25");
  });

  // Scenario 2: a pattern built in centimeters displays and saves centimeters.
  it("centimeters: displays inches as cm and parses cm back to inches", () => {
    seedGaugeUnit("cm");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("cm");
    // 40 in ? 101.6 cm displayed; user sees cm and edits in cm.
    expect(loadFieldDisplay("40", "cm")).toBe("101.6");
    expect(saveFieldInches("101.6", "cm")).toBe("40");
    // A fresh cm edit converts to canonical inches on the quarter-inch grid (100/2.54 = 39.37).
    expect(saveFieldInches("100", "cm")).toBe("39.25");
  });

  // Scenario 3: a centimeter value survives edit ? save ? reopen without changing.
  it("cm value survives edit ? save ? reopen without drift", () => {
    seedGaugeUnit("cm");
    const unit = resolveSavedPatternMeasurementDisplayUnit();
    let storedInches = "40";

    // Reopen (no edit): display, then save the untouched display value back.
    const display1 = loadFieldDisplay(storedInches, unit);
    expect(display1).toBe("101.6");
    storedInches = saveFieldInches(display1, unit);
    expect(storedInches).toBe("40");

    // Reopen again � same cm displayed, still 40 in canonically.
    const display2 = loadFieldDisplay(storedInches, unit);
    expect(display2).toBe(display1);
    expect(saveFieldInches(display2, unit)).toBe("40");
  });

  // Scenario 4: an inch value survives edit ? save ? reopen without changing.
  it("inch value survives edit ? save ? reopen without drift", () => {
    seedGaugeUnit("in");
    const unit = resolveSavedPatternMeasurementDisplayUnit();
    let storedInches = "18.75";
    const display1 = loadFieldDisplay(storedInches, unit);
    expect(display1).toBe("18.75");
    storedInches = saveFieldInches(display1, unit);
    expect(storedInches).toBe("18.75");
    expect(loadFieldDisplay(storedInches, unit)).toBe("18.75");
  });

  // Scenario 5: repeated renders / saves do not double-convert.
  it("repeated load/save cycles are idempotent (no double conversion)", () => {
    for (const unit of ["in", "cm"] as const) {
      for (const startInches of ["40", "8.25", "18.75", "0.5", "2", "24.25"]) {
        let inchesStr = startInches;
        let display = "";
        for (let i = 0; i < 6; i += 1) {
          display = loadFieldDisplay(inchesStr, unit);
          inchesStr = saveFieldInches(display, unit);
        }
        // After settling, the canonical inch value equals where it converged on the first cycle.
        const settledDisplay = loadFieldDisplay(inchesStr, unit);
        expect(settledDisplay).toBe(display);
        expect(saveFieldInches(settledDisplay, unit)).toBe(inchesStr);
      }
    }
  });

  // Scenario 6: existing projects with no saved unit still behave as before (inches).
  it("legacy project without gaugeRawUnit defaults to inches", () => {
    seedGaugeUnit(null);
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("in");
    expect(loadFieldDisplay("40", resolveSavedPatternMeasurementDisplayUnit())).toBe("40");

    // Completely empty storage also defaults to inches.
    localStorage.clear();
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("in");
  });

  // Scenario 7: stitch / row / gauge counts are unitless and untouched.
  it("does not convert gauge counts and does not mutate pattern data", () => {
    const canonical = Object.freeze({
      yarnGauge: Object.freeze({ gaugeRawUnit: "cm", gaugeStitchRaw: "28", gaugeRowRaw: "44" }),
    });
    const pb = Object.freeze({
      yarnGaugeMachine: Object.freeze({ gaugeRawUnit: "cm", gaugeStitchRaw: "28", gaugeRowRaw: "44" }),
    });
    // Resolving the unit is read-only (frozen inputs would throw on mutation).
    expect(resolveMeasurementDisplayUnitFromPatternData(canonical, pb)).toBe("cm");
    // Gauge counts remain exactly as stored � never run through the length converters.
    expect(canonical.yarnGauge.gaugeStitchRaw).toBe("28");
    expect(pb.yarnGaugeMachine.gaugeRowRaw).toBe("44");

    // Through storage: seeding cm keeps the raw swatch counts intact.
    seedGaugeUnit("cm");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("cm");
    const ygm = getPatternData().yarnGaugeMachine as Record<string, unknown>;
    expect(ygm.gaugeStitchRaw).toBe("28");
    expect(ygm.gaugeRowRaw).toBe("44");
  });

  // Scenario 8: both Sleeveless and Drop Shoulder honor the corrected behavior.
  it("resolves the persisted unit for both sleeveless and drop shoulder", () => {
    seedGaugeUnit("cm", "sleeveless");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("cm");
    expect(loadFieldDisplay("40", "cm")).toBe("101.6");

    localStorage.clear();
    seedGaugeUnit("cm", "drop-shoulder");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("cm");
    // A drop-shoulder sleeve length round-trips through cm the same way.
    expect(saveFieldInches(loadFieldDisplay("18", "cm"), "cm")).toBe("18");

    localStorage.clear();
    seedGaugeUnit("in", "drop-shoulder");
    expect(resolveSavedPatternMeasurementDisplayUnit()).toBe("in");
  });

  // Live Edit-page switch (Issue 2): flipping the toggle must not move the physical measurement.
  it("switching inches -> centimeters on the diagram preserves the physical measurement", () => {
    // A canonical 40" bust shown in inches, switched to cm, is the same physical size (101.6 cm).
    const shownInches = formatMeasurementDisplayFromInches(40, "in");
    expect(shownInches).toBe("40");
    const shownCm = switchDisplayedUnit(shownInches, "in", "cm");
    expect(shownCm).toBe("101.6");
    // Saving from the cm display returns to the exact canonical inches — no drift.
    expect(saveFieldInches(shownCm, "cm")).toBe("40");
  });

  it("switching centimeters -> inches on the diagram preserves the physical measurement", () => {
    const shownCm = formatMeasurementDisplayFromInches(40, "cm"); // 101.6
    const shownInches = switchDisplayedUnit(shownCm, "cm", "in");
    expect(shownInches).toBe("40");
    expect(saveFieldInches(shownInches, "in")).toBe("40");
  });

  it("switching repeatedly does not double-convert or drift", () => {
    for (const startInches of [40, 18.75, 8.25, 2, 24.25]) {
      let text = formatMeasurementDisplayFromInches(startInches, "in");
      let unit: MeasurementDisplayUnit = "in";
      const settledInch = text; // canonical inch text after initial display
      for (let i = 0; i < 8; i += 1) {
        const next: MeasurementDisplayUnit = unit === "in" ? "cm" : "in";
        text = switchDisplayedUnit(text, unit, next);
        unit = next;
      }
      // Land back on inches and confirm we are exactly where we started.
      const backToInch = unit === "in" ? text : switchDisplayedUnit(text, unit, "in");
      expect(backToInch).toBe(settledInch);
      expect(saveFieldInches(backToInch, "in")).toBe(settledInch);
    }
  });

  it("an unsaved valid edit survives a unit switch (edit in cm, keep the edited value)", () => {
    // User is viewing inches, types a new value, then flips to cm before saving.
    const editedInchText = "42";
    const shownCm = switchDisplayedUnit(editedInchText, "in", "cm");
    expect(shownCm).toBe("106.7"); // 42 in -> 106.68 -> 106.7 cm
    // Flip back to inches: the edit is intact (42), not silently reset to the saved value.
    expect(switchDisplayedUnit(shownCm, "cm", "in")).toBe("42");
    // And it saves as the edited canonical inches.
    expect(saveFieldInches(shownCm, "cm")).toBe("42");
  });

  it("resolveMeasurementDisplayUnitFromPatternData prefers canonical yarnGauge over stale cm mirrors", () => {
    expect(resolveMeasurementDisplayUnitFromPatternData({}, {})).toBe("in");
    expect(
      resolveMeasurementDisplayUnitFromPatternData({ yarnGauge: { gaugeRawUnit: "cm" } }, {}),
    ).toBe("cm");
    expect(
      resolveMeasurementDisplayUnitFromPatternData({}, { yarnGaugeMachine: { gaugeRawUnit: "cm" } }),
    ).toBe("cm");
    expect(
      resolveMeasurementDisplayUnitFromPatternData(
        { yarnGauge: { gaugeRawUnit: "in" } },
        { yarnGaugeMachine: { gaugeRawUnit: "in" } },
      ),
    ).toBe("in");
    // After Edit Pattern saves inches on yarnGauge, a leftover cm on yarnGaugeMachine must not win.
    expect(
      resolveMeasurementDisplayUnitFromPatternData(
        { yarnGauge: { gaugeRawUnit: "in" } },
        { yarnGaugeMachine: { gaugeRawUnit: "cm" }, yarnGauge: { gaugeRawUnit: "in" } },
      ),
    ).toBe("in");
    expect(
      resolveMeasurementDisplayUnitFromPatternData(
        { yarnGauge: { gaugeRawUnit: "cm" } },
        { yarnGaugeMachine: { gaugeRawUnit: "in" }, yarnGauge: { gaugeRawUnit: "in" } },
      ),
    ).toBe("cm");
  });
});
