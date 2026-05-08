import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

describe("neckShoulderShapingChartRows split carriage shoulder display", () => {
  it("moves symmetric right shoulder cell to the following plain RC (front scoop fixture)", () => {
    const patternData: Record<string, unknown> = {
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 2,
          shoulder_width: 4.25,
          back_neck_depth: 6 / 7,
          front_neck_depth: 3,
        },
      },
      style: { recipientCategory: "misses" },
      yarnGaugeMachine: {
        gaugeStitchesPerInch: 5,
        gaugeRowsPerInch: 7,
        availableNeedles: 200,
      },
    };
    const result = generateSleevelessBackPattern(patternData);
    const rows = result.frontNeckShoulderShapingChart.rows;
    const splitPair = rows.find((r, idx) => {
      const next = rows[idx + 1];
      if (!next) return false;
      const leftVal = String(r.leftSide ?? "").trim();
      const rightVal = String(r.rightSide ?? "").trim();
      const nextLeftVal = String(next.leftSide ?? "").trim();
      const nextRightVal = String(next.rightSide ?? "").trim();
      return (
        /^-\d+$/.test(leftVal) &&
        rightVal === "-" &&
        nextLeftVal === "-" &&
        nextRightVal === leftVal &&
        r.row + 1 === next.row &&
        r.leftStitchCount === next.leftStitchCount &&
        r.rightStitchCount === next.rightStitchCount &&
        String(next.action) === "Shoulder"
      );
    });
    expect(splitPair).toBeDefined();
  });
});
