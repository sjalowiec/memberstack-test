import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptyHatDraft, writeHatDraft, readHatDraft } from "./hatDraft";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { applyHatCrownCastOnAdjustment, calculateHatPattern } from "./hatMath";
import { buildHatPatternCalcFromDraft } from "./hatPatternFromDraft";
import { buildHatPatternDiagramSvg, HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT } from "./hatPatternDiagramSvg";
import {
  applyHatEditFormToDraft,
  buildHatSummaryEditPreview,
  convertHatEditLengthDisplay,
  hatDraftToEditFormValues,
  resolveHatEditSizeAndLength,
  validateHatEditForm,
  type HatEditFormValues,
  type HatEditSizingRow,
} from "./hatPatternEdit";
import { HAT_EDIT_MEASUREMENT_TARGETS, HAT_EDIT_MEASUREMENT_TRANSFORMS } from "./hatPatternEditTargets";
import {
  HAT_PATTERN_HREF,
  HAT_SUMMARY_EDIT_FROM_BUILDER_HREF,
  HAT_SUMMARY_EDIT_FROM_PATTERN_HREF,
  HAT_SUMMARY_EDIT_HREF,
  HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL,
  HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL,
  HAT_SUMMARY_CANCEL_FROM_BUILDER_LABEL,
  HAT_SUMMARY_CANCEL_FROM_EDIT_LABEL,
  hatSummaryCancelHref,
  hatSummaryPrimaryLabel,
  resolveHatSummaryEntryPath,
} from "./hatPatternNavigation";
import { DESKTOP_MEASUREMENT_OVERLAY_MQ } from "../patternSummaryMeasurementOverlay";
import hatSizingRows from "../../../data/sizing_hats.json";
import {
  convertLength,
  formatLengthWithUnit,
} from "../../../components/wizards/utils/unitHelpers";

const sizingRows = buildHatSizingBuilderRows(
  Array.isArray(hatSizingRows) ? hatSizingRows : [],
) as HatEditSizingRow[];

function completeDraft(overrides: Partial<ReturnType<typeof createEmptyHatDraft>> = {}) {
  return createEmptyHatDraft({
    unit: "inches",
    sizeSel: "adult_woman",
    brimType: "single",
    brimLength: "2",
    crownShaping: "gathered",
    fit: "watchcap",
    availableNeedles: "200",
    gaugeSlots: {
      inches: { stitch: "5", row: "7" },
      cm: { stitch: "", row: "" },
    },
    ...overrides,
  });
}

function formFromDraft(
  draft = completeDraft(),
  overrides: Partial<HatEditFormValues> = {},
): HatEditFormValues {
  return { ...hatDraftToEditFormValues(draft, sizingRows), ...overrides };
}

describe("hatPatternEdit", () => {
  it("populates edit fields from the current draft (not builder defaults)", () => {
    const draft = completeDraft({
      brimLength: "1.75",
      fit: "slouchy",
      crownShaping: "spiral",
      gaugeSlots: { inches: { stitch: "4.5", row: "6.5" }, cm: { stitch: "", row: "" } },
    });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.brimLength).toBe("1.75");
    expect(form.fit).toBe("slouchy");
    expect(form.finishedHatLength).toBe("12.9");
    expect(form.crownShaping).toBe("spiral");
    expect(form.stitchGauge).toBe("4.5");
    expect(form.rowGauge).toBe("6.5");
    expect(form.finishedCircumference).toBeTruthy();
    expect(Number(form.finishedCircumference)).toBeGreaterThan(0);
  });

  it("loads named fit preset length (not chart hatLength) so Summary/Edit matches the diagram", () => {
    // adult_woman Standard is 11"; slouchy scales to 12.9".
    const draft = completeDraft({ fit: "slouchy", sizeSel: "adult_woman" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(form.finishedHatLength).toBe("12.9");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.hatHeight).toBe(12.9);
    expect(result.summary.lengthLabel).toContain('12.9"');
  });

  it("keeps named fit when Summary/Edit length matches the fit preset on update", () => {
    const draft = completeDraft({ fit: "slouchy", sizeSel: "adult_woman" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.finishedHatLength).toBe("12.9");
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.fit).toBe("slouchy");
    expect(resolved.customHatLength).toBe("");
  });

  it("promotes to custom when length matches chart but not the selected fit preset", () => {
    const form = formFromDraft(completeDraft({ fit: "beanie", sizeSel: "adult_woman" }), {
      finishedHatLength: "11", // adult_woman Standard, not beanie 9.1"
    });
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.fit).toBe("custom");
    expect(resolved.customHatLength).toBe("11");
  });

  it("exposes circumference, length, brim, stitch gauge, and row gauge as editable inputs", () => {
    const form = formFromDraft();
    expect(form).toMatchObject({
      finishedCircumference: expect.any(String),
      finishedHatLength: expect.any(String),
      brimLength: expect.any(String),
      stitchGauge: expect.any(String),
      rowGauge: expect.any(String),
    });
    expect(form.crownShaping).toBe("gathered");
    expect(["rolled", "single", "folded"]).toContain(form.brimType);
  });

  it("keeps crown style and other builder choices available for all three crowns", () => {
    for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
      const form = formFromDraft(completeDraft({ crownShaping: crown }));
      const check = validateHatEditForm(form, sizingRows);
      expect(check.ok).toBe(true);
      if (check.ok) {
        expect(check.draft.crownShaping).toBe(crown);
      }
    }
  });

  it("Update Path: apply + writeHatDraft + existing hat math recalculates the pattern", () => {
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    const previous = completeDraft({ brimLength: "2" });
    writeHatDraft(previous, mem);
    const before = buildHatPatternCalcFromDraft(previous, sizingRows);
    expect(before.ok).toBe(true);

    const form = formFromDraft(previous, { brimLength: "2.5", finishedHatLength: "9" });
    form.fit = "watchcap";
    const check = validateHatEditForm(form, sizingRows);
    expect(check.ok).toBe(true);
    if (!check.ok) return;

    const next = applyHatEditFormToDraft(previous, form, sizingRows);
    writeHatDraft(next, mem);
    const saved = readHatDraft(mem);
    expect(saved?.brimLength).toBe("2.5");
    expect(saved?.fit).toBe("custom");
    expect(saved?.customHatLength).toBe("9");

    const after = buildHatPatternCalcFromDraft(saved, sizingRows);
    expect(after.ok).toBe(true);
    if (!after.ok || !before.ok) return;
    expect(after.calc.brimDepth).toBe(2.5);
    expect(after.calc.hatHeight).toBe(9);
    expect(after.calc.brimDepth).not.toBe(before.calc.brimDepth);
    expect(after.calc.hatHeight).not.toBe(before.calc.hatHeight);
  });

  it("invalid values fail validation without requiring a draft write", () => {
    const form = formFromDraft(completeDraft(), {
      finishedCircumference: "0",
      sizeSel: "custom",
      brimLength: "",
    });
    const check = validateHatEditForm(form, sizingRows);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.errors.finishedCircumference || check.errors.form).toBeTruthy();
    expect(check.errors.brimLength || check.errors.form).toBeTruthy();
  });

  it("available-needle capacity blocks an invalid update", () => {
    const form = formFromDraft(completeDraft({ availableNeedles: "10" }));
    const check = validateHatEditForm(form, sizingRows);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.errors.availableNeedles).toMatch(/requires/i);
    expect(check.errors.form).toMatch(/requires/i);
  });

  it("Cancel leaves the draft unchanged (no write) and returns to finished pattern", () => {
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    const saved = completeDraft({ brimLength: "2" });
    writeHatDraft(saved, mem);
    const abandoned = formFromDraft(saved, { brimLength: "9.9" });
    // Cancel: do not writeHatDraft — navigate back to finished pattern.
    expect(HAT_PATTERN_HREF).toBe("/patterns/hat/pattern/");
    const reopened = hatDraftToEditFormValues(readHatDraft(mem)!, sizingRows);
    expect(reopened.brimLength).toBe("2");
    expect(abandoned.brimLength).toBe("9.9");
  });

  it("inch and metric drafts populate and round-trip through apply", () => {
    const inch = completeDraft({ unit: "inches", brimLength: "2" });
    const inchForm = hatDraftToEditFormValues(inch, sizingRows);
    expect(inchForm.unit).toBe("inches");
    expect(inchForm.brimLength).toBe("2");

    const cmDraft = completeDraft({
      unit: "cm",
      sizeSel: "custom",
      customCircumference: "52",
      fit: "custom",
      customHatLength: "22",
      brimLength: "5",
      gaugeSlots: {
        inches: { stitch: "", row: "" },
        cm: { stitch: "20", row: "28" },
      },
    });
    const cmForm = hatDraftToEditFormValues(cmDraft, sizingRows);
    expect(cmForm.unit).toBe("cm");
    expect(cmForm.finishedCircumference).toBe("52");
    expect(cmForm.finishedHatLength).toBe("22");
    expect(cmForm.brimLength).toBe("5");
    expect(cmForm.stitchGauge).toBe("20");
    const check = validateHatEditForm(cmForm, sizingRows);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const applied = applyHatEditFormToDraft(cmDraft, cmForm, sizingRows);
    const result = buildHatPatternCalcFromDraft(applied, sizingRows);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.unit).toBe("cm");
  });

  it("older compatible drafts with legacy crown still load safely", () => {
    const draft = completeDraft({ crownShaping: "wedge-4" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.crownShaping).toBe("wedge-4-decrease");
    const check = validateHatEditForm(form, sizingRows);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.draft.crownShaping).toBe("wedge-4-decrease");
  });

  it("unchanged inputs produce the same calculateHatPattern results", () => {
    const draft = completeDraft({ crownShaping: "wedge-4-decrease" });
    const before = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    const form = hatDraftToEditFormValues(draft, sizingRows);
    const afterDraft = applyHatEditFormToDraft(draft, form, sizingRows);
    const after = buildHatPatternCalcFromDraft(afterDraft, sizingRows);
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(after.calc.castOnSts).toBe(before.calc.castOnSts);
    expect(after.calc.brimRows).toBe(before.calc.brimRows);
    expect(after.calc.bodyRows).toBe(before.calc.bodyRows);
    expect(after.calc.crownRowCount).toBe(before.calc.crownRowCount);
    expect(after.calc.hatHeight).toBe(before.calc.hatHeight);
  });

  it("convertHatEditLengthDisplay converts between units", () => {
    expect(convertHatEditLengthDisplay("2", "inches", "cm")).toBe("5.1");
    expect(convertHatEditLengthDisplay("5.1", "cm", "inches")).toBe("2");
  });

  it("resolveHatEditSizeAndLength promotes chart size to custom when circ changes", () => {
    const form = formFromDraft();
    form.finishedCircumference = "99";
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.sizeSel).toBe("custom");
    expect(resolved.customCircumference).toBe("99");
  });

  it("keeps chart size when Finished hat size still matches the chart", () => {
    const form = formFromDraft();
    const chart = form.finishedCircumference;
    form.finishedCircumference = chart;
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.sizeSel).toBe("adult_woman");
    expect(resolved.customCircumference).toBe("");
  });

  it("stays custom when circ matches a chart size after already being custom", () => {
    const chart = hatDraftToEditFormValues(completeDraft(), sizingRows).finishedCircumference;
    const form = formFromDraft(completeDraft({ sizeSel: "custom", customCircumference: chart }), {
      sizeSel: "custom",
      finishedCircumference: chart,
    });
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.sizeSel).toBe("custom");
    expect(resolved.customCircumference).toBe(chart);
  });

  it("uses shared overlay breakpoint and hat measurement targets", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toContain("700px");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.circumference).toBe("target_hat_circumference");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.length).toBe("target_hat_length");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.brimDepth).toBe("target_hat_brim");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.circumference).toBe("translate(-50%, 4px)");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.length).toBe("translate(calc(-100% - 6px), -50%)");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.brimDepth).toBe("translate(6px, -50%)");
  });
});

describe("buildHatSummaryEditPreview (live Summary/Edit diagram)", () => {
  const formatters = {
    convertLength: convertLength as (v: number, from: string, to: string) => number,
    formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
  };

  it("redraws Summary/Edit SVG for each brim type from unsaved form values", () => {
    const saved = completeDraft({ brimType: "single" });
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    writeHatDraft(saved, mem);

    for (const brimType of ["rolled", "single", "folded"] as const) {
      const form = formFromDraft(saved, { brimType });
      const preview = buildHatSummaryEditPreview(saved, form, sizingRows);
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      expect(preview.draft.brimType).toBe(brimType);
      const svg = buildHatPatternDiagramSvg(
        preview.calc,
        preview.unit,
        formatters,
        HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
      );
      expect(svg).toContain(`data-brim="${brimType}"`);
      expect(svg).toContain('data-hat-diagram-mode="summaryEdit"');
      expect(svg).toContain('id="target_hat_circumference"');
      expect(svg).toContain('id="target_hat_length"');
      expect(svg).toContain('id="target_hat_brim"');
    }

    expect(readHatDraft(mem)?.brimType).toBe("single");
  });

  it("redraws Summary/Edit SVG for each crown style from unsaved form values", () => {
    const saved = completeDraft({ crownShaping: "gathered" });
    for (const crown of ["gathered", "wedge-4-decrease", "spiral"] as const) {
      const form = formFromDraft(saved, { crownShaping: crown });
      const preview = buildHatSummaryEditPreview(saved, form, sizingRows);
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;
      expect(preview.draft.crownShaping).toBe(crown);
      const svg = buildHatPatternDiagramSvg(
        preview.calc,
        preview.unit,
        formatters,
        HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
      );
      expect(svg).toContain(`data-crown="${crown}"`);
    }
  });

  it("invalid intermediate input fails preview without writing and leaves saved draft intact", () => {
    const saved = completeDraft({ brimLength: "2" });
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    writeHatDraft(saved, mem);
    const ready = buildHatPatternCalcFromDraft(saved, sizingRows);
    expect(ready.ok).toBe(true);
    if (!ready.ok) return;
    const beforeSvg = buildHatPatternDiagramSvg(
      ready.calc,
      "inches",
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );

    const invalid = formFromDraft(saved, { brimLength: "" });
    const preview = buildHatSummaryEditPreview(saved, invalid, sizingRows);
    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.errors.brimLength || preview.errors.form).toBeTruthy();
    expect(readHatDraft(mem)?.brimLength).toBe("2");
    expect(beforeSvg).toContain('data-brim="single"');
    expect(beforeSvg).toContain('id="target_hat_brim"');
  });

  it("finished-pattern mode still includes construction counts after summary preview changes", () => {
    const saved = completeDraft({ brimType: "rolled", crownShaping: "spiral" });
    const form = formFromDraft(saved, {
      brimType: "folded",
      crownShaping: "wedge-4-decrease",
    });
    const preview = buildHatSummaryEditPreview(saved, form, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const summarySvg = buildHatPatternDiagramSvg(
      preview.calc,
      preview.unit,
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    const patternSvg = buildHatPatternDiagramSvg(preview.calc, preview.unit, formatters);
    expect(summarySvg).toContain('data-hat-diagram-mode="summaryEdit"');
    expect(summarySvg).not.toMatch(/\d+\s*sts/);
    expect(patternSvg).toContain('data-hat-diagram-mode="pattern"');
    expect(patternSvg).toMatch(/\d+ sts/);
    expect(patternSvg).toMatch(/\d+ rows/);
  });
});

describe("Finished hat length preset selection on Summary/Edit", () => {
  const formatters = {
    convertLength: convertLength as (v: number, from: string, to: string) => number,
    formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
  };

  const adultWomanPresets = [
    ["beanie", 9.1],
    ["watchcap", 11],
    ["slouchy", 12.9],
  ] as const;

  it("Beanie displays and calculates from size-scaled length for Adult Woman", () => {
    const saved = completeDraft({ sizeSel: "adult_woman", fit: "watchcap" });
    const form = formFromDraft(saved, { fit: "beanie", finishedHatLength: "9.1" });
    const preview = buildHatSummaryEditPreview(saved, form, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.draft.fit).toBe("beanie");
    expect(preview.draft.customHatLength).toBe("");
    expect(preview.calc.hatHeight).toBe(9.1);
    expect(preview.calc.bodyHeightInches).toBeCloseTo(
      9.1 - preview.calc.crownHeightInches - Number(saved.brimLength),
      5,
    );
  });

  it("every named preset loads its own size-scaled finished length", () => {
    for (const [fit, inches] of adultWomanPresets) {
      const draft = completeDraft({ sizeSel: "adult_woman", fit });
      const form = hatDraftToEditFormValues(draft, sizingRows);
      expect(form.finishedHatLength, fit).toBe(String(inches));
      const result = buildHatPatternCalcFromDraft(draft, sizingRows);
      expect(result.ok, fit).toBe(true);
      if (!result.ok) continue;
      expect(result.calc.hatHeight, fit).toBe(inches);
    }
  });

  it("maps a stored Relaxed draft onto Standard in the edit form", () => {
    const draft = completeDraft({ sizeSel: "adult_woman", fit: "relaxed" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.fit).toBe("watchcap");
    expect(form.finishedHatLength).toBe("11");
  });

  it("changing between presets changes live preview height", () => {
    const saved = completeDraft({ sizeSel: "adult_woman", fit: "beanie" });
    const beanie = buildHatSummaryEditPreview(
      saved,
      formFromDraft(saved, { fit: "beanie", finishedHatLength: "9.1" }),
      sizingRows,
    );
    const slouchy = buildHatSummaryEditPreview(
      saved,
      formFromDraft(saved, { fit: "slouchy", finishedHatLength: "12.9" }),
      sizingRows,
    );
    expect(beanie.ok && slouchy.ok).toBe(true);
    if (!beanie.ok || !slouchy.ok) return;
    expect(slouchy.calc.hatHeight).toBeGreaterThan(beanie.calc.hatHeight);
    expect(slouchy.calc.bodyRows).toBeGreaterThan(beanie.calc.bodyRows);
    expect(slouchy.calc.bodyHeightInches).toBeGreaterThan(beanie.calc.bodyHeightInches);

    const beanieSvg = buildHatPatternDiagramSvg(
      beanie.calc,
      beanie.unit,
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    const slouchySvg = buildHatPatternDiagramSvg(
      slouchy.calc,
      slouchy.unit,
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    expect(beanieSvg).toContain('data-hat-diagram-mode="summaryEdit"');
    expect(slouchySvg).toContain('data-hat-diagram-mode="summaryEdit"');
    expect(beanieSvg).not.toMatch(/\d+\s*rows/);
    const beaniePattern = buildHatPatternDiagramSvg(beanie.calc, beanie.unit, formatters);
    const slouchyPattern = buildHatPatternDiagramSvg(slouchy.calc, slouchy.unit, formatters);
    expect(beaniePattern).toContain(formatLengthWithUnit(9.1, "inches"));
    expect(slouchyPattern).toContain(formatLengthWithUnit(12.9, "inches"));
    expect(slouchyPattern).toContain(`${slouchy.calc.bodyRows} rows`);
    expect(beaniePattern).toContain(`${beanie.calc.bodyRows} rows`);
    expect(slouchy.calc.bodyRows).not.toBe(beanie.calc.bodyRows);
  });

  it("manual length becomes Custom and size chart does not override an explicit fit", () => {
    const saved = completeDraft({ sizeSel: "adult_woman", fit: "beanie" });
    const manual = formFromDraft(saved, {
      fit: "beanie",
      finishedHatLength: "12",
    });
    const resolved = resolveHatEditSizeAndLength(manual, sizingRows);
    expect(resolved.fit).toBe("custom");
    expect(resolved.customHatLength).toBe("12");

    const preview = buildHatSummaryEditPreview(saved, manual, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.calc.hatHeight).toBe(12);

    const beanieAgain = formFromDraft(saved, { fit: "beanie", finishedHatLength: "9.1" });
    const kept = resolveHatEditSizeAndLength(beanieAgain, sizingRows);
    expect(kept.fit).toBe("beanie");
    expect(kept.customHatLength).toBe("");
    const beaniePreview = buildHatSummaryEditPreview(saved, beanieAgain, sizingRows);
    expect(beaniePreview.ok).toBe(true);
    if (!beaniePreview.ok) return;
    expect(beaniePreview.calc.hatHeight).toBe(9.1);
  });

  it("changing size recalculates an active named style", () => {
    const saved = completeDraft({ sizeSel: "adult_woman", fit: "beanie" });
    const adultForm = hatDraftToEditFormValues(saved, sizingRows);
    expect(adultForm.finishedHatLength).toBe("9.1");

    const preemieCirc = hatDraftToEditFormValues(
      completeDraft({ sizeSel: "preemie" }),
      sizingRows,
    ).finishedCircumference;
    const preemieForm = formFromDraft(saved, {
      sizeSel: "preemie",
      finishedCircumference: preemieCirc,
      fit: "beanie",
      finishedHatLength: "4.1",
    });
    const preview = buildHatSummaryEditPreview(saved, preemieForm, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.draft.fit).toBe("beanie");
    expect(preview.calc.hatHeight).toBe(4.1);
    expect(preview.calc.hatHeight).not.toBe(9.1);
  });

  it("changing size does not overwrite a Custom finished length", () => {
    const saved = completeDraft({
      sizeSel: "adult_woman",
      fit: "custom",
      customHatLength: "7.25",
    });
    const preemieCirc = hatDraftToEditFormValues(
      completeDraft({ sizeSel: "preemie" }),
      sizingRows,
    ).finishedCircumference;
    const form = formFromDraft(saved, {
      sizeSel: "preemie",
      finishedCircumference: preemieCirc,
      fit: "custom",
      finishedHatLength: "7.25",
    });
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.fit).toBe("custom");
    expect(resolved.customHatLength).toBe("7.25");
    const preview = buildHatSummaryEditPreview(saved, form, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.calc.hatHeight).toBe(7.25);
  });

  it("builder and Summary/Edit resolve identical lengths for the same size + style", () => {
    for (const sizeSel of ["preemie", "adult_woman"] as const) {
      for (const fit of ["beanie", "watchcap", "slouchy"] as const) {
        const draft = completeDraft({ sizeSel, fit });
        const form = hatDraftToEditFormValues(draft, sizingRows);
        const fromDraft = buildHatPatternCalcFromDraft(draft, sizingRows);
        const fromEdit = buildHatSummaryEditPreview(draft, form, sizingRows);
        expect(fromDraft.ok && fromEdit.ok, `${sizeSel}/${fit}`).toBe(true);
        if (!fromDraft.ok || !fromEdit.ok) continue;
        expect(fromEdit.calc.hatHeight, `${sizeSel}/${fit}`).toBe(fromDraft.calc.hatHeight);
        expect(form.finishedHatLength, `${sizeSel}/${fit}`).toBe(String(fromDraft.calc.hatHeight));
      }
    }
  });

  it("folded hems do not add visible brim height twice to finished length", () => {
    const visible = 1;
    const folded = completeDraft({
      sizeSel: "adult_woman",
      fit: "beanie",
      brimType: "folded",
      brimLength: String(visible),
    });
    const single = completeDraft({
      sizeSel: "adult_woman",
      fit: "beanie",
      brimType: "single",
      brimLength: String(visible),
    });
    const foldedResult = buildHatPatternCalcFromDraft(folded, sizingRows);
    const singleResult = buildHatPatternCalcFromDraft(single, sizingRows);
    expect(foldedResult.ok && singleResult.ok).toBe(true);
    if (!foldedResult.ok || !singleResult.ok) return;
    expect(foldedResult.calc.hatHeight).toBe(9.1);
    expect(singleResult.calc.hatHeight).toBe(9.1);
    expect(foldedResult.calc.bodyHeightInches).toBeCloseTo(singleResult.calc.bodyHeightInches, 5);
    expect(foldedResult.calc.bodyRows).toBe(singleResult.calc.bodyRows);
    expect(foldedResult.calc.brimRows).toBe(singleResult.calc.brimRows * 2);
  });

  it("finished-pattern rows are calculated from the resolved total length", () => {
    const saved = completeDraft({ sizeSel: "adult_woman", fit: "watchcap" });
    const form = formFromDraft(saved, { fit: "beanie", finishedHatLength: "9.1" });
    const updated = applyHatEditFormToDraft(saved, form, sizingRows);
    expect(updated.fit).toBe("beanie");
    const fromDraft = buildHatPatternCalcFromDraft(updated, sizingRows);
    expect(fromDraft.ok).toBe(true);
    if (!fromDraft.ok) return;
    expect(fromDraft.calc.hatHeight).toBe(9.1);
    expect(fromDraft.summary.lengthLabel).toMatch(/Beanie/i);
    expect(fromDraft.summary.lengthLabel).toContain('9.1"');
    const patternSvg = buildHatPatternDiagramSvg(fromDraft.calc, fromDraft.unit, formatters);
    expect(patternSvg).toContain(formatLengthWithUnit(9.1, "inches"));
    expect(fromDraft.calc.bodyRows).toBeGreaterThan(0);
    expect(fromDraft.calc.bodyHeightInches).toBeCloseTo(
      9.1 - fromDraft.calc.crownHeightInches - Number(updated.brimLength),
      5,
    );
  });

  it("Summary/Edit fit change handler loads fitPresetLengthDisplay (not chart length)", () => {
    const summaryScript = readFileSync(
      resolve("src/scripts/hat-pattern-summary-page.ts"),
      "utf8",
    );
    expect(summaryScript).toContain("fitPresetLengthDisplay");
    expect(summaryScript).toContain("populateFitOptions(activeUnit, fit, size)");
    const fitStart = summaryScript.indexOf('fitSelect?.addEventListener("change"');
    expect(fitStart).toBeGreaterThan(-1);
    const fitFn = summaryScript.slice(fitStart, fitStart + 450);
    expect(fitFn).toContain("fitPresetLengthDisplay");
    expect(fitFn).toContain("sizeSelect?.value");
  });
});

describe("Finished hat size recalculation on Summary/Edit", () => {
  const formatters = {
    convertLength: convertLength as (v: number, from: string, to: string) => number,
    formatLengthWithUnit: formatLengthWithUnit as (v: number, unit: string) => string,
  };

  function bodyWidth(svg: string): number {
    const m = svg.match(/class="hat-diagram__body"[^>]*\swidth="([\d.]+)"/);
    expect(m).toBeTruthy();
    return Number(m![1]);
  }

  it("changing Finished hat size recalculates cast-on, crown, needles, preview width, and pattern output", () => {
    const saved = completeDraft({
      crownShaping: "wedge-4-decrease",
      availableNeedles: "200",
    });
    const baseForm = formFromDraft(saved);
    const basePreview = buildHatSummaryEditPreview(saved, baseForm, sizingRows);
    expect(basePreview.ok).toBe(true);
    if (!basePreview.ok) return;

    const largerForm = formFromDraft(saved, {
      sizeSel: "adult_woman",
      finishedCircumference: "28",
    });
    const larger = buildHatSummaryEditPreview(saved, largerForm, sizingRows);
    expect(larger.ok).toBe(true);
    if (!larger.ok) return;

    // Custom size promotion + circumference-driven stitch math.
    expect(larger.draft.sizeSel).toBe("custom");
    expect(larger.draft.customCircumference).toBe("28");
    expect(larger.calc.targetWidth).toBe(28);
    expect(larger.calc.castOnSts).toBeGreaterThan(basePreview.calc.castOnSts);

    // Crown / gore planning follows the new cast-on (÷4 after crown normalization).
    const baseAdjusted = applyHatCrownCastOnAdjustment(
      basePreview.calc.castOnSts,
      "wedge-4-decrease",
    );
    const largerAdjusted = applyHatCrownCastOnAdjustment(
      larger.calc.castOnSts,
      "wedge-4-decrease",
    );
    const baseGore = baseAdjusted / 4;
    const largerGore = largerAdjusted / 4;
    expect(baseGore).toBeGreaterThan(0);
    expect(largerGore).toBeGreaterThan(baseGore);
    expect(larger.calc.crownPlan).toBeTruthy();

    // Needle-capacity revalidation: needles that fit the chart hat fail for 28".
    expect(largerAdjusted).toBeGreaterThan(baseAdjusted);
    const fitsBase = formFromDraft(saved, {
      availableNeedles: String(baseAdjusted),
    });
    expect(buildHatSummaryEditPreview(saved, fitsBase, sizingRows).ok).toBe(true);
    const tooTight = formFromDraft(saved, {
      finishedCircumference: "28",
      availableNeedles: String(baseAdjusted),
    });
    const blocked = buildHatSummaryEditPreview(saved, tooTight, sizingRows);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.errors.availableNeedles || blocked.errors.form).toMatch(/requires/i);

    // Preview silhouette widens with circumference; Summary/Edit stays count-free.
    const baseSvg = buildHatPatternDiagramSvg(
      basePreview.calc,
      basePreview.unit,
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    const largerSvg = buildHatPatternDiagramSvg(
      larger.calc,
      larger.unit,
      formatters,
      HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT,
    );
    expect(bodyWidth(largerSvg)).toBeGreaterThan(bodyWidth(baseSvg));
    expect(largerSvg).not.toMatch(/\d+\s*sts/);
    expect(largerSvg).not.toMatch(/\d+\s*rows/);

    // Finished-pattern diagram + instructions use the recalculated counts.
    const patternSvg = buildHatPatternDiagramSvg(larger.calc, larger.unit, formatters);
    expect(patternSvg).toContain(`${larger.calc.castOnSts} sts`);
    expect(patternSvg).toContain(`${largerGore} sts / gore`);

    // Live preview must not write the draft.
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    writeHatDraft(saved, mem);
    void buildHatSummaryEditPreview(saved, largerForm, sizingRows);
    expect(readHatDraft(mem)?.sizeSel).toBe("adult_woman");
    expect(readHatDraft(mem)?.customCircumference || "").toBe("");

    // Update / View My Pattern path applies the form and matches preview math.
    const updated = applyHatEditFormToDraft(saved, largerForm, sizingRows);
    const fromDraft = buildHatPatternCalcFromDraft(updated, sizingRows);
    expect(fromDraft.ok).toBe(true);
    if (!fromDraft.ok) return;
    expect(fromDraft.calc.castOnSts).toBe(larger.calc.castOnSts);
    expect(
      applyHatCrownCastOnAdjustment(fromDraft.calc.castOnSts, "wedge-4-decrease") / 4,
    ).toBe(largerGore);
  });

  it("chart size selection loads that chart’s finished circumference", () => {
    const woman = hatDraftToEditFormValues(completeDraft({ sizeSel: "adult_woman" }), sizingRows);
    const child = hatDraftToEditFormValues(completeDraft({ sizeSel: "child" }), sizingRows);
    const man = hatDraftToEditFormValues(completeDraft({ sizeSel: "adult_man" }), sizingRows);
    expect(Number(woman.finishedCircumference)).toBe(20.5);
    expect(Number(child.finishedCircumference)).toBe(18);
    expect(Number(man.finishedCircumference)).toBe(21.5);
    expect(woman.finishedCircumference).not.toBe(child.finishedCircumference);
  });

  it("unit conversion preserves the underlying physical finished size", () => {
    const inchesForm = formFromDraft();
    const inchesCirc = Number(inchesForm.finishedCircumference);
    const cmDisplay = convertHatEditLengthDisplay(
      inchesForm.finishedCircumference,
      "inches",
      "cm",
    );
    const back = convertHatEditLengthDisplay(cmDisplay, "cm", "inches");
    expect(Number(back)).toBeCloseTo(inchesCirc, 5);

    const cmForm: HatEditFormValues = {
      ...inchesForm,
      unit: "cm",
      sizeSel: "custom",
      finishedCircumference: cmDisplay,
    };
    const preview = buildHatSummaryEditPreview(completeDraft(), cmForm, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    // Display rounding to cm can introduce ~0.01" — physical size stays effectively the same.
    expect(preview.calc.targetWidth).toBeCloseTo(inchesCirc, 1);
  });

  it("Cancel contract leaves the saved draft unchanged (no write on discard)", () => {
    const summaryScript = readFileSync(
      resolve("src/scripts/hat-pattern-summary-page.ts"),
      "utf8",
    );
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    const cancelFn = summaryScript.slice(cancelStart, cancelStart + 120);
    expect(cancelFn).not.toContain("writeHatDraft");
    const navigateCancel = summaryScript.indexOf("function navigateAfterCancel");
    const navigateFn = summaryScript.slice(navigateCancel, navigateCancel + 280);
    expect(navigateFn).toContain("Discard");
    expect(navigateFn).not.toContain("writeHatDraft");
  });
});

describe("finished hat length includes visible brim once", () => {
  const FINISHED = 12.9; // adult_woman slouchy (size-scaled)
  const VISIBLE_BRIM = 1;

  const diagramFormatters = {
    convertLength: convertLength as (value: number, from: string, to: string) => number,
    formatLengthWithUnit: formatLengthWithUnit as (value: number, unit: string) => string,
  };

  for (const brimType of ["rolled", "single", "folded"] as const) {
    it(`${brimType}: Summary/Edit, diagram, and body math agree on ${FINISHED}" finished length`, () => {
      const draft = completeDraft({
        sizeSel: "adult_woman",
        fit: "slouchy",
        brimType,
        brimLength: String(VISIBLE_BRIM),
        crownShaping: "wedge-4-decrease",
      });

      const form = hatDraftToEditFormValues(draft, sizingRows);
      expect(form.finishedHatLength).toBe(String(FINISHED));

      const result = buildHatPatternCalcFromDraft(draft, sizingRows);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.calc.hatHeight).toBe(FINISHED);
      expect(result.calc.brimDepth).toBe(VISIBLE_BRIM);
      expect(result.summary.lengthLabel).toContain(`${FINISHED}"`);

      // Body = finished − crown depth − visible brim (once).
      expect(result.calc.bodyHeightInches).toBeCloseTo(
        result.calc.hatHeight - result.calc.crownHeightInches - VISIBLE_BRIM,
        5,
      );

      const svg = buildHatPatternDiagramSvg(result.calc, "inches", diagramFormatters);
      expect(svg).toContain(formatLengthWithUnit(FINISHED, "inches"));

      if (brimType === "folded") {
        const singleResult = buildHatPatternCalcFromDraft(
          completeDraft({
            sizeSel: "adult_woman",
            fit: "slouchy",
            brimType: "single",
            brimLength: String(VISIBLE_BRIM),
            crownShaping: "wedge-4-decrease",
          }),
          sizingRows,
        );
        expect(singleResult.ok).toBe(true);
        if (!singleResult.ok) return;
        // Folded doubles knitting rows only; finished length and body rows stay the same.
        expect(result.calc.hatHeight).toBe(singleResult.calc.hatHeight);
        expect(result.calc.bodyRows).toBe(singleResult.calc.bodyRows);
        expect(result.calc.brimRows).toBe(singleResult.calc.brimRows * 2);
      }

      // Update without changing length must not shorten or lengthen the hat.
      const afterDraft = applyHatEditFormToDraft(draft, form, sizingRows);
      expect(afterDraft.fit).toBe("slouchy");
      expect(afterDraft.customHatLength).toBe("");
      const after = buildHatPatternCalcFromDraft(afterDraft, sizingRows);
      expect(after.ok).toBe(true);
      if (!after.ok) return;
      expect(after.calc.hatHeight).toBe(FINISHED);
      expect(after.calc.bodyRows).toBe(result.calc.bodyRows);
      expect(after.calc.brimRows).toBe(result.calc.brimRows);
    });
  }

  it("does not double-count brim when draft already stores total finished length as custom", () => {
    const draft = completeDraft({
      sizeSel: "custom",
      customCircumference: "20",
      fit: "custom",
      customHatLength: String(FINISHED),
      brimType: "single",
      brimLength: String(VISIBLE_BRIM),
      crownShaping: "gathered",
    });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.finishedHatLength).toBe(String(FINISHED));
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.hatHeight).toBe(FINISHED);
    // Gathered: crown depth 0 → body = finished − visible brim once.
    expect(result.calc.bodyHeightInches).toBeCloseTo(FINISHED - VISIBLE_BRIM, 5);
  });
});

describe("hat Summary/Edit page wiring", () => {
  const patternPage = readFileSync(
    resolve("src/pages/patterns/hat/pattern.astro"),
    "utf8",
  );
  const summaryPage = readFileSync(
    resolve("src/pages/patterns/hat/summary/index.astro"),
    "utf8",
  );
  const builderPage = readFileSync(
    resolve("src/pages/patterns/hat/builder.astro"),
    "utf8",
  );
  const builderScript = readFileSync(resolve("src/scripts/hat-builder-page.ts"), "utf8");
  const pageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
  const summaryScript = readFileSync(
    resolve("src/scripts/hat-pattern-summary-page.ts"),
    "utf8",
  );
  const sleevelessPatternPage = readFileSync(
    resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
    "utf8",
  );
  const summaryWorkspace = readFileSync(
    resolve("src/components/patterns/PatternSummaryEditWorkspace.astro"),
    "utf8",
  );
  const summaryWorkspaceCss = readFileSync(
    resolve("src/styles/patterns/pattern-summary-edit-workspace.css"),
    "utf8",
  );
  const hatMeasureFields = readFileSync(
    resolve("src/lib/patterns/hat/hatPatternEditTargets.ts"),
    "utf8",
  );

  it("completing the builder opens Summary/Edit, not the finished pattern", () => {
    expect(builderPage).toContain("Review My Pattern");
    expect(builderScript).toContain("buildHatSummaryEditFromBuilderHref");
    expect(builderScript).toContain("HAT_SUMMARY_FROM_BUILDER_HREF");
    expect(builderScript).toMatch(/location\.assign\(HAT_SUMMARY_FROM_BUILDER_HREF\)/);
    expect(builderScript).not.toMatch(/location\.assign\([^)]*hat\/pattern/);
    expect(HAT_SUMMARY_EDIT_FROM_BUILDER_HREF).toBe("/patterns/hat/summary/?generated=1");
  });

  it("Edit Pattern opens the same Summary/Edit page in edit mode", () => {
    expect(HAT_SUMMARY_EDIT_HREF).toBe("/patterns/hat/summary/");
    expect(HAT_SUMMARY_EDIT_FROM_PATTERN_HREF).toBe("/patterns/hat/summary/?edit=1");
    expect(patternPage).toContain("HAT_SUMMARY_EDIT_FROM_PATTERN_HREF");
    expect(patternPage).toContain('data-testid="button-edit-pattern"');
    expect(patternPage).toContain("data-hat-edit-open");
    expect(patternPage).not.toContain("data-hat-edit-drawer");
    expect(pageScript).not.toContain("initHatPatternEditDrawer");
    expect(resolveHatSummaryEntryPath("?edit=1")).toBe("from-finished-pattern");
    expect(resolveHatSummaryEntryPath("?generated=1")).toBe("from-builder");
    expect(resolveHatSummaryEntryPath("")).toBe("from-finished-pattern");
  });

  it("no edit drawer remains on the finished pattern page", () => {
    expect(patternPage).not.toContain("data-hat-edit-drawer");
    expect(patternPage).not.toContain("hat-edit-drawer-open");
    expect(patternPage).not.toContain("aria-controls=\"hat-edit-drawer-panel\"");
    expect(patternPage).not.toContain("data-hat-edit-panel");
  });

  it("Summary/Edit page restores every field and matches sweater workspace layout", () => {
    expect(summaryPage).toContain('data-testid="hat-summary-edit-page"');
    expect(summaryPage).toContain("PatternSummaryEditWorkspace");
    expect(summaryWorkspace).toContain("sl-edit-workspace__layout");
    expect(summaryWorkspace).toContain("sl-edit-workspace__quick");
    expect(summaryWorkspace).toContain("sl-edit-workspace__measure");
    expect(summaryPage).toContain("Pattern choices");
    expect(summaryPage).toContain("Update Pattern");
    expect(summaryPage).toContain("data-hat-edit-cancel");
    expect(summaryPage).toContain("data-hat-edit-update");
    expect(summaryPage).toContain("data-hat-edit-size");
    expect(summaryPage).toContain("data-hat-edit-fit");
    expect(summaryPage).toContain("data-hat-edit-brim-type");
    expect(summaryPage).toContain("data-hat-edit-crown");
    expect(summaryPage).toContain("data-hat-edit-stitch-gauge");
    expect(summaryPage).toContain("data-hat-edit-row-gauge");
    expect(summaryPage).toContain("data-hat-edit-available-needles");
    expect(hatMeasureFields).toContain("data-hat-edit-circ");
    expect(hatMeasureFields).toContain("data-hat-edit-length");
    expect(hatMeasureFields).toContain("data-hat-edit-brim");
    expect(hatMeasureFields).toContain('target_hat_circumference');
    expect(hatMeasureFields).toContain('target_hat_length');
    expect(hatMeasureFields).toContain('target_hat_brim');
    expect(hatMeasureFields).toContain("HAT_EDIT_MEASUREMENT_TRANSFORMS");
    expect(summaryPage).toContain("data-hat-edit-title");
    expect(summaryPage).toContain("data-hat-edit-title-field hidden");
    expect(summaryPage).toContain("PatternProjectDetails");
    expect(summaryPage).toContain("data-hat-edit-notes");
    expect(summaryPage).toContain("pattern-editable-pencil.css");
    expect(sleevelessPatternPage).toContain("pattern-editable-pencil.css");
    expect(sleevelessPatternPage).toContain("pattern-editable-heading");
    expect(summaryScript).toContain("hatSummaryShouldShowProjectDetails");
    expect(summaryScript).toContain("readHatActiveProjectId");
    expect(summaryScript).not.toContain("isEditingSavedCustomPatternProject");
    expect(sleevelessPatternPage).toContain("PatternSummaryEditWorkspace");
    expect(summaryWorkspace).toContain("sl-edit-workspace__measure-actions");
    expect(summaryPage).not.toContain("720px");
    expect(summaryWorkspaceCss).toContain("max-width: min(100%, 1000px)");
    expect(summaryWorkspaceCss).not.toContain("calc(100vh -");
  });

  it("measurement overlays use desktop positioning; fields stack on narrow screens", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toContain("700px");
    expect(summaryWorkspaceCss).toContain('data-measurement-overlay-mode="mobile"');
    expect(summaryWorkspaceCss).toContain("@container sl-edit-workspace (min-width: 1100px)");
    expect(summaryWorkspaceCss).toContain("@container sl-edit-workspace (max-width: 1099.98px)");
    expect(summaryScript).toContain("bindPatternSummaryOverlayPositioning");
    expect(summaryScript).toContain("hatDraftToEditFormValues");
    expect(summaryScript).toContain("HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT");
    expect(summaryScript).toContain("buildHatPatternDiagramSvg");
    expect(summaryScript).toContain("refreshLivePreview");
    expect(summaryScript).toContain("buildHatSummaryEditPreview");
    expect(summaryScript).toContain("rebindMeasurementOverlay");
    expect(summaryScript).toContain("teardownOverlay");
    expect(summaryScript).toContain("setPrimaryEnabled");
    expect(pageScript).toContain("buildHatPatternDiagramSvg");
    expect(pageScript).toContain("buildHatShapingNotationDiagramSvg");
    expect(pageScript).toContain("buildHatPatternDiagramTabsShellHtml");
    expect(pageScript).not.toContain("HAT_PATTERN_DIAGRAM_MODE_SUMMARY_EDIT");
    expect(pageScript).not.toContain("refreshLivePreview");
    // Live preview must not write the draft (only Update / View My Pattern writes).
    const refreshStart = summaryScript.indexOf("function refreshLivePreview");
    expect(refreshStart).toBeGreaterThan(-1);
    const refreshFn = summaryScript.slice(refreshStart, refreshStart + 700);
    expect(refreshFn).toContain("buildHatSummaryEditPreview");
    expect(refreshFn).not.toContain("writeHatDraft");
    expect(refreshFn).toContain("mountDiagramFromCalc");
    expect(refreshFn).toContain("setPrimaryEnabled(false)");
    // Unit switch converts displayed lengths; it must not reload chart circ/length
    // (that would wipe a custom Finished hat size while the dropdown still named a chart).
    const switchStart = summaryScript.indexOf("function switchUnit");
    expect(switchStart).toBeGreaterThan(-1);
    const switchFn = summaryScript.slice(switchStart, switchStart + 1200);
    expect(switchFn).toContain("convertHatEditLengthDisplay");
    expect(switchFn).not.toContain("chartSizeCircumferenceDisplay");
    expect(switchFn).not.toContain("resolvedFinishedHatLengthDisplay");
    // Desktop stage keeps the SVG large — no oversized chip gutters.
    expect(summaryPage).not.toContain("8.5rem");
    expect(summaryPage).not.toContain("padding: 0.35rem 8.5rem 5rem");
    expect(summaryWorkspaceCss).toMatch(
      /\.ps-measure-stage__inner\s*\{[^}]*padding:\s*0\.15rem;/s,
    );
    expect(summaryWorkspaceCss).toMatch(
      /\[data-measurement-overlay-mode="mobile"\][^{]*\{[^}]*position:\s*static/s,
    );
    expect(summaryWorkspaceCss).toContain("flex-direction: column");
  });

  it("initial Summary/Edit action writes the draft; guests open the finished pattern", () => {
    expect(hatSummaryPrimaryLabel("from-builder")).toBe(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL);
    expect(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL).toBe("View My Pattern");
    expect(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL.toLowerCase()).not.toContain("save");
    expect(summaryScript).toContain("resolveHatSummaryEntryPath");
    expect(summaryScript).toContain("resolveHatPatternPersistActionFromViewer");
    expect(summaryScript).toContain("persistHatPatternProject");
    expect(summaryScript).toContain("navigateAfterPrimarySuccess");
    expect(summaryScript).toContain("continueAfterPersist");
    expect(summaryScript).toContain("hatSummaryPrimarySuccessHref");
    expect(summaryScript).toContain("validateHatEditForm");
    expect(summaryScript).toContain("writeHatDraft");
    const writeStart = summaryScript.indexOf("function writeCurrentSummaryDraft");
    expect(writeStart).toBeGreaterThan(-1);
    const updateStart = summaryScript.indexOf("async function updatePattern");
    expect(updateStart).toBeGreaterThan(writeStart);
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    const writeFn = summaryScript.slice(
      writeStart,
      updateStart > writeStart ? updateStart : writeStart + 2500,
    );
    const updateFn = summaryScript.slice(
      updateStart,
      cancelStart > updateStart ? cancelStart : updateStart + 2500,
    );
    expect(writeFn).toContain("validateHatEditForm");
    expect(writeFn).toContain("applyHatEditFormToDraft");
    expect(writeFn).toContain("writeHatDraft");
    expect(writeFn).toContain("applyHatPatternProjectDetailsToDraft");
    expect(writeFn).not.toContain("persistHatPatternProject");
    expect(updateFn).toContain("writeCurrentSummaryDraft");
    expect(updateFn).toContain("persistHatPatternProject");
    expect(updateFn).toContain("promptEditPatternSaveConfirmation");
    expect(updateFn).toContain("continueAfterPersist");
  });

  it("member Save / Update stays on Summary/Edit until View Updated Pattern", () => {
    const updateStart = summaryScript.indexOf("async function updatePattern");
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    const updateFn = summaryScript.slice(
      updateStart,
      cancelStart > updateStart ? cancelStart : updateStart + 2500,
    );
    expect(updateFn).toContain("promptEditPatternSaveConfirmation");
    expect(updateFn).toContain('confirmationChoice === "view"');
    expect(updateFn).toContain("navigateAfterPrimarySuccess");
    expect(updateFn).toContain("resolveHatSummaryAfterPersistNext");
    expect(updateFn).not.toMatch(
      /applyPersistChrome\(\);\s*await continueAfterPersist\(\)/,
    );
  });

  it("guest email continuation rewrites the current summary values before navigating", () => {
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    const previous = completeDraft({ brimLength: "2" });
    writeHatDraft(previous, mem);
    expect(readHatDraft(mem)?.brimLength).toBe("2");

    const edited = formFromDraft(previous, { brimLength: "2.5", finishedHatLength: "9" });
    edited.fit = "watchcap";
    const check = validateHatEditForm(edited, sizingRows);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const next = applyHatEditFormToDraft(previous, edited, sizingRows);
    writeHatDraft(next, mem);

    const saved = readHatDraft(mem);
    expect(saved?.brimLength).toBe("2.5");
    expect(saved?.customHatLength).toBe("9");
    const finished = buildHatPatternCalcFromDraft(saved, sizingRows);
    expect(finished.ok).toBe(true);
    if (!finished.ok) return;
    expect(finished.calc.brimDepth).toBe(2.5);
    expect(finished.calc.hatHeight).toBe(9);

    const bindStart = summaryScript.indexOf("bindHatLeadForm(root");
    expect(bindStart).toBeGreaterThan(-1);
    const bindFn = summaryScript.slice(bindStart, bindStart + 220);
    expect(bindFn).toContain("writeCurrentSummaryDraft");
    expect(bindFn).toContain("navigateAfterPrimarySuccess");
    expect(bindFn).not.toContain("persistHatPatternProject");
    expect(bindFn).not.toContain("continueAfterPersist");
  });

  it("Cancel returns to the correct location based on the entry path", () => {
    expect(hatSummaryCancelHref("from-builder")).toBe("/patterns/hat/builder");
    expect(hatSummaryCancelHref("from-finished-pattern")).toBe(HAT_PATTERN_HREF);
    expect(HAT_SUMMARY_CANCEL_FROM_BUILDER_LABEL).toBe("Back to Builder");
    expect(HAT_SUMMARY_CANCEL_FROM_EDIT_LABEL).toBe("Cancel");
    expect(HAT_SUMMARY_PRIMARY_FROM_EDIT_LABEL).toBe("Update Pattern");
    expect(summaryScript).toContain("navigateAfterCancel");
    expect(summaryScript).toContain("hatSummaryCancelHref");
    const cancelStart = summaryScript.indexOf("function cancelEdit");
    expect(cancelStart).toBeGreaterThan(-1);
    const cancelFn = summaryScript.slice(cancelStart, cancelStart + 120);
    expect(cancelFn).toContain("navigateAfterCancel");
    expect(cancelFn).not.toContain("writeHatDraft");
  });

  it("free users can complete builder → Summary/Edit → finished-pattern without membership", () => {
    expect(summaryScript).not.toContain("resolvePatternWorkspaceSettingsEditGate");
    expect(summaryScript).not.toContain("blockPatternWorkspaceSettingsEditOrOfferUnlock");
    expect(summaryScript).not.toContain("hasSystemAccess");
    expect(builderScript).not.toContain("resolveExpressBuilderPostBuildHref");
    expect(builderScript).toContain("HAT_SUMMARY_FROM_BUILDER_HREF");
    // Primary label must not imply My Patterns save for free users.
    expect(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL).toBe("View My Pattern");
    expect(summaryScript).toContain("resolveHatPatternLeadContinue");
    expect(summaryScript).not.toContain("SleevelessPatternMemberGate");
    expect(summaryScript).not.toContain("PatternBuilderAccountGate");
  });

  it("missing draft follows the same empty-state behavior as the finished pattern page", () => {
    expect(summaryScript).toContain("buildHatPatternCalcFromDraft");
    expect(summaryScript).toContain("showEmptyState");
    expect(summaryPage).toContain("data-hat-summary-empty");
    expect(summaryPage).toContain("Go to Hat Builder");
    expect(patternPage).toContain("data-hat-pattern-empty");
  });

  it("preserves Planning Ribbing tip and related hat instruction features", () => {
    const instructions = readFileSync(
      resolve("src/lib/patterns/hat/hatInstructions.ts"),
      "utf8",
    );
    const planningRibbing = readFileSync(
      resolve("src/lib/patterns/hat/hatPlanningRibbingVideoTip.ts"),
      "utf8",
    );
    expect(instructions).toContain("buildHatPlanningRibbingBrimTipHtml");
    expect(instructions).not.toContain("Choose Your Brim");
    expect(instructions).not.toContain("hatChooseYourBrim");
    expect(instructions).toContain("buildHatGatheredTopVideoHtml");
    expect(instructions).toContain("buildHatMattressStitchVideoHtml");
    expect(planningRibbing).toMatch(/Planning Ribbing|2211/);
  });

  it("does not rewrite hat math — calculateHatPattern remains the engine", () => {
    const fromDraft = readFileSync(
      resolve("src/lib/patterns/hat/hatPatternFromDraft.ts"),
      "utf8",
    );
    expect(fromDraft).toContain("calculateHatPattern");
    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 2,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    expect(calc.castOnSts).toBeGreaterThan(0);
  });
});
