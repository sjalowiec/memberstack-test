import { describe, expect, it } from "vitest";
import {
  calculateSetInArmhole,
  divideSetInArmholeShaping,
  stairStepBindOffs,
} from "./setInArmhole";

describe("stair-step rounding", () => {
  it("uses two bind-offs for four or five stitches and three from six upward", () => {
    expect(stairStepBindOffs(3)).toBeNull();
    expect(stairStepBindOffs(4)).toEqual([2, 2]);
    expect(stairStepBindOffs(5)).toEqual([3, 2]);
    expect(stairStepBindOffs(6)).toEqual([2, 2, 2]);
    expect(stairStepBindOffs(7)).toEqual([3, 2, 2]);
    expect(stairStepBindOffs(8)).toEqual([3, 3, 2]);
    expect(stairStepBindOffs(9)).toEqual([3, 3, 3]);
    expect(stairStepBindOffs(12)).toEqual([4, 4, 4]);
  });

  it("keeps every stair step at least two stitches and conserves the group", () => {
    for (let stitches = 4; stitches <= 40; stitches += 1) {
      const steps = stairStepBindOffs(stitches);
      expect(steps).not.toBeNull();
      if (!steps) continue;
      expect(steps.length === 2 || steps.length === 3).toBe(true);
      expect(steps.reduce((sum, step) => sum + step, 0)).toBe(stitches);
      for (const step of steps) expect(step).toBeGreaterThanOrEqual(2);
      const first = steps[0] ?? 0;
      for (const step of steps) expect(step).toBeLessThanOrEqual(first);
    }
  });
});

describe("automatic armhole method", () => {
  it("uses the standard armhole when the stair-step third is under four stitches", () => {
    for (const shaping of [1, 4, 8, 9, 10]) {
      const groups = divideSetInArmholeShaping(shaping);
      expect(groups?.method).toBe("standard");
      expect(groups?.stairStepBindOffsEachSide).toEqual([]);
      expect(groups?.initialBindOffStitchesEachSide).toBe(Math.round(shaping / 2));
      expect(
        (groups?.initialBindOffStitchesEachSide ?? 0) + (groups?.decreaseStitchesEachSide ?? 0),
      ).toBe(shaping);
    }
  });

  it("uses the alternate armhole from 11 shaping stitches upward", () => {
    expect(divideSetInArmholeShaping(11)).toEqual({
      method: "alternate",
      initialBindOffStitchesEachSide: 4,
      stairStepBindOffsEachSide: [2, 2],
      decreaseStitchesEachSide: 3,
    });
    expect(divideSetInArmholeShaping(19)).toEqual({
      method: "alternate",
      initialBindOffStitchesEachSide: 6,
      stairStepBindOffsEachSide: [2, 2, 2],
      decreaseStitchesEachSide: 7,
    });
    expect(divideSetInArmholeShaping(14)).toEqual({
      method: "alternate",
      initialBindOffStitchesEachSide: 5,
      stairStepBindOffsEachSide: [3, 2],
      decreaseStitchesEachSide: 4,
    });
  });

  it("conserves shaping stitches after rounding", () => {
    for (let shaping = 1; shaping <= 80; shaping += 1) {
      const groups = divideSetInArmholeShaping(shaping);
      expect(groups).not.toBeNull();
      if (!groups) continue;
      const stairs = groups.stairStepBindOffsEachSide.reduce((sum, step) => sum + step, 0);
      expect(groups.initialBindOffStitchesEachSide + stairs + groups.decreaseStitchesEachSide).toBe(
        shaping,
      );
      if (groups.method === "alternate") {
        expect(stairs).toBeGreaterThanOrEqual(4);
        expect(groups.decreaseStitchesEachSide).toBeGreaterThan(0);
      }
    }
  });
});

describe("set-in armhole row budget", () => {
  it("uses one plan for the front and the back", () => {
    const plan = calculateSetInArmhole({
      startingStitches: 122,
      targetStitches: 84,
      totalRows: 70,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.appliesTo).toBe("front-and-back");
    expect(plan.method).toBe("alternate");
    expect(plan.matchedBindOffRows).toBe(8);
    expect(plan.decreaseRows).toBe(14);
    expect(plan.straightRows).toBe(48);
    expect(plan.totalRows).toBe(plan.matchedBindOffRows + plan.decreaseRows + plan.straightRows);
  });

  it("knits the standard armhole over two bind-off rows", () => {
    const plan = calculateSetInArmhole({
      startingStitches: 100,
      targetStitches: 80,
      totalRows: 40,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.shapingStitchesEachSide).toBe(10);
    expect(plan.method).toBe("standard");
    expect(plan.initialBindOffStitchesEachSide).toBe(5);
    expect(plan.decreaseStitchesEachSide).toBe(5);
    expect(plan.decreaseRows).toBe(10);
    expect(plan.matchedBindOffRows).toBe(2);
    expect(plan.straightRows).toBe(28);
  });

  it("rejects an armhole that is too shallow for its bind-offs and decreases", () => {
    const plan = calculateSetInArmhole({
      startingStitches: 122,
      targetStitches: 84,
      totalRows: 12,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toBe("armhole-too-shallow");
  });

  it("rejects a stitch difference that cannot be split between the two sides", () => {
    const plan = calculateSetInArmhole({
      startingStitches: 21,
      targetStitches: 10,
      totalRows: 40,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.reason).toBe("armhole-shaping");
  });
});
