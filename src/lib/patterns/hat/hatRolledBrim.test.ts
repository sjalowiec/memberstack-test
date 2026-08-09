import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  convertLength,
  formatLength,
} from "../../../components/wizards/utils/unitHelpers";
import { coerceHatDraft, createEmptyHatDraft, writeHatDraft, readHatDraft } from "./hatDraft";
import {
  calculateHatPattern,
  formatHatRolledBrimDefaultLength,
  hatBrimDisplayLabel,
  nextBrimLengthAfterBrimTypeChange,
} from "./hatMath";
import { buildHatPatternHtml } from "./hatInstructions";
import { buildHatPatternDiagramSvg } from "./hatPatternDiagramSvg";
import { buildHatPatternCalcFromDraft } from "./hatPatternFromDraft";
import {
  applyHatEditFormToDraft,
  hatDraftToEditFormValues,
  validateHatEditForm,
} from "./hatPatternEdit";
import { buildHatSizingBuilderRows } from "./hatBuilderSizingLabels";
import { isHatBuilderBrimComplete } from "./hatBuilderValidation";
import { HAT_PLANNING_RIBBING_VIDEO_TIP_ID } from "./hatPlanningRibbingVideoTip";
import hatSizingRows from "../../../data/sizing_hats.json";

const sizingRows = buildHatSizingBuilderRows(
  Array.isArray(hatSizingRows) ? hatSizingRows : [],
);

const formatters = {
  convertLength: convertLength as (v: number, from: string, to: string) => number,
  formatLength: formatLength as (v: number, unit: string) => string,
};

function completeDraft(
  overrides: Partial<ReturnType<typeof createEmptyHatDraft>> = {},
) {
  return createEmptyHatDraft({
    unit: "inches",
    sizeSel: "adult_woman",
    brimType: "rolled",
    brimLength: "1",
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

describe("Rolled Brim construction", () => {
  it("exposes Rolled Brim first in the builder picker with the existing image", () => {
    const builder = readFileSync(
      resolve(process.cwd(), "src/pages/patterns/hat/builder.astro"),
      "utf8",
    );
    const brimSelect = builder.slice(
      builder.indexOf('id="brimType"'),
      builder.indexOf("hat-builder-brim-length"),
    );
    expect(brimSelect).toContain('value="rolled"');
    expect(brimSelect).toContain("Rolled Brim");
    expect(brimSelect).toContain("/images/hats/rolled-brim.png");
    expect(brimSelect.indexOf('value="rolled"')).toBeLessThan(
      brimSelect.indexOf('value="single"'),
    );
    expect(brimSelect.indexOf('value="single"')).toBeLessThan(
      brimSelect.indexOf('value="folded"'),
    );

    const summary = readFileSync(
      resolve(process.cwd(), "src/pages/patterns/hat/summary/index.astro"),
      "utf8",
    );
    const editBrim = summary.slice(
      summary.indexOf("hat-edit-brim-type"),
      summary.indexOf("hat-edit-crown"),
    );
    expect(editBrim.indexOf('value="rolled"')).toBeLessThan(
      editBrim.indexOf('value="single"'),
    );
  });

  it("defaults to 1 inch (2.5 cm) only when Rolled Brim is newly selected", () => {
    expect(formatHatRolledBrimDefaultLength("inches")).toBe("1");
    expect(formatHatRolledBrimDefaultLength("cm")).toBe("2.5");
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "single",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBe("1");
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "folded",
        nextBrimType: "rolled",
        unit: "cm",
      }),
    ).toBe("2.5");
    // User already on rolled with an edited height — do not overwrite.
    expect(
      nextBrimLengthAfterBrimTypeChange({
        previousBrimType: "rolled",
        nextBrimType: "rolled",
        unit: "inches",
      }),
    ).toBeNull();
  });

  it("validates, labels, and calculates rolled as its own type", () => {
    expect(isHatBuilderBrimComplete({ brimType: "rolled", brimLength: "1" })).toBe(true);
    expect(hatBrimDisplayLabel("rolled")).toBe("Rolled Brim");

    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 1,
      brimType: "rolled",
      crown: "gathered",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    expect(calc.brimType).toBe("rolled");
    // Same row formula as single (not folded doubling).
    expect(calc.brimRows).toBe(2);
    // Selected rolled height is included in finished length; body subtracts it once.
    expect(calc.hatHeight).toBe(8.5);
    expect(calc.bodyHeightInches).toBe(7.5);

    const singleCalc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 1,
      brimType: "single",
      crown: "gathered",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    expect(calc.brimRows).toBe(singleCalc.brimRows);
    expect(calc.bodyRows).toBe(singleCalc.bodyRows);
  });

  it("saves and restores rolled brim drafts; keeps single/folded unchanged", () => {
    const storage: Record<string, string> = {};
    const mem = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v;
      },
    };
    writeHatDraft(completeDraft({ brimLength: "1.5" }), mem);
    const restored = readHatDraft(mem);
    expect(restored?.brimType).toBe("rolled");
    expect(restored?.brimLength).toBe("1.5");

    const result = buildHatPatternCalcFromDraft(restored, sizingRows);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.calc.brimType).toBe("rolled");
    expect(result.summary.brimLabel).toContain("Rolled Brim");

    // Backward compatible: drafts without rolled still coerce single/folded.
    expect(coerceHatDraft(completeDraft({ brimType: "single" }))?.brimType).toBe("single");
    expect(coerceHatDraft(completeDraft({ brimType: "folded" }))?.brimType).toBe("folded");
    expect(coerceHatDraft(completeDraft({ brimType: "legacy-x" }))?.brimType).toBe("");
  });

  it("updates Edit Pattern form for rolled brim", () => {
    const draft = completeDraft({ brimLength: "1.25" });
    const form = hatDraftToEditFormValues(draft, sizingRows);
    expect(form.brimType).toBe("rolled");
    expect(form.brimLength).toBe("1.25");

    const nextForm = { ...form, brimLength: "1.75" };
    const check = validateHatEditForm(nextForm, sizingRows);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    const applied = applyHatEditFormToDraft(draft, nextForm, sizingRows);
    expect(applied.brimType).toBe("rolled");
    expect(applied.brimLength).toBe("1.75");

    const preview = buildHatPatternCalcFromDraft(applied, sizingRows);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.calc.brimType).toBe("rolled");
    expect(preview.calc.brimDepth).toBe(1.75);
  });

  it("generates rolled-brim stockinette instructions and diagram labels", () => {
    const calc = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 1,
      brimType: "rolled",
      crown: "gathered",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    const html = buildHatPatternHtml({
      calc,
      currentUnit: "inches",
      scrapOffPatternTooltip: "scrap",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    });
    expect(html).toContain("Rolled Brim");
    expect(html).toContain(`Work ${calc.brimRows} rows in stockinette`);
    expect(html).toContain("roll naturally");
    expect(html).toContain("after the rolled brim");
    expect(html).not.toContain("chosen brim finish");
    expect(html).not.toContain("ribbing");
    expect(html).not.toContain("hung hem");
    expect(html).not.toContain("hat-folded-brim-length");
    expect(html).not.toContain("Choose Your Brim");
    expect(html).not.toContain(HAT_PLANNING_RIBBING_VIDEO_TIP_ID);

    // Body begins after rolled rows (crown RC includes brim + body).
    expect(html).toContain(`Begin crown shaping at RC ${calc.brimRows + calc.bodyRows}`);

    const svg = buildHatPatternDiagramSvg(calc, "inches", {
      convertLength,
      formatLengthWithUnit: (v, u) => (u === "cm" ? `${v}cm` : `${v}"`),
    });
    expect(svg).toContain('data-brim="rolled"');
    expect(svg).toContain(">Rolled Brim<");
  });

  it("preserves existing single and folded instruction behavior", () => {
    const single = calculateHatPattern({
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
    const folded = calculateHatPattern({
      finishedHatCircInches: 20.5,
      stitchGaugeDisplay: 5,
      rowGaugeDisplay: 7,
      displayUnit: "inches",
      totalHatLengthInches: 8.5,
      brimDepthInches: 2,
      brimType: "folded",
      crown: "gathered",
      suggestedCrownDepthInches: 2.5,
      fit: "watchcap",
    });
    expect(folded.brimRows).toBe(single.brimRows * 2);
    const singleHtml = buildHatPatternHtml({
      calc: single,
      currentUnit: "inches",
      scrapOffPatternTooltip: "scrap",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    });
    const foldedHtml = buildHatPatternHtml({
      calc: folded,
      currentUnit: "inches",
      scrapOffPatternTooltip: "scrap",
      tipsIntroHtml: "",
      showTips: true,
      formatters,
    });
    expect(singleHtml).toContain("chosen brim finish");
    expect(singleHtml).toContain(HAT_PLANNING_RIBBING_VIDEO_TIP_ID);
    expect(singleHtml).not.toContain("Choose Your Brim");
    expect(foldedHtml).toContain("hat-folded-brim-length");
    expect(foldedHtml).toContain(HAT_PLANNING_RIBBING_VIDEO_TIP_ID);
    expect(foldedHtml).not.toContain("Choose Your Brim");
  });
});
