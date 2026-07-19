import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import {
  SLEEVELESS_ROUND_BACK_FIRST_SHOULDER_EDGE,
  buildSleevelessRoundNeckBackShapingMapData,
  buildSleevelessRoundNeckBackShapingSchedule,
  backShapingScheduleToMapData,
  isSleevelessRoundBackNeckShapingMapSupported,
} from "./sleevelessRoundNeckBackShapingSchedule";
import { renderShapingMapSvg } from "./shapingMapSvg";

function mkRow(row: number, events: ShapingEvent[]): RowEntry {
  return {
    row,
    events,
    stitchesL: 0,
    stitchesR: 0,
    netChangeL: 0,
    netChangeR: 0,
    isSplit: true,
    centerWidth: 0,
    leftOuterEdge: 0,
    leftInnerEdge: 0,
    rightInnerEdge: 0,
    rightOuterEdge: 0,
  };
}

function centerHold(amount: number): ShapingEvent {
  return { kind: "hold", side: "center", edge: "center", amount };
}

function rightNeck(amount: number, kind: ShapingEvent["kind"] = "hold"): ShapingEvent {
  return { kind, side: "right", edge: "inner", amount };
}

function leftNeck(amount: number, kind: ShapingEvent["kind"] = "hold"): ShapingEvent {
  return { kind, side: "left", edge: "inner", amount };
}

function rightShoulder(amount: number): ShapingEvent {
  return { kind: "bindOff", side: "right", edge: "outer", amount };
}

function leftShoulder(amount: number): ShapingEvent {
  return { kind: "bindOff", side: "left", edge: "outer", amount };
}

function basePattern(neckline: string, rowsPerInch = 7): Record<string, unknown> {
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
    style: { recipientCategory: "misses", neckline },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: rowsPerInch,
      availableNeedles: 200,
    },
  };
}

describe("isSleevelessRoundBackNeckShapingMapSupported", () => {
  it("requires a shallow center hold row (round back only)", () => {
    expect(isSleevelessRoundBackNeckShapingMapSupported(undefined)).toBe(false);
    expect(isSleevelessRoundBackNeckShapingMapSupported([])).toBe(false);
    expect(
      isSleevelessRoundBackNeckShapingMapSupported([mkRow(100, [centerHold(12)])]),
    ).toBe(true);
    expect(
      isSleevelessRoundBackNeckShapingMapSupported([
        mkRow(100, [{ kind: "bindOff", side: "center", edge: "center", amount: 12 }]),
      ]),
    ).toBe(false);
  });

  it("excludes V-neck patterns even when the back timeline carries a center hold", () => {
    const timeline = [mkRow(200, [centerHold(10)]), mkRow(202, [rightNeck(1)])];
    expect(isSleevelessRoundBackNeckShapingMapSupported(timeline, basePattern("round"))).toBe(
      true,
    );
    expect(isSleevelessRoundBackNeckShapingMapSupported(timeline, basePattern("v-neck"))).toBe(
      false,
    );
  });
});

describe("buildSleevelessRoundNeckBackShapingSchedule", () => {
  it("returns null without a shallow center hold row", () => {
    expect(buildSleevelessRoundNeckBackShapingSchedule(undefined)).toBeNull();
    expect(
      buildSleevelessRoundNeckBackShapingSchedule([
        mkRow(100, [{ kind: "bindOff", side: "center", edge: "center", amount: 10 }]),
      ]),
    ).toBeNull();
  });

  it("defaults to the right edge for the first shoulder workflow", () => {
    const timeline = [mkRow(200, [centerHold(14)]), mkRow(202, [rightNeck(2)])];
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    expect(schedule.edge).toBe(SLEEVELESS_ROUND_BACK_FIRST_SHOULDER_EDGE);
    expect(schedule.neckProfile).toBe("back");
    expect(schedule.centerHeld).toBe(true);
    expect(schedule.centerStitches).toBe(14);
  });

  it("groups inner-neck hold shaping on the first shoulder (right edge)", () => {
    const timeline = [
      mkRow(300, [centerHold(20)]),
      mkRow(302, [rightNeck(3)]),
      mkRow(304, [rightNeck(3)]),
      mkRow(306, [rightNeck(2)]),
    ];
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    expect(schedule.neckOps).toEqual([
      {
        region: "neck",
        kind: "hold",
        stitches: 3,
        repetitions: 2,
        rowInterval: 2,
        startRow: 302,
        endRow: 304,
      },
      {
        region: "neck",
        kind: "hold",
        stitches: 2,
        repetitions: 1,
        rowInterval: 2,
        startRow: 306,
        endRow: 306,
      },
    ]);
    expect(schedule.neckStitchesTotal).toBe(8);
    expect(schedule.shoulderOps).toHaveLength(0);
    expect(schedule.shoulderMode).toBe("straight");
  });

  it("includes shoulder shaping ops when present on the first shoulder", () => {
    const timeline = [
      mkRow(500, [centerHold(10)]),
      mkRow(502, [rightNeck(1)]),
      mkRow(504, [rightNeck(1), rightShoulder(6)]),
      mkRow(506, [rightShoulder(6)]),
      mkRow(508, [rightShoulder(5)]),
    ];
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    expect(schedule.shoulderOps).toEqual([
      {
        region: "shoulder",
        kind: "bindOff",
        stitches: 6,
        repetitions: 2,
        rowInterval: 2,
        startRow: 504,
        endRow: 506,
      },
      {
        region: "shoulder",
        kind: "bindOff",
        stitches: 5,
        repetitions: 1,
        rowInterval: 2,
        startRow: 508,
        endRow: 508,
      },
    ]);
    expect(schedule.shoulderStitchesTotal).toBe(17);
    expect(schedule.shoulderMode).toBe("shaped");
  });

  it("second shoulder (left edge) mirrors first-shoulder stitch totals", () => {
    const timeline = [
      mkRow(400, [centerHold(12)]),
      mkRow(402, [rightNeck(2), leftNeck(2)]),
      mkRow(404, [rightNeck(1), leftNeck(1), rightShoulder(5), leftShoulder(5)]),
      mkRow(406, [rightShoulder(4), leftShoulder(4)]),
    ];
    const first = buildSleevelessRoundNeckBackShapingSchedule(timeline, { edge: "right" })!;
    const second = buildSleevelessRoundNeckBackShapingSchedule(timeline, { edge: "left" })!;
    expect(first.neckStitchesTotal).toBe(second.neckStitchesTotal);
    expect(first.shoulderStitchesTotal).toBe(second.shoulderStitchesTotal);
    expect(first.startRow).toBe(second.startRow);
    expect(first.endRow).toBe(second.endRow);
    expect(first.centerStitches).toBe(second.centerStitches);
  });
});

describe("backShapingScheduleToMapData", () => {
  it("omits the shoulder path when there is no shoulder shaping", () => {
    const timeline = [mkRow(200, [centerHold(10)]), mkRow(202, [rightNeck(1)])];
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    const map = backShapingScheduleToMapData(schedule);
    expect(map.paths.find((p) => p.id === "shoulder")).toBeUndefined();
    const neckPath = map.paths.find((p) => p.id === "neck")!;
    expect(neckPath.startX).toBe(0);
    expect(map.title).toBe("Back neckline shaping map");
  });

  it("converts row labels to armhole-local RC using firstArmholeRc", () => {
    const timeline = [
      mkRow(118, [centerHold(10)]),
      mkRow(120, [rightNeck(1)]),
      mkRow(122, [rightShoulder(6)]),
      mkRow(124, [rightShoulder(6)]),
    ];
    const firstArmholeRc = 104;
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    const local = backShapingScheduleToMapData(schedule, { firstArmholeRc });
    expect(local.rowMin).toBe(118 - firstArmholeRc);
    expect(local.rowMax).toBe(124 - firstArmholeRc);
    const shoulderPath = local.paths.find((p) => p.id === "shoulder")!;
    expect(shoulderPath.startRow).toBe(122 - firstArmholeRc);
  });

  it("labels edges Armhole Edge / Neck Edge for the SVG renderer", () => {
    const timeline = [
      mkRow(500, [centerHold(8)]),
      mkRow(502, [rightNeck(1)]),
      mkRow(504, [rightShoulder(6)]),
    ];
    const map = buildSleevelessRoundNeckBackShapingMapData(timeline)!;
    expect(map!.edgeLabels).toEqual({ shoulder: "Armhole Edge", neck: "Neck Edge" });
    const svg = renderShapingMapSvg(map!);
    expect(svg).toContain(">Armhole Edge<");
    expect(svg).not.toContain("Shoulder Edge");
    expect(svg).toContain(">Neck Edge<");
    expect(svg).toContain(">Bind off 8 center stitches<");
    expect(svg).not.toContain("Center Stitches");
  });
});

describe("integration  real Sleeveless Round Neck back timeline", () => {
  it("builds a schedule from the calculated back timeline with matching center + real rows", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const timeline = r.backNeckShoulderTimeline;
    expect(timeline?.length).toBeGreaterThan(0);

    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    expect(schedule).not.toBeNull();
    expect(schedule.centerHeld).toBe(true);
    expect(schedule.centerStitches).toBeGreaterThan(0);

    const firstRowCenter = timeline![0]!.events
      .filter((e) => e.side === "center" && e.edge === "center")
      .reduce((s, e) => s + e.amount, 0);
    expect(schedule.centerStitches).toBe(firstRowCenter);

    const rows = timeline!.map((e) => e.row);
    expect(schedule.startRow).toBe(Math.min(...rows));
    expect(schedule.endRow).toBe(Math.max(...rows));

    const rawNeck = timeline!.reduce(
      (sum, e) =>
        sum +
        e.events
          .filter(
            (ev) =>
              ev.side === "right" &&
              ev.edge === "inner" &&
              ev.amount > 0 &&
              (ev.kind === "bindOff" || ev.kind === "decrease" || ev.kind === "hold"),
          )
          .reduce((s, ev) => s + ev.amount, 0),
      0,
    );
    const rawShoulder = timeline!.reduce(
      (sum, e) =>
        sum +
        e.events
          .filter(
            (ev) =>
              ev.side === "right" &&
              ev.edge === "outer" &&
              ev.amount > 0 &&
              (ev.kind === "bindOff" || ev.kind === "decrease"),
          )
          .reduce((s, ev) => s + ev.amount, 0),
      0,
    );
    expect(schedule.neckStitchesTotal).toBe(rawNeck);
    expect(schedule.shoulderStitchesTotal).toBe(rawShoulder);
    expect(schedule.shoulderOps.length).toBeGreaterThan(0);
  });

  it("map row labels use backNecklineStartLocalRC (shared armhole-local origin)", () => {
    const r = generateSleevelessBackPattern(basePattern("round")) as {
      backNeckShoulderTimeline?: RowEntry[];
      debug?: Record<string, number | undefined>;
    };
    const timeline = r.backNeckShoulderTimeline!;
    const armholeStartRow = r.debug?.armholeStartRow;
    expect(Number.isFinite(armholeStartRow)).toBe(true);

    const map = buildSleevelessRoundNeckBackShapingMapData(timeline, {
      firstArmholeRc: armholeStartRow,
      patternData: basePattern("round"),
    })!;
    expect(map).not.toBeNull();

    const rows = timeline.map((e) => e.row);
    const globalMin = Math.min(...rows);
    expect(map.rowMin).toBe(globalMin - Math.floor(armholeStartRow!));

    const backNecklineStartLocalRC = r.debug?.backNecklineStartLocalRC;
    if (Number.isFinite(backNecklineStartLocalRC)) {
      expect(map.rowMin).toBe(Math.floor(backNecklineStartLocalRC!));
    }
  });

  it("does not build a map for a V-neck back (non-round neckline)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    expect(
      buildSleevelessRoundNeckBackShapingMapData(r.backNeckShoulderTimeline, {
        patternData: basePattern("v-neck"),
      }),
    ).toBeNull();
  });
});

describe("integration  back without shoulder shaping", () => {
  it("produces a neck-only map when the timeline has no outer-edge bind-offs", () => {
    const timeline = [
      mkRow(200, [centerHold(18)]),
      mkRow(202, [rightNeck(4)]),
      mkRow(204, [rightNeck(4)]),
      mkRow(206, [rightNeck(2)]),
    ];
    const schedule = buildSleevelessRoundNeckBackShapingSchedule(timeline)!;
    expect(schedule).not.toBeNull();
    expect(schedule.shoulderStitchesTotal).toBe(0);
    expect(schedule.shoulderMode).toBe("straight");

    const map = buildSleevelessRoundNeckBackShapingMapData(timeline, {
      firstArmholeRc: 180,
      patternData: basePattern("round"),
    })!;
    expect(map.paths.find((p) => p.id === "shoulder")).toBeUndefined();
    expect(map.paths.find((p) => p.id === "neck")).toBeDefined();
    expect(map.rowMin).toBe(20);
    expect(map.rowMax).toBe(26);
  });
});
