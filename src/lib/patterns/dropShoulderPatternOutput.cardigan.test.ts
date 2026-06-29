import { describe, expect, it } from "vitest";
import { splitBodyBackCastOnToSymmetricCardiganHalves } from "./cardiganFrontBlock";
import {
  buildDropShoulderFrontJapaneseNotationReplacements,
} from "./dropShoulderBodyJapaneseNotation";
import { buildDropShoulderBodyDiagramReplacements } from "./dropShoulderBodyNotationSvg";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { extractCastOnFromRows } from "./testScenarios/sleevelessPatternQaMatrix";

/** Men's Med ù matches `public/data/sizing_sweaters_men.json`. */
const MENS_MED_CHART_ROW: ChartRow = {
  size: "Med",
  bust_or_chest: 36,
  waist: 30,
  hip: 19.25,
  garment_back_length: 26,
  armhole_depth: 9,
  shoulder_width: 16.5,
  neck_opening: 6.5,
  front_neck_depth: 4.25,
  back_neck_depth: 1,
  upper_arm: 13,
  wrist: 6.5,
  sleeve_length: 18.25,
};

/** Misses size 8 ù matches `public/data/sizing_sweaters_misses.json`. */
const MISSES_8_CHART_ROW: ChartRow = {
  size: 8,
  bust_or_chest: 42,
  waist: 33,
  hip: 44,
  garment_back_length: 25,
  armhole_depth: 8,
  shoulder_width: 14.25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12.5,
  wrist: 6.25,
  sleeve_length: 17,
};

function castOnFromJpNotation(token: string | undefined): number | undefined {
  if (!token) return undefined;
  const m = token.match(/^co(\d+)$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function mensMedCardiganPatternData(neckline: "round" | "v"): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "men",
      selectedSize: "Med",
      easeChoice: "close",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        MENS_MED_CHART_ROW,
        "close",
        { bodyShape: "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "men",
      neckline: neckline === "v" ? "v" : "round",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 6,
      availableNeedles: 200,
    },
  };
}

function misses8CardiganPatternData(neckline: "round" | "v"): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedSize: 8,
      easeChoice: "standard",
      selectedMeasurements: computeDefaultMeasurementsFromChartRow(
        MISSES_8_CHART_ROW,
        "standard",
        { bodyShape: "straight" },
      ),
    },
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      recipientCategory: "misses",
      neckline: neckline === "v" ? "v" : "round",
      bodyShape: "straight",
      frontStyle: "open",
      garmentStyle: "cardigan",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function expectCardiganFrontCastOnAgreement(
  patternData: Record<string, unknown>,
  label: string,
): void {
  const result = generateDropShoulderPattern(patternData);
  const backHem = result.debug.hemCastOnStitches ?? result.debug.backStitches;
  expect(backHem, label).toBeGreaterThan(0);

  const writtenFront = extractCastOnFromRows(result.frontDisplayRows);
  const diagramFront = Number(
    buildDropShoulderBodyDiagramReplacements(result, "in", {
      patternData,
      measurementPiece: "front",
      cardiganHalfSide: "left",
    }).HIP_STS,
  );
  const jpFront = castOnFromJpNotation(
    buildDropShoulderFrontJapaneseNotationReplacements(result, patternData)["jp-caston"],
  );
  const expectedHalf = splitBodyBackCastOnToSymmetricCardiganHalves(backHem!).leftFrontWidthSts;

  expect(writtenFront, `${label} written`).toBe(expectedHalf);
  expect(diagramFront, `${label} diagram`).toBe(expectedHalf);
  expect(jpFront, `${label} jp`).toBe(expectedHalf);
  expect(result.debug.cardiganHalfLeftCastOnSts, `${label} debug`).toBe(expectedHalf);
}

describe("generateDropShoulderPattern cardigan front cast-on", () => {
  it("Men's Med 16/24 round: written, diagram, and JP agree on left-front cast-on", () => {
    expectCardiganFrontCastOnAgreement(mensMedCardiganPatternData("round"), "mens-med-16/24-round");
  });

  it("Men's Med 16/24 V-neck: written, diagram, and JP agree on left-front cast-on", () => {
    expectCardiganFrontCastOnAgreement(mensMedCardiganPatternData("v"), "mens-med-16/24-v");
  });

  it("Misses 8 5/7 round: written, diagram, and JP agree on left-front cast-on", () => {
    expectCardiganFrontCastOnAgreement(misses8CardiganPatternData("round"), "misses-8-5/7-round");
  });

  it("Misses 8 5/7 V-neck: written, diagram, and JP agree on left-front cast-on", () => {
    expectCardiganFrontCastOnAgreement(misses8CardiganPatternData("v"), "misses-8-5/7-v");
  });
});
