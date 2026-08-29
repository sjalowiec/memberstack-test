import { describe, expect, it } from "vitest";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import { tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg } from "./dropShoulderSleevePatternDiagramSvg";
import { tryBuildLiveDropShoulderSleeveNotationSvg } from "./dropShoulderSleeveShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderBackNotationSvg } from "./dropShoulderBackShapingNotationDiagramSvg";
import { tryBuildLiveDropShoulderFrontNotationSvg } from "./dropShoulderFrontShapingNotationDiagramSvg";
import {
  buildDropShoulderSleeveJapaneseNotationReplacements,
  resolveDropShoulderSleeveBodyRowsForDiagram,
} from "./sleevelessGarmentDiagramReplacements";
import {
  dropShoulderSleeveShapingPlan,
  dropShoulderSleeveShapingVerb,
  formatDropShoulderSleeveShapingNotation,
} from "./dropShoulderSleeveShaping";

const TAPERED = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening_width: 7,
      back_neck_depth: 1,
      front_neck_depth: 4,
    },
  },
  yarnGaugeMachine: {
    gaugeStitchesPerInch: 5,
    gaugeRowsPerInch: 7,
    availableNeedles: 200,
  },
  style: {
    construction: "drop-shoulder",
    frontStyle: "closed",
    neckline: "round",
  },
};

function pathD(svg: string, className: string): string {
  const match = svg.match(new RegExp(`<path class="${className}" d="([^"]+)"`));
  return match?.[1] ?? "";
}

describe("generated Drop Shoulder sleeve Shaping Notation", () => {
  it("bottom-up uses the Stitches & Rows silhouette and the existing increase schedule", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const sts = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "cuff-up", "in")!;
    const live = tryBuildLiveDropShoulderSleeveNotationSvg(result, "cuff-up", "in")!;
    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result, "cuff-up");
    const bodyRows = resolveDropShoulderSleeveBodyRowsForDiagram(result.debug)!;
    const plan = dropShoulderSleeveShapingPlan({
      topSts: result.debug.dropShoulderSleeveTopStitches!,
      wristSts: result.debug.dropShoulderSleeveWristStitches!,
      sleeveBodyRows: bodyRows,
    });

    expect(pathD(live, "ds-sleeve-diagram__body")).toBe(pathD(sts, "ds-sleeve-diagram__body"));
    expect(live).toContain('data-ds-sleeve-generated-notation="true"');
    expect(live).toContain('data-sleeve-direction="cuff-up"');
    expect(live).toContain(`data-jp-caston="${repl["jp-caston"]}"`);
    expect(live).toContain(`data-jp-cuff="${repl["jp-cuff"]}"`);
    expect(live).toContain(`data-jp-sleeve="${repl["jp-sleeve"]}"`);
    expect(live).toContain(repl["jp-caston"]!);
    expect(live).toContain(repl["jp-cuff"]!);
    expect(live).toContain(repl["jp-sleeve"]!);
    expect(live).toContain(repl["jp-sleeve_cap_sts"]!);
    expect(repl["jp-sleeve"]).toBe(formatDropShoulderSleeveShapingNotation(plan.steps));
    expect(dropShoulderSleeveShapingVerb("cuff-up", result.debug.dropShoulderSleeveTopStitches!, result.debug.dropShoulderSleeveWristStitches!)).toBe(
      "increase",
    );
    expect(live).toContain('data-sleeve-shaping-direction="increase"');
    expect(live).toContain('width="100%"');
    expect(live).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(live).not.toMatch(/\bNaN\b/);
  });

  it("top-down uses the same schedule as decrease from upper arm toward the wrist", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const sts = tryBuildLiveDropShoulderSleeveStsRowsDiagramSvg(result, "top-down", "in")!;
    const live = tryBuildLiveDropShoulderSleeveNotationSvg(result, "top-down", "in")!;
    const repl = buildDropShoulderSleeveJapaneseNotationReplacements(result, "top-down");
    const topSts = result.debug.dropShoulderSleeveTopStitches!;
    const wristSts = result.debug.dropShoulderSleeveWristStitches!;

    expect(pathD(live, "ds-sleeve-diagram__body")).toBe(pathD(sts, "ds-sleeve-diagram__body"));
    expect(live).toContain('data-sleeve-direction="top-down"');
    expect(repl["jp-caston"]).toContain(String(Math.round(topSts)));
    expect(repl["jp-sleeve_cap_sts"]).toContain(String(Math.round(wristSts)));
    expect(live).toContain(repl["jp-caston"]!);
    expect(live).toContain(repl["jp-sleeve"]!);
    expect(live).toContain(repl["jp-sleeve_cap_sts"]!);
    expect(dropShoulderSleeveShapingVerb("top-down", topSts, wristSts)).toBe("decrease");
    expect(live).toContain('data-sleeve-shaping-direction="decrease"');
  });

  it("returns null for Sleeveless and missing debug so Illustrator can hydrate", () => {
    expect(
      tryBuildLiveDropShoulderSleeveNotationSvg(
        { debug: {} as never, isDropShoulder: true },
        "cuff-up",
      ),
    ).toBeNull();
    expect(
      tryBuildLiveDropShoulderSleeveNotationSvg(
        { debug: {} as never, isDropShoulder: false },
        "cuff-up",
      ),
    ).toBeNull();
  });

  it("does not change Front or Back Shaping Notation", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const back = tryBuildLiveDropShoulderBackNotationSvg(result, TAPERED);
    const front = tryBuildLiveDropShoulderFrontNotationSvg(result, TAPERED);
    expect(back).toContain('data-ds-back-generated-notation="true"');
    expect(front).toContain('data-ds-front-generated-notation="true"');
    expect(back).not.toContain("data-ds-sleeve-generated-notation");
    expect(front).not.toContain("data-ds-sleeve-generated-notation");
  });
});
