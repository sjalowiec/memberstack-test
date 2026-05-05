import { describe, expect, it } from "vitest";
import { buildTimeline } from "./shapingTimeline";
import { buildNeckShoulderShapingChartRows } from "./neckShoulderShapingChartRows";

describe("buildTimeline shoulder cadence", () => {
  it("uses every other row for shoulder actions across the full shoulder-depth span", () => {
    const timeline = buildTimeline({
      firstShapingRow: 300,
      shoulderStitchesPerSide: 35,
      centerNeckBindOff: 10,
      shapingWorkRows: 7,
    });

    expect(timeline.length).toBe(8);

    const [, ...afterCenter] = timeline;
    expect(afterCenter.length).toBe(7);

    for (let i = 0; i < afterCenter.length; i++) {
      const shoulderEvent = afterCenter[i].events.find(
        (e) => e.side !== "center" && e.edge === "outer" && e.amount > 0
      );
      const hasShoulder = shoulderEvent !== undefined;
      expect(hasShoulder).toBe(i % 2 === 0);
    }
  });

  it("chart stitch counts are displayed before row decreases, then carried forward", () => {
    const input = {
      firstShapingRow: 143,
      shoulderStitchesPerSide: 20,
      centerNeckBindOff: 10,
      shapingWorkRows: 5,
    };
    const chartRows = buildNeckShoulderShapingChartRows(input);
    const timeline = buildTimeline(input);
    expect(chartRows.length).toBeGreaterThan(2);
    expect(chartRows.length).toBe(timeline.length);

    for (let i = 1; i < chartRows.length; i++) {
      // Display count for row i should equal previous row's post-action count.
      expect(chartRows[i].leftStitchCount).toBe(timeline[i - 1].stitchesL);
      expect(chartRows[i].rightStitchCount).toBe(timeline[i - 1].stitchesR);
    }
  });
});
