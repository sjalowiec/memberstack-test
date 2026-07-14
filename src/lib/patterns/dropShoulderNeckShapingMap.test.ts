import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  buildSleevelessRoundNeckShapingMapData,
  buildSleevelessRoundNeckShapingSchedule,
  detectShoulderRepresentationMode,
} from "./sleevelessRoundNeckShapingSchedule";
import type { ShapingMapPath } from "./shapingMapSvg";
import { renderShapingMapSvg } from "./shapingMapSvg";

const DROP_SHOULDER_ROUND = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

/** Trace grid points from map paths (mirrors renderer tracePath logic). */
function traceMapPathPoints(path: ShapingMapPath): { x: number; row: number }[] {
  const dir = path.edge === "right" ? -1 : 1;
  const rowSign = path.rowDirection === "down" ? -1 : 1;
  let x = path.startX;
  let row = path.startRow;
  const points: { x: number; row: number }[] = [{ x, row }];
  for (const step of path.steps) {
    const nx = x + dir * step.stitches;
    x = nx;
    points.push({ x, row });
    row += rowSign * step.rows;
    if (step.rows !== 0) points.push({ x, row });
  }
  return points;
}

describe("drop-shoulder front round-neck shaping map", () => {
  it("builds a map from the full front timeline without trimming events", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    expect(result.frontNeckShoulderTimeline?.length).toBeGreaterThan(0);

    const schedule = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline)!;
    expect(schedule.shoulderMode).toBe("straight");
    expect(schedule.shoulderOps).toHaveLength(1);
    expect(schedule.shoulderOps[0]!.endRow).toBe(schedule.endRow);

    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    });
    expect(map).not.toBeNull();
    expect(map!.rowMax).toBeGreaterThan(map!.rowMin);
  });

  it("completion bind-off produces vertical side edge and flat horizontal shoulder top", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    })!;

    const shoulderPath = map.paths.find((p) => p.id === "shoulder")!;
    expect(shoulderPath.startX).toBe(0);

    // Vertical outer side: first step climbs with no inward stitch removal.
    expect(shoulderPath.steps[0]).toMatchObject({ stitches: 0, rows: expect.any(Number) });
    expect(shoulderPath.steps[0]!.rows).toBeGreaterThan(0);

    // Flat horizontal shoulder at top: single inward step at rowMax with full shoulder width.
    const topStep = shoulderPath.steps[shoulderPath.steps.length - 1]!;
    expect(topStep).toMatchObject({ stitches: scheduleShoulderWidth(result), rows: 0 });

    // No stepped shoulder shaping: only one bind-off label on the shoulder path (the top completion).
    const shoulderPoints = traceMapPathPoints(shoulderPath);
    const inwardSteps = shoulderPoints.filter((p, i) => i > 0 && p.x > shoulderPoints[i - 1]!.x);
    expect(inwardSteps).toHaveLength(1);

    const topRowPoints = shoulderPoints.filter((p) => p.row === map.rowMax);
    expect(topRowPoints.length).toBeGreaterThanOrEqual(2);
    expect(topRowPoints[0]!.x).toBe(0);
    expect(topRowPoints[topRowPoints.length - 1]!.x).toBe(scheduleShoulderWidth(result));
  });

  it("does not use shaped shoulder stepping for drop-shoulder timelines", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.armholeStartRow,
    })!;

    const shoulderPath = map.paths.find((p) => p.id === "shoulder")!;
    const steppedMidAscent = shoulderPath.steps.filter(
      (s, i) => i > 0 && i < shoulderPath.steps.length - 1 && s.stitches > 0,
    );
    expect(steppedMidAscent).toHaveLength(0);

    const svg = renderShapingMapSvg(map, { mirror: true });
    expect(svg).toContain(">Shoulder Edge<");
    expect(svg).toContain(">Neck Edge<");
    expect(svg).toContain("Center Stitches");
  });

  it("detectShoulderRepresentationMode classifies completion-only bind-offs as straight", () => {
    expect(
      detectShoulderRepresentationMode([{ row: 168, amount: 46, kind: "bindOff" }], 168),
    ).toBe("straight");
    expect(
      detectShoulderRepresentationMode(
        [
          { row: 505, amount: 6, kind: "bindOff" },
          { row: 507, amount: 6, kind: "bindOff" },
        ],
        509,
      ),
    ).toBe("shaped");
  });
});

function scheduleShoulderWidth(result: ReturnType<typeof generateDropShoulderPattern>): number {
  const schedule = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline)!;
  return schedule.shoulderStitchesTotal;
}
