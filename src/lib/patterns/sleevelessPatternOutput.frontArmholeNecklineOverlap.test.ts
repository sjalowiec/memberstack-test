import { describe, expect, it } from "vitest";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  isCenterNecklineSetupChecklistRow,
} from "./neckShoulderActiveSideChecklist";
import { neckShoulderChartRowsFromTimeline } from "./neckShoulderShapingChartRows";
import {
  generateSleevelessBackPattern,
  type SleevelessPatternDisplayRow,
} from "./sleevelessPatternOutput";

/** Amanda: 78 start, BO 8, 7 armhole decreases, B=48, V divide at RC 007. */
function amandaVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 6.86,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function shallowVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 39,
        back_neck_to_hem: 18,
        armhole_depth: 8,
        neck_opening: 6,
        shoulder_width: 12,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "v-neck" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 4,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function armholeBlocks(rows: readonly SleevelessPatternDisplayRow[]) {
  let inArmhole = false;
  const out: Extract<SleevelessPatternDisplayRow, { kind: "block" }>[] = [];
  for (const row of rows) {
    if (row.kind === "section") {
      if (row.title === "ARMHOLE") {
        inArmhole = true;
        continue;
      }
      if (inArmhole) break;
    }
    if (inArmhole && row.kind === "block") out.push(row);
  }
  return out;
}

function localRc(entryRow: number, armholeStart: number): number {
  return entryRow - armholeStart;
}

describe("sleeveless Front V-neck armhole/neckline overlap (Amanda)", () => {
  const r = generateSleevelessBackPattern(amandaVNeckPattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap;
  const tl = r.frontNeckShoulderTimeline!;
  const byLocal = new Map(tl.map((e) => [localRc(e.row, armholeStart), e]));

  it("geometry still uses finished B=48 and the confirmed armhole plan", () => {
    expect(r.debug.bustBodyStitches ?? r.debug.backStitches).toBe(78);
    expect(r.debug.stitchesAfterArmhole).toBe(48);
    expect(overlap).toBeDefined();
    expect(overlap!.stitchesAfterArmhole).toBe(48);
    expect(overlap!.completedDecreaseLocalRcs).toEqual([2, 4, 6]);
    expect(overlap!.remainingDecreaseLocalRcs).toEqual([8, 10, 12, 14]);
    expect(r.debug.frontNecklineStartLocalRC).toBe(7);
    expect(r.debug.frontNecklineShapingBeginLocalRC).toBe(8);
  });

  it("RC 007 has 56 live stitches divided 28/28, not 48", () => {
    expect(overlap!.liveTotalAtDivide).toBe(56);
    expect(overlap!.leftAtDivide).toBe(28);
    expect(overlap!.rightAtDivide).toBe(28);
    const divide = byLocal.get(7)!;
    expect(divide.stitchesL).toBe(28);
    expect(divide.stitchesR).toBe(28);
    expect(divide.stitchesL + divide.stitchesR).toBe(56);
    expect(divide.events).toEqual([]);
  });

  it("RC 008 contains both Armhole and Neck shaping; active-side count reflects both", () => {
    const row = byLocal.get(8)!;
    const armhole = row.events.filter((e) => e.edge === "outer" && e.kind === "decrease");
    const neck = row.events.filter((e) => e.edge === "inner" && e.kind === "decrease");
    expect(armhole).toHaveLength(2);
    expect(neck.length).toBeGreaterThan(0);
    expect(row.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
    expect(row.stitchesL).toBe(26);
    expect(row.stitchesR).toBe(26);

    const chartRow = neckShoulderChartRowsFromTimeline([row])[0]!;
    expect(String(chartRow.action)).toBe("Armhole / Neck");
    expect(String(chartRow.action)).not.toMatch(/Shoulder/i);
  });

  it("RC 010 / 012 / 014 keep armhole decreases; neck continues on its own schedule", () => {
    const geometryNeckRows = new Set(
      tl
        .filter((e) => e.events.some((ev) => ev.edge === "inner" && ev.amount > 0))
        .map((e) => localRc(e.row, armholeStart)),
    );
    expect(geometryNeckRows.has(8)).toBe(true);

    for (const local of [10, 12, 14]) {
      const row = byLocal.get(local)!;
      expect(row.events.filter((e) => e.edge === "outer" && e.kind === "decrease")).toHaveLength(2);
      expect(row.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
      const chartRow = neckShoulderChartRowsFromTimeline([row])[0]!;
      expect(String(chartRow.action)).not.toMatch(/Shoulder/i);
      expect(String(chartRow.action)).toMatch(/Armhole/);
    }

    const after14 = tl.filter((e) => localRc(e.row, armholeStart) > 14);
    expect(after14.length).toBeGreaterThan(0);
    expect(
      after14.some((e) => e.events.some((ev) => ev.edge === "outer" && ev.kind === "decrease")),
    ).toBe(false);
    expect(
      after14.some((e) => e.events.some((ev) => ev.edge === "inner" && ev.kind === "decrease")),
    ).toBe(true);
  });

  it("does not jump 56 → 48 in the Front armhole summary or divide row", () => {
    const blocks = armholeBlocks(r.frontDisplayRows);
    const decrease = blocks.find((b) =>
      b.paragraphs.some((p) => /Decrease 1 stitch at each armhole edge/i.test(p)),
    );
    expect(decrease).toBeDefined();
    expect(decrease!.stitchCount).toBe(56);
    expect(decrease!.paragraphs.join("\n")).toMatch(/Decrease on rows: 2 - 4 - 6/);
    expect(decrease!.paragraphs.join("\n")).not.toMatch(/8 - 10 - 12 - 14/);
    expect(decrease!.paragraphs.join("\n")).toMatch(/Remaining armhole decreases continue/);
    expect(blocks.some((b) => b.stitchCount === 48)).toBe(false);
  });

  it("checklist shows divide 28/28, both events at 008, and active-side wording", () => {
    const chart = r.frontNeckShoulderShapingChart;
    const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, {
      includeCenterNecklineSetupRow: true,
    });
    const rows = buildActiveSideInstructionTableRows(chart, rcStart, {
      includeCenterNecklineSetupRow: true,
    });
    const setup = rows.find(isCenterNecklineSetupChecklistRow);
    expect(setup).toBeDefined();
    expect(setup!.rc).toBe(7);
    expect(setup!.action).toMatch(/28 stitches on each side/i);
    expect(setup!.action).toMatch(/active side/i);
    expect(setup!.stitchesRemaining).toBe(28);
    expect(setup!.stitchesRemainingDisplay).toBe("28 (active side)");

    const at8 = rows.filter((row) => row.rc === 8 && !isCenterNecklineSetupChecklistRow(row));
    expect(at8.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
    expect(at8.some((row) => row.edge === "Armhole" && /Decrease/i.test(row.action))).toBe(true);
    expect(at8[at8.length - 1]!.stitchesRemaining).toBe(26);

    for (const local of [10, 12, 14]) {
      const arm = rows.find((row) => row.rc === local && row.edge === "Armhole" && /Decrease/i.test(row.action));
      expect(arm).toBeDefined();
    }

    const lastArmholeDec = rows.filter((row) => row.rc === 14 && /Decrease/i.test(row.action));
    const afterArmhole = rows.filter((row) => row.rc > 14);
    expect(lastArmholeDec.length).toBeGreaterThan(0);
    expect(afterArmhole.some((row) => row.edge === "Armhole" && /Decrease/i.test(row.action))).toBe(
      false,
    );
  });

  it("leaves Back armhole summary on the finished B count", () => {
    expect(r.debug.frontArmholeNecklineOverlap).toBeDefined();
    const backDecrease = armholeBlocks(r.displayRows).find((b) =>
      b.paragraphs.some((p) => /Decrease 1 stitch at each armhole edge/i.test(p)),
    );
    expect(backDecrease?.stitchCount).toBe(48);
    expect(backDecrease?.paragraphs.join("\n")).toMatch(/2 - 4 - 6 - 8 - 10 - 12 - 14/);
  });
});

describe("sleeveless Front V-neck shallow neckline is unchanged", () => {
  it("does not compose overlap when the neckline starts after armhole decreases finish", () => {
    const r = generateSleevelessBackPattern(shallowVNeckPattern());
    expect(r.debug.frontArmholeNecklineOverlap).toBeUndefined();
    expect(r.debug.frontNecklineStartLocalRC).toBeGreaterThan(14);
    expect(r.debug.stitchesAfterArmhole).toBe(48);

    const first = r.frontNeckShoulderTimeline![0]!;
    expect(first.stitchesL + first.stitchesR).toBe(r.debug.stitchesAfterArmhole);

    const decrease = armholeBlocks(r.frontDisplayRows).find((b) =>
      b.paragraphs.some((p) => /Decrease 1 stitch at each armhole edge/i.test(p)),
    );
    expect(decrease?.stitchCount).toBe(r.debug.stitchesAfterArmhole);
    expect(decrease?.paragraphs.join("\n")).not.toMatch(/Remaining armhole decreases continue/);

    const hasOuterDecrease = r.frontNeckShoulderTimeline!.some((e) =>
      e.events.some((ev) => ev.edge === "outer" && ev.kind === "decrease"),
    );
    expect(hasOuterDecrease).toBe(false);
  });
});
