import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { stubLocalStorage } from "./test/stubLocalStorage";
import { getCurrentPattern, getPatternData } from "./patternStorage";
import { syncSidewaysCardiganBuilderToPatternStorage } from "./syncSidewaysCardiganBuilderToPatternStorage";
import { loadSidewaysCardiganWorkspaceView } from "./sidewaysCardiganWorkspaceLoad";
import { readSidewaysCardiganBuilderStateFromDraft } from "./sidewaysCardiganBuilderState";
import {
  applySidewaysCardiganSummaryMeasurementEdits,
  applySidewaysCardiganSummaryQuickEdits,
  buildSidewaysCardiganSummaryDiagramInput,
  displaySidewaysCardiganSummaryMeasurements,
  readSidewaysCardiganSummaryMeasurements,
  SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS,
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS,
  SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS,
  SIDEWAYS_CARDIGAN_SUMMARY_SLEEVE_FIELDS,
} from "./sidewaysCardiganSummaryEdit";
import {
  buildSidewaysCardiganEditMeasurementDiagramSvg,
  derivedSidewaysSummaryInches,
  SIDEWAYS_SUMMARY_DERIVED_ROLES,
  SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS,
} from "./sidewaysCardiganEditMeasurementDiagramSvg";
import {
  SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF,
  SIDEWAYS_CARDIGAN_OPEN_PATTERN_EDIT_WORKSPACE_HREF,
} from "./customPatternProjectNavigation";
import {
  SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF,
  SIDEWAYS_CARDIGAN_SUMMARY_PRIMARY_LABEL,
  SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_BUILDER_LABEL,
  resolveSidewaysCardiganSummaryEntryPath,
  sidewaysCardiganSummaryCancelHref,
  sidewaysCardiganSummaryCancelLabel,
} from "./sidewaysCardiganPatternNavigation";
import { CUSTOM_BUILD_STYLE_STORAGE_KEYS } from "./sleevelessCustomBuildStyleKeys";
import type { SidewaysCardiganWomenChartRow } from "./sidewaysCardiganSizeCharts";
import type { SidewaysCardiganBuilderValues } from "./syncSidewaysCardiganBuilderToPatternStorage";
import {
  resetExpressSweaterChartsForTests,
  seedExpressSweaterChartsForTests,
} from "./sleevelessExpressSizeChartClient";

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

const cardiganValues: SidewaysCardiganBuilderValues = {
  selectedSize: "8",
  chartAudience: "misses",
  fit: "standard",
  garmentStyle: "cardigan",
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
  sleeveLengthChoice: "long",
};

const pulloverValues: SidewaysCardiganBuilderValues = {
  ...cardiganValues,
  garmentStyle: "pullover",
};

const builderAstro = readFileSync(
  resolve("src/pages/patterns/sideways-cardigan/builder.astro"),
  "utf8",
);
const builderScript = readFileSync(
  resolve("src/scripts/sideways-cardigan-builder-page.ts"),
  "utf8",
);
const summaryPage = readFileSync(
  resolve("src/pages/patterns/sideways-cardigan/summary/index.astro"),
  "utf8",
);
const summaryScript = readFileSync(
  resolve("src/scripts/sideways-cardigan-summary-page.ts"),
  "utf8",
);
const patternPage = readFileSync(
  resolve("src/pages/patterns/sideways-cardigan/pattern/index.astro"),
  "utf8",
);

function saveBuild(values: SidewaysCardiganBuilderValues): void {
  syncSidewaysCardiganBuilderToPatternStorage(values, missesRow);
}

function diagramFor(
  values: SidewaysCardiganBuilderValues,
  edits: Parameters<typeof applySidewaysCardiganSummaryMeasurementEdits>[0] = {},
): string {
  saveBuild(values);
  if (Object.keys(edits).length > 0) {
    const result = applySidewaysCardiganSummaryMeasurementEdits(edits);
    expect(result.ok).toBe(true);
  }
  const measurements = readSidewaysCardiganSummaryMeasurements();
  const style = readSidewaysCardiganBuilderStateFromDraft().garmentStyle;
  const input = buildSidewaysCardiganSummaryDiagramInput(measurements, style, "in");
  expect(input).not.toBeNull();
  return buildSidewaysCardiganEditMeasurementDiagramSvg(input!);
}

describe("Sideways Summary/Edit first-time routing", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("opens Summary/Edit after a new Cardigan build, not knitting instructions", () => {
    expect(SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF).toBe(
      "/patterns/sideways-cardigan/summary/?generated=1",
    );
    expect(builderAstro).toContain(SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF);
    expect(builderScript).toContain("SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF");
    expect(builderAstro).not.toContain(
      'data-express-review-href="/patterns/sideways-cardigan/pattern/?generated=1"',
    );
    expect(builderScript).toContain("completeBuilderAndOpenSummary");
    expect(builderAstro).not.toContain("data-sideways-review-panel");
    expect(builderAstro).not.toContain("Create Pattern");
    expect(builderAstro).not.toContain('id="sideways-create-pattern"');
    expect(resolveSidewaysCardiganSummaryEntryPath("?generated=1")).toBe("from-builder");
    saveBuild(cardiganValues);
    expect(getCurrentPattern().style.garmentStyle).toBe("cardigan");
    expect(summaryPage).toContain("data-testid=\"sideways-summary-edit-page\"");
    expect(summaryPage).toContain("PatternSummaryEditWorkspace");
    expect(summaryPage).toContain("PatternSummaryMeasurementChip");
  });

  it("imports Summary/Edit helpers so the page can unhide the workspace after a build", () => {
    expect(summaryScript).toContain('from "../lib/patterns/sidewaysCardiganSummaryEdit"');
    expect(summaryScript).toContain("readSidewaysCardiganSummaryMeasurements");
    expect(summaryScript).toContain("emptySidewaysCardiganSummaryMeasurements");
    expect(summaryScript).toContain("SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS");
    expect(summaryScript).toContain("applySidewaysCardiganSummaryQuickEdits");
    expect(summaryScript).toContain("applySidewaysCardiganSummaryMeasurementEdits");
    expect(summaryScript).toContain("buildSidewaysCardiganSummaryDiagramInput");
    expect(summaryScript).toContain("refreshAutoPatternProjectTitle");
    expect(summaryScript).toContain("stampSidewaysSummaryMeasureShell");
  });

  it("opens Summary/Edit after a new Pullover build, not knitting instructions", () => {
    saveBuild(pulloverValues);
    expect(getCurrentPattern().style.garmentStyle).toBe("pullover");
    expect(builderScript).toContain("SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF");
    expect(summaryPage).toContain(SIDEWAYS_CARDIGAN_SUMMARY_PRIMARY_LABEL);
    expect(patternPage).not.toContain("PatternSummaryEditWorkspace");
  });

  it("does not show the legacy text-only review screen and keeps Cancel on Summary/Edit", () => {
    expect(builderScript).toContain("completeBuilderAndOpenSummary()");
    expect(builderScript).toContain("window.location.assign(SIDEWAYS_CARDIGAN_SUMMARY_EDIT_FROM_BUILDER_HREF)");
    expect(builderScript).not.toContain("showingReview");
    expect(builderAstro).not.toContain("data-sideways-review-summary");
    expect(sidewaysCardiganSummaryCancelLabel("from-builder")).toBe(
      SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_BUILDER_LABEL,
    );
    expect(SIDEWAYS_CARDIGAN_SUMMARY_CANCEL_FROM_BUILDER_LABEL).toBe("Cancel");
    expect(SIDEWAYS_CARDIGAN_SUMMARY_PRIMARY_LABEL).toBe("Save Changes");
    expect(sidewaysCardiganSummaryCancelHref("from-builder")).toBe(
      "/patterns/sideways-cardigan/builder",
    );
    expect(summaryScript).toContain("sidewaysCardiganSummaryCancelHref");
    expect(summaryPage).toContain("Garment style");
    expect(summaryPage).toContain("Starting size");
    const reviewAstro = readFileSync(
      resolve("src/pages/patterns/sideways-cardigan/review.astro"),
      "utf8",
    );
    expect(reviewAstro).toContain("SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF");
    expect(reviewAstro).toContain("buildPatternReviewLegacyRedirect");
    expect(reviewAstro).not.toContain("data-sideways-review-panel");
  });
});

describe("Sideways Summary/Edit Cardigan vs Pullover diagrams", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("renders different appropriate body diagrams for Cardigan and Pullover", () => {
    const cardigan = diagramFor(cardiganValues);
    const pullover = diagramFor(pulloverValues);
    expect(cardigan).toContain('data-sideways-edit-diagram="cardigan"');
    expect(cardigan).toContain('data-sideways-start="center-front"');
    expect(cardigan).toContain('data-role="center-front-start"');
    expect(cardigan).toContain('data-role="v-neck"');
    expect(pullover).toContain('data-sideways-edit-diagram="pullover"');
    expect(pullover).toContain('data-sideways-start="underarm"');
    expect(pullover).not.toBe(cardigan);
    expect(cardigan).toContain('data-cardigan-structure="front-back-front"');
    expect(cardigan).toContain('data-role="first-front"');
    expect(cardigan).toContain('data-role="back-panel"');
    expect(cardigan).toContain('data-role="second-front"');
    expect(cardigan).not.toContain('data-role="sleeve-outline"');
    expect(pullover).toContain('data-role="sleeve-outline"');
    expect(pullover).toContain('data-cardigan-structure="underarm-graft"');
    expect(cardigan).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
    expect(pullover).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth}"`);
  });

  it("does not make the Pullover diagram start at center front", () => {
    const pullover = diagramFor(pulloverValues);
    expect(pullover).toContain('data-role="underarm-start"');
    expect(pullover).toContain('data-scrap-on="true"');
    expect(pullover).toContain('data-role="graft-join"');
    expect(pullover).toContain("Start at underarm");
    expect(pullover).not.toContain('data-role="center-front-start"');
    expect(pullover).not.toContain('data-sideways-start="center-front"');
    expect(pullover).toContain('data-closed-front="true"');
  });
});

describe("Sideways Summary/Edit live measurement edits", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("editing V-neck depth redraws the SVG and updates the pattern math", () => {
    saveBuild(cardiganValues);
    const beforeSvg = diagramFor(cardiganValues);
    const beforeView = loadSidewaysCardiganWorkspaceView();
    expect(beforeView.ok).toBe(true);
    if (!beforeView.ok) throw new Error(beforeView.message);
    expect(beforeView.input.vNeckDepthInches).toBe(8);

    const result = applySidewaysCardiganSummaryMeasurementEdits({ vNeckDepth: "9.5" });
    expect(result.ok).toBe(true);
    const afterView = loadSidewaysCardiganWorkspaceView();
    expect(afterView.ok).toBe(true);
    if (!afterView.ok) throw new Error(afterView.message);
    expect(afterView.input.vNeckDepthInches).toBe(9.5);
    expect(afterView.calc.vNeckDepthStitches).not.toBe(beforeView.calc.vNeckDepthStitches);

    const afterMeasurements = readSidewaysCardiganSummaryMeasurements();
    const afterInput = buildSidewaysCardiganSummaryDiagramInput(
      afterMeasurements,
      "cardigan",
      "in",
    );
    const afterSvg = buildSidewaysCardiganEditMeasurementDiagramSvg(afterInput!);
    expect(afterSvg).not.toBe(beforeSvg);
    expect(summaryScript).toContain("mountDiagram");
    expect(summaryScript).toContain("buildSidewaysCardiganEditMeasurementDiagramSvg");
    expect(summaryScript).toContain('input.addEventListener("input"');
  });

  it("editing upper arm updates the derived armhole depth without a separate override", () => {
    saveBuild(cardiganValues);
    const before = derivedSidewaysSummaryInches({
      finishedBustInches: 42,
      finishedLengthInches: 25,
      neckOpeningWidthInches: 7.5,
      vNeckDepthInches: 8,
      finishedUpperArmInches: 14.5,
      sleeveLengthInches: 17,
      wristInches: 7.25,
    });
    expect(before.armholeDepthInches).toBe(7.25);

    const result = applySidewaysCardiganSummaryMeasurementEdits({ finishedUpperArm: "16" });
    expect(result.ok).toBe(true);
    const afterView = loadSidewaysCardiganWorkspaceView();
    expect(afterView.ok).toBe(true);
    if (!afterView.ok) throw new Error(afterView.message);
    expect(afterView.input.finishedUpperArmInches).toBe(16);
    expect(afterView.calc.armholeDepthInches).toBe(8);
    expect(getCurrentPattern().fit?.cbMeasurementOverrides).not.toHaveProperty("armholeDepth");

    const svg = diagramFor(cardiganValues, { finishedUpperArm: "16" });
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.armholeDepth}"`);
    expect(svg).toContain("Armhole depth");
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.shoulderSection}"`);
    expect(svg).toContain(`data-role="${SIDEWAYS_SUMMARY_DERIVED_ROLES.halfNeckOpening}"`);
    expect(SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_OVERRIDE_KEYS).not.toHaveProperty("armholeDepth");
    expect(SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS.some((f) => f.id === "armholeDepth" && f.editable === false)).toBe(
      true,
    );
    expect(SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS.map((f) => f.id)).not.toContain("sleeveLength");
    expect(SIDEWAYS_CARDIGAN_SUMMARY_BODY_FIELDS.map((f) => f.id)).not.toContain("wrist");
    expect(SIDEWAYS_CARDIGAN_SUMMARY_SLEEVE_FIELDS.map((f) => f.id)).toEqual([
      "finishedUpperArm",
      "sleeveLength",
      "wrist",
    ]);
  });

  it("changing one measurement does not reset the other overrides", () => {
    saveBuild(cardiganValues);
    const first = applySidewaysCardiganSummaryMeasurementEdits({
      finishedLength: "23.5",
      vNeckDepth: "9",
      wrist: "8",
    });
    expect(first.ok).toBe(true);
    const second = applySidewaysCardiganSummaryMeasurementEdits({ neckOpeningWidth: "8" });
    expect(second.ok).toBe(true);
    const measurements = readSidewaysCardiganSummaryMeasurements();
    expect(measurements.finishedLength).toBe("23.5");
    expect(measurements.vNeckDepth).toBe("9");
    expect(measurements.wrist).toBe("8");
    expect(measurements.neckOpeningWidth).toBe("8");
    expect(measurements.finishedUpperArm).toBe("14.5");
    const overrides = getCurrentPattern().fit?.cbMeasurementOverrides as Record<string, string>;
    expect(overrides.finishedLength).toBe("23.5");
    expect(overrides.neckDepth).toBe("9");
    expect(overrides.wrist).toBe("8");
    expect(overrides.finishedNeckOpeningWidth).toBe("8");
    expect(overrides.upperArm).toBe("14.5");
  });

  it("editing a Cardigan does not silently change it to a Pullover", () => {
    saveBuild(cardiganValues);
    localStorage.setItem(CUSTOM_BUILD_STYLE_STORAGE_KEYS.garmentType, "pullover");
    const result = applySidewaysCardiganSummaryMeasurementEdits({ vNeckDepth: "9" });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style.garmentStyle).toBe("cardigan");
    expect(getCurrentPattern().style.frontStyle).toBe("open");
    expect(getPatternData().style?.garmentStyle).toBe("cardigan");
    expect(readSidewaysCardiganBuilderStateFromDraft().garmentStyle).toBe("cardigan");
    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.instructions?.garmentStyle).toBe("cardigan");
    expect(summaryScript).not.toMatch(/localStorage\.getItem\([^)]*garmentType/);
    expect(summaryScript).not.toContain("CUSTOM_BUILD_STYLE_STORAGE_KEYS");
    expect(summaryPage).not.toContain("garmentType");
  });

  it("overrides survive refresh and saved-pattern reopening", () => {
    saveBuild(cardiganValues);
    const result = applySidewaysCardiganSummaryMeasurementEdits({
      finishedLength: "24",
      vNeckDepth: "9",
    });
    expect(result.ok).toBe(true);

    const refreshed = readSidewaysCardiganSummaryMeasurements();
    expect(refreshed.finishedLength).toBe("24");
    expect(refreshed.vNeckDepth).toBe("9");
    expect(readSidewaysCardiganBuilderStateFromDraft().styleMeasurements.finishedLength).toBe("24");
    expect(getCurrentPattern().fit?.cbMeasurementOverrides?.finishedLength).toBe("24");
    expect(getPatternData().fit?.cbMeasurementOverrides?.neckDepth).toBe("9");

    const view = loadSidewaysCardiganWorkspaceView();
    expect(view.ok).toBe(true);
    if (!view.ok) throw new Error(view.message);
    expect(view.input.garmentLengthInches).toBe(24);
    expect(view.input.vNeckDepthInches).toBe(9);
    expect(view.pattern.style).toMatchObject({
      garmentStyle: "cardigan",
      sleeveDirection: "cuff-up",
      sleeveLength: "long",
    });
    expect(SIDEWAYS_CARDIGAN_OPEN_PATTERN_EDIT_WORKSPACE_HREF).toBe(
      `${SIDEWAYS_CARDIGAN_SUMMARY_EDIT_HREF}?edit=1`,
    );
    expect(summaryScript).toContain("ensureUrlRequestedSavedPatternHydrated");
  });

  it("inches/centimeters changes displayed values without changing the underlying measurements", () => {
    saveBuild(cardiganValues);
    const stored = readSidewaysCardiganSummaryMeasurements();
    const inchDisplay = displaySidewaysCardiganSummaryMeasurements(stored, "in");
    const cmDisplay = displaySidewaysCardiganSummaryMeasurements(stored, "cm");
    expect(inchDisplay.vNeckDepth).toBe("8");
    expect(cmDisplay.vNeckDepth).toBe("20.3");
    expect(stored.vNeckDepth).toBe("8");
    expect(getCurrentPattern().fit?.cbMeasurementOverrides?.neckDepth).toBe("8");
    expect(summaryPage).toContain("data-sideways-edit-unit");
    expect(summaryPage).toContain("Inches");
    expect(summaryPage).toContain("Centimeters");
    expect(summaryScript).toContain("displaySidewaysCardiganSummaryMeasurements");
    expect(summaryScript).not.toContain("gaugeRawUnit = next");
  });
});

describe("Sideways Summary/Edit workspace copy", () => {
  it("does not put sleeve construction direction on the Summary/Edit page", () => {
    expect(summaryPage).not.toContain("Sleeve direction");
    expect(summaryPage).not.toContain("Cuff up");
    expect(summaryPage).not.toContain("data-sideways-edit-sleeve-direction");
    expect(summaryScript).not.toContain("SIDEWAYS_CARDIGAN_SLEEVE_DIRECTION_LABELS");
    expect(summaryPage).not.toContain("Neckline");
    expect(summaryPage).not.toContain("sl-edit-neckline");
  });
});

describe("Sideways Summary/Edit shared workspace structure", () => {
  it("uses the shared sweater Summary/Edit sidebar and Body/Sleeve tabs", () => {
    expect(summaryPage).toContain("PatternProjectDetails");
    expect(summaryPage).toContain("EditWorkspaceGaugeFields");
    expect(summaryPage).toContain("Quick edits");
    expect(summaryPage).toContain("data-cb-build-summary");
    expect(summaryPage).toContain("data-sideways-workspace-measure-summary");
    expect((summaryPage.match(/>Units</g) ?? []).length).toBe(1);
    expect(summaryScript).toContain("createDropShoulderEditPreviewTablist");
    expect(summaryScript).toContain("applyDropShoulderEditPreviewChipVisibility");
    expect(summaryScript).toContain("focusDropShoulderUpperArmMeasurement");
    expect(summaryScript).toContain("buildSidewaysCardiganEditMeasurementDiagramSvg(input, previewTab)");
    expect(SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS.filter((f) => f.previewTab === "body").map((f) => f.id)).not.toContain(
      "sleeveLength",
    );
    expect(SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS.filter((f) => f.previewTab === "body").map((f) => f.id)).not.toContain(
      "wrist",
    );
    expect(
      SIDEWAYS_CARDIGAN_SUMMARY_MEASUREMENT_FIELDS.filter((f) => f.previewTab === "sleeve").map((f) => f.id),
    ).toEqual(["finishedUpperArm", "sleeveLength", "wrist"]);
  });
});

describe("Sideways Summary/Edit quick edits and tabs", () => {
  beforeEach(() => {
    stubLocalStorage();
    localStorage.clear();
    seedExpressSweaterChartsForTests("misses", [missesRow]);
  });

  afterEach(() => {
    localStorage.clear();
    resetExpressSweaterChartsForTests();
  });

  it("updates the pattern and SVG when garment style, fit, or sleeve length change", () => {
    saveBuild(cardiganValues);
    const before = diagramFor(cardiganValues);
    expect(before).toContain('data-sideways-edit-diagram="cardigan"');
    expect(before).toContain('data-sideways-edit-piece="body"');

    const styleResult = applySidewaysCardiganSummaryQuickEdits({ garmentStyle: "pullover" });
    expect(styleResult.ok).toBe(true);
    expect(getCurrentPattern().style.garmentStyle).toBe("pullover");
    const pulloverSvg = buildSidewaysCardiganEditMeasurementDiagramSvg(
      buildSidewaysCardiganSummaryDiagramInput(
        readSidewaysCardiganSummaryMeasurements(),
        readSidewaysCardiganBuilderStateFromDraft().garmentStyle,
        "in",
      )!,
      "body",
    );
    expect(pulloverSvg).toContain('data-sideways-edit-diagram="pullover"');
    expect(pulloverSvg).not.toBe(before);

    const fitResult = applySidewaysCardiganSummaryQuickEdits({ fit: "relaxed" });
    expect(fitResult.ok).toBe(true);
    expect(getCurrentPattern().fit?.easeChoice).toBe("relaxed");
    const afterFit = readSidewaysCardiganSummaryMeasurements();
    expect(afterFit.finishedBust).not.toBe("");

    const sleeveResult = applySidewaysCardiganSummaryQuickEdits({ sleeveLengthChoice: "short" });
    expect(sleeveResult.ok).toBe(true);
    expect(getCurrentPattern().style.sleeveLength).toBe("short");
    const sleeveSvg = buildSidewaysCardiganEditMeasurementDiagramSvg(
      buildSidewaysCardiganSummaryDiagramInput(
        readSidewaysCardiganSummaryMeasurements(),
        "pullover",
        "in",
      )!,
      "sleeve",
    );
    expect(sleeveSvg).toContain('data-sideways-edit-piece="sleeve"');
    expect(sleeveSvg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(sleeveSvg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    expect(sleeveSvg).toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist}"`);
    expect(summaryScript).toContain("applySidewaysCardiganSummaryQuickEdits");
  });

  it("keeps Body chips off the sleeve drawing and Sleeve chips off the body drawing", () => {
    saveBuild(cardiganValues);
    const body = diagramFor(cardiganValues);
    const sleeve = buildSidewaysCardiganEditMeasurementDiagramSvg(
      buildSidewaysCardiganSummaryDiagramInput(
        readSidewaysCardiganSummaryMeasurements(),
        "cardigan",
        "in",
      )!,
      "sleeve",
    );
    expect(body).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.sleeveLength}"`);
    expect(body).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.wrist}"`);
    expect(body).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.upperArm}"`);
    expect(sleeve).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.finishedBust}"`);
    expect(sleeve).not.toContain(`id="${SIDEWAYS_SUMMARY_MEASUREMENT_TARGETS.vNeckDepth}"`);
  });
});
