import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateDropShoulderPattern } from "./dropShoulderPatternOutput";
import {
  buildDropShoulderBackMountHtml,
  buildDropShoulderBackVisualGuidesHtml,
  buildDropShoulderMountShapingMapData,
} from "./dropShoulderMountVisualGuides";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { buildSleevelessRoundNeckBackShapingMapData } from "./sleevelessRoundNeckBackShapingSchedule";

const DROP_SHOULDER_ROUND = {
  fit: {
    sizingChart: "women",
    selectedMeasurements: {
      finished_bust_chest: 40,
      back_neck_to_hem: 24,
      upper_arm: 16,
      wrist: 8,
      sleeve_length: 12,
      shoulder_width: 16,
      neck_opening: 7,
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
    patternMode: "custom-build",
  },
};

describe("drop shoulder mount Visual Guides (full generation ? mount HTML path)", () => {
  it("emits Back section HTML with Shaping Notation, Shaping Map card, and SVG", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);

    expect(result.isDropShoulder).toBe(true);
    expect(result.backNeckShoulderTimeline?.length).toBeGreaterThan(0);
    const first = result.backNeckShoulderTimeline![0]!;
    expect(
      first.events.some((e) => e.side === "center" && e.kind === "hold" && e.amount > 0),
    ).toBe(true);

    // Same helper renderDropShoulderMount uses (generatorPatternData, not diagram rebuild).
    const { backShapingMapData, frontShapingMapData } = buildDropShoulderMountShapingMapData(
      result,
      DROP_SHOULDER_ROUND,
      { isCardigan: false },
    );
    expect(backShapingMapData).not.toBeNull();
    expect(frontShapingMapData).not.toBeNull();
    // Back/front maps use the neckline reset origin (RC:000), not armhole-local RC.
    expect(backShapingMapData!.rowMin).toBe(0);
    expect(frontShapingMapData!.rowMin).toBe(0);
    expect(result.debug.backNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    expect(result.debug.frontNecklineStartRC).toBeGreaterThan(result.debug.armholeStartRow!);
    const frontArmholeLocal =
      result.debug.frontNecklineStartRC! - result.debug.armholeStartRow!;
    expect(frontArmholeLocal).toBeGreaterThan(0);
    expect(frontShapingMapData!.rowMin).not.toBe(frontArmholeLocal);

    const mountHtml = buildDropShoulderBackMountHtml(result, DROP_SHOULDER_ROUND, {
      notationSupported: true,
      isCardigan: false,
    });

    expect(mountHtml).toContain('id="sg-back"');
    expect(mountHtml).toContain("BACK");
    expect(mountHtml).toContain("Shaping Notation");
    expect(mountHtml).toContain("Shaping Map");
    expect(mountHtml).toContain("ns-visual-guides__card--map");
    expect(mountHtml).toContain("shaping-map__svg");
    expect(mountHtml).not.toContain("ns-visual-guides__grid--single");
  });

  it("does not null the back map when diagram rebuild data looks like V-neck", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    expect(result.backNeckShoulderTimeline?.length).toBeGreaterThan(0);

    // Reproduce the runtime divergence: generation used round gen input, but
    // buildSleevelessGarmentDiagramPatternData re-resolved a stale V-neck.
    const staleDiagramPatternData = {
      ...DROP_SHOULDER_ROUND,
      style: { ...DROP_SHOULDER_ROUND.style, neckline: "v-neck" },
    };

    expect(
      buildSleevelessRoundNeckBackShapingMapData(result.backNeckShoulderTimeline, {
        patternData: staleDiagramPatternData,
      }),
    ).toBeNull();

    const { backShapingMapData } = buildDropShoulderMountShapingMapData(
      result,
      DROP_SHOULDER_ROUND,
      { isCardigan: false },
    );
    expect(backShapingMapData).not.toBeNull();

    const guidesHtml = buildDropShoulderBackVisualGuidesHtml(result, DROP_SHOULDER_ROUND);
    expect(guidesHtml).toContain("ns-visual-guides__card--map");
    expect(guidesHtml).toContain("shaping-map__svg");
  });

  it("keeps the front map unchanged for the same mount helper", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const { frontShapingMapData } = buildDropShoulderMountShapingMapData(
      result,
      DROP_SHOULDER_ROUND,
      { isCardigan: false },
    );
    expect(frontShapingMapData).not.toBeNull();

    const frontHtml = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      construction: "drop-shoulder",
      shapingMapData: frontShapingMapData,
    });
    expect(frontHtml).toContain("ns-visual-guides__card--map");
    expect(frontHtml).toContain("shaping-map__svg");
  });

  it("still renders a back map when shoulders are straight (no shoulder shaping)", () => {
    const result = generateDropShoulderPattern(DROP_SHOULDER_ROUND);
    const { backShapingMapData } = buildDropShoulderMountShapingMapData(
      result,
      DROP_SHOULDER_ROUND,
    );
    expect(backShapingMapData).not.toBeNull();
    expect(backShapingMapData!.paths.some((p) => p.id === "neck")).toBe(true);

    const html = buildDropShoulderBackMountHtml(result, DROP_SHOULDER_ROUND);
    expect(html).toContain("ns-visual-guides__card--map");
  });

  it("passes armholeStartRow into the Front chart RC origin on the pattern page", () => {
    const page = readFileSync(resolve("src/scripts/sleevelessPatternPageShared.ts"), "utf8");
    const idx = page.indexOf("const frontActiveSideRcStart = dropShoulderFrontChartActiveSideRcStart");
    const snippet = page.slice(idx, idx + 400);
    expect(snippet).toContain("frontNecklineStartRC");
    expect(snippet).toContain("armholeStartRow");
  });
});
