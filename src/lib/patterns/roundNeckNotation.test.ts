import { describe, expect, it } from "vitest";
import { initialCenterNeckStitches } from "./legoBlocks/roundNeckline";
import { cardiganFrontInitialNeckBindOffStitches } from "./roundNeckNotation";
import { buildFrontJapaneseNotationReplacements, pulloverRoundFrontNeckEdgeNotationLines } from "./sleevelessFrontJapaneseNotation";
import { formatBindOffNotation } from "./sleevelessBackJapaneseNotation";
import {
  generateSleevelessBackPattern,
  initialNeckBindOffFromNeckShoulderChart,
} from "./sleevelessPatternOutput";
import { buildActiveSideInstructionTableRows, armholeLocalRcActiveShoulderChecklistStart } from "./neckShoulderActiveSideChecklist";

function cardiganRoundPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "round", frontStyle: "open" },
    yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
  };
}

describe("roundNeckNotation", () => {
  it("cardigan initial bind-off is half of pullover center for full neck opening N", () => {
    expect(initialCenterNeckStitches(30)).toBe(10);
    expect(cardiganFrontInitialNeckBindOffStitches(30)).toBe(5);
    expect(cardiganFrontInitialNeckBindOffStitches(30)).toBe(Math.round(10 / 2));
  });

  it("cardigan jp-neckline-bo and shaping agree with pullover closed front chart", () => {
    const pattern = cardiganRoundPattern();
    const result = generateSleevelessBackPattern(pattern);
    const fullNeck = result.debug.necklineStitches ?? 0;
    const cardiganInitial = cardiganFrontInitialNeckBindOffStitches(fullNeck);
    const pulloverCenter = initialCenterNeckStitches(fullNeck);

    expect(cardiganInitial).toBe(Math.max(1, Math.round(pulloverCenter / 2)));
    expect(
      initialNeckBindOffFromNeckShoulderChart(result.frontNeckShoulderShapingChart, {
        fullNecklineStitches: fullNeck,
      }),
    ).toBe(cardiganInitial);

    const pulloverShaping = buildFrontJapaneseNotationReplacements(
      generateSleevelessBackPattern({
        ...pattern,
        style: { ...(pattern.style as Record<string, unknown>), garmentStyle: "pullover", frontStyle: "closed" },
      }),
      {
        ...pattern,
        style: { ...(pattern.style as Record<string, unknown>), garmentStyle: "pullover", frontStyle: "closed" },
      },
    )["jp-neckline-shaping"];
    expect(pulloverShaping.length).toBeGreaterThan(0);

    const repl = buildFrontJapaneseNotationReplacements(result, pattern);
    expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(cardiganInitial));
    expect(repl["jp-neckline-bo"]).not.toBe(formatBindOffNotation(pulloverCenter));
    expect(repl["jp-neckline-shaping"]).toBe(pulloverShaping);
    expect(repl["jp-neckline-shaping"]).toBe(
      pulloverRoundFrontNeckEdgeNotationLines(
        {
          ...pattern,
          style: { ...(pattern.style as Record<string, unknown>), garmentStyle: "pullover", frontStyle: "closed" },
        },
        "right",
      ).join("\n"),
    );

    const rcStart = armholeLocalRcActiveShoulderChecklistStart(
      result.frontNeckShoulderShapingChart,
      result.firstArmholeGarmentRc,
    );
    const firstNeck = buildActiveSideInstructionTableRows(
      result.frontNeckShoulderShapingChart,
      rcStart,
    ).find((row) => row.edge === "Neck" && /bind off/i.test(row.action));
    expect(firstNeck?.action).toMatch(new RegExp(`Bind off ${cardiganInitial} sts`, "i"));
  });
});
