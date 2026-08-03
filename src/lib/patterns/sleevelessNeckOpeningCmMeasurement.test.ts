/**
 * Regression: Sleeveless / Drop Shoulder neck-opening measurement in centimeters.
 *
 * Bug: a neck opening entered (or defaulted) in centimeters was snapped to the quarter-INCH input
 * grid before being stored as canonical inches, silently shrinking the physical width the user
 * asked for (e.g. 16 cm -> 6.25 in = 15.875 cm instead of ~6.299 in = 16 cm). Inch entries were
 * unaffected because inch inputs already sit on the quarter-inch grid.
 *
 * Fix: centimeter entries convert ONCE to canonical inches and are stored preserving the physical
 * width (cmToCanonicalInches + formatCanonicalInchesFromCm), never re-snapped to the quarter-inch
 * grid. Inches are still canonical and inch behavior is unchanged.
 *
 * These tests exercise the shared measurement infrastructure end-to-end: the cm input collector,
 * the neck-opening resolver, the neckline stitch calculation, and the garment-diagram conversion
 * back to centimeters — for BOTH Sleeveless and Drop Shoulder (they share this path).
 */
import { describe, expect, it, beforeEach } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import {
  centimetersToCanonicalInches,
  formatCanonicalInchesFromCm,
  parseMeasurementInputToInches,
  inchesToCmRounded,
} from "./patternMeasurementDisplayUnit";
import { collectCustomBuildMeasurementOverridesFromDom } from "./sleevelessCustomMeasurementStorage";
import {
  getCurrentPattern,
  getPatternData,
  saveCurrentPattern,
  savePatternData,
} from "./patternStorage";
import {
  mergedPatternForDisplayFromSources,
  buildGeneratorPatternDataFromSources,
} from "./sleevelessPatternBuilderMerge";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import { rawSwatchToPerInch } from "./syncExpressWizardToPatternStorage";

const IN_TO_CM = 2.54;

/** DOM stand-in matching the production `[data-cb-measure-input="key"]` inputs. */
function measureRoot(values: Record<string, string>): ParentNode {
  const inputs = new Map(
    Object.entries(values).map(([key, value]) => [
      key,
      { value, trim: () => value.trim() } as HTMLInputElement,
    ]),
  );
  return {
    querySelector(sel: string) {
      const match = /data-cb-measure-input="([^"]+)"/.exec(sel);
      return match ? (inputs.get(match[1]) ?? null) : null;
    },
    querySelectorAll: () => [],
  } as unknown as ParentNode;
}

/** Seed a Custom Build pattern; neckOverrideInches is the stored canonical string (may be absent). */
function seedCustomBuild(options: {
  gaugeUnit: "in" | "cm";
  stitchRaw: string;
  rowRaw: string;
  neckOverrideInches?: string;
  family?: "sleeveless" | "drop-shoulder";
}): void {
  stubLocalStorage();
  localStorage.clear();
  const { gaugeStitchesPerInch, gaugeRowsPerInch } = rawSwatchToPerInch(
    options.stitchRaw,
    options.rowRaw,
    options.gaugeUnit,
  );
  const overrides =
    options.neckOverrideInches !== undefined
      ? { finishedNeckOpeningWidth: options.neckOverrideInches }
      : {};
  const core = {
    style: {
      patternMode: "custom-build",
      recipientCategory: "baby",
      constructionFamily: options.family === "drop-shoulder" ? "drop-shoulder" : undefined,
      garmentStyle: "pullover",
      neckline: "round",
    },
    fit: {
      selectedSize: "1",
      sizingChart: "baby",
      selectedMeasurements: {
        finished_bust_chest: 22,
        finished_hip: 22,
        back_neck_to_hem: 12,
        armhole_depth: 4,
        shoulder_width: 3,
        neck_opening: 5.75,
        neck_width: 5.75,
        front_neck_depth: 2,
        back_neck_depth: 1,
      },
      cbMeasurementOverrides: overrides,
    },
    yarnGauge: {
      gaugeStitchRaw: options.stitchRaw,
      gaugeRowRaw: options.rowRaw,
      gaugeRawUnit: options.gaugeUnit,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch,
      gaugeRowsPerInch,
      gaugeStitchRaw: options.stitchRaw,
      gaugeRowRaw: options.rowRaw,
      gaugeRawUnit: options.gaugeUnit,
      availableNeedles: "200",
    },
  };
  saveCurrentPattern(core as never);
  savePatternData("style", core.style);
  savePatternData("fit", core.fit);
  savePatternData("yarnGauge", core.yarnGauge);
  savePatternData("yarnGaugeMachine", core.yarnGaugeMachine);
}

/** Full pipeline: stored override string -> generator input -> neckline stitches + diagram labels. */
function runPipeline(neckOverrideInches: string, gauge: { stitchRaw: string; rowRaw: string; gaugeUnit: "in" | "cm" }) {
  seedCustomBuild({ ...gauge, neckOverrideInches });
  const merged = mergedPatternForDisplayFromSources(getCurrentPattern(), getPatternData());
  const genInput = buildGeneratorPatternDataFromSources(merged, getPatternData(), getCurrentPattern());
  const effIn = resolveEffectiveNeckOpeningWidthInches(genInput);
  const result = generateSleevelessBackPattern(genInput);
  const replCm = buildSleevelessGarmentDiagramReplacements(result, "cm", {
    patternData: genInput,
    measurementPiece: "back",
  });
  const replIn = buildSleevelessGarmentDiagramReplacements(result, "in", {
    patternData: genInput,
    measurementPiece: "back",
  });
  return {
    effIn,
    stitchesPerInch: result.debug.stitchesPerInch as number,
    necklineStitches: result.debug.necklineStitches as number,
    neckWidthCm: Number(replCm.NECK_WIDTH),
    neckWidthIn: Number(replIn.NECK_WIDTH),
  };
}

const BABY_GAUGE = { stitchRaw: "20", rowRaw: "28", gaugeUnit: "cm" as const };

describe("neck opening — centimeter measurement is preserved (shared infra)", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  // (1) 14.6 cm reaches the neckline calculation as the correct physical measurement.
  it("14.6 cm neck opening reaches generation as the correct physical width", () => {
    const root = measureRoot({ finishedNeckOpeningWidth: "14.6" });
    const overrides = collectCustomBuildMeasurementOverridesFromDom(root, "cm");
    const storedInches = Number(overrides.finishedNeckOpeningWidth);
    // 14.6 cm / 2.54 = 5.748 in — the physical width, NOT quarter-snapped to 5.75 by force.
    expect(storedInches).toBeCloseTo(14.6 / IN_TO_CM, 3);
    // Re-displayed, it is still exactly 14.6 cm (no drift).
    expect(inchesToCmRounded(storedInches)).toBe(14.6);

    const run = runPipeline(overrides.finishedNeckOpeningWidth!, BABY_GAUGE);
    expect(run.effIn).toBeCloseTo(14.6 / IN_TO_CM, 3);
  });

  // (2) 16 cm reaches the calculation as ~6.299 inches, exactly once (no double conversion / no snap).
  it("16 cm neck opening reaches generation as ~6.299 in, exactly once", () => {
    const root = measureRoot({ finishedNeckOpeningWidth: "16" });
    const overrides = collectCustomBuildMeasurementOverridesFromDom(root, "cm");
    const storedInches = Number(overrides.finishedNeckOpeningWidth);
    expect(storedInches).toBeCloseTo(6.2992, 3); // 16 / 2.54, not 6.25
    expect(storedInches).not.toBe(6.25);

    // "Exactly once": converting the stored inches back to cm and in again is a fixed point.
    expect(inchesToCmRounded(storedInches)).toBe(16);
    expect(centimetersToCanonicalInches(inchesToCmRounded(storedInches))).toBeCloseTo(storedInches, 4);

    const run = runPipeline(overrides.finishedNeckOpeningWidth!, BABY_GAUGE);
    expect(run.effIn).toBeCloseTo(6.2992, 3);
  });

  // (3) Saving and reopening does not alter the value.
  it("cm neck opening survives save -> reopen without drift", () => {
    // Save from a cm field.
    let root = measureRoot({ finishedNeckOpeningWidth: "16" });
    let overrides = collectCustomBuildMeasurementOverridesFromDom(root, "cm");
    const first = overrides.finishedNeckOpeningWidth!;

    // Reopen: the stored inches are shown in cm, and the untouched value is saved again.
    const shownCm = String(inchesToCmRounded(Number(first)));
    expect(shownCm).toBe("16");
    root = measureRoot({ finishedNeckOpeningWidth: shownCm });
    overrides = collectCustomBuildMeasurementOverridesFromDom(root, "cm");
    expect(overrides.finishedNeckOpeningWidth).toBe(first);

    // And once more — a stable fixed point.
    root = measureRoot({ finishedNeckOpeningWidth: String(inchesToCmRounded(Number(overrides.finishedNeckOpeningWidth))) });
    expect(collectCustomBuildMeasurementOverridesFromDom(root, "cm").finishedNeckOpeningWidth).toBe(first);
  });

  // (4) Repeated unit switching does not change the physical value.
  it("repeated cm re-parsing is idempotent (no accumulating drift)", () => {
    let inches = centimetersToCanonicalInches(16);
    for (let i = 0; i < 8; i += 1) {
      const cm = inchesToCmRounded(inches);
      expect(cm).toBe(16);
      inches = centimetersToCanonicalInches(cm);
    }
    expect(inches).toBeCloseTo(6.2992, 4);
  });

  // (5) Equivalent inch and centimeter inputs produce equivalent pattern calculations.
  it("14.6 cm and its 5.75 in equivalent produce identical neckline stitch counts", () => {
    const cmStored = formatCanonicalInchesFromCm(centimetersToCanonicalInches(14.6));
    const cmRun = runPipeline(cmStored, BABY_GAUGE);
    // Inch user types 5.75 (already on the quarter grid) — canonical 5.75.
    const inStored = String(parseMeasurementInputToInches("5.75", "in"));
    const inRun = runPipeline(inStored, BABY_GAUGE);
    expect(cmRun.necklineStitches).toBe(inRun.necklineStitches);
  });

  // (6) Existing inch behavior remains unchanged (quarter-inch grid).
  it("inch neck opening entries still snap to the quarter-inch grid", () => {
    const root = measureRoot({ finishedNeckOpeningWidth: "6.3" });
    const overrides = collectCustomBuildMeasurementOverridesFromDom(root, "in");
    // Inch inputs use the quarter-inch grid: 6.3 -> 6.25 (unchanged behavior).
    expect(overrides.finishedNeckOpeningWidth).toBe("6.25");
    expect(parseMeasurementInputToInches("6.3", "in")).toBe(6.25);
  });

  // (7) The final stitch-rounded diagram measurement is unit-consistent and differs only by
  //     mathematically necessary stitch rounding.
  it("diagram neck width is stitch-derived and unit-consistent (in x 2.54 == cm)", () => {
    const stored = formatCanonicalInchesFromCm(centimetersToCanonicalInches(16));
    const run = runPipeline(stored, BABY_GAUGE);

    // The diagram shows the achievable knitted width from the (even) neckline stitch count.
    const achievableIn = run.necklineStitches / run.stitchesPerInch;
    expect(run.neckWidthIn).toBeCloseTo(Math.round(achievableIn * 10) / 10, 5);
    // Inches and centimeters describe the SAME physical width (no cm-only factor).
    expect(run.neckWidthCm).toBeCloseTo(
      Math.round(run.neckWidthIn * IN_TO_CM * 10) / 10,
      5,
    );

    // The gap between the requested 16 cm and the displayed width is only stitch rounding:
    // strictly less than one stitch of width.
    const requestedIn = Number(stored);
    const oneStitchIn = 1 / run.stitchesPerInch;
    expect(Math.abs(requestedIn - achievableIn)).toBeLessThan(oneStitchIn);
  });

  // Drop Shoulder shares the same corrected infrastructure.
  it("drop shoulder cm neck opening is preserved through the same collector", () => {
    seedCustomBuild({ ...BABY_GAUGE, neckOverrideInches: "5.75", family: "drop-shoulder" });
    const root = measureRoot({ finishedNeckOpeningWidth: "16" });
    const overrides = collectCustomBuildMeasurementOverridesFromDom(root, "cm");
    expect(Number(overrides.finishedNeckOpeningWidth)).toBeCloseTo(6.2992, 3);
  });
});
