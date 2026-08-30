import { describe, expect, it } from "vitest";
import { computeAutoShaping, magicFormulaIntervals } from "./autoShaping";
import { computeMagicFormulaPairedShaping } from "./magicFormulaPaired";

describe("computeMagicFormulaPairedShaping", () => {
  it("returns no shaping when start and target match", () => {
    const result = computeMagicFormulaPairedShaping({
      startSts: 60,
      endSts: 60,
      rows: 46,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.noShaping).toBe(true);
    expect(result.direction).toBe("none");
    expect(result.pairedEventCount).toBe(0);
    expect(result.steps).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.method).toBe("magic");
    expect(result.shapingMode).toBe("both");
  });

  it("distributes paired increases with Magic Formula intervals that sum to the available rows", () => {
    const result = computeMagicFormulaPairedShaping({
      startSts: 60,
      endSts: 70,
      rows: 46,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expected = magicFormulaIntervals(46, 5);
    expect(result.direction).toBe("increase");
    expect(result.method).toBe("magic");
    expect(result.shapingMode).toBe("both");
    expect(result.pairedEventCount).toBe(5);
    expect(result.stitchChange).toBe(10);
    expect(result.shortInterval).toBe(expected.shortInterval);
    expect(result.longInterval).toBe(expected.longInterval);
    expect(result.shortCount).toBe(expected.shortCount);
    expect(result.longCount).toBe(expected.longCount);
    expect(result.steps).toEqual(expected.steps);
    expect(
      result.shortCount * result.shortInterval + result.longCount * result.longInterval,
    ).toBe(46);
    expect(result.events).toHaveLength(5);
    expect(result.events.every((event) => event.stitchChange === 2)).toBe(true);
    expect(result.events[result.events.length - 1]).toMatchObject({
      rowNumber: 46,
      stitchesAfter: 70,
    });
  });

  it("uses the same interval split for paired decreases and lands on the exact target", () => {
    const increase = computeMagicFormulaPairedShaping({
      startSts: 60,
      endSts: 70,
      rows: 46,
    });
    const decrease = computeMagicFormulaPairedShaping({
      startSts: 70,
      endSts: 60,
      rows: 46,
    });
    expect(increase.ok && decrease.ok).toBe(true);
    if (!increase.ok || !decrease.ok) return;
    expect(decrease.direction).toBe("decrease");
    expect(decrease.pairedEventCount).toBe(5);
    expect(decrease.steps).toEqual(increase.steps);
    expect(decrease.shortInterval).toBe(increase.shortInterval);
    expect(decrease.longInterval).toBe(increase.longInterval);
    expect(decrease.events.every((event) => event.stitchChange === -2)).toBe(true);
    expect(decrease.events.map((event) => event.rowNumber)).toEqual(
      increase.events.map((event) => event.rowNumber),
    );
    expect(decrease.events[decrease.events.length - 1]).toMatchObject({
      rowNumber: 46,
      stitchesAfter: 60,
    });
  });

  it("rejects an odd stitch difference instead of leaving a remainder stitch", () => {
    const result = computeMagicFormulaPairedShaping({
      startSts: 60,
      endSts: 71,
      rows: 46,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("odd-stitch-change");
    expect(result.message).toMatch(/pairs/i);
  });

  it("rejects more paired events than rows instead of clamping or switching to slope", () => {
    const auto = computeAutoShaping({ startSts: 60, endSts: 80, rows: 8 });
    expect(auto.method).toBe("slope");

    const result = computeMagicFormulaPairedShaping({
      startSts: 60,
      endSts: 80,
      rows: 8,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too-few-rows");
    expect(result.message).toMatch(/10 paired shaping events/);
    expect(result.message).toMatch(/8 rows/);
    expect(result.message).not.toMatch(/clamp/i);
  });

  it("rejects nonsensical row counts", () => {
    expect(
      computeMagicFormulaPairedShaping({ startSts: 60, endSts: 70, rows: 0 }).ok,
    ).toBe(false);
    expect(
      computeMagicFormulaPairedShaping({ startSts: 60, endSts: 70, rows: -4 }).ok,
    ).toBe(false);
  });
});
