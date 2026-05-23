import { describe, expect, it } from "vitest";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import {
  EXPRESS_DEFAULT_AVAILABLE_NEEDLES,
  evaluateExpressNeedleFailSafeBeforeRender,
  isValidExpressAvailableNeedles,
  readExpressSessionAvailableNeedles,
  resolveExpressAvailableNeedles,
  resolveExpressAvailableNeedlesForResume,
  resolveExpressAvailableNeedlesForValidation,
  resolveExpressAvailableNeedlesForValidationWithSource,
  resolveExpressNeedleFailSafeActivation,
  resolveExpressRequiredNeedlesFromPattern,
  validateExpressPatternNeedles,
  validateExpressPatternNeedlesFromSources,
} from "./sleevelessExpressAvailableNeedles";

function expressPatternData(overrides: {
  finishedBust?: number;
  finishedHip?: number;
  availableNeedles?: number;
  bodyShape?: string;
  frontStyle?: string;
  gaugeStitchesPerInch?: number;
} = {}): Record<string, unknown> {
  return {
    fit: {
      selectedMeasurements: {
        finished_bust_chest: overrides.finishedBust ?? 40,
        finished_hip: overrides.finishedHip ?? 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: {
      patternMode: "express",
      bodyShape: overrides.bodyShape ?? "straight",
      frontStyle: overrides.frontStyle ?? "closed",
      neckline: "round",
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: overrides.gaugeStitchesPerInch ?? 5,
      gaugeRowsPerInch: 7,
      availableNeedles: overrides.availableNeedles ?? 200,
    },
  };
}

describe("resolveExpressAvailableNeedles", () => {
  it("defaults to 150 when there is no prior value or input", () => {
    expect(resolveExpressAvailableNeedles(undefined)).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
    expect(resolveExpressAvailableNeedles({})).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
    expect(resolveExpressAvailableNeedles(undefined, "  ")).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
  });

  it("prefers live input over stored yarnGaugeMachine", () => {
    expect(resolveExpressAvailableNeedles({ availableNeedles: 200 }, "272")).toBe("272");
    expect(resolveExpressAvailableNeedles({ availableNeedles: "200" }, "110")).toBe("110");
  });

  it("preserves prior yarnGaugeMachine when input is empty", () => {
    expect(resolveExpressAvailableNeedles({ availableNeedles: 200 })).toBe("200");
    expect(resolveExpressAvailableNeedles({ availableNeedles: "110" })).toBe("110");
  });
});

describe("isValidExpressAvailableNeedles", () => {
  it("accepts positive integers and rejects empty or non-positive values", () => {
    expect(isValidExpressAvailableNeedles("150")).toBe(true);
    expect(isValidExpressAvailableNeedles(" 272 ")).toBe(true);
    expect(isValidExpressAvailableNeedles("")).toBe(false);
    expect(isValidExpressAvailableNeedles("0")).toBe(false);
    expect(isValidExpressAvailableNeedles("-1")).toBe(false);
    expect(isValidExpressAvailableNeedles("abc")).toBe(false);
  });
});

describe("resolveExpressAvailableNeedlesForResume", () => {
  it("prefers Express session snapshot over pattern storage", () => {
    expect(
      resolveExpressAvailableNeedlesForResume("150", { availableNeedles: 200 }),
    ).toBe("150");
  });

  it("falls back to yarnGaugeMachine then default", () => {
    expect(resolveExpressAvailableNeedlesForResume(undefined, { availableNeedles: 272 })).toBe(
      "272",
    );
    expect(resolveExpressAvailableNeedlesForResume("", {})).toBe(EXPRESS_DEFAULT_AVAILABLE_NEEDLES);
  });
});

describe("validateExpressPatternNeedles", () => {
  it("passes when required needles are within available needles", () => {
    const result = generateSleevelessBackPattern(expressPatternData({ availableNeedles: 300 }));
    const required = resolveExpressRequiredNeedlesFromPattern(result);
    expect(required).toBeGreaterThan(0);
    const validation = validateExpressPatternNeedles(300, result);
    expect(validation.ok).toBe(true);
    expect(validation.requiredNeedles).toBe(required);
    expect(validation.availableNeedles).toBe(300);
  });

  it("fails when required needles exceed available needles", () => {
    const result = generateSleevelessBackPattern(expressPatternData({ finishedBust: 48 }));
    const required = resolveExpressRequiredNeedlesFromPattern(result);
    expect(required).toBeGreaterThan(100);
    const validation = validateExpressPatternNeedles(100, result);
    expect(validation.ok).toBe(false);
    expect(validation.requiredNeedles).toBe(required);
    expect(validation.availableNeedles).toBe(100);
    expect(validation.requiredNeedles).toBeGreaterThan(validation.availableNeedles);
  });

  it("uses reverse A-line bust width, not cast-on only", () => {
    const result = generateSleevelessBackPattern(
      expressPatternData({
        bodyShape: "aline",
        finishedBust: 28.8,
        finishedHip: 20,
      }),
    );
    expect(result.debug.hemCastOnStitches).toBeLessThan(result.debug.bustBodyStitches!);
    const required = resolveExpressRequiredNeedlesFromPattern(result);
    expect(required).toBe(result.debug.bustBodyStitches);
    expect(required).toBeGreaterThan(result.debug.hemCastOnStitches!);
    expect(validateExpressPatternNeedles(result.debug.hemCastOnStitches, result).ok).toBe(false);
    expect(validateExpressPatternNeedles(required, result).ok).toBe(true);
  });

  it("hard-stops when cast-on is 166 and available needles are 100", () => {
    const base = generateSleevelessBackPattern(expressPatternData());
    const validation = validateExpressPatternNeedlesFromSources(
      { yarnGaugeMachine: { availableNeedles: "100" } },
      {
        ...base,
        displayRows: [
          {
            kind: "block",
            paragraphs: ["Cast on 166 stitches for the back."],
            stitchCount: 166,
          },
        ],
      },
    );
    expect(validation.requiredNeedles).toBe(166);
    expect(validation.availableNeedles).toBe(100);
    expect(validation.ok).toBe(false);
  });

  it("hard-stops when cast-on is 176 and available needles are 100", () => {
    const validation = validateExpressPatternNeedlesFromSources(
      { expressSessionNeedles: "100" },
      {
        debug: { hemCastOnStitches: 120, bustBodyStitches: 176, backStitches: 176 },
        displayRows: [
          {
            kind: "block",
            paragraphs: ["Cast on 176 stitches for the back."],
            stitchCount: 176,
          },
        ],
        frontDisplayRows: [],
      },
    );
    expect(validation.requiredNeedles).toBe(176);
    expect(validation.availableNeedles).toBe(100);
    expect(validation.ok).toBe(false);
  });
});

describe("resolveExpressAvailableNeedlesForValidation", () => {
  it("prefers express session over stale yarnGaugeMachine defaults", () => {
    expect(
      resolveExpressAvailableNeedlesForValidation({
        yarnGaugeMachine: { availableNeedles: "200" },
        expressSessionNeedles: "100",
      }),
    ).toBe(100);
    expect(
      resolveExpressAvailableNeedlesForValidationWithSource({
        yarnGaugeMachine: { availableNeedles: "200" },
        expressSessionNeedles: "100",
      }),
    ).toEqual({ value: 100, source: "express-session" });
  });

  it("falls back to express session when pattern storage is missing needles", () => {
    expect(
      resolveExpressAvailableNeedlesForValidation({
        expressSessionNeedles: "100",
      }),
    ).toBe(100);
  });
});

describe("readExpressSessionAvailableNeedles", () => {
  it("returns undefined when localStorage is unavailable", () => {
    expect(readExpressSessionAvailableNeedles()).toBeUndefined();
  });
});

describe("evaluateExpressNeedleFailSafeBeforeRender", () => {
  const widePatternResult = {
    debug: { hemCastOnStitches: 120, bustBodyStitches: 176, backStitches: 176 },
    displayRows: [
      {
        kind: "block" as const,
        paragraphs: ["Cast on 176 stitches for the back."],
        stitchCount: 176,
      },
    ],
    frontDisplayRows: [],
  };

  it("blocks render when required needles exceed session available needles", () => {
    const failSafe = evaluateExpressNeedleFailSafeBeforeRender(widePatternResult, {
      patternData: {
        style: { patternMode: "express" },
        yarnGaugeMachine: { availableNeedles: "200" },
      },
      patternMerged: { machine: { availableNeedles: "200" } },
      canonicalStyle: { patternMode: "express" },
      session: {
        values: { who: "women", selectedSize: "medium" },
        availableNeedles: "100",
        flowSteps: 5,
      },
    });

    expect(failSafe.ran).toBe(true);
    expect(failSafe.active).toBe(true);
    expect(failSafe.shouldBlockRender).toBe(true);
    expect(failSafe.availableNeedles).toBe(100);
    expect(failSafe.availableSource).toBe("express-session");
    expect(failSafe.requiredNeedles).toBe(176);
    expect(failSafe.requiredSource).toMatch(/castOnText|stitchCount|debug/);
    expect(failSafe.validation.ok).toBe(false);
  });

  it("runs when patternMode was overwritten to custom-build but express session exists", () => {
    const failSafe = evaluateExpressNeedleFailSafeBeforeRender(widePatternResult, {
      patternData: {
        style: { patternMode: "custom-build" },
        yarnGaugeMachine: { availableNeedles: "200" },
      },
      patternMerged: { machine: { availableNeedles: "200" } },
      canonicalStyle: { patternMode: "custom-build" },
      session: {
        values: { who: "women", selectedSize: "medium" },
        availableNeedles: "100",
        flowSteps: 5,
      },
    });

    expect(failSafe.ran).toBe(true);
    expect(failSafe.active).toBe(true);
    expect(failSafe.activeReason).toMatch(/overwritten custom-build|express handoff/i);
    expect(failSafe.shouldBlockRender).toBe(true);
    expect(failSafe.requiredNeedles).toBe(176);
    expect(failSafe.availableNeedles).toBe(100);
  });

  it("skips pure custom-build without express handoff signals", () => {
    const failSafe = evaluateExpressNeedleFailSafeBeforeRender(widePatternResult, {
      patternData: {
        style: { patternMode: "custom-build" },
        yarnGaugeMachine: { availableNeedles: "100" },
      },
      patternMerged: {},
      canonicalStyle: { patternMode: "custom-build" },
      session: null,
      expressRouteHint: false,
    });

    expect(failSafe.ran).toBe(false);
    expect(failSafe.active).toBe(false);
    expect(failSafe.shouldBlockRender).toBe(false);
    expect(failSafe.skipReason).toMatch(/custom-build without express handoff/i);
  });

  it("does not block when required needles fit available needles", () => {
    const failSafe = evaluateExpressNeedleFailSafeBeforeRender(widePatternResult, {
      patternData: { style: { patternMode: "express" } },
      patternMerged: {},
      canonicalStyle: { patternMode: "express" },
      session: {
        values: { who: "women" },
        availableNeedles: "300",
        flowSteps: 5,
      },
    });

    expect(failSafe.ran).toBe(true);
    expect(failSafe.shouldBlockRender).toBe(false);
    expect(failSafe.validation.ok).toBe(true);
  });
});

describe("resolveExpressNeedleFailSafeActivation", () => {
  it("activates from express session even when patternMode is custom-build", () => {
    const activation = resolveExpressNeedleFailSafeActivation({
      canonicalStyle: { patternMode: "custom-build" },
      patternBuilderStyle: { patternMode: "custom-build" },
      session: {
        values: { who: "women", selectedSize: "medium" },
        availableNeedles: "100",
        flowSteps: 5,
      },
    });
    expect(activation.active).toBe(true);
  });
});
