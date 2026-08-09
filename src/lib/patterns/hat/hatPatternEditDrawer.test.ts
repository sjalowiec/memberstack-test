import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptyHatDraft, writeHatDraft, readHatDraft } from "./hatDraft";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { calculateHatPattern } from "./hatMath";
import { buildHatPatternCalcFromDraft } from "./hatPatternFromDraft";
import {
  applyHatEditFormToDraft,
  convertHatEditLengthDisplay,
  hatDraftToEditFormValues,
  resolveHatEditSizeAndLength,
  validateHatEditForm,
  type HatEditFormValues,
  type HatEditSizingRow,
} from "./hatPatternEditDrawer";
import { HAT_EDIT_MEASUREMENT_TARGETS } from "./hatPatternEditTargets";
import { DESKTOP_MEASUREMENT_OVERLAY_MQ } from "../patternSummaryMeasurementOverlay";
import hatSizingRows from "../../../data/sizing_hats.json";

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

describe("hatPatternEditDrawer", () => {
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
    expect(form.finishedHatLength).toBe("10");
    expect(form.crownShaping).toBe("spiral");
    expect(form.stitchGauge).toBe("4.5");
    expect(form.rowGauge).toBe("6.5");
    expect(form.finishedCircumference).toBeTruthy();
    expect(Number(form.finishedCircumference)).toBeGreaterThan(0);
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
    expect(["single", "folded"]).toContain(form.brimType);
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
    // Changing length away from watchcap (8.5) → custom
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

  it("cancel semantics: abandoned form values are not written; reopen uses saved draft", () => {
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
    // Simulate cancel: do not writeHatDraft(abandoned)
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
  });
});

describe("hat Edit Pattern page wiring (no new route)", () => {
  const patternPage = readFileSync(
    resolve("src/pages/patterns/hat/pattern.astro"),
    "utf8",
  );
  const pageScript = readFileSync(resolve("src/scripts/hat-pattern-page.ts"), "utf8");
  const editScript = readFileSync(
    resolve("src/scripts/hat-pattern-edit-drawer.ts"),
    "utf8",
  );

  it("keeps Builder → Finished Pattern only (no summary/review route)", () => {
    expect(patternPage).toContain('href="/patterns/hat/builder"');
    expect(patternPage).not.toMatch(/\/patterns\/hat\/(summary|review)/);
    expect(patternPage).toContain("data-hat-edit-drawer");
    expect(patternPage).toContain("Update Pattern");
    expect(patternPage).toContain('data-measurement-target="target_hat_circumference"');
    expect(patternPage).toContain('data-measurement-target="target_hat_length"');
    expect(patternPage).toContain('data-measurement-target="target_hat_brim"');
  });

  it("Edit Pattern action opens the enhanced drawer and uses existing draft/math", () => {
    expect(pageScript).toContain("data-hat-edit-open");
    expect(pageScript).toContain("initHatPatternEditDrawer");
    expect(editScript).toContain("writeHatDraft");
    expect(editScript).toContain("buildHatPatternCalcFromDraft");
    expect(editScript).toContain("buildHatPatternDiagramSvg");
    expect(editScript).toContain("validateHatEditForm");
    expect(editScript).not.toContain("calculateHatPattern("); // no duplicated math path in drawer
  });

  it("preserves Choose Your Brim tip and related hat instruction features", () => {
    const instructions = readFileSync(
      resolve("src/lib/patterns/hat/hatInstructions.ts"),
      "utf8",
    );
    const chooseBrim = readFileSync(
      resolve("src/lib/patterns/hat/hatChooseYourBrim.ts"),
      "utf8",
    );
    expect(instructions).toContain("buildHatChooseYourBrimTipHtml");
    expect(chooseBrim).toContain("hat-choose-your-brim");
    expect(instructions).toContain("buildHatGatheredTopVideoHtml");
    expect(instructions).toContain("buildHatMattressStitchVideoHtml");
    expect(chooseBrim).toMatch(/Planning Ribbing|hatPlanningRibbing|2211/);
  });

  it("does not rewrite hat math — calculateHatPattern remains the engine", () => {
    const fromDraft = readFileSync(
      resolve("src/lib/patterns/hat/hatPatternFromDraft.ts"),
      "utf8",
    );
    expect(fromDraft).toContain("calculateHatPattern");
    // Sanity: engine still computes cast-on for a known input.
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
