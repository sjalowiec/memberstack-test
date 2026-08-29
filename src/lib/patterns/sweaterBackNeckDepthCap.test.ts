import { describe, expect, it } from "vitest";
import {
  resolveEffectiveBackNeckDepthInches,
  resolveEffectiveFrontNeckDepthInches,
} from "./customBuildEffectiveNeckDepth";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildDropShoulderBodyDiagramReplacements } from "./dropShoulderBodyNotationSvg";
import { buildDropShoulderBackStitchesRowsModel } from "./dropShoulderPatternDiagramModel";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildSleevelessBackStsRowsDiagramModel } from "./sleevelessBackStsRowsDiagramModel";
import { buildSleevelessGarmentDiagramReplacements } from "./sleevelessGarmentDiagramReplacements";
import { normalizeRoundNecklineDepthRows } from "./legoBlocks/roundNeckline";

/**
 * Men's 5X chart `back_neck_depth` is 1.75″ (`public/data/sizing_sweaters_men.json`).
 * The sweater Lego block must cap that at 1″ for every construction.
 */
const MENS_5X_CHART_BACK_NECK_DEPTH = 1.75;

const MENS_5X_MEASUREMENTS = {
  finished_bust_chest: 50,
  back_neck_to_hem: 29,
  armhole_depth: 12.5,
  neck_opening: 8.5,
  shoulder_width: 22,
  front_neck_depth: 6,
  back_neck_depth: MENS_5X_CHART_BACK_NECK_DEPTH,
  upper_arm: 22,
  wrist: 8.25,
  sleeve_length: 20,
};

function mens5XSleeveless(rpi: number): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "men",
      selectedSize: "5X",
      selectedMeasurements: { ...MENS_5X_MEASUREMENTS },
    },
    style: {
      garmentStyle: "pullover",
      neckline: "round",
      frontStyle: "closed",
      recipientCategory: "men",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: rpi,
      availableNeedles: 200,
    },
  };
}

function mens5XDropShoulder(rpi: number): Record<string, unknown> {
  return {
    ...mens5XSleeveless(rpi),
    style: {
      construction: "drop-shoulder",
      constructionAuthored: "drop-shoulder",
      garmentStyle: "pullover",
      neckline: "round",
      frontStyle: "closed",
      recipientCategory: "men",
    },
  };
}

function expectedBackNeckRows(inches: number, rpi: number): number {
  return normalizeRoundNecklineDepthRows(Math.round(inches * rpi));
}

describe("sweater back neck depth cap — Men's 5X (chart 1.75″)", () => {
  it("caps Drop Shoulder and Sleeveless at 1 inch / 6 rows at 6 rpi (not 12 rows / 2 in)", () => {
    const sleevelessData = mens5XSleeveless(6);
    const dropData = mens5XDropShoulder(6);

    expect(resolveEffectiveBackNeckDepthInches(sleevelessData)).toBe(1);
    expect(resolveEffectiveBackNeckDepthInches(dropData)).toBe(1);
    expect(resolveEffectiveFrontNeckDepthInches(sleevelessData)).toBe(6);

    const sleeveless = generateSleevelessBackPattern(sleevelessData);
    const drop = generateDropShoulderPattern(dropData);

    expect(sleeveless.debug.backNeckDepthRows).toBe(6);
    expect(drop.debug.backNeckDepthRows).toBe(6);
    expect(sleeveless.debug.backNeckDepthRows).not.toBe(12);
    expect(drop.debug.backNeckDepthRows).not.toBe(12);

    expect(sleeveless.debug.frontNeckDepth).toBe(6);
    expect(drop.debug.frontNeckDepth).toBe(6);

    const sleevelessRepl = buildSleevelessGarmentDiagramReplacements(sleeveless, "in", {
      patternData: sleevelessData,
      measurementPiece: "back",
    });
    expect(sleevelessRepl.NECK_DEPTH).toBe("1");
    expect(sleevelessRepl.NECK_DEPTH_ROWS).toBe("6");

    const dropRepl = buildDropShoulderBodyDiagramReplacements(drop, "in", {
      patternData: dropData,
      measurementPiece: "back",
    });
    expect(dropRepl.NECK_DEPTH).toBe("1");
    expect(dropRepl.NECK_DEPTH_ROWS).toBe("6");

    const dropModel = buildDropShoulderBackStitchesRowsModel(drop, "in");
    expect(dropModel).not.toBeNull();
    expect(dropModel!.backNeckDepthRows).toBe(6);
    expect(dropModel!.necklineDepthLabel).toBe("6 rows / 1 in");
    expect(dropModel!.necklineDepthLabel).not.toBe("12 rows / 2 in");

    const sleevelessModel = buildSleevelessBackStsRowsDiagramModel(sleeveless, sleevelessData);
    expect(sleevelessModel).not.toBeNull();
    expect(sleevelessModel!.rows.backNeckDepthRows).toBe(6);
    expect(sleevelessModel!.neckline.depthRows).toBe(6);

    expect(drop.debug.backNecklineStartRC).toBe(drop.debug.finalRC! - drop.debug.backNeckDepthRows);
  });

  it("keeps even-row normalization: 1 inch is 8 rows at 7 rpi and at 8 rpi", () => {
    for (const rpi of [7, 8]) {
      const expected = expectedBackNeckRows(1, rpi);
      expect(expected).toBe(8);

      const sleeveless = generateSleevelessBackPattern(mens5XSleeveless(rpi));
      const drop = generateDropShoulderPattern(mens5XDropShoulder(rpi));
      expect(sleeveless.debug.backNeckDepthRows).toBe(8);
      expect(drop.debug.backNeckDepthRows).toBe(8);
    }
  });

  it("preserves chart values below 1 inch through both generators", () => {
    const shallowMeasurements = { ...MENS_5X_MEASUREMENTS, back_neck_depth: 0.5 };
    const sleevelessData = {
      ...mens5XSleeveless(6),
      fit: { sizingChart: "men", selectedMeasurements: shallowMeasurements },
    };
    const dropData = {
      ...mens5XDropShoulder(6),
      fit: { sizingChart: "men", selectedMeasurements: shallowMeasurements },
    };

    expect(resolveEffectiveBackNeckDepthInches(sleevelessData)).toBe(0.5);
    expect(generateSleevelessBackPattern(sleevelessData).debug.backNeckDepthRows).toBe(4);
    expect(generateDropShoulderPattern(dropData).debug.backNeckDepthRows).toBe(4);
  });
});

describe("sleeveless missing back_neck_depth fallback", () => {
  it("does not use 2.5 inches when the chart field is missing", () => {
    const { back_neck_depth: _omit, ...rest } = MENS_5X_MEASUREMENTS;
    const data: Record<string, unknown> = {
      ...mens5XSleeveless(6),
      fit: { sizingChart: "men", selectedMeasurements: rest },
    };
    expect(resolveEffectiveBackNeckDepthInches(data)).toBeUndefined();

    const result = generateSleevelessBackPattern(data);
    expect(result.debug.backNeckDepthRows).toBe(6);
    expect(result.debug.backNeckDepthRows).not.toBe(
      normalizeRoundNecklineDepthRows(Math.round(2.5 * 6)),
    );
  });
});
