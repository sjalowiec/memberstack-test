import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import {
  buildSleevelessRoundNeckBackShapingMapData,
  buildSleevelessRoundNeckBackShapingSchedule,
} from "./sleevelessRoundNeckBackShapingSchedule";
import {
  buildSleevelessRoundNeckShapingMapData,
  buildSleevelessRoundNeckShapingSchedule,
  detectShoulderRepresentationMode,
} from "./sleevelessRoundNeckShapingSchedule";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
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

    // Origin = neckline reset (frontNecklineStartRC), matching written RC:000.
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.frontNecklineStartRC,
    });
    expect(map).not.toBeNull();
    expect(map!.rowMin).toBe(0);
    expect(map!.rowMax).toBeGreaterThan(map!.rowMin);
    // Initial center-neck bind-off is at the neckline reset origin.
    expect(schedule.startRow).toBe(result.debug.frontNecklineStartRC);
    expect(schedule.startRow - result.debug.frontNecklineStartRC!).toBe(0);
  });

  it("locks the initial center-neck bind-off to local RC:000 after the neckline reset", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const schedule = buildSleevelessRoundNeckShapingSchedule(result.frontNeckShoulderTimeline)!;
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.frontNecklineStartRC,
    })!;

    expect(result.debug.frontNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    expect(map.rowMin).toBe(0);
    expect(schedule.startRow).toBe(result.debug.frontNecklineStartRC);

    const firstTimelineRow = result.frontNeckShoulderTimeline![0]!;
    expect(firstTimelineRow.row).toBe(result.debug.frontNecklineStartRC);
    expect(firstTimelineRow.events.some((e) => e.side === "center" && e.amount > 0)).toBe(true);

    // Armhole-local offset would start the map at (neckStart − armholeStart), e.g. 12.
    const armholeLocalStart =
      result.debug.frontNecklineStartRC! - result.debug.armholeStartRow!;
    expect(armholeLocalStart).toBeGreaterThan(0);
    expect(map.rowMin).not.toBe(armholeLocalStart);
  });

  it("completion bind-off produces vertical side edge and flat horizontal shoulder top", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.frontNecklineStartRC,
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
      firstArmholeRc: result.debug.frontNecklineStartRC,
    })!;

    const shoulderPath = map.paths.find((p) => p.id === "shoulder")!;
    const steppedMidAscent = shoulderPath.steps.filter(
      (s, i) => i > 0 && i < shoulderPath.steps.length - 1 && s.stitches > 0,
    );
    expect(steppedMidAscent).toHaveLength(0);

    const svg = renderShapingMapSvg(map, { mirror: true });
    expect(svg).toContain(">Armhole Edge<");
    expect(svg).not.toContain("Shoulder Edge");
    expect(svg).toContain(">Neck Edge<");
    expect(svg).toMatch(/>Bind off \d+ center stitch(?:es)?</);
    expect(svg).not.toContain("Center Stitches");
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

describe("drop-shoulder back round-neck shaping map", () => {
  it("renders a shaping map with neckline shaping and straight shoulders", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    expect(result.backNeckShoulderTimeline?.length).toBeGreaterThan(0);

    const schedule = buildSleevelessRoundNeckBackShapingSchedule(result.backNeckShoulderTimeline)!;
    expect(schedule).not.toBeNull();
    expect(schedule.centerHeld).toBe(true);
    expect(schedule.centerStitches).toBeGreaterThan(0);
    expect(schedule.neckStitchesTotal).toBeGreaterThan(0);
    expect(schedule.shoulderMode).toBe("straight");

    // Local origin = neckline reset (backNecklineStartRC), matching written RC:000.
    const map = buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
      firstArmholeRc: result.debug.backNecklineStartRC,
      title: "Back neckline shaping map",
      patternData: DROP_SHOULDER_ROUND,
    });
    expect(map).not.toBeNull();
    expect(map!.rowMin).toBe(0);
    expect(map!.paths.find((p) => p.id === "neck")).toBeDefined();
    expect(map!.paths.find((p) => p.id === "shoulder")).toBeDefined();
    expect(map!.rowMax).toBeGreaterThan(map!.rowMin);
    // Armhole-local origin would yield a non-zero start (armholeRows − backNeckDepthRows).
    const armholeLocalStart =
      result.debug.backNecklineStartRC! - result.debug.armholeStartRow!;
    expect(armholeLocalStart).toBeGreaterThan(0);
    expect(map!.rowMin).not.toBe(armholeLocalStart);

    const html = buildPatternVisualGuidesHtml({
      piece: "back",
      notationSupported: true,
      construction: "drop-shoulder",
      shapingMapData: map,
    });
    expect(html).toContain("Shaping Notation");
    expect(html).toContain("Shaping Map");
    expect(html).toContain("shaping-map__svg");
    expect(html).not.toContain("ns-visual-guides__grid--single");
  });

  it("does not suppress the neckline map when there is no shoulder shaping", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(result.backNeckShoulderTimeline)!;
    expect(schedule.shoulderMode).toBe("straight");
    // Completion bind-off only at the final row — not graduated shoulder shaping.
    expect(schedule.shoulderOps.every((op) => op.endRow === schedule.endRow)).toBe(true);

    const map = buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
      firstArmholeRc: result.debug.backNecklineStartRC,
      patternData: DROP_SHOULDER_ROUND,
    });
    expect(map).not.toBeNull();
    expect(map!.rowMin).toBe(0);
    expect(map!.paths.some((p) => p.id === "neck")).toBe(true);

    const svg = renderShapingMapSvg(map!);
    expect(svg).toContain(">Neck Edge<");
    expect(svg).toContain(">Armhole Edge<");
    expect(svg).not.toContain("Shoulder Edge");
    expect(svg).toMatch(/>Bind off \d+ center stitch(?:es)?</);
    expect(svg).not.toContain("Center Stitches");
  });

  it("keeps the drop-shoulder front shaping map working alongside the back map", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);

    const frontMap = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: result.debug.frontNecklineStartRC,
      title: "Front neckline shaping map",
    });
    const backMap = buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
      firstArmholeRc: result.debug.backNecklineStartRC,
      patternData: DROP_SHOULDER_ROUND,
    });

    expect(frontMap).not.toBeNull();
    expect(backMap).not.toBeNull();
    expect(frontMap!.rowMin).toBe(0);
    expect(backMap!.rowMin).toBe(0);
    expect(frontMap!.title).toBe("Front neckline shaping map");
    expect(backMap!.title).toBe("Back neckline shaping map");

    const frontHtml = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      construction: "drop-shoulder",
      shapingMapData: frontMap,
    });
    expect(frontHtml).toContain("Shaping Map");
    expect(frontHtml).toContain("shaping-map__svg");
  });

  it("uses garment RC on the Front map when the neckline begins before the armhole marker", () => {
    const pattern = {
      ...DROP_SHOULDER_ROUND,
      fit: {
        ...DROP_SHOULDER_ROUND.fit,
        selectedMeasurements: {
          ...DROP_SHOULDER_ROUND.fit.selectedMeasurements,
          front_neck_depth: 12,
          upper_arm: 13.4,
        },
      },
      yarnGaugeMachine: {
        ...DROP_SHOULDER_ROUND.yarnGaugeMachine,
        gaugeRowsPerInch: 6,
      },
    };
    const result = generateDropShoulderPattern(pattern);
    expect(result.debug.frontNecklineStartRC).toBeLessThan(result.debug.armholeStartRow!);
    const start = result.debug.frontNecklineStartRC!;
    const map = buildSleevelessRoundNeckShapingMapData(result.frontNeckShoulderTimeline, {
      firstArmholeRc: 0,
    })!;
    expect(map.rowMin).toBe(start);
    expect(map.rowMin).not.toBe(0);
    expect(result.frontNeckShoulderTimeline![0]!.row).toBe(start);
  });
});

describe("sleeveless map rendering remains intact", () => {
  it("still builds front and back maps for sleeveless round neck", () => {
    const pattern = {
      fit: {
        sizingChart: "women",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 24,
          armhole_depth: 8,
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
        construction: "sleeveless",
        frontStyle: "closed",
        neckline: "round",
      },
    };
    const r = generateSleevelessBackPattern(pattern);
    const frontMap = buildSleevelessRoundNeckShapingMapData(r.frontNeckShoulderTimeline, {
      firstArmholeRc: r.debug?.armholeStartRow,
    });
    const backMap = buildSleevelessRoundNeckBackShapingMapData(r.backNeckShoulderTimeline, {
      firstArmholeRc: r.debug?.armholeStartRow,
      patternData: pattern,
    });
    expect(frontMap).not.toBeNull();
    expect(backMap).not.toBeNull();
    expect(frontMap!.paths.length).toBeGreaterThan(0);
    expect(backMap!.paths.length).toBeGreaterThan(0);
  });
});
