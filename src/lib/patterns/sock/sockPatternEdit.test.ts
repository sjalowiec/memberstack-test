import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, readSockDraft, writeSockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import { measurementsFromSockSize } from "./sockBuilderValidation";
import { convertSockSummaryMeasurements, sockSummaryMeasureFieldsFromDraft } from "./sockSummaryEdit";
import {
  applySockEditFormToDraft,
  sockDraftToEditFormValues,
  sockEditFormMeasureFields,
  validateSockEditForm,
  withSockEditFormMeasures,
} from "./sockPatternEdit";
import { buildSockPatternFromDraft } from "./sockPatternPage";
import { buildSockSummaryFromDraft } from "./sockPatternFromDraft";
import {
  SOCK_EDIT_CANCEL_LABEL,
  SOCK_EDIT_HREF,
  SOCK_EDIT_PRIMARY_LABEL,
  SOCK_PATTERN_BUILDER_HREF,
  SOCK_PATTERN_HREF,
  SOCK_SUMMARY_HREF,
  buildSockBuilderHref,
  buildSockEditHref,
  buildSockPatternHref,
  buildSockSummaryFromBuilderHref,
} from "./sockPatternNavigation";
import { SOCK_SUMMARY_MEASUREMENT_FIELDS } from "./sockPatternEditTargets";
import { buildSockBuilderNewPatternHref, SOCK_BUILDER_PATH } from "./sockFreshStart";

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

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

const dir = dirname(fileURLToPath(import.meta.url));
const editHelper = readFileSync(resolve(dir, "sockPatternEdit.ts"), "utf8");
const editPage = readFileSync(resolve("src/pages/patterns/socks/edit/index.astro"), "utf8");
const editScript = readFileSync(resolve("src/scripts/socks-edit-page.ts"), "utf8");
const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
const patternScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
const builderPage = readFileSync(resolve("src/pages/patterns/socks/builder.astro"), "utf8");
const builderScript = readFileSync(resolve("src/scripts/socks-builder-page.ts"), "utf8");
const summaryPage = readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8");

describe("Pattern Edit Pattern → Socks edit route", () => {
  it("opens /patterns/socks/edit/ from Edit Pattern, not the Builder", () => {
    expect(SOCK_EDIT_HREF).toBe("/patterns/socks/edit/");
    expect(buildSockEditHref()).toBe("/patterns/socks/edit/");
    expect(SOCK_EDIT_HREF).not.toContain("new=1");
    expect(SOCK_EDIT_HREF).not.toContain("builder");
    expect(patternPage).toContain("SOCK_EDIT_HREF");
    expect(patternPage).toContain('data-testid="button-edit-pattern"');
    const editOpen = patternPage.indexOf("data-socks-edit-open");
    const editChunk = patternPage.slice(Math.max(0, editOpen - 280), editOpen + 220);
    expect(editChunk).toContain("SOCK_EDIT_HREF");
    expect(editChunk).not.toContain("SOCK_PATTERN_BUILDER_HREF");
    expect(patternScript).toContain("SOCK_EDIT_HREF");
    expect(patternScript).not.toContain("SOCK_PATTERN_BUILDER_HREF");
    expect(editPage).toContain('data-testid="socks-edit-page"');
    expect(editPage).toContain("patternWorkspace={true}");
    expect(editPage).not.toContain("new=1");
    expect(editPage).not.toContain("express-step-nav");
    expect(editPage).not.toContain("express-acc");
    expect(editPage).not.toContain("Review My Pattern");
    expect(editPage).not.toContain("Make your changes, then click Update Pattern");
    expect(editPage).not.toContain("SOCK_EDIT_HINT");
  });
});

describe("edit loads existing kbm_socks_draft", () => {
  it("populates size, direction, gauge, and measurements from the saved draft", () => {
    const draft = completeDraft({
      constructionDirection: "toe-up",
      footLength: "9.5",
      gaugeSlots: { inches: { stitch: "26", row: "38" }, cm: { stitch: "", row: "" } },
      availableNeedles: "180",
    });
    const form = sockDraftToEditFormValues(draft);
    expect(form.sizeSel).toBe("woman_med");
    expect(form.constructionDirection).toBe("toe-up");
    expect(form.footCircumference).toBe("8.5");
    expect(form.footLength).toBe("9.5");
    expect(form.legCircumference).toBe("8.5");
    expect(form.legLength).toBe("4.5");
    expect(form.stitchGauge).toBe("26");
    expect(form.rowGauge).toBe("38");
    expect(form.availableNeedles).toBe("180");
    expect(editScript).toContain("readSockDraft");
    expect(editScript).toContain("sockDraftToEditFormValues");
    expect(editScript).toContain("writeForm");
    expect(editScript).not.toContain("applySockNewSessionFromUrl");
    expect(editScript).not.toContain("clearSockDraftStorage");
    expect(editPage).toContain('data-testid="socks-edit-size"');
    expect(editPage).toContain('data-testid="socks-edit-construction"');
    expect(editPage).toContain('data-testid="socks-edit-stitch-gauge"');
    expect(editPage).toContain('data-testid="socks-edit-row-gauge"');
    expect(editPage).toContain('data-testid="socks-edit-available-needles"');
    expect(editPage).toContain('value="cuff-to-toe"');
    expect(editPage).toContain('value="toe-up"');
    expect(editPage).toContain("SOCK_CONSTRUCTION_DIRECTION_LABELS");
    expect(editPage).toContain("Pattern choices");
    expect(editPage).toContain("Gauge / machine");
    expect(editPage).toContain("AVAILABLE_NEEDLES_LABEL");
    expect(editPage).toContain("socks-edit-units-heading");
  });
});

describe("Edit measurements are chips only", () => {
  it("omits the left-side Perfect Fit Measurements section and duplicate inputs", () => {
    expect(editPage).not.toContain("Perfect Fit measurements");
    expect(editPage).not.toContain("socks-edit-measure-heading");
    expect(editPage).not.toContain("data-socks-edit-form-foot-circ");
    expect(editPage).not.toContain("data-socks-edit-form-foot-length");
    expect(editPage).not.toContain("data-socks-edit-form-leg-circ");
    expect(editPage).not.toContain("data-socks-edit-form-leg-length");
    expect(editPage).not.toContain("socks-edit-form-foot-circ");
    expect(editPage).not.toContain("socks-edit-measure-grid");
    expect(editScript).not.toContain("data-socks-edit-form-foot-circ");
    expect(editScript).not.toContain("writeFormMeasures");
    expect(editScript).not.toMatch(/\bwriteMeasures\b/);
    expect(editPage).toContain("Pattern choices");
    expect(editPage).toContain("Gauge / machine");
    expect(editPage).toContain('data-testid="socks-edit-size"');
    expect(editPage).toContain('data-testid="socks-edit-construction"');
    expect(editPage).toContain('data-testid="socks-edit-stitch-gauge"');
    expect(editPage).toContain('data-testid="socks-edit-row-gauge"');
    expect(editPage).toContain('data-testid="socks-edit-available-needles"');
  });

  it("keeps all four shared measurement chips on the approved static image", () => {
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.id)).toEqual([
      "legLength",
      "legCircumference",
      "footLength",
      "footCircumference",
    ]);
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.label)).toEqual([
      "Leg Length",
      "Leg Circumference",
      "Foot Length",
      "Foot Circumference",
    ]);
    expect(editPage).toContain("PatternSummaryMeasurementChip");
    expect(editPage).toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(editPage).toContain("SOCK_SUMMARY_ART_SRC");
    expect(editPage).toContain("data-socks-edit-art");
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.testId)).toEqual([
      "socks-edit-chip-leg-length",
      "socks-edit-chip-leg-circ",
      "socks-edit-chip-foot-length",
      "socks-edit-chip-foot-circ",
    ]);
    expect(editScript).toContain("bindPatternSummaryOverlayPositioning");
    expect(editScript).toContain("writeChipMeasures");
    expect(editScript).toContain("readChipMeasures");
  });

  it("uses chip values for draft updates, size defaults, unit display, and Update Pattern", () => {
    const draft = completeDraft();
    const form = sockDraftToEditFormValues(draft);
    const chips = sockSummaryMeasureFieldsFromDraft(draft);
    expect(sockEditFormMeasureFields(form)).toEqual(chips);

    const fromChip = withSockEditFormMeasures(form, { ...chips, footLength: "10.5" });
    expect(fromChip.footLength).toBe("10.5");
    const next = applySockEditFormToDraft(draft, fromChip);
    expect(next.footLength).toBe("10.5");

    const cm = convertSockSummaryMeasurements(chips, "inches", "cm");
    expect(Number(cm.footCircumference)).toBeCloseTo(8.5 * 2.54, 1);
    expect(Number(cm.footLength)).toBeCloseTo(9 * 2.54, 1);
    expect(Number(cm.legCircumference)).toBeCloseTo(8.5 * 2.54, 1);
    expect(Number(cm.legLength)).toBeCloseTo(4.5 * 2.54, 1);

    expect(editScript).toContain("readChipMeasures()");
    expect(editScript).toContain("footCircumference: measures.footCircumference");
    expect(editScript).toContain("applySockEditFormToDraft(lastDraft, readForm())");
    expect(editScript).toContain("convertSockSummaryMeasurements");
    expect(editScript).toContain("sockSummaryUnitSuffix");
    expect(editScript).toContain("writeChipMeasures");
    expect(editScript).toContain("validateSockEditForm(lastDraft, form, adapter)");
  });
});

describe("Update Pattern persists and returns to Pattern", () => {
  it("writes kbm_socks_draft through existing Socks math and returns to the Pattern page", () => {
    const storage = memoryStorage();
    const previous = completeDraft();
    writeSockDraft(previous, storage);
    const form = {
      ...sockDraftToEditFormValues(previous),
      constructionDirection: "toe-up" as const,
      footLength: "10.5",
    };
    const check = validateSockEditForm(previous, form, adapter);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    writeSockDraft(check.draft, storage);
    const saved = readSockDraft(storage);
    expect(saved?.footLength).toBe("10.5");
    expect(saved?.constructionDirection).toBe("toe-up");
    const pattern = buildSockPatternFromDraft(saved, adapter);
    expect(pattern.ok).toBe(true);
    if (!pattern.ok) return;
    expect(pattern.calc.footLengthInches).toBe(10.5);
    expect(pattern.view.constructionLabel).toBe("Toe Up");
    const summary = buildSockSummaryFromDraft(saved, adapter);
    expect(summary.ok).toBe(true);
    if (!summary.ok) return;
    expect(pattern.calc).toEqual(summary.calc);
    expect(SOCK_PATTERN_HREF).toBe("/patterns/socks/pattern/");
    expect(buildSockPatternHref()).toBe("/patterns/socks/pattern/");
    expect(SOCK_EDIT_PRIMARY_LABEL).toBe("Update Pattern");
    expect(editPage).toContain("SOCK_EDIT_PRIMARY_LABEL");
    expect(editPage).toContain('data-testid="button-edit-update"');
    expect(editPage).toContain("SOCK_PATTERN_HREF");
    expect(editPage).toContain('data-testid="button-edit-cancel"');
    expect(SOCK_EDIT_CANCEL_LABEL).toBe("Cancel");
    expect(editScript).toContain("writeSockDraft(check.draft)");
    expect(editScript).toContain("window.location.assign(SOCK_PATTERN_HREF)");
    expect(editScript).not.toContain("clearSockDraftStorage");
  });
});

describe("Builder remains unchanged for new patterns", () => {
  it("still uses /patterns/socks/builder and Summary for new-pattern creation", () => {
    expect(SOCK_BUILDER_PATH).toBe("/patterns/socks/builder");
    expect(SOCK_PATTERN_BUILDER_HREF).toBe("/patterns/socks/builder");
    expect(buildSockBuilderHref()).toBe("/patterns/socks/builder");
    expect(buildSockBuilderNewPatternHref()).toBe("/patterns/socks/builder?new=1");
    expect(SOCK_SUMMARY_HREF).toBe("/patterns/socks/summary/");
    expect(buildSockSummaryFromBuilderHref()).toBe("/patterns/socks/summary/?generated=1");
    expect(builderPage).toContain("express-step-nav");
    expect(builderPage).toContain("express-acc");
    expect(builderPage).toContain("Review My Pattern");
    expect(builderPage).toContain('id="socks-size"');
    expect(builderScript).toContain("applySockNewSessionFromUrl");
    expect(builderScript).toContain("buildSockSummaryFromBuilderHref");
    expect(builderScript).toMatch(/location\.assign\(buildSockSummaryFromBuilderHref\(\)\)/);
    expect(builderScript).not.toContain("SOCK_EDIT_HREF");
    expect(builderPage).not.toContain("SOCK_EDIT_HREF");
    expect(summaryPage).toContain("SOCK_PATTERN_HREF");
    expect(summaryPage).toContain("Magic Formula");
  });
});

describe("Edit omits calculation review and does not duplicate Socks math", () => {
  it("does not show Summary-style calculation blocks", () => {
    expect(editPage).not.toContain("Machine capacity");
    expect(editPage).not.toContain("Needles required");
    expect(editPage).not.toContain("Working stitches");
    expect(editPage).not.toContain("Held stitches");
    expect(editPage).not.toContain("Center stitches remaining");
    expect(editPage).not.toContain("Short-row shaping");
    expect(editPage).not.toContain("Heel depth");
    expect(editPage).not.toContain("Toe depth");
    expect(editPage).not.toContain("Straight foot");
    expect(editPage).not.toContain("Magic Formula");
    expect(editPage).not.toContain("Total sock stitches");
    expect(editPage).not.toContain("Calculated geometry");
    expect(editPage).not.toContain("socks-summary.svg");
    expect(editScript).not.toContain("renderSockSummaryView");
    expect(editScript).not.toContain("workingStitches");
    expect(editScript).not.toContain("magicFormulaSchedule");
  });

  it("does not duplicate Socks math in the Edit layer", () => {
    const joined = [editHelper, editScript, editPage].join("\n");
    expect(joined).not.toMatch(/calculateBasicSockPattern/);
    expect(joined).not.toMatch(/magicFormulaIntervals/);
    expect(joined).not.toMatch(/remainingStitchesAtOneThird/);
    expect(joined).not.toMatch(/roundToEvenPreferUp/);
    expect(joined).not.toMatch(/computeMagicFormulaPairedShaping/);
    expect(joined).not.toMatch(/calculateShortRowShaping/);
    expect(editHelper).toContain("buildSockSummaryFromDraft");
    expect(editHelper).toContain("applySockSummaryMeasurementsToDraft");
    expect(editHelper).toContain("snapshotFromSockDraft");
    expect(editScript).toContain("validateSockEditForm");
    expect(editScript).toContain("applySockEditFormToDraft");
  });
});

describe("validation still blocks impossible updates", () => {
  it("rejects insufficient needles and impossible foot length", () => {
    const draft = completeDraft();
    const needles = validateSockEditForm(
      draft,
      { ...sockDraftToEditFormValues(draft), availableNeedles: "40" },
      adapter,
    );
    expect(needles.ok).toBe(false);
    if (needles.ok) return;
    expect(needles.errors.availableNeedles).toMatch(/60/);
    expect(needles.errors.form).toMatch(/60/);

    const tooShort = validateSockEditForm(
      draft,
      { ...sockDraftToEditFormValues(draft), footLength: "1" },
      adapter,
    );
    expect(tooShort.ok).toBe(false);
    if (tooShort.ok) return;
    expect(tooShort.errors.form).toMatch(/foot length/i);

    const emptyMeasure = validateSockEditForm(
      draft,
      { ...sockDraftToEditFormValues(draft), footCircumference: "" },
      adapter,
    );
    expect(emptyMeasure.ok).toBe(false);
    if (emptyMeasure.ok) return;
    expect(emptyMeasure.errors.footCircumference).toMatch(/foot circumference/i);

    const emptyGauge = validateSockEditForm(
      draft,
      { ...sockDraftToEditFormValues(draft), stitchGauge: "" },
      adapter,
    );
    expect(emptyGauge.ok).toBe(false);
    if (emptyGauge.ok) return;
    expect(emptyGauge.errors.stitchGauge).toMatch(/stitch gauge/i);
  });

  it("applies chart defaults onto the same measurement fields when size changes", () => {
    const draft = completeDraft();
    const lg = measurementsFromSockSize("woman_lg", adapter, "inches");
    expect(lg).toBeTruthy();
    if (!lg) return;
    const next = applySockEditFormToDraft(
      draft,
      withSockEditFormMeasures(
        { ...sockDraftToEditFormValues(draft), sizeSel: "woman_lg" },
        lg,
      ),
    );
    expect(next.sizeSel).toBe("woman_lg");
    expect(next.footCircumference).toBe(lg.footCircumference);
    expect(next.footLength).toBe(lg.footLength);
    expect(editScript).toContain("writeChipMeasures(defaults)");
    expect(editScript).toContain("measurementsFromSockSize");
    expect(editScript).toContain("applySizeChartDefaults");
  });
});
