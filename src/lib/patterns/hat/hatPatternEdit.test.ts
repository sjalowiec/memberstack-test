import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptyHatDraft, writeHatDraft, readHatDraft } from "./hatDraft";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { calculateHatPattern } from "./hatMath";
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
    expect(form.finishedHatLength).toBe("11");
    expect(form.crownShaping).toBe("spiral");
    expect(form.stitchGauge).toBe("4.5");
    expect(form.rowGauge).toBe("6.5");
    expect(form.finishedCircumference).toBeTruthy();
    expect(Number(form.finishedCircumference)).toBeGreaterThan(0);
  });

  it("loads chart finished length (not bare fit preset) so Summary/Edit matches the diagram", () => {
    // adult_woman chart hatLength is 11"; slouchy fit preset alone is 10".
    const draft = completeDraft({ fit: "slouchy", sizeSel: "adult_woman" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    const result = buildHatPatternCalcFromDraft(draft, sizingRows);
    expect(form.finishedHatLength).toBe("11");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.hatHeight).toBe(11);
    expect(result.summary.lengthLabel).toContain('11"');
  });

  it("keeps named fit when Summary/Edit length matches chart hatLength on update", () => {
    const draft = completeDraft({ fit: "slouchy", sizeSel: "adult_woman" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.finishedHatLength).toBe("11");
    const resolved = resolveHatEditSizeAndLength(form, sizingRows);
    expect(resolved.fit).toBe("slouchy");
    expect(resolved.customHatLength).toBe("");
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

  it("uses shared overlay breakpoint and hat measurement targets", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toContain("700px");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.circumference).toBe("target_hat_circumference");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.length).toBe("target_hat_length");
    expect(HAT_EDIT_MEASUREMENT_TARGETS.brimDepth).toBe("target_hat_brim");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.circumference).toBe("translate(-50%, 8px)");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.length).toBe("translate(-50%, -50%)");
    expect(HAT_EDIT_MEASUREMENT_TRANSFORMS.brimDepth).toBe("translate(8px, -50%)");
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

describe("finished hat length includes visible brim once", () => {
  const FINISHED = 11;
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
    expect(summaryPage).toContain("sl-edit-workspace__layout");
    expect(summaryPage).toContain("sl-edit-workspace__quick");
    expect(summaryPage).toContain("sl-edit-workspace__measure");
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
    expect(summaryPage).toContain("data-hat-edit-circ");
    expect(summaryPage).toContain("data-hat-edit-length");
    expect(summaryPage).toContain("data-hat-edit-brim");
    expect(summaryPage).toContain('data-measurement-target="target_hat_circumference"');
    expect(summaryPage).toContain('data-measurement-target="target_hat_length"');
    expect(summaryPage).toContain('data-measurement-target="target_hat_brim"');
    expect(summaryPage).toContain("data-measurement-transform=");
    expect(summaryPage).not.toContain("PatternEditablePencilIcon");
    expect(summaryPage).not.toContain("pattern-editable-pencil-icon");
    expect(sleevelessPatternPage).toContain("sl-edit-workspace__layout");
    expect(sleevelessPatternPage).toContain("sl-edit-workspace__measure-actions");
    expect(summaryPage).toContain("sl-edit-workspace__measure-actions");
    // Compact diagram sizing (sweater-like viewport cap), not the prior 720px stage.
    expect(summaryPage).toContain("calc(100vh - 260px)");
    expect(summaryPage).toContain("560px");
    expect(summaryPage).not.toContain("720px");
  });

  it("measurement overlays use desktop positioning; fields stack on narrow screens", () => {
    expect(DESKTOP_MEASUREMENT_OVERLAY_MQ).toContain("700px");
    expect(summaryPage).toContain('data-measurement-overlay-mode="mobile"');
    expect(summaryPage).toContain("@media (min-width: 1000px)");
    expect(summaryPage).toContain("@media (max-width: 999px)");
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
    // Desktop stage keeps the SVG large — no oversized chip gutters.
    expect(summaryPage).not.toContain("8.5rem");
    expect(summaryPage).not.toContain("padding: 0.35rem 8.5rem 5rem");
    expect(summaryPage).toMatch(
      /\.hat-edit-mbp-stage__inner\s*\{[^}]*padding:\s*0\.15rem;/s,
    );
    // Mobile stack behavior unchanged (absolute chips cleared; static column).
    expect(summaryPage).toMatch(
      /\[data-measurement-overlay-mode="mobile"\][^{]*\{[^}]*position:\s*static/s,
    );
    expect(summaryPage).toContain("flex-direction: column");
  });

  it("initial Summary/Edit action creates and opens the finished pattern", () => {
    expect(hatSummaryPrimaryLabel("from-builder")).toBe(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL);
    expect(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL).toBe("View My Pattern");
    expect(HAT_SUMMARY_PRIMARY_FROM_BUILDER_LABEL.toLowerCase()).not.toContain("save");
    expect(summaryScript).toContain("resolveHatSummaryEntryPath");
    expect(summaryScript).toContain("hatSummaryPrimaryLabel");
    expect(summaryScript).toContain("navigateAfterPrimarySuccess");
    expect(summaryScript).toContain("hatSummaryPrimarySuccessHref");
    expect(summaryScript).toContain("validateHatEditForm");
    expect(summaryScript).toContain("writeHatDraft");
    const updateStart = summaryScript.indexOf("async function updatePattern");
    expect(updateStart).toBeGreaterThan(-1);
    const updateFn = summaryScript.slice(updateStart, updateStart + 900);
    expect(updateFn).toContain("writeHatDraft");
    expect(updateFn).toContain("navigateAfterPrimarySuccess");
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
