import { describe, expect, it } from "vitest";
import { buildDropShoulderSleeveStitchesRowsModel } from "./dropShoulderSleeveDiagramModel";
import {
  dropShoulderSleeveDefaultsFromChartRow,
  reconcileDropShoulderSleeveOverridesForSizeChange,
  resolveDropShoulderSleeveInches,
  resolveDropShoulderSleeveOverrideStrings,
  scaleDropShoulderCuffCircumferenceInches,
} from "./dropShoulderSleeveMeasurementOverrides";
import { buildDropShoulderSleeveDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { centimetersToCanonicalInches } from "./patternMeasurementDisplayUnit";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { evenPositiveBodyStitches } from "./sleevelessBodyStitchMath";
import { findExpressChartRow } from "./sleevelessExpressSizeChartClient";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { withDropShoulderConstructionAuthored } from "./patternConstructionIdentity";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import type { DropShoulderUserEditedSleeveFields } from "./dropShoulderUserEditedSleeveFields";

/** Men's Large chart body. Standard adult ease is +2 in upper arm and +0.75 in wrist. */
const MENS_LG: ChartRow = {
  size: "Lg",
  bust_or_chest: 38,
  garment_back_length: 26.5,
  upper_arm: 15,
  wrist: 6.75,
  sleeve_length: 18.5,
};

const SPI_PER_10_CM = (19.5 / 10) * 2.54;
const NONE_EDITED: DropShoulderUserEditedSleeveFields = {
  upperArm: false,
  sleeveLength: false,
  cuffCircumference: false,
};

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pattern(args: {
  sleeveLength?: string;
  overrides?: Record<string, string>;
  userEdited?: DropShoulderUserEditedSleeveFields;
  spi?: number;
  gaugeRawUnit?: "in" | "cm";
  gaugeStitchRaw?: number;
}) {
  return {
    style: withDropShoulderConstructionAuthored(
      {
        frontStyle: "closed",
        neckline: "round",
        patternMode: "custom-build",
        recipientCategory: "men",
        bodyShape: "straight",
      },
      args.sleeveLength ?? "long",
    ),
    fit: {
      sizingChart: "men",
      selectedSize: "Lg",
      easeChoice: "standard",
      selectedMeasurements: {
        finished_bust_chest: 41,
        back_neck_to_hem: 26.5,
        upper_arm: 15,
        wrist: 6.75,
        sleeve_length: 18.5,
      },
      cbMeasurementOverrides: {
        cuffDepth: "2",
        sleeveLength: "18.5",
        ...(args.overrides ?? {}),
      },
      ...(args.userEdited ? { dropShoulderUserEditedSleeveFields: args.userEdited } : {}),
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: args.spi ?? SPI_PER_10_CM,
      gaugeRowsPerInch: 7,
      gaugeStitchRaw: args.gaugeStitchRaw ?? 19.5,
      gaugeRawUnit: args.gaugeRawUnit ?? "cm",
      availableNeedles: 200,
    },
  };
}

function finishedStandard(): Record<string, string> {
  return dropShoulderSleeveDefaultsFromChartRow(MENS_LG, "standard", { chartAudience: "men" });
}

describe("Drop shoulder generation consumes stored finished cuff and upper arm", () => {
  it("does not have the sweater chart loaded, so generation cannot rebuild from the chart row", () => {
    expect(findExpressChartRow("men", "Lg")).toBeNull();
  });

  it("uses the stored finished 7.5 in cuff (19.1 cm) instead of the 6.75 in body wrist", () => {
    const stored = finishedStandard();
    expect(stored.wrist).toBe("7.5");
    expect(stored.upperArm).toBe("17");

    const before = generateDropShoulderPattern(
      pattern({ overrides: { wrist: "6.75", upperArm: "15" } }),
    );
    const after = generateDropShoulderPattern(pattern({ overrides: stored }));

    expect(before.debug.dropShoulderWristInches).toBe(6.75);
    expect(before.debug.dropShoulderSleeveWristStitches).toBe(34);
    expect(before.debug.dropShoulderUpperArmInches).toBe(15);
    expect(before.debug.armholeDepth).toBe(7.5);
    expect(before.debug.dropShoulderSleeveTopStitches).toBe(
      evenPositiveBodyStitches(15 * SPI_PER_10_CM),
    );

    expect(after.debug.dropShoulderWristInches).toBe(7.5);
    expect(after.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(after.debug.dropShoulderUpperArmInches).toBe(17);
    expect(after.debug.armholeDepth).toBe(8.5);
    expect(after.debug.dropShoulderSleeveTopStitches).toBe(
      evenPositiveBodyStitches(17 * SPI_PER_10_CM),
    );
    expect(after.debug.dropShoulderSleeveWristStitches).not.toBe(
      evenPositiveBodyStitches((7.5 + 0.75) * SPI_PER_10_CM),
    );
  });

  it("matches the editor, the screen instructions, and the print for that stored finished cuff", () => {
    const stored = finishedStandard();
    const editor = resolveDropShoulderSleeveInches({
      overrides: stored,
      chartRow: MENS_LG,
      fitPreference: "standard",
      chartAudience: "men",
      sleeveLengthChoice: "long",
      userEdited: NONE_EDITED,
    });
    const result = generateDropShoulderPattern(pattern({ overrides: stored }));
    expect(result.debug.dropShoulderWristInches).toBe(editor.wristIn);
    expect(result.debug.dropShoulderUpperArmInches).toBe(editor.upperArmIn);
    expect(result.debug.armholeDepth).toBe((editor.upperArmIn ?? 0) / 2);

    const wristSts = result.debug.dropShoulderSleeveWristStitches ?? 0;
    const screen = visible(
      renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" }),
    );
    const print = visible(renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve"));
    expect(screen).toContain(`Cast on ${wristSts} stitches`);
    expect(print).toContain(`Cast on ${wristSts} stitches`);
    expect(screen).toContain(`${wristSts} stitches`);
    expect(print).toContain(`${wristSts} stitches`);

    const diagram = buildDropShoulderSleeveStitchesRowsModel(result, "cuff-up", "cm");
    expect(diagram?.wristWidthLabel).toBe("38 sts / 19.5 cm");
    expect(diagram?.topWidthLabel).toBe("84 sts / 43.1 cm");
    const inches = buildDropShoulderSleeveStitchesRowsModel(result, "cuff-up", "in");
    expect(inches?.wristWidthLabel).toBe("38 sts / 7.7 in");
  });

  it("keeps a hand-edited cuff and does not add ease or taper it", () => {
    const result = generateDropShoulderPattern(
      pattern({
        overrides: { wrist: "7.5197", upperArm: "17" },
        userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: true },
        sleeveLength: "short",
      }),
    );
    expect(result.debug.dropShoulderWristInches).toBe(7.5);
    expect(result.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(result.debug.dropShoulderUpperArmInches).toBe(17);
  });

  it("keeps a hand-edited upper arm and still tapers an unedited full wrist once", () => {
    const result = generateDropShoulderPattern(
      pattern({
        overrides: { wrist: "7.5", upperArm: "16" },
        userEdited: { upperArm: true, sleeveLength: false, cuffCircumference: false },
        sleeveLength: "short",
      }),
    );
    expect(result.debug.dropShoulderUpperArmInches).toBe(16);
    expect(result.debug.armholeDepth).toBe(8);
    expect(result.debug.dropShoulderWristInches).toBe(16);
  });

  it("applies each shorter-sleeve opening once from the stored full wrist", () => {
    const stored = finishedStandard();
    for (const choice of ["long", "three-quarter", "elbow", "short"] as const) {
      const expected = scaleDropShoulderCuffCircumferenceInches(17, 7.5, choice);
      const result = generateDropShoulderPattern(
        pattern({ overrides: stored, sleeveLength: choice }),
      );
      expect(result.debug.dropShoulderWristInches, choice).toBe(expected);
      expect(result.debug.dropShoulderUpperArmInches, choice).toBe(17);
      expect(result.debug.armholeDepth, choice).toBe(8.5);
      expect(result.debug.dropShoulderSleeveWristStitches, choice).toBe(
        evenPositiveBodyStitches((expected ?? 0) * SPI_PER_10_CM),
      );
    }
  });

  it("gives the same cuff stitches for the equivalent 4-inch gauge and after a second generate", () => {
    const stored = finishedStandard();
    const cm = generateDropShoulderPattern(pattern({ overrides: stored }));
    const inches = generateDropShoulderPattern(
      pattern({
        overrides: stored,
        spi: 19.81 / 4,
        gaugeRawUnit: "in",
        gaugeStitchRaw: 19.81,
      }),
    );
    const reopened = generateDropShoulderPattern(pattern({ overrides: stored }));
    expect(cm.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(inches.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(reopened.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(reopened.debug.dropShoulderUpperArmInches).toBe(cm.debug.dropShoulderUpperArmInches);
  });

  it("follows a size or fit rewrite of the stored finished measurements", () => {
    const med: ChartRow = { ...MENS_LG, size: "Med", upper_arm: 13, wrist: 6.5 };
    const resized = reconcileDropShoulderSleeveOverridesForSizeChange(
      finishedStandard(),
      med,
      "standard",
      NONE_EDITED,
      { chartAudience: "men" },
    );
    const refit = reconcileDropShoulderSleeveOverridesForSizeChange(
      finishedStandard(),
      MENS_LG,
      "close",
      NONE_EDITED,
      { chartAudience: "men" },
    );
    const afterSize = generateDropShoulderPattern(pattern({ overrides: resized }));
    const afterFit = generateDropShoulderPattern(pattern({ overrides: refit }));
    expect(afterSize.debug.dropShoulderUpperArmInches).toBe(15);
    expect(afterSize.debug.dropShoulderWristInches).toBe(7.25);
    expect(afterFit.debug.dropShoulderUpperArmInches).toBe(16);
    expect(afterFit.debug.dropShoulderWristInches).toBe(7.25);
    expect(afterFit.debug.armholeDepth).toBe(8);
  });
});

describe("Older drop-shoulder saves without a reliable finished sleeve", () => {
  it("does not add ease when the stored cuff and upper arm are still the body measurements", () => {
    const result = generateDropShoulderPattern(
      pattern({ overrides: { wrist: "6.75", upperArm: "15" } }),
    );
    const editor = resolveDropShoulderSleeveInches({
      overrides: { wrist: "6.75", upperArm: "15", sleeveLength: "18.5" },
      chartRow: MENS_LG,
      fitPreference: "standard",
      chartAudience: "men",
      sleeveLengthChoice: "long",
      userEdited: NONE_EDITED,
    });
    expect(result.debug.dropShoulderWristInches).toBe(6.75);
    expect(result.debug.dropShoulderSleeveWristStitches).toBe(34);
    expect(result.debug.dropShoulderUpperArmInches).toBe(15);
    expect(result.debug.armholeDepth).toBe(7.5);
    expect(editor.wristIn).toBe(7.5);
    expect(editor.upperArmIn).toBe(17);
  });

  it("does not invent ease when the cuff and upper arm were never stored", () => {
    const result = generateDropShoulderPattern(pattern({}));
    expect(result.debug.dropShoulderWristInches).toBe(6.75);
    expect(result.debug.dropShoulderSleeveWristStitches).toBe(34);
    expect(result.debug.dropShoulderUpperArmInches).toBe(15);
    expect(findExpressChartRow("men", "Lg")).toBeNull();
  });

  it("uses the saved body cuff in the editor and in generation, and does not add ease", () => {
    const stored = { wrist: "6.75", upperArm: "15", sleeveLength: "18.5" };
    const editor = resolveDropShoulderSleeveOverrideStrings({
      overrides: stored,
      chartRow: MENS_LG,
      fitPreference: "standard",
      chartAudience: "men",
      selectedMeasurements: { wrist: 6.75, upper_arm: 15, sleeve_length: 18.5 },
      userEdited: NONE_EDITED,
      authoritativeStoredCuffAndUpperArm: true,
    });
    const generated = generateDropShoulderPattern(pattern({ overrides: stored }));
    expect(editor.wrist).toBe("6.75");
    expect(editor.upperArm).toBe("15");
    expect(generated.debug.dropShoulderWristInches).toBe(6.75);
    expect(generated.debug.dropShoulderSleeveWristStitches).toBe(34);
    expect(generated.debug.dropShoulderUpperArmInches).toBe(15);
    expect(generated.debug.armholeDepth).toBe(7.5);
  });
});

describe("Screenshot cuff label", () => {
  it("labels 34 cuff stitches with their knitted width, 17.4 cm", () => {
    const body = generateDropShoulderPattern(
      pattern({ overrides: { wrist: "6.75", upperArm: "15" } }),
    );
    const bodyDiagram = buildDropShoulderSleeveStitchesRowsModel(body, "cuff-up", "cm");
    const bodySvg = buildDropShoulderSleeveDiagramReplacements(body, "cm");
    expect(bodyDiagram?.wristWidthLabel).toBe("34 sts / 17.4 cm");
    expect(bodySvg.WRIST_STS).toBe("34");
    expect(bodySvg.WRIST_WIDTH).toBe("17.1");

    const entered = centimetersToCanonicalInches(17.4);
    const typed = generateDropShoulderPattern(
      pattern({
        overrides: {
          wrist: String(entered),
          upperArm: "15",
        },
      }),
    );
    const typedDiagram = buildDropShoulderSleeveStitchesRowsModel(typed, "cuff-up", "cm");
    expect(typed.debug.dropShoulderWristInches).toBe(6.75);
    expect(typed.debug.dropShoulderSleeveWristStitches).toBe(34);
    expect(typedDiagram?.wristWidthLabel).toBe("34 sts / 17.4 cm");
  });
});
