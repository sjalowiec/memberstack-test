import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEmptySockDraft, type SockDraft } from "./sockDraft";
import { createSockSizingAdapter } from "./sockSizing";
import {
  SOCK_EDIT_MEASUREMENT_TARGETS,
  SOCK_EDIT_MEASUREMENT_TRANSFORMS,
  SOCK_SUMMARY_ART_SRC,
  SOCK_SUMMARY_CHIP_TARGET_POINTS,
  SOCK_SUMMARY_MEASUREMENT_FIELDS,
} from "./sockPatternEditTargets";
import {
  applySockSummaryMeasurementsToDraft,
  buildSockSummaryEditPreview,
  convertSockSummaryMeasurements,
  sockSummaryMeasureFieldsFromDraft,
  sockSummaryUnitSuffix,
} from "./sockSummaryEdit";

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

const summaryPage = readFileSync(resolve("src/pages/patterns/socks/summary/index.astro"), "utf8");
const summaryScript = readFileSync(resolve("src/scripts/socks-summary-page.ts"), "utf8");
const patternPage = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
const patternScript = readFileSync(resolve("src/scripts/socks-pattern-page.ts"), "utf8");
const hatSummaryPage = readFileSync(resolve("src/pages/patterns/hat/summary/index.astro"), "utf8");
const sleevelessPattern = readFileSync(
  resolve("src/pages/patterns/sleeveless/pattern/index.astro"),
  "utf8",
);
const dropShoulderPattern = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/pattern/index.astro"),
  "utf8",
);

describe("Socks Summary/Edit measurement chips", () => {
  it("uses the static single-sock Summary image, not the catalog thumbnail", () => {
    expect(SOCK_SUMMARY_ART_SRC).toBe("/images/patterns/socks-pattern-summary-transparent.webp");
    expect(existsSync(resolve("public/images/patterns/socks-pattern-summary-transparent.webp"))).toBe(true);
    expect(existsSync(resolve("public/images/patterns/socks-pattern-summary.webp"))).toBe(true);
    expect(summaryPage).toContain("SOCK_SUMMARY_ART_SRC");
    expect(summaryPage).toContain('data-socks-summary-art');
    expect(summaryPage).toContain("data-socks-summary-chip-targets");
    expect(summaryPage).not.toContain("socks-pattern-catalog.webp");
    expect(summaryScript).not.toContain("buildSockFinishedProfileSvg");
    expect(summaryScript).not.toContain("diagramHost.innerHTML");
    expect(summaryScript).not.toContain("finished-profile");
  });

  it("exposes exactly the four Perfect Fit chips on the shared overlay", () => {
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
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.targetId)).toEqual([
      SOCK_EDIT_MEASUREMENT_TARGETS.legLength,
      SOCK_EDIT_MEASUREMENT_TARGETS.legCircumference,
      SOCK_EDIT_MEASUREMENT_TARGETS.footLength,
      SOCK_EDIT_MEASUREMENT_TARGETS.footCircumference,
    ]);
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.inputDataAttr)).toEqual([
      "data-socks-edit-leg-length",
      "data-socks-edit-leg-circ",
      "data-socks-edit-foot-length",
      "data-socks-edit-foot-circ",
    ]);
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.every((field) => field.editable === true)).toBe(true);
    expect(SOCK_SUMMARY_MEASUREMENT_FIELDS.map((field) => field.errorKey)).not.toContain("ankle");
    expect(summaryPage).toContain("PatternSummaryMeasurementChip");
    expect(summaryPage).toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(summaryPage).toContain("data-socks-summary-overlay");
    expect(summaryPage).toContain("data-socks-summary-stage");
    expect(summaryPage).toContain(`id={SOCK_EDIT_MEASUREMENT_TARGETS.legLength}`);
    const diagramStart = summaryPage.indexOf('slot="diagram"');
    const diagramEnd = summaryPage.indexOf("</PatternSummaryDiagramStage>", diagramStart);
    const diagramSlot = summaryPage.slice(diagramStart, diagramEnd);
    expect(diagramSlot).toContain("PatternSummaryMeasurementChip");
    expect(diagramSlot).toContain('slot="art"');
    expect(diagramSlot).not.toContain("Heel depth");
    expect(diagramSlot).not.toContain("Straight ankle");
  });

  it("parks chips around the static sock, not on Pattern schematics", () => {
    expect(SOCK_EDIT_MEASUREMENT_TRANSFORMS.legLength).toContain("-100%");
    expect(SOCK_EDIT_MEASUREMENT_TRANSFORMS.legCircumference).toContain("-100%");
    expect(SOCK_EDIT_MEASUREMENT_TRANSFORMS.footLength).toContain("12px");
    expect(SOCK_EDIT_MEASUREMENT_TRANSFORMS.footCircumference).toContain("12px");
    expect(SOCK_SUMMARY_CHIP_TARGET_POINTS.legLength.x).toBeLessThan(
      SOCK_SUMMARY_CHIP_TARGET_POINTS.footCircumference.x,
    );
    expect(SOCK_SUMMARY_CHIP_TARGET_POINTS.legCircumference.y).toBeLessThan(
      SOCK_SUMMARY_CHIP_TARGET_POINTS.footLength.y,
    );
    expect(summaryScript).toContain("bindPatternSummaryOverlayPositioning");
    expect(summaryScript).toContain("collectOverlayAnchors");
    expect(summaryScript).toContain("rebindMeasurementOverlay");
    expect(patternScript).not.toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(patternScript).not.toContain("PatternSummaryMeasurementChip");
    expect(patternPage).not.toContain("data-socks-edit-foot-circ");
    expect(patternPage).not.toContain("socks-pattern-summary.webp");
    expect(patternScript).not.toContain("bindPatternSummaryOverlayPositioning");
  });

  it("shows the draft finished measurements and converts them with the active unit", () => {
    const inches = completeDraft();
    expect(sockSummaryMeasureFieldsFromDraft(inches)).toEqual({
      footCircumference: "8.5",
      footLength: "9",
      legCircumference: "8.5",
      legLength: "4.5",
    });
    expect(sockSummaryUnitSuffix("inches")).toBe('"');
    expect(sockSummaryUnitSuffix("cm")).toBe("cm");
    const cm = convertSockSummaryMeasurements(
      sockSummaryMeasureFieldsFromDraft(inches),
      "inches",
      "cm",
    );
    expect(Number(cm.footCircumference)).toBeCloseTo(8.5 * 2.54, 1);
    expect(Number(cm.footLength)).toBeCloseTo(9 * 2.54, 1);
    expect(Number(cm.legCircumference)).toBeCloseTo(8.5 * 2.54, 1);
    expect(Number(cm.legLength)).toBeCloseTo(4.5 * 2.54, 1);
    expect(summaryPage).toContain("data-socks-edit-units");
    expect(summaryPage).toContain('data-socks-edit-unit="inches"');
    expect(summaryPage).toContain('data-socks-edit-unit="cm"');
    expect(summaryScript).toContain("switchUnit");
    expect(summaryScript).toContain("convertSockSummaryMeasurements");
    expect(summaryScript).toContain("sockSummaryUnitSuffix");
    expect(summaryScript).toContain("data-socks-edit-unit-suffix");
  });

  it("updates the draft and calculation when a Perfect Fit chip changes", () => {
    const saved = completeDraft();
    const longerFoot = applySockSummaryMeasurementsToDraft(saved, {
      ...sockSummaryMeasureFieldsFromDraft(saved),
      footLength: "10.5",
    });
    const preview = buildSockSummaryEditPreview(
      saved,
      sockSummaryMeasureFieldsFromDraft(longerFoot),
      adapter,
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.draft.footLength).toBe("10.5");
    expect(preview.calc.footLengthInches).toBe(10.5);
    const baseline = buildSockSummaryEditPreview(
      saved,
      sockSummaryMeasureFieldsFromDraft(saved),
      adapter,
    );
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) return;
    expect(preview.calc.straightFootRows).toBeGreaterThan(baseline.calc.straightFootRows);
    expect(summaryScript).toContain("refreshFromChips");
    expect(summaryScript).toContain("writeSockDraft");
    expect(summaryScript).toContain('addEventListener("input"');
    expect(summaryScript).toContain("PATTERN_SUMMARY_MEASURE_CHIP_INVALID_CLASS");
    const refreshStart = summaryScript.indexOf("function refreshFromChips");
    const refreshFn = summaryScript.slice(refreshStart, refreshStart + 900);
    expect(refreshFn).toContain("buildSockSummaryEditPreview");
    expect(refreshFn).toContain("writeSockDraft");
    expect(refreshFn).toContain("applyReady");
    expect(refreshFn).not.toContain("innerHTML");
    expect(refreshFn).not.toContain("buildSockFinishedProfileSvg");
  });

  it("keeps the static sock image and overlay chips when measurements refresh", () => {
    expect(summaryScript).not.toContain("overlay.innerHTML");
    expect(summaryScript).toContain("rebindMeasurementOverlay");
    expect(summaryPage).toContain("PatternSummaryMeasurementChip");
    expect(summaryPage).toContain("SOCK_SUMMARY_ART_SRC");
    const applyStart = summaryScript.indexOf("function applyReady");
    const applyFn = summaryScript.slice(applyStart, applyStart + 400);
    expect(applyFn).toContain("renderSockSummaryView");
    expect(applyFn).not.toContain("innerHTML");
    expect(applyFn).not.toContain("buildSockFinishedProfileSvg");
  });

  it("keeps Pattern Stitches & Rows and Shaping Notation dynamic", () => {
    expect(patternScript).toContain("buildSockPatternDiagramSvg");
    expect(patternScript).toContain("buildSockShapingNotationDiagramSvg");
    expect(patternScript).toContain('mode: "pattern"');
    expect(patternPage).not.toContain("socks-pattern-summary.webp");
    expect(patternPage).not.toContain("socks-pattern-catalog.webp");
  });

  it("does not alter Sweater or Hat chip wiring", () => {
    expect(hatSummaryPage).toContain("HAT_SUMMARY_MEASUREMENT_FIELDS");
    expect(hatSummaryPage).not.toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(sleevelessPattern).not.toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(dropShoulderPattern).not.toContain("SOCK_SUMMARY_MEASUREMENT_FIELDS");
    expect(sleevelessPattern).toContain("PatternSummaryEditWorkspace");
    expect(dropShoulderPattern).toContain("PatternSummaryEditWorkspace");
  });
});
