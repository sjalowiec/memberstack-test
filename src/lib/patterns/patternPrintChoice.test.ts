import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PATTERN_PRINT_CHOICE_PDF_NOTE,
  PATTERN_PRINT_CHOICE_REMINDER,
  PATTERN_PRINT_CHOICES,
  PATTERN_PRINT_HIDE_TIPS_HELP,
  PATTERN_PRINT_HIDE_TIPS_LABEL,
  PATTERN_PRINT_PAGE_RANGE_NOTE,
  PATTERN_PRINT_SELECTED_PAGES_BACK,
  PATTERN_PRINT_SELECTED_PAGES_HREF,
  PATTERN_PRINT_SELECTED_PAGES_LINK,
} from "./patternPrintChoice";
import { renderPatternDisplayRowsHtml } from "./sleevelessPatternDisplayHtml";
import { renderSleevelessPrintPieceHtml } from "./sleevelessPatternPrintRender";
import { computeDefaultMeasurementsFromChartRow } from "./sleevelessExpressSizeChartClient";
import type { ChartRow } from "./sleevelessExpressSizeChartTypes";
import { generateSetInSleevePattern } from "./setInSleevePatternOutput";
import { withSetInSleeveConstructionAuthored } from "./setInSleeveConstructionIdentity";

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
    style: withSetInSleeveConstructionAuthored(
      {
        recipientCategory: "misses",
        garmentStyle: "pullover",
        neckline: "round",
        bodyShape,
      },
      "long",
    ),
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
    expect(PATTERN_PRINT_PAGE_RANGE_NOTE).toBe(
      "Only need a few pages? After you click Print, choose the page numbers you want in your print window.",
    );
    expect(PATTERN_PRINT_SELECTED_PAGES_LINK).toBe("How to print selected pages");
    expect(PATTERN_PRINT_SELECTED_PAGES_BACK).toBe("Back to print options");
    expect(PATTERN_PRINT_SELECTED_PAGES_HREF).toBe(
      "/help-hub/my-pattern-has-a-lot-of-pages-how-can-i-print-just-the-pages-i-want",
    );
    expect(PATTERN_PRINT_SELECTED_PAGES_HREF.startsWith("/")).toBe(true);
    expect(PATTERN_PRINT_SELECTED_PAGES_HREF).not.toMatch(/^https?:/);
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
    expect(dialog).toContain("PATTERN_PRINT_PAGE_RANGE_NOTE");
    expect(dialog).toContain("PATTERN_PRINT_SELECTED_PAGES_LINK");
    expect(dialog).toContain("PATTERN_PRINT_SELECTED_PAGES_HREF");
    expect(dialog).toContain("PATTERN_PRINT_SELECTED_PAGES_BACK");
    expect(dialog).toContain('data-pattern-print-selected-pages');
    expect(dialog).toContain('data-pattern-print-help-back');
    expect(dialog).toContain('data-pattern-print-help-frame');
    expect(dialog).toContain("showSelectedPagesHelp(dialog)");
    expect(dialog).toContain("returnToPrintOptions(dialog)");
    expect(dialog).toContain('querySelector<HTMLElement>("[data-pattern-print-selected-pages]")?.focus()');
    expect(dialog).toContain("frame.src = PATTERN_PRINT_SELECTED_PAGES_HREF");
    expect(dialog).not.toContain('target="_blank"');
    const tipsAt = dialog.indexOf("pattern-print-choice-dialog__tips");
    const pageRangeAt = dialog.indexOf("pattern-print-choice-dialog__page-range");
    const reminderAt = dialog.indexOf("pattern-print-choice-dialog__reminder");
    expect(tipsAt).toBeGreaterThan(-1);
    expect(pageRangeAt).toBeGreaterThan(tipsAt);
    expect(reminderAt).toBeGreaterThan(pageRangeAt);
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
    expect(css).toContain('html[data-pattern-print-choice="charts"] .pattern-print-chart-break');
    expect(css).toContain('html[data-pattern-print-choice="both"] .pattern-print-charts-appendix');
    expect(css).toContain("page-break-before: auto");
    expect(css).not.toContain(
      'html[data-pattern-print-choice="both"] .pattern-print-charts-appendix,\n  html[data-pattern-print-choice="both"] .pattern-print-chart-unit + .pattern-print-chart-unit',
    );
    expect(css).toContain("pattern-print-choice-dialog__page-range");
    expect(css).toContain("pattern-video-modal-link");
    expect(readFileSync("src/styles/print.css", "utf8")).toContain("pattern-print-choice.css");
    const tipsCss = readFileSync("src/styles/pattern-tips.css", "utf8");
    expect(tipsCss).toContain('html[data-pattern-print-include-tips="false"]');
    expect(tipsCss).toContain('html[data-pattern-print-include-tips="true"]');
    expect(tipsCss).toContain('html[data-pattern-print-choice="charts"]');
  });

  it("prints the on-screen neckline sentences without a paper-only essay", () => {
    const result = generateSetInSleevePattern(pattern());
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    const frontHtml = renderPatternDisplayRowsHtml(result.frontDisplayRows, { pieceSectionId: "front" });
    expect(html).toContain("Use the checklist below for row-by-row neckline and shoulder shaping.");
    expect(html).toContain('class="sleeveless-pattern-line pattern-print-checklist-pointer"');
    expect(html).toContain("pattern-print-written-shaping");
    expect(html).not.toContain("Work the First Shoulder and the neck edge first");
    expect(frontHtml).not.toContain("Work the First Shoulder and the neck edge first");
    const backPrint = printParagraphs(result.displayRows);
    const frontPrint = printParagraphs(result.frontDisplayRows);
    expect(backPrint).not.toMatch(/checklist/i);
    expect(frontPrint).not.toMatch(/checklist/i);
    expect(backPrint).toContain("COR means carriage on the right.");
    expect(frontPrint).toContain("COL means carriage on the left.");
    expect(backPrint.match(/COR means carriage on the right/g)).toHaveLength(1);
    expect(frontPrint.match(/COL means carriage on the left/g)).toHaveLength(1);
    expect(backPrint).toMatch(/RC: \d{3}/);
    expect(frontPrint).toMatch(/RC: \d{3}/);
    const printHtml = [
      renderSleevelessPrintPieceHtml(result.displayRows, "", "back"),
      renderSleevelessPrintPieceHtml(result.frontDisplayRows, "", "front"),
    ].join("\n");
    expect(printHtml).toContain("Use the checklist below for row-by-row neckline and shoulder shaping.");
    expect(printHtml).not.toContain("Work the First Shoulder and the neck edge first");
    expect(printHtml).toContain("pattern-print-written-shaping");
    expect(printHtml).not.toContain("pattern-print-written-shaping\" hidden");

    const sleeveText = result.sleeveDisplayRows
      .flatMap((row) => (row.kind === "block" ? row.paragraphs ?? [] : []))
      .join("\n");
    const sleeveChartRows = result.sleeveDisplayRows.flatMap((row) =>
      row.kind === "block" ? row.sleeveShapingChartRows ?? [] : [],
    );
    expect(sleeveChartRows.length).toBeGreaterThan(0);
    const increases = sleeveChartRows.filter((row) => /increase/i.test(row.action));
    expect(increases.length).toBeGreaterThan(0);
    for (const row of increases) {
      expect(sleeveText).toContain(String(row.rc).padStart(3, "0"));
    }
    const capBindOff = sleeveChartRows.find((row) => /bind off the remaining/i.test(row.action));
    expect(capBindOff).toBeTruthy();
    expect(sleeveText).toContain(capBindOff!.action);
  });

  it("keeps the A-line chart and does not rewrite it as print prose", () => {
    const result = generateSetInSleevePattern(pattern("aline"));
    const chartRows = result.displayRows.flatMap((row) =>
      row.kind === "block" ? row.bodyShapingChartRows ?? [] : [],
    );
    expect(chartRows.length).toBeGreaterThan(0);
    const html = renderPatternDisplayRowsHtml(result.displayRows, { pieceSectionId: "back" });
    expect(html).toContain("sleeveless-body-shaping-chart");
    expect(html).toContain("pattern-print-written-shaping");
    expect(html).not.toContain("A-line shaping readings");
  });
});
