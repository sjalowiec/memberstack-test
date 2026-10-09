import { describe, expect, it } from "vitest";
import {
  armholeBindOffDecreaseFromEachSide,
  buildBackJapaneseNotationReplacements,
  formatBindOffNotation,
} from "../sleevelessBackJapaneseNotation";
import { buildSleevelessBackStsRowsDiagramModel } from "../sleevelessBackStsRowsDiagramModel";
import { tryBuildLiveSleevelessBackNotationSvg } from "../sleevelessBackShapingNotationDiagramSvg";
import { tryBuildLiveSleevelessFrontStsRowsDiagramSvg } from "../sleevelessFrontStsRowsDiagramSvg";
import type { ChartRow } from "../sleevelessExpressSizeChartTypes";
import { computeDefaultMeasurementsFromChartRow } from "../sleevelessExpressSizeChartClient";
import { generateSetInSleevePattern } from "../setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "../setInSleeveConstructionIdentity";
import {
  buildSetInSleeveDiagramModel,
  tryBuildSetInSleeveShapingNotationSvg,
  tryBuildSetInSleeveStitchesRowsSvg,
} from "./setInSleeveDiagram";

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

const MEN_4X: ChartRow = {
  bust_or_chest: 48,
  waist: 46,
  hip: 52.5,
  garment_back_length: 29,
  armhole_depth: 12,
  shoulder_width: 21,
  neck_opening: 8.25,
  front_neck_depth: 5.75,
  back_neck_depth: 1.5,
  upper_arm: 20,
  wrist: 8,
  sleeve_length: 19.75,
};

function pattern(options: {
  audience: string;
  row: ChartRow;
  stitchesPerInch: number;
  rowsPerInch: number;
}): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(options.row, "standard", {
    bodyShape: "straight",
  });
  return {
    fit: {
      sizingChart: options.audience,
      easeChoice: "standard",
      selectedMeasurements: measurements,
    },
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: options.audience,
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape: "straight",
      },
      "long",
    ),
    yarnGaugeMachine: {
      gaugeStitchesPerInch: options.stitchesPerInch,
      gaugeRowsPerInch: options.rowsPerInch,
      availableNeedles: 250,
    },
  };
}

const cases = [
  { name: "misses size 7 at 5 sts and 7 rows", audience: "misses", row: MISSES_7, stitchesPerInch: 5, rowsPerInch: 7 },
  { name: "men's 4X at 6 sts and 8 rows", audience: "men", row: MEN_4X, stitchesPerInch: 6, rowsPerInch: 8 },
] as const;

describe("set-in sleeve diagrams use calculated shaping", () => {
  it.each(cases)("$name shows the set-in armhole and sleeve cap", (sample) => {
    const result = generateSetInSleevePattern(
      pattern({
        audience: sample.audience,
        row: sample.row,
        stitchesPerInch: sample.stitchesPerInch,
        rowsPerInch: sample.rowsPerInch,
      }),
    );
    const plan = result.setInArmholePlan;
    const cap = result.sleeveCap;
    expect(plan).toBeTruthy();
    expect(cap).toBeTruthy();
    expect(result.sleevePiece).toBeTruthy();
    if (!plan || !cap || !result.sleevePiece) return;

    const backModel = buildSleevelessBackStsRowsDiagramModel(result, result.debug ? pattern({
      audience: sample.audience,
      row: sample.row,
      stitchesPerInch: sample.stitchesPerInch,
      rowsPerInch: sample.rowsPerInch,
    }) : {});
    expect(backModel).toBeTruthy();
    expect(backModel?.armhole.bindOffStsEachSide).toBe(plan.matchedBindOffStitchesEachSide);
    expect(backModel?.armhole.decreaseStsEachSide).toBe(plan.decreaseStitchesEachSide);
    const sleevelessSplit = armholeBindOffDecreaseFromEachSide(plan.shapingStitchesEachSide);
    if (sleevelessSplit.bindOffSts !== plan.initialBindOffStitchesEachSide) {
      expect(backModel?.armhole.bindOffStsEachSide).not.toBe(sleevelessSplit.bindOffSts);
    }
    const bindOffEvents = backModel?.armhole.events.filter(
      (event) => event.kind === "bindOff" && event.side === "right",
    );
    expect(bindOffEvents?.map((event) => event.amount)).toEqual([
      plan.initialBindOffStitchesEachSide,
      ...plan.stairStepBindOffsEachSide,
    ]);

    const patternData = pattern({
      audience: sample.audience,
      row: sample.row,
      stitchesPerInch: sample.stitchesPerInch,
      rowsPerInch: sample.rowsPerInch,
    });
    const notation = buildBackJapaneseNotationReplacements(result, patternData);
    const notationText = `${notation["jp-armhole-bo"]}\n${notation["jp-armhole-shaping"]}`;
    expect(notation["jp-armhole-bo"]).toBe(formatBindOffNotation(plan.initialBindOffStitchesEachSide));
    for (const stair of plan.stairStepBindOffsEachSide) {
      expect(notationText).toContain(formatBindOffNotation(stair));
    }
    expect(notationText).toContain(`1s-2r-${plan.decreaseStitchesEachSide}x`);
    if (plan.straightRows > 0) expect(notationText).toContain(`${plan.straightRows}r`);

    const backNotationSvg = tryBuildLiveSleevelessBackNotationSvg(result, patternData);
    expect(backNotationSvg).toContain(formatBindOffNotation(plan.initialBindOffStitchesEachSide));
    const frontSvg = tryBuildLiveSleevelessFrontStsRowsDiagramSvg(result, patternData, "in");
    expect(frontSvg).toContain('data-supported="true"');
    expect(frontSvg).toContain(`data-bind-off-sts="${plan.matchedBindOffStitchesEachSide}"`);

    const sleeveModel = buildSetInSleeveDiagramModel({
      sleevePiece: result.sleevePiece,
      sleeveCap: cap,
    });
    expect(sleeveModel?.wristStitches).toBe(result.sleevePiece.wristSts);
    expect(sleeveModel?.upperArmStitches).toBe(cap.sleeve.upperArmStitches);
    expect(sleeveModel?.topStitches).toBe(cap.totals.finalStitches);
    expect(sleeveModel?.capRows).toBe(cap.totals.capRows);
    expect(sleeveModel?.capNotationLines[0]).toBe(
      formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide),
    );
    for (const stair of cap.sleeve.stairStepBindOffsEachSide) {
      expect(sleeveModel?.capNotationLines).toContain(formatBindOffNotation(stair));
    }
    expect(sleeveModel?.capNotationLines.join(" ")).toContain(
      formatBindOffNotation(cap.totals.finalStitches),
    );
    expect(sleeveModel?.capMarks[0]?.stitches).toBe(cap.sleeve.upperArmStitches);
    expect(sleeveModel?.capMarks[sleeveModel.capMarks.length - 1]?.stitches).toBe(
      cap.totals.finalStitches,
    );

    const stsRows = tryBuildSetInSleeveStitchesRowsSvg({
      sleevePiece: result.sleevePiece,
      sleeveCap: cap,
    });
    const shaping = tryBuildSetInSleeveShapingNotationSvg({
      sleevePiece: result.sleevePiece,
      sleeveCap: cap,
    });
    expect(stsRows).toContain(`${result.sleevePiece.wristSts} sts`);
    expect(stsRows).toContain(`${cap.sleeve.upperArmStitches} sts`);
    expect(stsRows).toContain(`${cap.totals.finalStitches} sts`);
    expect(stsRows).toContain(`rc${String(result.sleevePiece.sleeveBodyRows).padStart(3, "0")}`);
    expect(shaping).toContain(formatBindOffNotation(cap.sleeve.initialBindOffStitchesEachSide));
    for (const zone of [cap.workingCap.zones.lower, cap.workingCap.zones.middle, cap.workingCap.zones.upper]) {
      for (const step of zone.steps) {
        expect(shaping).toContain(`${step.stitchesEachSide}s-${step.everyRows}r-${step.times}x`);
      }
    }
  });
});
