import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { buildFrontJapaneseNotationReplacements } from "./sleevelessFrontJapaneseNotation";
import { formatRcNotation } from "./sleevelessBackJapaneseNotation";
import { armholeLocalRcCenterNecklineSetupRow } from "./neckShoulderActiveSideChecklist";

const roundNeckPattern = {
  fit: {
    sizingChart: "misses" as const,
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
  style: { recipientCategory: "misses" as const, neckline: "round" },
  yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
};

describe("front neck scoop RC alignment", () => {
  it("round-neck front center divide local RC matches rc-neckline-start and sits one row before shoulderEnd − depth", () => {
    const r = generateSleevelessBackPattern(roundNeckPattern);
    const armholeStart = r.debug.armholeStartRow!;
    const divideLocal = armholeLocalRcCenterNecklineSetupRow(r.frontNeckShoulderShapingChart, armholeStart, {
      includeCenterNecklineSetupRow: true,
    });

    expect(divideLocal).toBeDefined();
    expect(r.debug.frontNecklineStartLocalRC).toBe(divideLocal);
    expect(r.debug.frontNecklineCenterDivideLocalRC).toBe(divideLocal);

    const repl = buildFrontJapaneseNotationReplacements(r, roundNeckPattern);
    expect(repl["rc-neckline-start"]).toBe(formatRcNotation(divideLocal!));
  });
});
