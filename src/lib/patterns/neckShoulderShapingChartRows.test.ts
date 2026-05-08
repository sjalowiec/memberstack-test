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
    const r148 = rows.find((r) => r.row === 148);
    const r149 = rows.find((r) => r.row === 149);
    expect(r148).toBeDefined();
    expect(r149).toBeDefined();
    expect(r148!.leftSide).toBe("-2");
    expect(r148!.rightSide).toBe("-");
    expect(r149!.leftSide).toBe("-");
    expect(r149!.rightSide).toBe("-2");
    expect(String(r149!.action)).toBe("Shoulder");
    expect(r148!.leftStitchCount).toBe(r149!.leftStitchCount);
    expect(r148!.rightStitchCount).toBe(r149!.rightStitchCount);
  });
});
