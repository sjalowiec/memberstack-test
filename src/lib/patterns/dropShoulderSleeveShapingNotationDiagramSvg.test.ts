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
import { formatBodyRowsNotation, formatCastOnNotation } from "./sleevelessBackJapaneseNotation";
import { formatShapingSegment } from "./shapingNotationCompress";

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
    expect(repl["jp-sleeve"]).toBe(
      formatShapingSegment(plan.steps[0]!.sts, plan.steps[0]!.rows, plan.steps[0]!.times),
    );
    expect(repl["jp-caston"]).toBe(
      `${formatCastOnNotation(result.debug.dropShoulderSleeveWristStitches!)} sts`,
    );
    expect(repl["jp-cuff"]).toBe(formatBodyRowsNotation(result.debug.dropShoulderSleeveCuffRows!));
    expect(repl["jp-cuff"]).toMatch(/^\d+r$/);
    expect(repl["jp-cuff"]).not.toMatch(/r rows/);
    expect(live).not.toContain("r rows");
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
    expect(repl["jp-caston"]).toBe(`${formatCastOnNotation(topSts)} sts`);
    expect(repl["jp-cuff"]).toBe(formatBodyRowsNotation(result.debug.dropShoulderSleeveCuffRows!));
    expect(repl["jp-cuff"]).toMatch(/^\d+r$/);
    expect(repl["jp-cuff"]).not.toMatch(/r rows/);
    expect(live).not.toContain("r rows");
    expect(repl["jp-sleeve"]).toMatch(/^\d+s-\d+r-\d+x$/);
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

  it("places cuff-up cast-on at the wrist and top-down cast-on at the upper arm", () => {
    const result = generateDropShoulderPattern(TAPERED);
    const cuffUp = tryBuildLiveDropShoulderSleeveNotationSvg(result, "cuff-up", "in")!;
    const topDown = tryBuildLiveDropShoulderSleeveNotationSvg(result, "top-down", "in")!;

    const cuffUpCastOnY = Number(/data-role="cast-on"[^>]* y="([^"]+)"/.exec(cuffUp)?.[1]);
    const cuffUpCuffY = Number(/data-role="cuff"[^>]* y="([^"]+)"/.exec(cuffUp)?.[1]);
    const cuffUpCapY = Number(/data-role="sleeve-cap-sts"[^>]* y="([^"]+)"/.exec(cuffUp)?.[1]);
    const cuffUpShapingX = Number(/data-role="sleeve-shaping"[^>]* x="([^"]+)"/.exec(cuffUp)?.[1]);
    expect(cuffUpCapY).toBeLessThan(cuffUpCuffY);
    expect(cuffUpCuffY).toBeLessThan(cuffUpCastOnY);
    expect(cuffUpCuffY - cuffUpCapY).toBeGreaterThan(cuffUpCastOnY - cuffUpCuffY);
    expect(cuffUpShapingX).toBeGreaterThan(215);

    const topDownCastOnY = Number(/data-role="cast-on"[^>]* y="([^"]+)"/.exec(topDown)?.[1]);
    const topDownCuffY = Number(/data-role="cuff"[^>]* y="([^"]+)"/.exec(topDown)?.[1]);
    const topDownCapY = Number(/data-role="sleeve-cap-sts"[^>]* y="([^"]+)"/.exec(topDown)?.[1]);
    expect(topDownCapY).toBeLessThan(topDownCuffY);
    expect(topDownCuffY).toBeLessThan(topDownCastOnY);
    expect(topDownCastOnY - topDownCuffY).toBeGreaterThan(topDownCuffY - topDownCapY);
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
