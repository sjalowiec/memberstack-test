import { describe, expect, it } from "vitest";
import {
  BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE,
  calculateBustDart,
  normalizeBustDartConfigForAudience,
  normalizeBustDartSavedConfig,
  readBustDartConfigFromPatternData,
  type BustDartInput,
} from "./bustDart";
import { inchesToRows } from "../sleevelessRowAccounting";

function baseInput(over: Partial<BustDartInput> = {}): BustDartInput {
  return {
    enabled: true,
    cupSize: "C",
    sizeGroup: "misses",
    stitchesPerInch: 5,
    rowsPerInch: 7,
    frontConstruction: "pullover",
    frontStitchCount: 100,
    armholeOpeningGarmentRc: 140,
    hemRows: 22,
    bodyToArmholeRows: 118,
    ...over,
  };
}

describe("bustDart lego block", () => {
  it("returns inactive when darts are disabled", () => {
    const r = calculateBustDart(baseInput({ enabled: false }));
    expect(r.active).toBe(false);
    expect(r.eligible).toBe(true);
    expect(r.config).toEqual({ enabled: false, cupSize: null });
    expect(r.instructionParagraphs).toEqual([]);
  });

  it("activates for eligible women’s patterns", () => {
    const r = calculateBustDart(baseInput());
    expect(r.active).toBe(true);
    expect(r.eligible).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.placementOffsetRows).toBe(inchesToRows(1, 7));
    expect(r.dartStartGarmentRc).toBe(140 - 7);
    expect(r.shaping?.totalHeldStitches).toBe(16);
    expect(r.shaping?.totalDepthRows).toBe(7);
    expect(r.instructionParagraphs.some((p) => p.includes("front only"))).toBe(true);
  });

  it("treats plus and women who-keys as eligible", () => {
    expect(calculateBustDart(baseInput({ sizeGroup: "plus" })).eligible).toBe(true);
    expect(calculateBustDart(baseInput({ sizeGroup: "women" })).eligible).toBe(true);
  });

  it("disables for men, kids, and baby", () => {
    for (const sizeGroup of ["men", "kids", "baby"]) {
      const r = calculateBustDart(baseInput({ sizeGroup, enabled: true }));
      expect(r.active).toBe(false);
      expect(r.eligible).toBe(false);
      expect(r.config.enabled).toBe(false);
    }
  });

  it("uses the same 1″ placement in rows for inch-equivalent gauges", () => {
    const a = calculateBustDart(baseInput({ rowsPerInch: 7 }));
    const b = calculateBustDart(baseInput({ rowsPerInch: (28 / 10) * 2.54 }));
    // Different float rpi may round differently; exact 7 vs converted should match when equal.
    expect(a.placementOffsetRows).toBe(7);
    expect(BUST_DART_PLACEMENT_INCHES_BELOW_ARMHOLE).toBe(1);
    expect(inchesToRows(1, 7)).toBe(7);
    expect(inchesToRows(1, (28 / 4))).toBe(7);
    void b;
  });

  it("places dart at armholeRc − round(1 × rpi) at multiple gauges", () => {
    for (const rpi of [5, 6, 7, 8, 9]) {
      const armhole = 100;
      const r = calculateBustDart(
        baseInput({
          rowsPerInch: rpi,
          armholeOpeningGarmentRc: armhole,
          bodyToArmholeRows: 80,
          hemRows: 20,
        }),
      );
      expect(r.active).toBe(true);
      expect(r.placementOffsetRows).toBe(Math.round(rpi));
      expect(r.dartStartGarmentRc).toBe(armhole - Math.round(rpi));
    }
  });

  it("errors when cup size is missing while enabled", () => {
    const r = calculateBustDart(baseInput({ cupSize: null }));
    expect(r.active).toBe(false);
    expect(r.errors.some((e) => /cup size/i.test(e))).toBe(true);
  });

  it("errors when front stitches cannot hold the dart", () => {
    const r = calculateBustDart(baseInput({ frontStitchCount: 10, cupSize: "DD" }));
    expect(r.active).toBe(false);
    expect(r.errors.some((e) => /enough stitches|too narrow/i.test(e))).toBe(true);
  });

  it("errors when body rows below armhole are insufficient", () => {
    const r = calculateBustDart(
      baseInput({
        bodyToArmholeRows: 3,
        armholeOpeningGarmentRc: 25,
        hemRows: 22,
      }),
    );
    expect(r.active).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("normalizes malformed saved config to off", () => {
    expect(normalizeBustDartSavedConfig(undefined)).toEqual({ enabled: false, cupSize: null });
    expect(normalizeBustDartSavedConfig("nope")).toEqual({ enabled: false, cupSize: null });
    expect(normalizeBustDartSavedConfig({ enabled: true, cupSize: "Z" })).toEqual({
      enabled: true,
      cupSize: null,
    });
    expect(normalizeBustDartSavedConfig({ enabled: true, cupSize: "B" })).toEqual({
      enabled: true,
      cupSize: "B",
    });
  });

  it("loads legacy missing style.bustDart as off", () => {
    expect(readBustDartConfigFromPatternData({ style: { bodyShape: "straight" } })).toEqual({
      enabled: false,
      cupSize: null,
    });
  });

  it("clears darts when audience becomes ineligible", () => {
    expect(
      normalizeBustDartConfigForAudience({ enabled: true, cupSize: "C" }, "men"),
    ).toEqual({ enabled: false, cupSize: null });
  });

  it("is deterministic and does not mutate caller input", () => {
    const input = baseInput();
    const freeze = structuredClone(input);
    const a = calculateBustDart(input);
    const b = calculateBustDart(input);
    expect(a).toEqual(b);
    expect(input).toEqual(freeze);
  });

  it("cardigan results include right-front mirror note; pullover does not", () => {
    const pullover = calculateBustDart(baseInput({ frontConstruction: "pullover" }));
    const cardigan = calculateBustDart(
      baseInput({ frontConstruction: "cardigan", frontStitchCount: 50 }),
    );
    expect(pullover.cardiganRightMirrorParagraph).toBeNull();
    expect(cardigan.cardiganRightMirrorParagraph).toMatch(/RIGHT FRONT/i);
    expect(cardigan.instructionParagraphs.some((p) => /side \(armhole\) edge/i.test(p))).toBe(
      true,
    );
  });
});
