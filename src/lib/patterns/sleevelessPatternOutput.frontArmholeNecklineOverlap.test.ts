import { describe, expect, it } from "vitest";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
  buildHeldSideInstructionTableRows,
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

/** Deep V: 102 start, BO 4, 3 curve decreases, B=88, divide on the same garment row as BO #1. */
function deepVNeckBindOffPhasePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 8.86,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
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

/** Case A: same 102-st body, V-neck several garment rows before the armhole. */
function vNeckBeforeArmholePattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 9,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 11,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "mens", neckline: "v-neck" },
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

function firstAndHeld(r: ReturnType<typeof generateSleevelessBackPattern>) {
  const chart = r.frontNeckShoulderShapingChart;
  const armholeStart = r.debug.armholeStartRow!;
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, armholeStart, {
    includeCenterNecklineSetupRow: true,
  });
  const opts = { includeCenterNecklineSetupRow: true as const };
  return {
    first: buildActiveSideInstructionTableRows(chart, rcStart, opts),
    held: buildHeldSideInstructionTableRows(chart, rcStart, opts),
  };
}

describe("sleeveless Front V-neck armhole/neckline overlap (Amanda Case C)", () => {
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
    expect(overlap!.divideGarmentRc).toBe(armholeStart + 7);
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

    const chartRow = neckShoulderChartRowsFromTimeline([row], {
      lastArmholeGarmentRc: overlap!.lastArmholeGarmentRc,
    })[0]!;
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
      const chartRow = neckShoulderChartRowsFromTimeline([row], {
        lastArmholeGarmentRc: overlap!.lastArmholeGarmentRc,
      })[0]!;
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
    expect(decrease!.paragraphs.join("\n")).not.toMatch(/Remaining armhole decreases continue/);
    expect(blocks.some((b) => /Begin V-neck shaping/i.test(b.paragraphs.join("\n")))).toBe(true);
    expect(blocks.some((b) => b.stitchCount === 48)).toBe(false);
  });

  it("checklist shows divide 28/28, both events at 008, and active-side wording", () => {
    const { first: rows } = firstAndHeld(r);
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

  it("held side starts from the parked 28 and does not copy a different active count", () => {
    const { first, held } = firstAndHeld(r);
    const heldSetup = held.find(isCenterNecklineSetupChecklistRow);
    expect(heldSetup).toBeDefined();
    expect(heldSetup!.stitchesRemaining).toBe(28);
    expect(heldSetup!.action).toMatch(/28 needles in work/i);
    const firstAt8 = first.filter((row) => row.rc === 8 && !isCenterNecklineSetupChecklistRow(row));
    const heldAt8 = held.filter((row) => row.rc === 8 && !isCenterNecklineSetupChecklistRow(row));
    expect(heldAt8.some((row) => row.edge === "Neck")).toBe(true);
    expect(heldAt8.some((row) => row.edge === "Armhole")).toBe(true);
    expect(heldAt8[heldAt8.length - 1]!.stitchesRemaining).toBe(
      firstAt8[firstAt8.length - 1]!.stitchesRemaining,
    );
  });
});

describe("sleeveless Front V-neck shallow neckline is unchanged (Case D)", () => {
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

describe("sleeveless Front V-neck overlap during initial armhole bind-off phase (Case B 102-st)", () => {
  const r = generateSleevelessBackPattern(deepVNeckBindOffPhasePattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap;
  const tl = r.frontNeckShoulderTimeline!;
  const byLocal = new Map(tl.map((e) => [localRc(e.row, armholeStart), e]));

  it("geometry still uses finished B=88 and the confirmed armhole plan", () => {
    expect(r.debug.bustBodyStitches ?? r.debug.backStitches).toBe(102);
    expect(r.debug.stitchesAfterArmhole).toBe(88);
    expect(overlap).toBeDefined();
    expect(overlap!.stitchesAfterArmhole).toBe(88);
    expect(overlap!.remainingDecreaseLocalRcs).toEqual([2, 4, 6]);
    expect(overlap!.divideGarmentRc).toBe(armholeStart);
    expect(r.debug.frontNecklineStartLocalRC).toBe(0);
    expect(r.debug.frontNecklineShapingBeginLocalRC).toBe(1);
  });

  it("divides 102 → 51/51 on the BO #1 row, then active BO → 47 / held 51", () => {
    expect(overlap!.liveTotalAtDivide).toBe(102);
    expect(overlap!.leftAtDivide).toBe(51);
    expect(overlap!.rightAtDivide).toBe(51);
    expect(overlap!.heldAfterDivideRow).toBe(51);
    expect(overlap!.activeAfterDivideRow).toBe(47);
    expect(overlap!.leftAtDivide).not.toBe(49);
    expect(overlap!.leftAtDivide).not.toBe(47);

    const divide = byLocal.get(0)!;
    expect(divide.stitchesL).toBe(51);
    expect(divide.stitchesR).toBe(47);
    expect(divide.events.filter((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")).toHaveLength(
      1,
    );
    expect(divide.events.some((e) => e.side === "left" && e.kind === "bindOff")).toBe(false);

    const { first } = firstAndHeld(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup).toBeDefined();
    expect(setup!.rc).toBe(0);
    expect(setup!.action).toMatch(/51 stitches on each side/i);
    expect(setup!.action).not.toMatch(/49 stitches/i);
    expect(setup!.action).not.toMatch(/47 stitches on each side/i);
    expect(setup!.stitchesRemaining).toBe(51);

    const at0 = first.filter((row) => row.rc === 0 && !isCenterNecklineSetupChecklistRow(row));
    expect(at0.some((row) => row.edge === "Armhole" && /Bind off/i.test(row.action))).toBe(true);
    expect(at0.some((row) => row.edge === "Shoulder")).toBe(false);
    expect(at0[at0.length - 1]!.stitchesRemaining).toBe(47);
  });

  it("next garment row is the first Neck decrease; opposite BO is not applied to the active half", () => {
    const { first } = firstAndHeld(r);
    const at1 = first.filter((row) => row.rc === 1 && !isCenterNecklineSetupChecklistRow(row));
    expect(at1.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
    expect(at1.some((row) => row.edge === "Armhole" && /Bind off/i.test(row.action))).toBe(false);

    const tlRow = byLocal.get(1)!;
    expect(tlRow.events.some((e) => e.side === "right" && e.edge === "inner" && e.kind === "decrease")).toBe(
      true,
    );
    expect(tlRow.events.some((e) => e.side === "right" && e.edge === "outer" && e.kind === "bindOff")).toBe(
      false,
    );
  });

  it("RC 002 / 004 / 006 execute active-side Armhole decreases, not Shoulder", () => {
    const { first: rows } = firstAndHeld(r);
    let active = 47;
    const firstNeck = rows.find((row) => row.rc === 1 && row.edge === "Neck" && /Decrease/i.test(row.action));
    expect(firstNeck).toBeDefined();
    active = firstNeck!.stitchesRemaining;

    for (const local of [2, 4, 6]) {
      const arm = rows.find(
        (row) => row.rc === local && row.edge === "Armhole" && /Decrease/i.test(row.action),
      );
      expect(arm, `RC ${String(local).padStart(3, "0")} must decrease at the Armhole edge`).toBeDefined();
      expect(arm!.action).not.toMatch(/Knit in pattern/i);
      expect(arm!.action).not.toMatch(/Shoulder/i);
      expect(arm!.stitchesRemaining).toBe(active - 1);
      active = arm!.stitchesRemaining;

      const tlRow = byLocal.get(local)!;
      expect(tlRow.events.filter((e) => e.edge === "outer" && e.kind === "decrease")).toHaveLength(2);
      expect(tlRow.events.some((e) => e.kind === "bindOff" && e.edge === "outer")).toBe(false);
      const chartRow = neckShoulderChartRowsFromTimeline([tlRow], {
        lastArmholeGarmentRc: overlap!.lastArmholeGarmentRc,
      })[0]!;
      expect(String(chartRow.action)).toMatch(/Armhole/);
      expect(String(chartRow.action)).not.toMatch(/Shoulder/i);
    }
  });

  it("second side starts from parked 51 and receives its own Armhole BO", () => {
    const { first, held } = firstAndHeld(r);
    const heldSetup = held.find(isCenterNecklineSetupChecklistRow);
    expect(heldSetup).toBeDefined();
    expect(heldSetup!.stitchesRemaining).toBe(51);
    expect(heldSetup!.action).toMatch(/51 needles in work/i);

    const firstAfterDivide = first.filter((row) => row.rc === 0 && !isCenterNecklineSetupChecklistRow(row));
    expect(firstAfterDivide[firstAfterDivide.length - 1]!.stitchesRemaining).toBe(47);
    expect(heldSetup!.stitchesRemaining).not.toBe(
      firstAfterDivide[firstAfterDivide.length - 1]!.stitchesRemaining,
    );

    const at1 = held.filter((row) => row.rc === 1 && !isCenterNecklineSetupChecklistRow(row));
    expect(at1.some((row) => row.edge === "Neck" && /Decrease/i.test(row.action))).toBe(true);
    expect(at1.some((row) => row.edge === "Armhole" && /Bind off/i.test(row.action))).toBe(true);
    expect(at1[at1.length - 1]!.stitchesRemaining).toBe(46);

    for (const local of [2, 4, 6]) {
      expect(
        held.find((row) => row.rc === local && row.edge === "Armhole" && /Decrease/i.test(row.action)),
      ).toBeDefined();
    }
  });

  it("invariants: B, neck decrease count, and one Armhole event per half", () => {
    expect(r.debug.stitchesAfterArmhole).toBe(88);
    const neckRows = tl.filter((e) =>
      e.events.some((ev) => ev.edge === "inner" && ev.kind === "decrease" && ev.side === "right"),
    );
    expect(neckRows.length).toBeGreaterThan(0);

    const rightBos = tl.flatMap((e) =>
      e.events.filter((ev) => ev.side === "right" && ev.edge === "outer" && ev.kind === "bindOff"),
    );
    const leftBos = tl.flatMap((e) =>
      e.events.filter((ev) => ev.side === "left" && ev.edge === "outer" && ev.kind === "bindOff"),
    );
    expect(rightBos.filter((e) => e.amount === 4)).toHaveLength(1);
    expect(leftBos.filter((e) => e.amount === 4)).toHaveLength(1);

    const { first } = firstAndHeld(r);
    const activeArmholeBos = first.filter(
      (row) => row.edge === "Armhole" && /Bind off/i.test(row.action) && row.rc <= 1,
    );
    expect(activeArmholeBos).toHaveLength(1);
  });
});

describe("sleeveless Front V-neck before the armhole (Case A)", () => {
  const r = generateSleevelessBackPattern(vNeckBeforeArmholePattern());
  const armholeStart = r.debug.armholeStartRow!;
  const overlap = r.debug.frontArmholeNecklineOverlap;
  const tl = r.frontNeckShoulderTimeline!;

  it("divides at the calculated neckline garment RC, several rows before the armhole", () => {
    expect(r.debug.bustBodyStitches ?? r.debug.backStitches).toBe(102);
    expect(r.debug.stitchesAfterArmhole).toBe(88);
    expect(overlap).toBeDefined();
    expect(overlap!.necklineBeginsBeforeArmhole).toBe(true);
    expect(overlap!.divideGarmentRc).toBeLessThan(armholeStart);
    expect(overlap!.divideGarmentRc).toBeLessThanOrEqual(armholeStart - 3);
    expect(r.debug.frontNecklineStartRC).toBe(overlap!.divideGarmentRc);
    expect(r.debug.frontNecklineStartLocalRC).toBe(overlap!.divideGarmentRc - armholeStart);
    expect(r.debug.frontNecklineStartLocalRC).toBeLessThan(0);

    expect(overlap!.liveTotalAtDivide).toBe(102);
    expect(overlap!.leftAtDivide).toBe(51);
    expect(overlap!.rightAtDivide).toBe(51);

    const first = tl[0]!;
    expect(first.row).toBe(overlap!.divideGarmentRc);
    expect(first.stitchesL).toBe(51);
    expect(first.stitchesR).toBe(51);
    expect(first.events.some((e) => e.edge === "outer")).toBe(false);
  });

  it("neck shaping begins immediately; no Armhole event appears before armholeStartRC", () => {
    const { first } = firstAndHeld(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow);
    expect(setup).toBeDefined();
    expect(setup!.rc).toBe(overlap!.divideGarmentRc);
    expect(setup!.rc).not.toBe(0);
    expect(setup!.action).toMatch(/51 stitches on each side/i);

    const beforeArmhole = tl.filter((e) => e.row < armholeStart);
    expect(beforeArmhole.length).toBeGreaterThan(2);
    expect(
      beforeArmhole.some((e) => e.events.some((ev) => ev.edge === "outer" && ev.amount > 0)),
    ).toBe(false);
    expect(
      beforeArmhole.some((e) => e.events.some((ev) => ev.edge === "inner" && ev.kind === "decrease")),
    ).toBe(true);

    const firstNeck = first.find(
      (row) => !isCenterNecklineSetupChecklistRow(row) && row.edge === "Neck" && /Decrease/i.test(row.action),
    );
    expect(firstNeck).toBeDefined();
    expect(firstNeck!.rc).toBeGreaterThanOrEqual(overlap!.divideGarmentRc);
    expect(firstNeck!.rc).toBeLessThan(armholeStart);
  });

  it("when the armhole is reached, the active half gets its BO and later curve decreases", () => {
    const { first, held } = firstAndHeld(r);
    const bo = first.find(
      (row) => row.rc === 0 && row.edge === "Armhole" && /Bind off/i.test(row.action),
    );
    expect(bo).toBeDefined();
    expect(bo!.action).not.toMatch(/Shoulder/i);

    for (const local of [2, 4, 6]) {
      expect(
        first.find((row) => row.rc === local && row.edge === "Armhole" && /Decrease/i.test(row.action)),
      ).toBeDefined();
    }

    const heldSetup = held.find(isCenterNecklineSetupChecklistRow);
    expect(heldSetup!.stitchesRemaining).toBe(overlap!.heldAfterDivideRow);
    const heldBo = held.find(
      (row) => row.rc === 1 && row.edge === "Armhole" && /Bind off/i.test(row.action),
    );
    expect(heldBo).toBeDefined();
  });

  it("does not show finished B in a Front ARMHOLE section and does not clamp neck rows to RC 000", () => {
    const blocks = armholeBlocks(r.frontDisplayRows);
    expect(blocks.some((b) => b.stitchCount === 88)).toBe(false);
    expect(
      r.frontDisplayRows.some(
        (row) =>
          row.kind === "block" &&
          row.paragraphs.some((p) => /before the armhole reset/i.test(p)),
      ),
    ).toBe(false);
    expect(
      r.frontDisplayRows.some(
        (row) =>
          row.kind === "block" &&
          row.paragraphs.some((p) => /^Begin V-neck shaping\.?$/i.test(p)),
      ),
    ).toBe(true);

    const { first } = firstAndHeld(r);
    const setup = first.find(isCenterNecklineSetupChecklistRow)!;
    expect(setup.rc).toBe(overlap!.divideGarmentRc);
    expect(first.filter((row) => row.rc === 0 && row.edge === "Armhole").length).toBeGreaterThan(0);
  });
});
