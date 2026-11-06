import { describe, expect, it } from "vitest";
import { resolveEffectiveFinishedLengthInches } from "./customBuildEffectiveFinishedLength";
import { resolveEffectiveHemDepthInches } from "./customBuildEffectiveHemDepth";
import { resolveEffectiveArmholeDepthInches } from "./customBuildEffectiveArmholeDepth";
import { resolveEffectiveShoulderWidthInches } from "./customBuildEffectiveShoulderWidth";
import { resolveEffectiveNeckOpeningWidthInches } from "./customBuildEffectiveNeckOpeningWidth";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { reconcileCustomBuildDiagramOverridesAfterSizingChange } from "./customBuildMeasurementOverrideReconcile";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import {
  centimetersToCanonicalInches,
  formatCanonicalInchesFromCm,
  inchesToCmRounded,
} from "./patternMeasurementDisplayUnit";
import { roundUpToEvenRows } from "./hemDefaults";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { classifySavedPatternForErrata } from "./errata/classifySavedPatternErrata";
import {
  savedPatternNoticeText,
  noticesForSavedPattern,
} from "./errata/errataVisibility";
import {
  SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION,
  sweaterFinishedMeasurementErrataRecord,
} from "./errata/sweaterFinishedMeasurementErrata";

const SPI = 5;
const RPI = 7;

const chart = {
  finished_bust_chest: 40,
  finished_hip: 40,
  back_neck_to_hem: 22,
  armhole_depth: 8,
  shoulder_width: 4.25,
  neck_opening: 3,
  front_neck_depth: 3,
  back_neck_depth: 1.5,
  upper_arm: 15,
  wrist: 6.75,
  sleeve_length: 18.5,
};

const edited = {
  finishedLength: "26",
  hemDepth: "4",
  armholeDepth: "10",
  shoulderWidth: "5.5",
  finishedNeckOpeningWidth: "5",
  neckDepth: "6",
};

function sweater(args: {
  mode?: string;
  construction?: "sleeveless" | "drop-shoulder" | "set-in";
  overrides?: Record<string, string>;
  measurements?: Record<string, number>;
}): Record<string, unknown> {
  let style: Record<string, unknown> = {
    patternMode: args.mode ?? "express",
    recipientCategory: "men",
    bodyShape: "straight",
    frontStyle: "closed",
    neckline: "round",
  };
  if (args.construction === "drop-shoulder") {
    style = withDropShoulderConstructionAuthored(style, "long");
  }
  if (args.construction === "set-in") {
    style = { ...style, construction: "set-in-sleeve", constructionAuthored: "set-in-sleeve" };
  }
  return {
    fit: {
      sizingChart: "men",
      selectedSize: "Lg",
      easeChoice: "standard",
      selectedMeasurements: { ...chart, ...args.measurements },
      cbMeasurementOverrides: args.overrides ?? {},
    },
    style,
    yarnGaugeMachine: { gaugeStitchesPerInch: SPI, gaugeRowsPerInch: RPI, availableNeedles: 200 },
  };
}

function instructionText(rows: Parameters<typeof renderPatternDisplayRowsHtml>[0]): {
  screen: string;
  print: string;
} {
  return {
    screen: renderPatternDisplayRowsHtml(rows),
    print: renderSleevelessPrintPieceHtml(rows, "", "back"),
  };
}

describe("saved finished measurements are used after a direct reopen", () => {
  it("uses every editable Express body measurement for sleeveless stitches and rows", () => {
    const saved = sweater({ overrides: edited });
    const baseline = sweater({});
    expect(resolveEffectiveFinishedLengthInches(saved)).toBe(26);
    expect(resolveEffectiveHemDepthInches(saved, "men")).toBe(4);
    expect(resolveEffectiveArmholeDepthInches(saved)).toBe(10);
    expect(resolveEffectiveShoulderWidthInches(saved)).toBe(5.5);
    expect(resolveEffectiveNeckOpeningWidthInches(saved)).toBe(5);
    expect(resolveEffectiveFrontNeckDepthInches(saved)).toBe(6);
    expect(resolveEffectiveBackNeckDepthInches(saved)).toBe(1);

    const generated = generateSleevelessBackPattern(saved);
    const original = generateSleevelessBackPattern(baseline);
    expect(generated.debug.backNeckToHem).toBe(26);
    expect(generated.debug.hemRows).toBe(roundUpToEvenRows(4 * RPI));
    expect(generated.debug.armholeDepth).toBe(10);
    expect(generated.debug.shoulderWidthInches).toBe(5.5);
    expect(generated.debug.necklineWidthInches).toBe(5);
    expect(generated.debug.frontNeckDepth).toBe(6);
    expect(generated.debug.expectedGarmentRows).toBeGreaterThan(original.debug.expectedGarmentRows!);

    const back = instructionText(generated.displayRows);
    const hemSentence = "The finished hem is 100 stitches and 28 rows deep.";
    expect(back.screen).toContain(hemSentence);
    expect(back.print).toContain(hemSentence);
    expect(back.screen).toContain("Knit to RC 112.");
    expect(back.print).toContain("Knit to RC 112.");
    const baselineText = instructionText(original.displayRows);
    expect(baselineText.screen).not.toContain(hemSentence);
    expect(baselineText.print).not.toContain("Knit to RC 112.");
  });

  it("uses the same saved measurements for a Set-In Sleeve body", () => {
    const saved = sweater({ construction: "set-in", overrides: edited });
    const generated = generateSetInSleevePattern(saved);
    expect(generated.debug.backNeckToHem).toBe(26);
    expect(generated.debug.armholeDepth).toBe(10);
    expect(generated.debug.shoulderWidthInches).toBe(5.5);
    const overview = instructionText(generated.overviewRows);
    expect(overview.screen).toContain("Length 26 in");
    expect(overview.print).toContain("Length 26 in");
    expect(overview.screen).toContain("Armhole depth 10 in");
    expect(overview.print).toContain("Armhole depth 10 in");
  });

  it("keeps Drop Shoulder armhole and shoulder width on their construction rules", () => {
    const saved = sweater({
      construction: "drop-shoulder",
      overrides: { ...edited, shoulderWidth: "20", armholeDepth: "12" },
    });
    expect(resolveEffectiveShoulderWidthInches(saved)).toBe(4.25);
    const generated = generateDropShoulderPattern(saved);
    expect(generated.debug.backNeckToHem).toBe(26);
    expect(generated.debug.frontNeckDepth).toBe(6);
    expect(generated.debug.necklineWidthInches).toBe(5);
    expect(generated.debug.armholeDepth).toBe(7.5);
    expect(generated.debug.shoulderWidthInches).toBe(4.25);
    const back = instructionText(generated.displayRows);
    const hemSentence = "The finished hem is 100 stitches and 28 rows deep.";
    expect(back.screen).toContain(hemSentence);
    expect(back.print).toContain(hemSentence);
    expect(back.screen).toContain("Knit 46 rows even.");
    expect(back.print).toContain("Knit 46 rows even.");
    expect(back.screen).not.toContain("84 rows");
    expect(back.print).not.toContain("84 rows");
  });
});

describe("size changes and both units", () => {
  const large: ChartRow = {
    size: "Lg",
    bust_or_chest: 38,
    garment_back_length: 26.5,
    armhole_depth: 9.5,
    shoulder_width: 17.5,
    neck_opening: 6.5,
    front_neck_depth: 4.5,
  };
  const medium: ChartRow = {
    size: "Med",
    bust_or_chest: 36,
    garment_back_length: 26,
    armhole_depth: 9.25,
    shoulder_width: 17,
    neck_opening: 6.25,
    front_neck_depth: 4.25,
  };

  it("keeps a typed length and replaces an unedited centimeter round-trip on a size change", () => {
    const uneditedCm = formatCanonicalInchesFromCm(centimetersToCanonicalInches(inchesToCmRounded(26.5)));
    const reconciled = reconcileCustomBuildDiagramOverridesAfterSizingChange({
      previousRow: large,
      previousFit: "standard",
      currentRow: medium,
      currentFit: "standard",
      overrides: { finishedLength: uneditedCm, neckDepth: "6" },
      audience: "men",
    });
    expect(reconciled.finishedLength).toBe("26");
    expect(reconciled.neckDepth).toBe("6");

    const generated = generateSleevelessBackPattern(
      sweater({
        overrides: reconciled,
        measurements: { back_neck_to_hem: 26, front_neck_depth: 4.25 },
      }),
    );
    expect(generated.debug.backNeckToHem).toBe(26);
    expect(generated.debug.frontNeckDepth).toBe(6);
  });

  it("knits a centimeter entry from the saved inches and shows that centimeter again", () => {
    const stored = formatCanonicalInchesFromCm(centimetersToCanonicalInches(71.1));
    const inches = Number(stored);
    expect(inchesToCmRounded(inches)).toBe(71.1);
    const saved = sweater({ overrides: { finishedLength: stored } });
    expect(resolveEffectiveFinishedLengthInches(saved)).toBe(inches);
    const generated = generateSleevelessBackPattern(saved);
    expect(generated.debug.backNeckToHem).toBe(inches);
    expect(generated.debug.expectedGarmentRows).toBe(roundUpToEvenRows(inches * RPI));

    const inchSaved = sweater({ overrides: { finishedLength: "28" } });
    const fromInches = generateSleevelessBackPattern(inchSaved);
    expect(fromInches.debug.backNeckToHem).toBe(28);
    expect(fromInches.debug.expectedGarmentRows).toBe(roundUpToEvenRows(28 * RPI));
  });
});

describe("correction notice for patterns whose instructions change", () => {
  const errata = sweaterFinishedMeasurementErrataRecord();

  function project(pattern: Record<string, unknown>, createdAt: string | null) {
    return {
      createdAt,
      pattern: { patternType: "sleeveless", ...pattern, createdAt },
    };
  }

  it("notices an Express pattern whose saved edits change the stitch or row count", () => {
    const saved = project(
      sweater({ overrides: edited }),
      "2026-10-01T00:00:00.000Z",
    );
    const match = classifySavedPatternForErrata(saved, errata);
    expect(match.classification).toBe("old_default");
    expect(match.matchedMeasurements).toEqual([
      "garment-length",
      "hem-depth",
      "armhole-depth",
      "shoulder-width",
      "neck-opening",
      "front-neck-depth",
    ]);
    const notices = noticesForSavedPattern([errata], saved, "project-1");
    expect(notices).toHaveLength(1);
    expect(savedPatternNoticeText(notices[0]!)).toBe(SWEATER_FINISHED_MEASUREMENTS_KNITTER_ACTION);
  });

  it("does not notice an unedited centimeter round-trip, Custom Build, or a Drop Shoulder shoulder width", () => {
    const roundTrip = formatCanonicalInchesFromCm(
      centimetersToCanonicalInches(inchesToCmRounded(22)),
    );
    expect(
      classifySavedPatternForErrata(
        project(sweater({ overrides: { finishedLength: roundTrip } }), "2026-10-01T00:00:00.000Z"),
        errata,
      ).classification,
    ).toBe("current_default");

    expect(
      classifySavedPatternForErrata(
        project(sweater({ mode: "custom-build", overrides: edited }), "2026-10-01T00:00:00.000Z"),
        errata,
      ).classification,
    ).toBe("current_default");

    expect(
      classifySavedPatternForErrata(
        project(
          sweater({ construction: "drop-shoulder", overrides: { shoulderWidth: "20", armholeDepth: "12" } }),
          "2026-10-01T00:00:00.000Z",
        ),
        errata,
      ).classification,
    ).toBe("current_default");

    const dropShoulderLength = classifySavedPatternForErrata(
      project(
        sweater({ construction: "drop-shoulder", overrides: { finishedLength: "28" } }),
        "2026-10-01T00:00:00.000Z",
      ),
      errata,
    );
    expect(dropShoulderLength.classification).toBe("old_default");
    expect(dropShoulderLength.matchedMeasurements).toEqual(["garment-length"]);

    expect(
      classifySavedPatternForErrata(
        project(sweater({ overrides: edited }), "2026-11-06T05:00:00.000Z"),
        errata,
      ).classification,
    ).toBe("old_default");

    expect(
      classifySavedPatternForErrata(
        project(sweater({ overrides: edited }), null),
        errata,
      ).classification,
    ).toBe("old_default");

    const released = sweaterFinishedMeasurementErrataRecord();
    released.matchRules = { ...released.matchRules, correctedAt: "2026-11-06T18:00:00.000Z" };
    expect(
      classifySavedPatternForErrata(
        project(sweater({ overrides: edited }), "2026-11-06T18:00:00.000Z"),
        released,
      ).classification,
    ).toBe("current_default");
    expect(
      classifySavedPatternForErrata(project(sweater({ overrides: edited }), null), released).classification,
    ).toBe("uncertain");
  });
});
