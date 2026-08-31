import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import { calculateBasicSockPattern } from "./sockMath";
import {
  SOCK_BUILDER_PATH,
  buildSockBuilderNewPatternHref,
} from "./sockFreshStart";
import {
  SOCK_PATTERN_BUILDER_HREF,
  SOCK_PATTERN_HREF,
  SOCK_SUMMARY_FROM_BUILDER_HREF,
  SOCK_SUMMARY_HREF,
  SOCK_EDIT_PRIMARY_LABEL,
  buildSockBuilderHref,
  buildSockPatternHref,
  buildSockSummaryFromBuilderHref,
} from "./sockPatternNavigation";
import { SOCK_SUMMARY_ART_SRC } from "./sockPatternEditTargets";
import {
  SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE,
  SOCK_PATTERN_MISSING_DRAFT_MESSAGE,
  SOCK_STRAIGHT_LEG_STATUS,
  buildSockSummaryFromDraft,
  formatSockLegKnitOrderSummary,
  formatSockLegShapingStatus,
  formatSockMagicFormulaSchedule,
  formatSockMeasurementWithUnit,
  formatSockSummaryGaugeLabel,
} from "./sockPatternFromDraft";

const adapter = createSockSizingAdapter(
  JSON.parse(readFileSync(resolve("public/data/sizing_socks.json"), "utf8")),
);

function completeDraft(overrides: Partial<SockDraft> = {}): SockDraft {
  return createEmptySockDraft({
    sizeSel: "woman_med",
    constructionDirection: "cuff-to-toe",
    footCircumference: "8.5",
    footLength: "9",
    legCircumference: "8.5",
    legLength: "4.5",
    gaugeSlots: {
      inches: { stitch: "28", row: "40" },
      cm: { stitch: "", row: "" },
    },
    availableNeedles: "200",
    ...overrides,
  });
}

describe("Socks Builder Review → Summary navigation", () => {
  const builderScript = readFileSync(resolve("src/scripts/socks-builder-page.ts"), "utf8");
  const editWorkspace = readFileSync(
    resolve("src/components/patterns/SocksPatternEditWorkspace.astro"),
    "utf8",
  );
  const summaryPage =
    readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8") +
    "\n" +
    editWorkspace;
  const summaryScript =
    readFileSync(resolve("src/scripts/socks-summary-page.ts"), "utf8") +
    "\n" +
    readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");

  it("sends a valid Builder review to /patterns/socks/summary/?generated=1", () => {
    expect(SOCK_SUMMARY_HREF).toBe("/patterns/socks/summary/");
    expect(buildSockSummaryFromBuilderHref()).toBe("/patterns/socks/summary/?generated=1");
    expect(SOCK_SUMMARY_FROM_BUILDER_HREF).toBe("/patterns/socks/summary/?generated=1");
    expect(buildSockBuilderHref()).toBe("/patterns/socks/builder");
    expect(SOCK_PATTERN_BUILDER_HREF).toBe(SOCK_BUILDER_PATH);
    expect(buildSockBuilderNewPatternHref()).toBe("/patterns/socks/builder?new=1");
    expect(builderScript).toContain("buildSockSummaryFromBuilderHref");
    expect(builderScript).toMatch(/location\.assign\(buildSockSummaryFromBuilderHref\(\)\)/);
    expect(builderScript).not.toContain("Pattern summary is not available yet");
    expect(summaryPage).toContain("patternWorkspace={true}");
    expect(summaryPage).toContain("SocksPatternEditWorkspace");
    expect(summaryPage).toContain("PatternSummaryEditWorkspace");
    expect(summaryPage).toContain("SOCK_PATTERN_BUILDER_HREF");
    expect(summaryPage).toContain("SOCK_EDIT_CANCEL_LABEL");
    expect(summaryPage).toContain("SOCK_EDIT_PRIMARY_LABEL");
    expect(summaryPage).toContain("SOCK_PATTERN_HREF");
    expect(summaryPage).toContain('data-testid="button-edit-update"');
    expect(summaryPage).not.toContain("disabled");
    expect(summaryPage).toContain("PatternSummaryDiagramStage");
    expect(summaryPage).toContain("data-socks-edit-diagram");
    expect(summaryPage).toContain("PatternSummaryMeasurementChip");
    expect(summaryPage).toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(SOCK_SUMMARY_ART_SRC).toContain("socks-pattern-summary-transparent.webp");
    expect(summaryPage).toContain("SOCK_SUMMARY_ART_SRC");
    expect(summaryScript).not.toContain("buildSockFinishedProfileSvg");
    expect(summaryScript).not.toContain("buildSockPatternDiagramSvg");
    expect(summaryPage).toContain("SleevelessPatternMemberGate");
    expect(summaryScript).toContain("validateSockEditForm");
    expect(summaryScript).toContain("reconcilePatternDraftOwner");
    expect(summaryScript).toContain("window.location.assign(SOCK_PATTERN_HREF)");
    expect(SOCK_PATTERN_HREF).toBe("/patterns/socks/pattern/");
    expect(buildSockPatternHref()).toBe("/patterns/socks/pattern/");
    expect(SOCK_EDIT_PRIMARY_LABEL).toBe("Update Pattern");
  });
});

describe("draft → Summary calculations", () => {
  it("calculates Woman Medium 28×40 over 4 inches from the saved draft via committed math", () => {
    const result = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const direct = calculateBasicSockPattern({
      footCircumferenceInches: 8.5,
      footLengthInches: 9,
      legCircumferenceInches: 8.5,
      legLengthInches: 4.5,
      stitchGaugeDisplay: 28,
      rowGaugeDisplay: 40,
      displayUnit: "inches",
      constructionDirection: "cuff-to-toe",
    });
    expect(direct.ok).toBe(true);
    if (!direct.ok) return;
    expect(result.calc).toEqual(direct.calc);
    expect(result.view.patternName).toBe("Basic Socks");
    expect(result.calc.legShapingSchedule.direction).toBe("none");
  });
});

describe("selected size display", () => {
  it("shows the chart size name, including overlapping foot-circumference sizes", () => {
    const womanMed = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(womanMed.ok && womanMed.view.sizeLabel).toContain("Woman Medium");

    const manSm = buildSockSummaryFromDraft(
      completeDraft({
        sizeSel: "man_sm",
        footCircumference: "9",
        footLength: "10",
        legCircumference: "9",
        legLength: "5",
      }),
      adapter,
    );
    expect(manSm.ok && manSm.view.sizeLabel).toContain("Man Small");
    expect(manSm.ok && manSm.view.footCircumference).toBe('9"');
  });
});

describe("customized Perfect Fit values", () => {
  it("displays the entered finished measurements instead of chart defaults", () => {
    const result = buildSockSummaryFromDraft(
      completeDraft({
        footCircumference: "9.25",
        footLength: "9.5",
        legCircumference: "10",
        legLength: "6",
      }),
      adapter,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.footCircumference).toBe('9.25"');
    expect(result.view.footLength).toBe('9.5"');
    expect(result.view.legCircumference).toBe('10"');
    expect(result.view.legLength).toBe('6"');
    expect(result.view.sizeLabel).toContain("Woman Medium");
    expect(result.calc.footCircumferenceInches).toBe(9.25);
    expect(result.calc.legCircumferenceInches).toBe(10);
  });
});

describe("construction direction display", () => {
  it("labels Cuff to Toe and Toe Up from the draft", () => {
    const cuff = buildSockSummaryFromDraft(completeDraft(), adapter);
    const toe = buildSockSummaryFromDraft(
      completeDraft({ constructionDirection: "toe-up" }),
      adapter,
    );
    expect(cuff.ok && cuff.view.constructionLabel).toBe("Cuff to Toe");
    expect(toe.ok && toe.view.constructionLabel).toBe("Toe Up");
  });
});

describe("gauge display", () => {
  it("shows entered stitch and row gauge in the active unit", () => {
    const inches = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(inches.ok && inches.view.stitchGauge).toBe("28");
    expect(inches.ok && inches.view.rowGauge).toBe("40");
    expect(inches.ok && inches.view.gaugeBasisLabel).toBe("over 4 inches");
    expect(inches.ok && inches.view.gaugeLabel).toBe("28 sts / 40 rows over 4 inches");
    expect(formatSockSummaryGaugeLabel("28", "40", "inches")).toBe(
      "28 sts / 40 rows over 4 inches",
    );

    const cm = buildSockSummaryFromDraft(
      completeDraft({
        unit: "cm",
        footCircumference: "21.6",
        footLength: "22.9",
        legCircumference: "21.6",
        legLength: "11.4",
        gaugeSlots: {
          inches: { stitch: "28", row: "40" },
          cm: { stitch: "22", row: "32" },
        },
      }),
      adapter,
    );
    expect(cm.ok && cm.view.unitsLabel).toBe("Centimeters");
    expect(cm.ok && cm.view.stitchGauge).toBe("22");
    expect(cm.ok && cm.view.gaugeLabel).toBe("22 sts / 32 rows over 10 cm");
  });
});

describe("calculated stitch and length geometry", () => {
  it("exposes total, heel/toe, one-way short-row, return, depths, and straight foot", () => {
    const result = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { view, calc } = result;

    expect(view.totalSockStitches).toBe(60);
    expect(view.legStitches).toBe(60);
    expect(view.workingStitches).toBe(30);
    expect(view.heldStitches).toBe(30);
    expect(view.remainingStitches).toBe(10);
    expect(view.shortRowShapingRows).toBe(20);
    expect(view.returnToWorkRows).toBe(20);
    expect(view.shortRowShapingRows).toBe(calc.heel.shortRowDepthRows);
    expect(view.returnToWorkRows).toBe(calc.heel.shortRowOutSteps);
    expect(view.shortRowShapingRows).not.toBe(calc.heel.shortRowKnittingRows);
    expect(calc.heelDepthInches).toBe(calc.heel.shortRowDepthRows / calc.rowGaugePerInch);
    expect(view.heelDepth).toBe('2"');
    expect(view.toeDepth).toBe('2"');
    expect(view.straightFootLength).toBe('5"');
    expect(view.straightFootRows).toBe(50);
    expect(view.ankleStraightLength).toBe(
      formatSockMeasurementWithUnit(calc.ankleStraightLengthInches, "inches"),
    );
    expect(view.ankleStraightRows).toBe(10);
    expect(view.legRows).toBe(46);
    expect(view.legShapingRowsAvailable).toBe(36);
    expect(calc.ankleStraightRows + calc.legShapingRowsAvailable).toBe(calc.legRows);
    expect(calc.heel).toEqual(calc.toe);
  });
});

describe("leg shaping status", () => {
  it("reports a straight leg when circumferences match", () => {
    const result = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.legShapingNeeded).toBe(false);
    expect(result.view.legStitchChange).toBe(0);
    expect(result.view.legShapingStatus).toBe(SOCK_STRAIGHT_LEG_STATUS);
    expect(result.calc.legShapingSchedule.direction).toBe("none");
    expect(result.view.pairedShapingEvents).toBe(0);
    expect(result.view.magicFormulaSchedule).toBe("");
    expect(result.view.ankleStraightRows).toBe(10);
    expect(formatSockLegShapingStatus(result.calc)).toBe(SOCK_STRAIGHT_LEG_STATUS);
  });

  it("shows Magic Formula paired increases for a wider top of leg", () => {
    const result = buildSockSummaryFromDraft(
      completeDraft({ legCircumference: "10" }),
      adapter,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const schedule = result.calc.legShapingSchedule;
    expect(result.view.legShapingNeeded).toBe(true);
    expect(result.view.legStitchChange).toBe(10);
    expect(result.view.legShapingStatus).toBe("Leg is 10 stitches wider than the foot.");
    expect(result.view.legShapingStatus).not.toMatch(/not generated/i);
    expect(result.view.ankleStitches).toBe(60);
    expect(result.view.topLegStitches).toBe(70);
    expect(result.view.pairedShapingEvents).toBe(5);
    expect(result.view.pairedEventLabel).toBe("Paired increase events");
    expect(result.view.magicFormulaSchedule).toBe(
      formatSockMagicFormulaSchedule(schedule.steps, result.calc.legShapingRowsAvailable),
    );
    expect(result.view.magicFormulaSchedule).toMatch(/after the straight ankle/);
    expect(result.view.legShapingRowsAvailable).toBe(result.calc.legShapingRowsAvailable);
    expect(result.view.ankleStraightRows).toBe(10);
    expect(result.view.knitOrderSummary).toBe(formatSockLegKnitOrderSummary(result.calc));
    expect(result.view.knitOrderSummary).toMatch(/Cuff to Toe/);
    expect(schedule.direction).toBe("increase");
    expect(schedule.method).toBe("magic");
  });

  it("shows Magic Formula paired decreases for a narrower top of leg", () => {
    const result = buildSockSummaryFromDraft(
      completeDraft({ legCircumference: "7" }),
      adapter,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.legShapingNeeded).toBe(true);
    expect(result.view.legStitchChange).toBe(-10);
    expect(result.view.legShapingStatus).toBe("Leg is 10 stitches narrower than the foot.");
    expect(result.view.ankleStitches).toBe(60);
    expect(result.view.topLegStitches).toBe(50);
    expect(result.view.pairedShapingEvents).toBe(5);
    expect(result.view.pairedEventLabel).toBe("Paired decrease events");
    expect(result.view.magicFormulaSchedule.length).toBeGreaterThan(0);
    expect(result.calc.legShapingSchedule.direction).toBe("decrease");
  });

  it("keeps Summary on the shared Edit workspace instead of a calculation report", () => {
    const editWorkspace = readFileSync(
      resolve("src/components/patterns/SocksPatternEditWorkspace.astro"),
      "utf8",
    );
    const summaryPage =
      readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8") +
      "\n" +
      editWorkspace;
    const summaryScript =
      readFileSync(resolve("src/scripts/socks-summary-page.ts"), "utf8") +
      "\n" +
      readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");
    expect(summaryPage).toContain("Pattern choices");
    expect(summaryPage).toContain("Gauge / machine");
    expect(summaryPage).toContain("SOCK_EDIT_PRIMARY_LABEL");
    expect(summaryPage).not.toContain("Ankle stitches");
    expect(summaryPage).not.toContain("Magic Formula");
    expect(summaryPage).not.toContain("data-socks-summary-leg-details");
    expect(summaryPage).not.toContain("Leg shaping instructions are not generated yet.");
    expect(summaryScript).toContain("validateSockEditForm");
    expect(summaryScript).toContain("applySockEditFormToDraft");
    expect(summaryScript).toContain("writeSockDraft(check.draft)");
  });
});

describe("machine capacity", () => {
  it("shows required vs available needles on a valid summary", () => {
    const result = buildSockSummaryFromDraft(completeDraft(), adapter);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.view.requiredNeedles).toBe(60);
    expect(result.view.availableNeedles).toBe(200);
    expect(result.view.machineCapacityOk).toBe(true);
  });

  it("blocks Summary when the draft needs more needles than available", () => {
    const result = buildSockSummaryFromDraft(
      completeDraft({ availableNeedles: "40" }),
      adapter,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("needles");
    expect(result.message).toContain("60");
    expect(result.message).toContain("40");
  });
});

describe("invalid or incomplete draft handling", () => {
  it("does not invent chart defaults for a missing or incomplete draft", () => {
    expect(buildSockSummaryFromDraft(null, adapter)).toMatchObject({
      ok: false,
      reason: "missing",
      message: SOCK_PATTERN_MISSING_DRAFT_MESSAGE,
    });
    const incomplete = buildSockSummaryFromDraft(
      createEmptySockDraft({ sizeSel: "woman_med" }),
      adapter,
    );
    expect(incomplete.ok).toBe(false);
    if (incomplete.ok) return;
    expect(incomplete.reason).toBe("incomplete");
    expect(incomplete.message).toBe(SOCK_PATTERN_INCOMPLETE_DRAFT_MESSAGE);
  });

  it("surfaces a calc error when finished foot length cannot hold heel and toe depth", () => {
    const result = buildSockSummaryFromDraft(
      completeDraft({ footLength: "1" }),
      adapter,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("calc-error");
    expect(result.message).toMatch(/foot length/i);
  });
});

describe("cuff-to-toe and toe-up show identical geometry", () => {
  it("keeps stitch and row geometry the same while construction labels differ", () => {
    const cuff = buildSockSummaryFromDraft(completeDraft(), adapter);
    const toe = buildSockSummaryFromDraft(
      completeDraft({ constructionDirection: "toe-up" }),
      adapter,
    );
    expect(cuff.ok && toe.ok).toBe(true);
    if (!cuff.ok || !toe.ok) return;
    expect(cuff.view.constructionLabel).toBe("Cuff to Toe");
    expect(toe.view.constructionLabel).toBe("Toe Up");
    const { constructionDirection: _c, legShapingSchedule: cuffSchedule, ...cuffRest } = cuff.calc;
    const { constructionDirection: _t, legShapingSchedule: toeSchedule, ...toeRest } = toe.calc;
    const { knitOrder: cuffKnit, ...cuffGeometry } = cuffSchedule;
    const { knitOrder: toeKnit, ...toeGeometry } = toeSchedule;
    expect(cuffRest).toEqual(toeRest);
    expect(cuffGeometry).toEqual(toeGeometry);
    expect(cuffKnit.constructionDirection).toBe("cuff-to-toe");
    expect(toeKnit.constructionDirection).toBe("toe-up");
    expect(cuff.view.totalSockStitches).toBe(toe.view.totalSockStitches);
    expect(cuff.view.workingStitches).toBe(toe.view.workingStitches);
    expect(cuff.view.shortRowShapingRows).toBe(toe.view.shortRowShapingRows);
    expect(cuff.view.heelDepth).toBe(toe.view.heelDepth);
    expect(cuff.view.straightFootRows).toBe(toe.view.straightFootRows);
    expect(cuff.view.legRows).toBe(toe.view.legRows);
  });
});

describe("Socks Summary page content", () => {
  const summaryPage =
    readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8") +
    "\n" +
    readFileSync(resolve("src/components/patterns/SocksPatternEditWorkspace.astro"), "utf8");

  it("reuses the Edit workspace and does not ask for heel/toe/ankle as inputs", () => {
    expect(summaryPage).toContain("SocksPatternEditWorkspace");
    expect(summaryPage).toContain("Pattern choices");
    expect(summaryPage).toContain("Gauge / machine");
    expect(summaryPage).toContain("SOCK_EDIT_PRIMARY_LABEL");
    expect(summaryPage).not.toContain("Basic information");
    expect(summaryPage).not.toContain("Finished measurements");
    expect(summaryPage).not.toContain("Heel &amp; Toe Shaping");
    expect(summaryPage).not.toContain("ankle circumference");
    expect(summaryPage).not.toContain("Fancy Socks");
    expect(summaryPage).toContain("SOCK_PATTERN_HREF");
  });
});
