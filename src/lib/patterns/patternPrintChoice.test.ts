import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PATTERN_PRINT_CHOICE_PDF_NOTE,
  PATTERN_PRINT_CHOICE_REMINDER,
  PATTERN_PRINT_CHOICES,
  PATTERN_PRINT_HIDE_TIPS_HELP,
  PATTERN_PRINT_HIDE_TIPS_LABEL,
} from "./patternPrintChoice";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

const MISSES_7: ChartRow = {
  bust_or_chest: 40,
  waist: 32,
  hip: 42,
  garment_back_length: 24.5,
  armhole_depth: 7.75,
  shoulder_width: 13.75,
  neck_opening: 7.5,
  front_neck_depth: 5,
  back_neck_depth: 1,
  upper_arm: 12,
  wrist: 6,
  sleeve_length: 17,
};

function pattern(bodyShape: "straight" | "aline" = "straight"): Record<string, unknown> {
  const measurements = computeDefaultMeasurementsFromChartRow(MISSES_7, "standard", { bodyShape });
  return {
    fit: {
      sizingChart: "misses",
      easeChoice: "standard",
      selectedMeasurements: measurements,
    },
    style: {
      recipientCategory: "misses",
      garmentStyle: "pullover",
      neckline: "round",
      bodyShape,
    },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function printParagraphs(rows: readonly { kind: string; printInstructionParagraphs?: string[] }[]): string {
  return rows
    .flatMap((row) => (row.kind === "block" ? row.printInstructionParagraphs ?? [] : []))
    .join("\n");
}

describe("pattern print choices", () => {
  it("names the three print options and the on-screen reminder", () => {
    expect(PATTERN_PRINT_CHOICES).toEqual([
      {
        id: "instructions",
        title: "Instructions only",
        explanation: "Instructions, notes, and schematics. No charts or checklists.",
      },
      {
        id: "charts",
        title: "Charts & checklists only",
        explanation: "Charts and checklists. No pattern instructions.",
      },
      {
        id: "both",
        title: "Complete pattern",
        explanation: "Instructions, notes, schematics, charts, and checklists.",
      },
    ]);
    expect(PATTERN_PRINT_CHOICE_PDF_NOTE).toBe(
      "The next step is your computer's print dialog. You can print the pattern or save it as a PDF.",
    );
    expect(PATTERN_PRINT_CHOICE_REMINDER).toBe(
      "You can also follow your pattern on a computer, tablet, or phone beside your knitting machine, with access to videos and interactive help.",
    );
    expect(PATTERN_PRINT_HIDE_TIPS_LABEL).toBe("Hide Pattern Tips");
    expect(PATTERN_PRINT_HIDE_TIPS_HELP).toBe("Uncheck to include tips.");
    const personalization = readFileSync("src/scripts/patternPrintPersonalization.ts", "utf8");
    expect(personalization).toContain("openPatternPrintChoiceDialog");
    expect(personalization).toContain("includeTips");
    expect(personalization).toContain("applyPatternPrintLayout");
    const dialog = readFileSync("src/scripts/patternPrintChoiceDialog.ts", "utf8");
    const choiceSource = readFileSync("src/lib/patterns/patternPrintChoice.ts", "utf8");
    expect(choiceSource).toContain("Hide Pattern Tips");
    expect(choiceSource).not.toContain("Use less paper");
    expect(choiceSource).not.toContain("written shaping");
    expect(choiceSource).not.toContain("Instructions + charts and checklists");
    expect(dialog).toContain("PATTERN_PRINT_HIDE_TIPS_LABEL");
    expect(dialog).toContain("PATTERN_PRINT_HIDE_TIPS_HELP");
    expect(dialog).toContain('name="pattern-print-hide-tips"');
    expect(dialog).toContain('data-pattern-print-hide-tips value="yes" checked');
    expect(dialog).toContain("box?.checked !== true");
    expect(dialog).toContain('const DEFAULT_PATTERN_PRINT_CHOICE: PatternPrintChoice = "instructions"');
    expect(dialog).toContain("resetDialogDefaults(dialog)");
    expect(dialog).toContain('input.checked = input.value === DEFAULT_PATTERN_PRINT_CHOICE');
    expect(dialog).toContain("hideTips.checked = true");
    expect(dialog).toContain('replaceAll("&", "&amp;")');
    const css = readFileSync("src/styles/patterns/pattern-print-choice.css", "utf8");
    expect(css).toContain('html[data-pattern-print-choice="instructions"]');
    expect(css).toContain('html[data-pattern-print-choice="charts"]');
    expect(css).toContain('html[data-pattern-print-choice="both"]');
    expect(css).toContain("table-header-group");
    expect(css).toContain("break-inside: avoid");
    expect(css).toContain("pattern-video-modal-link");
    expect(readFileSync("src/styles/print.css", "utf8")).toContain("pattern-print-choice.css");
    const tipsCss = readFileSync("src/styles/pattern-tips.css", "utf8");
    expect(tipsCss).toContain('html[data-pattern-print-include-tips="false"]');
    expect(tipsCss).toContain('html[data-pattern-print-include-tips="true"]');
    expect(tipsCss).toContain('html[data-pattern-print-choice="charts"]');
  });

  it("prints the on-screen neckline sentences without a paper-only essay", () => {
    const result = generateSleevelessBackPattern(pattern());
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    const frontHtml = renderPatternDisplayRowsHtml(result.frontDisplayRows, { pieceSectionId: "front" });
    expect(html).toContain("Use the checklist below for row-by-row neckline and shoulder shaping.");
    expect(html).toContain('class="sleeveless-pattern-line pattern-print-checklist-pointer"');
    expect(html).not.toContain("pattern-print-written-shaping");
    expect(html).not.toContain("Work the First Shoulder and the neck edge first");
    expect(frontHtml).not.toContain("Work the First Shoulder and the neck edge first");
    expect(printParagraphs(result.displayRows)).toBe("");
    expect(printParagraphs(result.frontDisplayRows)).toBe("");
    const printHtml = [
      renderSleevelessPrintPieceHtml(result.displayRows, "", "back"),
      renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front"),
    ].join("\n");
    expect(printHtml).toContain("Use the checklist below for row-by-row neckline and shoulder shaping.");
    expect(printHtml).not.toContain("Work the First Shoulder and the neck edge first");
    expect(printHtml).not.toContain("pattern-print-written-shaping");
  });

  it("keeps the A-line chart and does not rewrite it as print prose", () => {
    const result = generateSleevelessBackPattern(pattern("aline"));
    const chartRows = result.displayRows.flatMap((row) =>
      row.kind === "block" ? row.bodyShapingChartRows ?? [] : [],
    );
    expect(chartRows.length).toBeGreaterThan(0);
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    expect(html).toContain("sleeveless-body-shaping-chart");
    expect(html).not.toContain("pattern-print-written-shaping");
    expect(html).not.toContain("A-line shaping readings");
    expect(html).not.toContain("stitches remain");
  });
});
