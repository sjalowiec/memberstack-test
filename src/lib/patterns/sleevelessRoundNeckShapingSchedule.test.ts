import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import type { RowEntry, ShapingEvent } from "./shapingTimeline";
import {
  buildSleevelessRoundNeckShapingSchedule,
  buildSleevelessRoundNeckShapingMapData,
  shapingScheduleToMapData,
} from "./sleevelessRoundNeckShapingSchedule";
import { renderShapingMapSvg } from "./shapingMapSvg";

/** Minimal RowEntry factory ? only `row` + `events` matter to the schedule builder. */
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

function center(amount: number, kind: "bindOff" | "hold" = "bindOff"): ShapingEvent {
  return { kind, side: "center", edge: "center", amount };
}
function rightNeck(amount: number, kind: ShapingEvent["kind"] = "decrease"): ShapingEvent {
  return { kind, side: "right", edge: "inner", amount };
}
function rightShoulder(amount: number): ShapingEvent {
  return { kind: "bindOff", side: "right", edge: "outer", amount };
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

describe("buildSleevelessRoundNeckShapingSchedule", () => {
  it("returns null for empty / undefined timelines", () => {
    expect(buildSleevelessRoundNeckShapingSchedule(undefined)).toBeNull();
    expect(buildSleevelessRoundNeckShapingSchedule([])).toBeNull();
  });

  it("returns null when there is no center bind-off (V-neck / cardigan half front) ? scope protection", () => {
    const timeline = [
      mkRow(100, [rightNeck(1)]),
      mkRow(102, [rightNeck(1)]),
    ];
    expect(buildSleevelessRoundNeckShapingSchedule(timeline)).toBeNull();
  });

  it("case 1 ? simple neckline with minimal shaping (center + a few singles, no shoulder)", () => {
    const timeline = [
      mkRow(200, [center(10)]),
      mkRow(202, [rightNeck(1)]),
      mkRow(204, [rightNeck(1)]),
    ];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline);
    expect(schedule).not.toBeNull();
    expect(schedule!.centerStitches).toBe(10);
    expect(schedule!.centerHeld).toBe(false);
    expect(schedule!.startRow).toBe(200);
    expect(schedule!.endRow).toBe(204);
    expect(schedule!.shoulderOps).toHaveLength(0);
    expect(schedule!.neckOps).toEqual([
      {
        region: "neck",
        kind: "decrease",
        stitches: 1,
        repetitions: 2,
        rowInterval: 2,
        startRow: 202,
        endRow: 204,
      },
    ]);
    expect(schedule!.neckStitchesTotal).toBe(2);
  });

  it("case 2 ? initial center bind-off followed by repeated single decreases", () => {
    const timeline = [
      mkRow(300, [center(12)]),
      mkRow(301, [rightNeck(2, "bindOff")]),
      mkRow(303, [rightNeck(1)]),
      mkRow(305, [rightNeck(1)]),
      mkRow(307, [rightNeck(1)]),
    ];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    expect(schedule.centerStitches).toBe(12);
    // A stair bind-off (2) then three evenly spaced singles group separately.
    expect(schedule.neckOps).toEqual([
      { region: "neck", kind: "bindOff", stitches: 2, repetitions: 1, rowInterval: 2, startRow: 301, endRow: 301 },
      { region: "neck", kind: "decrease", stitches: 1, repetitions: 3, rowInterval: 2, startRow: 303, endRow: 307 },
    ]);
    expect(schedule.neckStitchesTotal).toBe(5);
  });

  it("case 3 ? more than one decrease grouping / interval (steep every row, then gradual every other row)", () => {
    const timeline = [
      mkRow(400, [center(8)]),
      mkRow(401, [rightNeck(1)]),
      mkRow(402, [rightNeck(1)]),
      mkRow(403, [rightNeck(1)]),
      mkRow(405, [rightNeck(1)]),
      mkRow(407, [rightNeck(1)]),
    ];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    expect(schedule.neckOps).toEqual([
      { region: "neck", kind: "decrease", stitches: 1, repetitions: 3, rowInterval: 1, startRow: 401, endRow: 403 },
      { region: "neck", kind: "decrease", stitches: 1, repetitions: 2, rowInterval: 2, startRow: 405, endRow: 407 },
    ]);
  });

  it("case 4 ? includes real shoulder shaping (outer-edge bind-offs)", () => {
    const timeline = [
      mkRow(500, [center(10)]),
      mkRow(501, [rightNeck(1)]),
      mkRow(503, [rightNeck(1)]),
      mkRow(505, [rightNeck(1), rightShoulder(6)]),
      mkRow(507, [rightShoulder(6)]),
      mkRow(509, [rightShoulder(5)]),
    ];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    expect(schedule.shoulderOps).toEqual([
      { region: "shoulder", kind: "bindOff", stitches: 6, repetitions: 2, rowInterval: 2, startRow: 505, endRow: 507 },
      { region: "shoulder", kind: "bindOff", stitches: 5, repetitions: 1, rowInterval: 2, startRow: 509, endRow: 509 },
    ]);
    expect(schedule.shoulderStitchesTotal).toBe(17);
    expect(schedule.neckStitchesTotal).toBe(3);
  });

  it("marks the center as held for shallow-round hold timelines", () => {
    const timeline = [mkRow(600, [center(20, "hold")]), mkRow(602, [rightNeck(1)])];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    expect(schedule.centerHeld).toBe(true);
    expect(schedule.centerStitches).toBe(20);
  });
});

describe("shapingScheduleToMapData (adapter)", () => {
  it("maps center stitches, real RC bounds, and step amounts into ShapingMapData", () => {
    const timeline = [
      mkRow(500, [center(10)]),
      mkRow(501, [rightNeck(1)]),
      mkRow(503, [rightNeck(1)]),
      mkRow(505, [rightShoulder(6)]),
      mkRow(507, [rightShoulder(6)]),
    ];
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    const map = shapingScheduleToMapData(schedule);

    expect(map.centerStitches).toBe(10);
    expect(map.rowMin).toBe(500);
    expect(map.rowMax).toBe(507);

    const shoulderPath = map.paths.find((p) => p.id === "shoulder")!;
    const neckPath = map.paths.find((p) => p.id === "neck")!;
    expect(shoulderPath).toBeDefined();
    expect(neckPath).toBeDefined();

    // Shoulder path draws bottom-up from the FIRST (lowest) shoulder RC: the armhole edge steps
    // inward toward the center as the RC climbs, ending at the top next to the neck.
    expect(shoulderPath.startRow).toBe(505);
    expect(shoulderPath.rowDirection).toBe("up");
    expect(shoulderPath.steps.map((s) => s.stitches)).toEqual([6, 6]);
    // Neck path is offset by the total shoulder stitches removed so the two connect.
    expect(neckPath.startX).toBe(12);
    expect(neckPath.steps.map((s) => s.stitches)).toEqual([1, 1]);
  });

  it("converts row labels to armhole-local RC using firstArmholeRc (single source of truth)", () => {
    const timeline = [
      mkRow(118, [center(10)]),
      mkRow(120, [rightNeck(1)]),
      mkRow(122, [rightShoulder(6)]),
      mkRow(124, [rightShoulder(6)]),
    ];
    const firstArmholeRc = 104;
    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    const global = shapingScheduleToMapData(schedule);
    const local = shapingScheduleToMapData(schedule, { firstArmholeRc });

    // Global (no offset) keeps timeline RC; local subtracts the same armhole origin.
    expect(global.rowMin).toBe(118);
    expect(global.rowMax).toBe(124);
    expect(local.rowMin).toBe(118 - firstArmholeRc);
    expect(local.rowMax).toBe(124 - firstArmholeRc);

    // Row window and every anchor shift uniformly; span (and thus step deltas) is unchanged.
    expect(local.rowMax - local.rowMin).toBe(global.rowMax - global.rowMin);
    const globalShoulder = global.paths.find((p) => p.id === "shoulder")!;
    const localShoulder = local.paths.find((p) => p.id === "shoulder")!;
    expect(globalShoulder.startRow - localShoulder.startRow).toBe(firstArmholeRc);
    expect(localShoulder.steps).toEqual(globalShoulder.steps);
    // Center stitches are a stitch count, not an RC ? never shifted.
    expect(local.centerStitches).toBe(global.centerStitches);
  });

  it("firstArmholeRc flows through buildSleevelessRoundNeckShapingMapData", () => {
    const timeline = [mkRow(118, [center(10)]), mkRow(120, [rightNeck(1)])];
    const map = buildSleevelessRoundNeckShapingMapData(timeline, { firstArmholeRc: 104 })!;
    expect(map.rowMin).toBe(14);
    const neckPath = map.paths.find((p) => p.id === "neck")!;
    expect(neckPath.startRow).toBe(120 - 104);
  });

  it("omits the shoulder path when there is no shoulder shaping", () => {
    const timeline = [mkRow(200, [center(10)]), mkRow(202, [rightNeck(1)])];
    const map = buildSleevelessRoundNeckShapingMapData(timeline)!;
    expect(map.paths.find((p) => p.id === "shoulder")).toBeUndefined();
    const neckPath = map.paths.find((p) => p.id === "neck")!;
    expect(neckPath.startX).toBe(0);
  });

  it("labels the outer edge Shoulder Edge and the center-front edge Neck Edge (never Left/Right)", () => {
    const timeline = [
      mkRow(500, [center(10)]),
      mkRow(502, [rightNeck(1)]),
      mkRow(504, [rightShoulder(6)]),
    ];
    const map = buildSleevelessRoundNeckShapingMapData(timeline)!;
    expect(map.edgeLabels).toEqual({ shoulder: "Shoulder Edge", neck: "Neck Edge" });

    // The renderer emits both callouts as upright <text>, exactly once each, never Left/Right Edge.
    const svg = renderShapingMapSvg(map);
    expect(svg).toContain("shaping-map-edge-label");
    expect(svg).toContain(">Shoulder Edge<");
    expect(svg).toContain(">Neck Edge<");
    expect(svg.match(/>Neck Edge</g)).toHaveLength(1);
    expect(svg).toContain(">10 Center Stitches<"); // center-stitch label kept
    expect(svg).not.toMatch(/Left Edge|Right Edge/);
  });

  it("mirror is a presentation-only flip: same data/labels, no backward (transform-flipped) text", () => {
    const timeline = [
      mkRow(500, [center(8)]),
      mkRow(502, [rightNeck(1)]),
      mkRow(504, [rightShoulder(6)]),
    ];
    const map = buildSleevelessRoundNeckShapingMapData(timeline, { firstArmholeRc: 100 })!;
    const normal = renderShapingMapSvg(map, { mirror: false });
    const mirrored = renderShapingMapSvg(map, { mirror: true });

    // Both orientations show the identical upright labels and center-stitch callout.
    for (const svg of [normal, mirrored]) {
      expect(svg).toContain(">Shoulder Edge<");
      expect(svg).toContain(">Neck Edge<");
      expect(svg).toContain(">8 Center Stitches<");
    }
    // The mirror must NOT be done with a scale(-1) transform (which would render text backward).
    expect(mirrored).not.toMatch(/scale\(\s*-1/);
    // Presentation-only: geometry differs (path x-coords flip) but the two are not identical.
    expect(mirrored).not.toBe(normal);
  });
});

/** Stable snapshot of map geometry for regression tests (adapter changes must not alter shaped output). */
function freezeMapGeometry(map: NonNullable<ReturnType<typeof buildSleevelessRoundNeckShapingMapData>>) {
  return {
    rowMin: map.rowMin,
    rowMax: map.rowMax,
    centerStitches: map.centerStitches,
    edgeLabels: map.edgeLabels,
    paths: map.paths.map((p) => ({
      id: p.id,
      startX: p.startX,
      startRow: p.startRow,
      rowDirection: p.rowDirection,
      edge: p.edge,
      steps: p.steps.map((s) => ({ stitches: s.stitches, rows: s.rows, label: s.label })),
    })),
  };
}

describe("sleeveless shaped-shoulder regression ? frozen ShapingMapData", () => {
  it("stepped shoulder timeline (case 4) produces unchanged shaped map geometry", () => {
    const timeline = [
      mkRow(500, [center(10)]),
      mkRow(501, [rightNeck(1)]),
      mkRow(503, [rightNeck(1)]),
      mkRow(505, [rightNeck(1), rightShoulder(6)]),
      mkRow(507, [rightShoulder(6)]),
      mkRow(509, [rightShoulder(5)]),
    ];
    const map = buildSleevelessRoundNeckShapingMapData(timeline)!;
    expect(freezeMapGeometry(map)).toEqual({
      rowMin: 500,
      rowMax: 509,
      centerStitches: 10,
      edgeLabels: { shoulder: "Shoulder Edge", neck: "Neck Edge" },
      paths: [
        {
          id: "shoulder",
          startX: 0,
          startRow: 505,
          rowDirection: "up",
          edge: "left",
          steps: [
            { stitches: 6, rows: 2, label: undefined },
            { stitches: 6, rows: 2, label: undefined },
            { stitches: 5, rows: 0, label: undefined },
          ],
        },
        {
          id: "neck",
          startX: 17,
          startRow: 505,
          rowDirection: "down",
          edge: "left",
          steps: [
            { stitches: 1, rows: 2, label: undefined },
            { stitches: 1, rows: 2, label: undefined },
            { stitches: 1, rows: 2, label: undefined },
          ],
        },
      ],
    });
  });

  it("no-shoulder shaping timeline produces unchanged neck-only map geometry", () => {
    const timeline = [mkRow(200, [center(10)]), mkRow(202, [rightNeck(1)])];
    const map = buildSleevelessRoundNeckShapingMapData(timeline)!;
    expect(freezeMapGeometry(map)).toEqual({
      rowMin: 200,
      rowMax: 202,
      centerStitches: 10,
      edgeLabels: { shoulder: "Shoulder Edge", neck: "Neck Edge" },
      paths: [
        {
          id: "neck",
          startX: 0,
          startRow: 202,
          rowDirection: "down",
          edge: "left",
          steps: [{ stitches: 1, rows: 2, label: undefined }],
        },
      ],
    });
  });

  it("real sleeveless round-neck timeline uses shaped shoulder map geometry", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const map = buildSleevelessRoundNeckShapingMapData(r.frontNeckShoulderTimeline, {
      firstArmholeRc: r.debug?.armholeStartRow,
    })!;
    const shoulderPath = map.paths.find((p) => p.id === "shoulder");
    expect(shoulderPath).toBeDefined();
    expect(shoulderPath!.steps.filter((s) => s.stitches > 0).length).toBeGreaterThan(1);
    expect(shoulderPath!.startRow).toBeLessThan(map.rowMax);
    expect({
      rowMin: map.rowMin,
      rowMax: map.rowMax,
      shoulderSteps: shoulderPath!.steps.map((s) => ({ stitches: s.stitches, rows: s.rows })),
      neckStartX: map.paths.find((p) => p.id === "neck")!.startX,
    }).toEqual({
      rowMin: r.debug?.frontNecklineStartLocalRC,
      rowMax:
        Math.max(...(r.frontNeckShoulderTimeline ?? []).map((e) => e.row)) -
        Math.floor(r.debug?.armholeStartRow ?? 0),
      shoulderSteps: shoulderPath!.steps.map((s) => ({ stitches: s.stitches, rows: s.rows })),
      neckStartX: shoulderPath!.steps.reduce((sum, s) => sum + s.stitches, 0),
    });
  });
});

describe("integration ? real Sleeveless Round Neck front timeline", () => {
  it("builds a schedule from the calculated front timeline with matching center + real rows", () => {
    const r = generateSleevelessBackPattern(basePattern("round"));
    const timeline = r.frontNeckShoulderTimeline;
    expect(timeline?.length).toBeGreaterThan(0);

    const schedule = buildSleevelessRoundNeckShapingSchedule(timeline)!;
    expect(schedule).not.toBeNull();
    expect(schedule.centerStitches).toBeGreaterThan(0);

    // Center matches the first timeline row's center event (source of truth).
    const firstRowCenter = timeline![0]!.events
      .filter((e) => e.side === "center" && e.edge === "center")
      .reduce((s, e) => s + e.amount, 0);
    expect(schedule.centerStitches).toBe(firstRowCenter);

    // Real RC bounds come straight from the timeline.
    const rows = timeline!.map((e) => e.row);
    expect(schedule.startRow).toBe(Math.min(...rows));
    expect(schedule.endRow).toBe(Math.max(...rows));

    // Op totals equal the raw per-row right-edge removals (no invented stitches).
    const rawNeck = timeline!.reduce(
      (sum, e) =>
        sum +
        e.events
          .filter((ev) => ev.side === "right" && ev.edge === "inner" && ev.amount > 0)
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

  it("map row labels use the SAME armhole-local RC origin as the written instructions/checklist", () => {
    const r = generateSleevelessBackPattern(basePattern("round")) as {
      frontNeckShoulderTimeline?: RowEntry[];
      debug?: Record<string, number | undefined>;
    };
    const timeline = r.frontNeckShoulderTimeline!;
    const armholeStartRow = r.debug?.armholeStartRow;
    expect(Number.isFinite(armholeStartRow)).toBe(true);

    const map = buildSleevelessRoundNeckShapingMapData(timeline, {
      firstArmholeRc: armholeStartRow,
    })!;
    expect(map).not.toBeNull();

    const rows = timeline.map((e) => e.row);
    const globalMin = Math.min(...rows);
    // The map's lowest label is the center row expressed in armhole-local RC ? not the raw
    // garment RC ? matching formatArmholeLocalRc(garmentRc, armholeStartRow) used elsewhere.
    expect(map.rowMin).toBe(globalMin - Math.floor(armholeStartRow!));
    expect(map.rowMin).toBeLessThan(globalMin);

    // The neckline (center bind-off) row is the front neckline start; its local RC is the
    // pattern's own debug.frontNecklineStartLocalRC ? proving one shared numbering system.
    const frontNecklineStartLocalRC = r.debug?.frontNecklineStartLocalRC;
    if (Number.isFinite(frontNecklineStartLocalRC)) {
      expect(map.rowMin).toBe(Math.floor(frontNecklineStartLocalRC!));
    }
  });

  it("does not build a round-neck schedule for a V-neck front (scope protection)", () => {
    const r = generateSleevelessBackPattern(basePattern("v-neck"));
    expect(buildSleevelessRoundNeckShapingMapData(r.frontNeckShoulderTimeline)).toBeNull();
  });

  it("case 5 ? row gauge changes the shaping schedule", () => {
    const coarse = generateSleevelessBackPattern(basePattern("round", 6));
    const fine = generateSleevelessBackPattern(basePattern("round", 9));
    const coarseSchedule = buildSleevelessRoundNeckShapingSchedule(coarse.frontNeckShoulderTimeline)!;
    const fineSchedule = buildSleevelessRoundNeckShapingSchedule(fine.frontNeckShoulderTimeline)!;
    expect(coarseSchedule).not.toBeNull();
    expect(fineSchedule).not.toBeNull();
    // A finer row gauge => more rows across the same neck depth => a longer RC span.
    const coarseSpan = coarseSchedule.endRow - coarseSchedule.startRow;
    const fineSpan = fineSchedule.endRow - fineSchedule.startRow;
    expect(fineSpan).toBeGreaterThan(coarseSpan);
  });
});
