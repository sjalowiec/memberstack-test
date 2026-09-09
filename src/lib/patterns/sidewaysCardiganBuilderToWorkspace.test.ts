import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import { loadSidewaysCardiganWorkspaceView } from "./sidewaysCardiganWorkspaceLoad";
import { readSidewaysCardiganBuilderStateFromDraft } from "./sidewaysCardiganBuilderState";
import { SIDEWAYS_CARDIGAN_CONSTRUCTION } from "./sidewaysCardiganConstructionIdentity";
import { SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF } from "./customPatternProjectNavigation";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";
import type { SidewaysCardiganBuilderValues } from "./syncSidewaysCardiganBuilderToPatternStorage";

const missesRow: SidewaysCardiganWomenChartRow = {
  size: 8,
  bust_or_chest: 42,
  garment_back_length: 25,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12.5,
  wrist: 6.5,
  sleeve_length: 17,
  chartAudience: "misses",
};

const plusRow: SidewaysCardiganWomenChartRow = {
  size: "X",
  bust_or_chest: 39,
  garment_back_length: 16.75,
  neck_opening: 7,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 13,
  wrist: 7,
  sleeve_length: 17,
  chartAudience: "plus",
};

const missesValues: SidewaysCardiganBuilderValues = {
  selectedSize: "8",
  chartAudience: "misses",
  fit: "standard",
  styleMeasurements: {
    finishedLength: "25",
    vNeckDepth: "8",
    neckOpeningWidth: "7.5",
    finishedUpperArm: "14.5",
    sleeveLength: "17",
    wrist: "7.25",
  },
  gaugeStitchRaw: "20",
  gaugeRowRaw: "28",
  availableNeedles: "200",
  unit: "in",
  sleeveDirection: "cuff-up",
};

const plusValues: SidewaysCardiganBuilderValues = {
  selectedSize: "X",
  chartAudience: "plus",
  fit: "standard",
  styleMeasurements: {
    finishedLength: "22",
    vNeckDepth: "8",
    neckOpeningWidth: "7",
    finishedUpperArm: "15",
    sleeveLength: "17",
    wrist: "8",
  },
  gaugeStitchRaw: "20",
  gaugeRowRaw: "28",
  availableNeedles: "200",
  unit: "in",
  sleeveDirection: "sideways",
};

/** Same persist used by the Create Pattern button. */
function saveFromCreatePattern(
  values: SidewaysCardiganBuilderValues,
  row: SidewaysCardiganWomenChartRow,
): void {
  syncSidewaysCardiganBuilderToPatternStorage(values, row);
}

describe("sideways cardigan builder-to-workspace round-trip", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("saves through Create Pattern and loads summary + Body sequence through the workspace loader", () => {
    expect(SIDEWAYS_CARDIGAN_PATTERN_WORKSPACE_GENERATED_HREF).toBe(
      "/patterns/sideways-cardigan/pattern/?generated=1",
    );
    saveFromCreatePattern(missesValues, missesRow);

    expect(getCurrentPattern().style.construction).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(getCurrentPattern().style.constructionAuthored).toBe(SIDEWAYS_CARDIGAN_CONSTRUCTION);
    expect(getPatternData().style).toMatchObject({
      construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      constructionAuthored: SIDEWAYS_CARDIGAN_CONSTRUCTION,
    });

    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.summary.rows.length).toBeGreaterThan(0);
    expect(view.summaryHtml).toContain("Garment length");
    expect(view.instructions).not.toBeNull();
    expect(view.instructions?.steps).toHaveLength(13);
    expect(view.sequenceHtml).toContain("sideways-body-sequence");
    expect(view.sequenceHtml).toContain("Cast on");
    expect(view.input.vNeckDepthInches).toBe(8);
    expect(view.pattern.style).toMatchObject({
      construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      recipientCategory: "misses",
      sleeveDirection: "cuff-up",
    });
  });

  it("round-trips a Women’s (plus) pattern", () => {
    saveFromCreatePattern(plusValues, plusRow);
    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.pattern.style).toMatchObject({
      recipientCategory: "plus",
      sleeveDirection: "sideways",
    });
    expect(view.input.finishedUpperArmInches).toBe(15);
    expect(view.summary.rows.find((row) => row.term === "Sleeve direction")?.def).toBe("Sideways");
    expect(view.instructions?.steps).toHaveLength(13);
  });

  it("keeps user measurement overrides on the workspace", () => {
    saveFromCreatePattern(
      {
        ...missesValues,
        styleMeasurements: {
          finishedLength: "23.5",
          vNeckDepth: "9",
          neckOpeningWidth: "8",
          finishedUpperArm: "16",
          sleeveLength: "18",
          wrist: "7",
        },
        sleeveDirection: "top-down",
      },
      missesRow,
    );
    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.input.garmentLengthInches).toBe(23.5);
    expect(view.input.vNeckDepthInches).toBe(9);
    expect(view.input.neckOpeningWidthInches).toBe(8);
    expect(view.input.finishedUpperArmInches).toBe(16);
    expect(view.pattern.style).toMatchObject({ sleeveDirection: "top-down" });
  });

  it("persists sleeve direction for workspace refresh", () => {
    saveFromCreatePattern({ ...missesValues, sleeveDirection: "top-down" }, missesRow);
    const first = loadSidewaysCardiganWorkspaceView();
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.message);
    expect(first.pattern.style).toMatchObject({ sleeveDirection: "top-down" });

    const refreshed = loadSidewaysCardiganWorkspaceView();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw new Error(refreshed.message);
    expect(refreshed.input).toEqual(first.input);
    expect(refreshed.instructions?.steps).toEqual(first.instructions?.steps);
    expect(refreshed.summary).toEqual(first.summary);
    expect(getCurrentPattern().style.sleeveDirection).toBe("top-down");
  });

  it("restores builder edit state after Create Pattern", () => {
    saveFromCreatePattern(
      {
        ...plusValues,
        styleMeasurements: {
          ...plusValues.styleMeasurements!,
          vNeckDepth: "9.5",
        },
        sleeveDirection: "sideways",
      },
      plusRow,
    );
    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.chartAudience).toBe("plus");
    expect(restored.selectedSize).toBe("X");
    expect(restored.fit).toBe("standard");
    expect(restored.sleeveDirection).toBe("sideways");
    expect(restored.garmentStyle).toBe("cardigan");
    expect(restored.styleMeasurements.vNeckDepth).toBe("9.5");
    expect(restored.styleMeasurements.finishedLength).toBe("22");
    expect(restored.styleMeasurements.finishedUpperArm).toBe("15");
    expect(restored.gaugeStitchRaw).toBe("20");
    expect(restored.gaugeRowRaw).toBe("28");
    expect(restored.availableNeedles).toBe("200");
  });

  it("defaults existing drafts without a garment-style choice to cardigan", () => {
    saveFromCreatePattern(missesValues, missesRow);
    expect(getCurrentPattern().style.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style.frontStyle).toBe("open");
    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.instructions?.garmentStyle).toBe("cardigan");
    expect(view.summary.rows.find((row) => row.term === "Garment style")?.def).toBe("Cardigan");
    expect(view.sequenceHtml).toMatch(/starts at center front/i);
    expect(view.sequenceHtml).toMatch(/two knitted armhole slits/i);
    expect(view.instructions?.steps.filter((s) => /armhole-slit/.test(s.id))).toHaveLength(2);
  });

  it("round-trips pullover through Create Pattern, workspace, and builder restore", () => {
    saveFromCreatePattern({ ...missesValues, garmentStyle: "pullover" }, missesRow);
    expect(getCurrentPattern().style.garmentStyle).toBe("pullover");
    expect(getCurrentPattern().style.frontStyle).toBe("closed");
    expect(getPatternData().style?.garmentStyle).toBe("pullover");

    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.instructions?.garmentStyle).toBe("pullover");
    expect(view.pattern.style).toMatchObject({
      construction: SIDEWAYS_CARDIGAN_CONSTRUCTION,
      garmentStyle: "pullover",
      frontStyle: "closed",
    });
    expect(view.summary.rows.find((row) => row.term === "Garment style")?.def).toBe("Pullover");
    expect(view.instructions?.steps[0]?.id).toBe("cast-on-side-seam");
    expect(view.instructions?.steps.at(-1)?.id).toBe("bind-off-side-seam");
    expect(view.instructions?.steps.filter((s) => /armhole-slit/.test(s.id))).toHaveLength(1);
    expect(view.sequenceHtml).toMatch(/starts at a side seam/i);
    expect(view.sequenceHtml).toMatch(/one knitted armhole slit/i);
    expect(view.sequenceHtml).toMatch(/leaving the calculated armhole depth open/i);
    expect(view.sequenceHtml).not.toMatch(/graft/i);

    const restored = readSidewaysCardiganBuilderStateFromDraft();
    expect(restored.garmentStyle).toBe("pullover");

    const refreshed = loadSidewaysCardiganWorkspaceView();
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) throw new Error(refreshed.message);
    expect(refreshed.instructions?.garmentStyle).toBe("pullover");
    expect(refreshed.instructions?.steps).toEqual(view.instructions?.steps);
  });

  it("reports a diagnostic when stored data is incomplete", () => {
    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(false);
    if (view.ok) throw new Error("expected incomplete draft");
    expect(view.reason).toBe("missing-construction");
    expect(view.diagnostic).toMatch(/\[DEV\]/);
    expect(view.message).toMatch(/Sideways V-Neck Sweater/i);
  });
});

describe("sideways V-Neck Sweater customer-facing copy", () => {
  it("uses the display name on the builder and workspace pages", () => {
    const builder = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/builder.astro"),
      "utf8",
    );
    const workspace = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    expect(builder).toContain("Sideways V-Neck Sweater");
    expect(workspace).toContain("Sideways V-Neck Sweater");
    expect(builder).toContain(
      "A V-neck sweater knitted sideways in one piece, with drop-shoulder armholes and a",
    );
    expect(workspace).toContain(
      "A V-neck sweater knitted sideways in one piece, with drop-shoulder armholes and a",
    );
    expect(builder).not.toContain("Sideways Cardigan");
    expect(workspace).not.toContain("Sideways Cardigan");
    expect(builder).not.toContain("V-neck cardigan");
    expect(workspace).not.toContain("V-neck cardigan");
    expect(builder).toContain('data-express-construction="sideways-cardigan"');
    expect(workspace).toContain('data-express-construction="sideways-cardigan"');
    expect(builder).toContain('data-field="garmentStyle"');
    expect(builder).toContain("Cardigan");
    expect(builder).toContain("Pullover");
  });
});

describe("sideways cardigan workspace is not print-only", () => {
  it("does not put the calc host in the print-only at-a-glance class", () => {
    const page = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
      "utf8",
    );
    expect(page).toContain("data-sideways-calc-host");
    expect(page).toContain("data-sideways-body-sequence");
    expect(page).toContain('import "/src/scripts/sideways-cardigan-pattern-page.ts"');
    expect(page).not.toMatch(/class="[^"]*sg-pattern-print-at-a-glance[^"]*"/);
    const shared = readFileSync(resolve("src/styles/patterns/sleeveless-pattern-shared.css"), "utf8");
    expect(shared).toContain(".sleeveless-pattern-page .sg-pattern-print-at-a-glance");
    expect(shared).toContain("display: none !important");
  });
});
