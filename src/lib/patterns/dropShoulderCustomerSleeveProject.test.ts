import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderSleeveStitchesRowsModel } from "./dropShoulderSleeveDiagramModel";
import { resolveDropShoulderSleeveOverrideStrings } from "./dropShoulderSleeveMeasurementOverrides";
import { inchesToCmRounded } from "./patternMeasurementDisplayUnit";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { noticesForSavedPattern, savedPatternNoticeText } from "./errata/errataVisibility";
import { dropShoulderSleeveErrataRecord } from "./errata/dropShoulderSleeveErrata";
import { sweaterFinishedMeasurementErrataRecord } from "./errata/sweaterFinishedMeasurementErrata";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";

const MENS_LG: ChartRow = {
  size: "Lg",
  bust_or_chest: 38,
  garment_back_length: 26.5,
  upper_arm: 15,
  wrist: 6.75,
  sleeve_length: 18.5,
};

/** The member's saved project. Read only. */
const CUSTOMER_PROJECT = {
  id: "3cdeae62-1182-4fd8-8e9b-7db0e5424b7a",
  name: "Men's Drop Shoulder",
  family: "sleeveless",
  source: "express",
  createdAt: "2026-10-17T13:57:41.566Z",
  updatedAt: "2026-11-05T22:37:39.848Z",
  version: 2,
  pattern: {
    id: "b96ab502-c119-4a0a-a3b1-8bd98084bdc9",
    patternType: "sleeveless",
    createdAt: "2026-10-17T13:44:48.712Z",
    style: {
      patternMode: "express",
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      sleeveLength: "long",
      recipientCategory: "men",
      bodyShape: "straight",
      frontStyle: "closed",
      neckline: "round",
    },
    fit: {
      sizingChart: "men",
      selectedSize: "Lg",
      easeChoice: "standard",
      fitChoice: "standard",
      selectedMeasurements: {
        finished_bust_chest: 41,
        upper_arm: 15,
        wrist: 6.75,
        sleeve_length: 18.5,
        armhole_depth: 9.5,
      },
      cbMeasurementOverrides: {
        upperArm: "17.0079",
        sleeveLength: "18.5039",
        wrist: "7.5197",
        cuffDepth: "2.0079",
      },
    },
    yarnGauge: {
      gaugeStitchRaw: "19.5",
      gaugeRowRaw: "26.5",
      gaugeRawUnit: "cm",
      stitchGauge: "4.953",
      rowGauge: "6.731",
    },
  },
  customOverrides: { constructionFamily: "drop-shoulder" },
};

function generatorInput() {
  const pattern = CUSTOMER_PROJECT.pattern;
  return {
    ...pattern,
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4.953,
      gaugeRowsPerInch: 6.731,
      gaugeStitchRaw: 19.5,
      gaugeRawUnit: "cm",
      availableNeedles: 150,
    },
  };
}

function visible(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const published = [dropShoulderSleeveErrataRecord()];

describe("Customer's saved Drop Shoulder project", () => {
  it("shows the saved 19.1 cm cuff in the editor and knits 38 stitches", () => {
    const fit = CUSTOMER_PROJECT.pattern.fit;
    const editor = resolveDropShoulderSleeveOverrideStrings({
      overrides: fit.cbMeasurementOverrides,
      chartRow: MENS_LG,
      fitPreference: "standard",
      selectedMeasurements: fit.selectedMeasurements,
      chartAudience: "men",
      userEdited: { upperArm: false, sleeveLength: false, cuffCircumference: false },
      authoritativeStoredCuffAndUpperArm: true,
    });
    expect(editor.wrist).toBe("7.5197");
    expect(editor.upperArm).toBe("17.0079");
    expect(inchesToCmRounded(7.5197)).toBe(19.1);
    expect(inchesToCmRounded(17.0079)).toBe(43.2);

    const result = generateDropShoulderPattern(generatorInput());
    expect(result.debug.dropShoulderWristInches).toBe(7.5);
    expect(result.debug.dropShoulderSleeveWristStitches).toBe(38);
    expect(result.debug.dropShoulderUpperArmInches).toBe(17);
    expect(result.debug.dropShoulderSleeveTopStitches).toBe(84);
    expect(result.debug.armholeDepth).toBe(8.5);

    const screen = visible(
      renderPatternDisplayRowsHtml(result.sleeveDisplayRows, { pieceSectionId: "sleeve" }),
    );
    const print = visible(renderSleevelessPrintPieceHtml(result.sleeveDisplayRows, "", "sleeve"));
    expect(screen).toContain("Cast on 38 stitches");
    expect(print).toContain("Cast on 38 stitches");
    expect(screen).not.toContain("Cast on 34 stitches");
    expect(print).not.toContain("Cast on 34 stitches");

    const diagram = buildDropShoulderSleeveStitchesRowsModel(result, "cuff-up", "cm");
    expect(diagram?.wristWidthLabel).toBe("38 sts\n19.5 cm");
    expect(diagram?.topWidthLabel).toBe("84 sts\n43.1 cm");
  });

  it("shows the sleeve correction for this project and stays quiet for unaffected projects", () => {
    const notices = noticesForSavedPattern(published, CUSTOMER_PROJECT, CUSTOMER_PROJECT.id);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.slug).toBe("drop-shoulder-sleeve-stitches");
    expect(notices[0]?.matchedMeasurements).toEqual(["cuff", "upper-arm"]);
    expect(
      noticesForSavedPattern(
        [dropShoulderSleeveErrataRecord(), sweaterFinishedMeasurementErrataRecord()],
        CUSTOMER_PROJECT,
        CUSTOMER_PROJECT.id,
      ).map((notice) => notice.slug),
    ).toEqual(["drop-shoulder-sleeve-stitches"]);
    const text = savedPatternNoticeText(notices[0]!);
    expect(text).toContain("Cuff stitches, upper-arm stitches, and armhole depth may change");
    expect(text).toContain("already knitting");
    expect(text).toContain("review those changes before you continue");

    const bodySaved = structuredClone(CUSTOMER_PROJECT);
    bodySaved.pattern.fit.cbMeasurementOverrides.wrist = "6.75";
    bodySaved.pattern.fit.cbMeasurementOverrides.upperArm = "15";
    expect(noticesForSavedPattern(published, bodySaved, bodySaved.id)).toEqual([]);

    const missing = structuredClone(CUSTOMER_PROJECT);
    delete (missing.pattern.fit.cbMeasurementOverrides as { wrist?: string }).wrist;
    delete (missing.pattern.fit.cbMeasurementOverrides as { upperArm?: string }).upperArm;
    expect(noticesForSavedPattern(published, missing, missing.id)).toEqual([]);

    const handEdited = structuredClone(CUSTOMER_PROJECT);
    (handEdited.pattern.fit as { dropShoulderUserEditedSleeveFields?: unknown }).dropShoulderUserEditedSleeveFields =
      { upperArm: true, sleeveLength: false, cuffCircumference: true };
    expect(noticesForSavedPattern(published, handEdited, handEdited.id)).toEqual([]);

    const sleeveless = structuredClone(CUSTOMER_PROJECT);
    sleeveless.pattern.style.construction = "sleeveless";
    sleeveless.pattern.style.constructionAuthored = "sleeveless";
    expect(noticesForSavedPattern(published, sleeveless, sleeveless.id)).toEqual([]);

    const createdAfterProvisionalCutoff = structuredClone(CUSTOMER_PROJECT);
    createdAfterProvisionalCutoff.createdAt = "2026-11-06T05:00:00.000Z";
    createdAfterProvisionalCutoff.pattern.createdAt = "2026-11-06T05:00:00.000Z";
    expect(
      noticesForSavedPattern(published, createdAfterProvisionalCutoff, createdAfterProvisionalCutoff.id),
    ).toHaveLength(1);

    const released = dropShoulderSleeveErrataRecord();
    released.matchRules = { ...released.matchRules, correctedAt: "2026-11-06T18:00:00.000Z" };
    const afterRelease = structuredClone(CUSTOMER_PROJECT);
    afterRelease.createdAt = "2026-11-06T18:00:00.000Z";
    afterRelease.pattern.createdAt = "2026-11-06T18:00:00.000Z";
    expect(noticesForSavedPattern([released], afterRelease, afterRelease.id)).toEqual([]);
    const beforeRelease = structuredClone(CUSTOMER_PROJECT);
    beforeRelease.createdAt = "2026-10-17T13:57:41.566Z";
    expect(noticesForSavedPattern([released], beforeRelease, beforeRelease.id)).toHaveLength(1);
  });
});
