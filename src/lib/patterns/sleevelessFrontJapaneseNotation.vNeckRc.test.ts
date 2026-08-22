import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  displayRcFromGarmentRc,
  pulloverArmholeEvents,
  resolveFrontVNeckRowCounterDisplayPolicy,
  sleevelessPulloverVNeckBeginDisplayRc,
} from "./frontArmholeNecklineComposition";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  buildActiveSideInstructionTableRows,
} from "./neckShoulderActiveSideChecklist";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import {
  buildFrontJapaneseNotationReplacements,
  resolveFrontVNeckNotationRcModel,
} from "./sleevelessFrontJapaneseNotation";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { SAMPLE_SHAPING_MAP_DATA } from "./shapingMapSvg";

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

function equalDepthVNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "mens",
      selectedMeasurements: {
        finished_bust_chest: 51,
        back_neck_to_hem: 28,
        armhole_depth: 10,
        neck_opening: 6,
        shoulder_width: 22,
        front_neck_depth: 10,
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

function firstSideRows(r: ReturnType<typeof generateSleevelessBackPattern>) {
  const chart = r.frontNeckShoulderShapingChart;
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.debug.armholeStartRow, {
    includeCenterNecklineSetupRow: true,
  });
  return buildActiveSideInstructionTableRows(chart, rcStart, {
    includeCenterNecklineSetupRow: true,
  });
}

describe("sleeveless Front V-neck Shaping Notation RC policy", () => {
  it("Case 4 deep V: no reset, garment RC start, composed armhole rows", () => {
    const pattern = vNeckBeforeArmholePattern();
    const r = generateSleevelessBackPattern(pattern);
    const overlap = r.debug.frontArmholeNecklineOverlap!;
    const armholeStart = r.debug.armholeStartRow!;
    const model = resolveFrontVNeckNotationRcModel(r);
    const repl = buildFrontJapaneseNotationReplacements(r, pattern);
    const beginRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });
    const first = firstSideRows(r);

    expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("continuous-garment-rc");
    expect(model.policy).toBe("continuous-garment-rc");
    expect(model.resetToken).toBe("");
    expect(repl.rc_reset).toBe("");
    expect(repl.rc_reset).not.toContain("↺");
    expect(repl.rc_reset).not.toContain("rc000");

    expect(beginRc).toBe(overlap.divideGarmentRc);
    expect(beginRc).not.toBe(0);
    expect(model.necklineStartDisplayRc).toBe(beginRc);
    expect(repl["rc-neckline-start"]).toBe(`rc${String(beginRc).padStart(3, "0")}`);
    expect(repl["rc-neckline-start"]).not.toBe("rc000");

    expect(repl["rc-armhole-bo"]).toBe(`rc${String(armholeStart).padStart(3, "0")}`);
    const expectedDecs = overlap.remainingDecreaseLocalRcs.map((local) => armholeStart + local);
    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(expectedDecs);
    expect(model.armholeDecreasePoints.map((p) => p.row)).not.toEqual(
      expectedDecs.map((_, i) => i * 2),
    );
    expect(model.armholeDecreasePoints.some((p) => p.row === 0 || p.row === 2)).toBe(false);

    const checklistDecs = first
      .filter((row) => row.edge === "Armhole" && /Decrease/i.test(row.action))
      .map((row) => row.rc);
    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(checklistDecs);

    const setup = first.find((row) => /center|each side/i.test(row.action));
    expect(setup?.rc).toBe(beginRc);

    const sharedRcs = new Set(
      first.filter((row) => row.edge === "Neck").map((row) => row.rc),
    );
    for (const row of first.filter((row) => row.edge === "Armhole")) {
      if (sharedRcs.has(row.rc)) {
        expect(model.armholeDecreasePoints.some((p) => p.row === row.rc) || row.rc === armholeStart).toBe(
          true,
        );
      }
    }
  });

  it("Case 1 shallow: keeps armhole reset and post-reset neckline RC", () => {
    const pattern = shallowVNeckPattern();
    const r = generateSleevelessBackPattern(pattern);
    const overlap = r.debug.frontArmholeNecklineOverlap;
    const model = resolveFrontVNeckNotationRcModel(r);
    const repl = buildFrontJapaneseNotationReplacements(r, pattern);
    const beginRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });
    const first = firstSideRows(r);
    const setup = first.find((row) => /center|each side/i.test(row.action));

    expect(model.policy).toBe("armhole-reset-first");
    expect(repl.rc_reset).toBe("↺ rc000");
    expect(model.necklineStartDisplayRc).toBe(beginRc);
    expect(repl["rc-neckline-start"]).toBe(`rc${String(beginRc).padStart(3, "0")}`);
    expect(setup?.rc).toBe(beginRc);
    expect(model.armholeDecreasePoints[0]?.row).toBe(2);
  });

  it("Case 2 Amanda: keeps reset and remaining armhole display RCs from the checklist", () => {
    const pattern = amandaVNeckPattern();
    const r = generateSleevelessBackPattern(pattern);
    const overlap = r.debug.frontArmholeNecklineOverlap!;
    const armholeStart = r.debug.armholeStartRow!;
    const model = resolveFrontVNeckNotationRcModel(r);
    const repl = buildFrontJapaneseNotationReplacements(r, pattern);
    const first = firstSideRows(r);

    expect(resolveFrontVNeckRowCounterDisplayPolicy(overlap)).toBe("armhole-reset-first");
    expect(repl.rc_reset).toBe("↺ rc000");
    expect(overlap.remainingDecreaseLocalRcs).toEqual([8, 10, 12, 14]);
    const remainingDisplay = overlap.remainingDecreaseLocalRcs.map((local) =>
      displayRcFromGarmentRc(armholeStart + local, armholeStart, model.policy),
    );
    expect(remainingDisplay).toEqual([8, 10, 12, 14]);
    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(
      expect.arrayContaining(remainingDisplay),
    );
    const checklistRemaining = first
      .filter((row) => row.edge === "Armhole" && /Decrease/i.test(row.action) && row.rc >= 8)
      .map((row) => row.rc);
    expect(checklistRemaining).toEqual(remainingDisplay);
    const beginRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });
    expect(repl["rc-neckline-start"]).toBe(`rc${String(beginRc).padStart(3, "0")}`);
    expect(beginRc).toBe(7);
  });

  it("Case 3 / equal-depth: shared reset and start at RC 000", () => {
    const pattern = equalDepthVNeckPattern();
    const r = generateSleevelessBackPattern(pattern);
    const overlap = r.debug.frontArmholeNecklineOverlap;
    const model = resolveFrontVNeckNotationRcModel(r);
    const repl = buildFrontJapaneseNotationReplacements(r, pattern);
    const beginRc = sleevelessPulloverVNeckBeginDisplayRc({
      overlap,
      frontNecklineStartLocalRC: r.debug.frontNecklineStartLocalRC,
      frontNecklineCenterDivideLocalRC: r.debug.frontNecklineCenterDivideLocalRC,
    });

    expect(model.policy).toBe("shared-reset");
    expect(repl.rc_reset).toBe("↺ rc000");
    expect(beginRc).toBe(0);
    expect(repl["rc-neckline-start"]).toBe("rc000");
    expect(model.armholeDecreasePoints[0]?.row).toBe(2);
  });

  it("does not rebuild overlap armhole decreases with synthetic i * 2 when events exist", () => {
    const pattern = vNeckBeforeArmholePattern();
    const r = generateSleevelessBackPattern(pattern);
    const model = resolveFrontVNeckNotationRcModel(r);
    const armholeStart = r.debug.armholeStartRow!;
    const eachSide = r.debug.armholeStitchesEachSide!;
    const bindOffSts = Math.round(eachSide / 2);
    const decreaseSts = eachSide - bindOffSts;
    const canonical = pulloverArmholeEvents({
      firstArmholeGarmentRc: armholeStart,
      bindOffSts,
      decreaseSts,
    })
      .filter((ev) => ev.kind === "decrease" && ev.side === "right")
      .map((ev) => displayRcFromGarmentRc(ev.garmentRc, armholeStart, "continuous-garment-rc"));

    expect(model.armholeDecreasePoints.map((p) => p.row)).toEqual(canonical);
    expect(model.armholeDecreasePoints.map((p) => p.row)).not.toEqual(
      Array.from({ length: decreaseSts }, (_, i) => i * 2),
    );
  });
});

describe("sleeveless Visual Guides no longer duplicate Shaping Notation", () => {
  it("omits the notation card when the page asks for map-only guides", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: false,
      construction: "sleeveless",
      shapingMapData: SAMPLE_SHAPING_MAP_DATA,
    });
    expect(html).toContain("Visual Guides");
    expect(html).toContain("Shaping Map");
    expect(html).not.toContain("data-pattern-notation-host");
    expect(html).not.toContain("ns-visual-guides__card--notation");
    expect(html).toContain("ns-visual-guides__grid--single");
  });

  it("keeps the Sleeveless page on tabbed notation and map-only Visual Guides", () => {
    const pageScript = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    expect(pageScript).toContain("buildSleevelessPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("notationSupported: false");
    expect(pageScript).toContain("frontShapingMapData");
    expect(pageScript).toContain("backShapingMapData");
    expect(pageScript).toMatch(/visualGuides: frontShapingMapData/);
    expect(pageScript).toMatch(/visualGuides: backShapingMapData/);
  });
});
