import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  JP_BACK_NOTATION_SVG_TOKEN_KEYS,
  armholeBindOffDecreaseFromEachSide,
  buildBackJapaneseNotationReplacements,
  formatBindOffNotation,
  formatCastOnNotation,
  formatRcNotation,
  formatRcResetNotation,
  formatShapingSegment,
  garmentRcAtArmholeStart,
  isBackJapaneseNotationSupported,
} from "./sleevelessBackJapaneseNotation";
import {
  assertJapaneseNotationSvgFullyReplaced,
  listJapaneseNotationPlaceholdersInSvg,
} from "./sleevelessJapaneseNotationSvg";
import { demoSleevelessBackPattern, generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const JP_BACK_SVG = readFileSync(
  resolve(process.cwd(), "public/images/patterns/sleeveless/diagrams/diagram-jp-back.svg"),
  "utf8",
);

describe("sleevelessBackJapaneseNotation formatters", () => {
  it("formats cast-on, bind-off, and shaping segments", () => {
    expect(formatCastOnNotation(128)).toBe("co128");
    expect(formatBindOffNotation(10)).toBe("bo10");
    expect(formatShapingSegment(1, 2, 10)).toBe("1s-2r-10x");
  });

  it("splits armhole stitches per side like armhole shaping block", () => {
    expect(armholeBindOffDecreaseFromEachSide(21)).toEqual({ bindOffSts: 11, decreaseSts: 10 });
  });

  it("jp-armhole-bo uses per-edge bind-off count, not doubled across edges or rows", () => {
    const { bindOffSts } = armholeBindOffDecreaseFromEachSide(20);
    expect(bindOffSts).toBe(10);
    expect(formatBindOffNotation(bindOffSts)).toBe("bo10");
  });
});

describe("buildBackJapaneseNotationReplacements", () => {
  it("covers every jp/rc placeholder token in diagram-jp-back.svg", () => {
    const svgTokens = listJapaneseNotationPlaceholdersInSvg(JP_BACK_SVG);
    expect(svgTokens).toEqual([...JP_BACK_NOTATION_SVG_TOKEN_KEYS].sort());
    const result = demoSleevelessBackPattern();
    const repl = buildBackJapaneseNotationReplacements(result, {});
    expect(() => assertJapaneseNotationSvgFullyReplaced(JP_BACK_SVG, repl)).not.toThrow();
  });

  it("builds live tokens from demo back pullover round neck", () => {
    const result = demoSleevelessBackPattern();
    expect(isBackJapaneseNotationSupported({}, result)).toBe(true);

    const repl = buildBackJapaneseNotationReplacements(result, {});
    const castOn = result.debug.hemCastOnStitches ?? result.debug.backStitches;

    expect(repl["jp-caston"]).toBe(formatCastOnNotation(castOn));
    expect(repl["jp-body-rows"]).toBe(`${result.debug.bodyRows}r`);
    expect(repl["jp-caston"].length).toBeGreaterThan(2);
    expect(repl["jp-body-rows"]).toMatch(/^\d+r$/);

    const eachSide = result.debug.armholeStitchesEachSide ?? 0;
    const { bindOffSts, decreaseSts } = armholeBindOffDecreaseFromEachSide(eachSide);
    expect(repl["jp-armhole-bo"]).toBe(formatBindOffNotation(bindOffSts));
    if (decreaseSts > 0) {
      expect(repl["jp-armhole-shaping"]).toBe(`1s-2r-${decreaseSts}x`);
    }

    const center = result.debug.centerNeckBindOffStitches;
    if (center != null && center > 0) {
      expect(repl["jp-neckline-bo"]).toBe(formatBindOffNotation(center));
    }

    expect(Object.keys(repl).sort()).toEqual([...JP_BACK_NOTATION_SVG_TOKEN_KEYS].sort());
    expect(repl["rc-caston"]).toBe(formatRcNotation(0));
    expect(repl["rc-hem"]).toBe(formatRcNotation(result.debug.hemRows));
    const armholeStartRc = garmentRcAtArmholeStart(result.debug);
    expect(armholeStartRc).toBe(result.debug.rowsFromCastOnToArmholeStart);
    expect(repl["rc-armhole-bo"]).toBe(formatRcNotation(armholeStartRc!));
    expect(repl["rc-armhole-bo"]).not.toBe(formatRcNotation(0));
    expect(repl.rc_reset).toBe(formatRcResetNotation(0));
    expect(repl.rc_reset).toContain("↺");
    if (result.debug.backNecklineStartLocalRC !== undefined) {
      expect(repl["rc-neckline-start"]).toBe(formatRcNotation(result.debug.backNecklineStartLocalRC));
    }
  });

  it("returns empty tokens for cardigan", () => {
    const result = generateSleevelessBackPattern({
      fit: {
        sizingChart: "misses",
        selectedMeasurements: {
          finished_bust_chest: 40,
          back_neck_to_hem: 22,
          armhole_depth: 8,
          neck_opening: 3,
          shoulder_width: 4.25,
        },
      },
      style: { garmentStyle: "cardigan", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    expect(isBackJapaneseNotationSupported({ style: { garmentStyle: "cardigan" } }, result)).toBe(false);
    const repl = buildBackJapaneseNotationReplacements(result, { style: { garmentStyle: "cardigan" } });
    expect(repl["jp-caston"]).toBe("");
  });

  it("returns empty tokens for V-neck pullover", () => {
    const result = generateSleevelessBackPattern({
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
      style: { neckline: "v-neck", recipientCategory: "misses" },
      yarnGaugeMachine: { gaugeStitchesPerInch: 5, gaugeRowsPerInch: 7, availableNeedles: 200 },
    });
    expect(isBackJapaneseNotationSupported({ style: { neckline: "v-neck" } }, result)).toBe(false);
  });
});
