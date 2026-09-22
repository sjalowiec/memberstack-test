import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PATTERN_TIP_MEDIA_NO_PRINT_CLASS } from "./patternExplainerVideoTip";
import { PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS } from "./patternEssentialDisclosurePrint";
import { buildPatternHelpCardInnerHtml } from "./patternHelpCard";
import { buildPatternQuickTipInnerHtml } from "./patternQuickTip";
import { renderDropShoulderSleeveShapingChartHtml } from "./dropShoulderSleeveShapingChart";
import {
  armholeLocalRcActiveShoulderChecklistStart,
  renderNeckShoulderShapingChartTableOnlyHtml,
} from "./neckShoulderShapingChartHtml";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function printBlock(css: string): string {
  const match = css.match(/@media print\s*\{[\s\S]*/);
  return match?.[0] ?? "";
}

function firstDetailsOpenTag(html: string): string {
  return html.match(/<details\b[^>]*>/)?.[0] ?? "";
}

function baseRoundNeckPattern(): Record<string, unknown> {
  return {
    fit: {
      sizingChart: "misses",
      selectedMeasurements: {
        finished_bust_chest: 40,
        back_neck_to_hem: 22,
        armhole_depth: 8,
        neck_opening: 3,
        shoulder_width: 4.25,
        front_neck_depth: 3,
        back_neck_depth: 1,
      },
    },
    style: { recipientCategory: "misses", neckline: "round" },
    yarnGaugeMachine: {
      gaugeStitchesPerInch: 5,
      gaugeRowsPerInch: 7,
      availableNeedles: 200,
    },
  };
}

function collapsedBackShoulderChecklistHtml(): string {
  const r = generateSleevelessBackPattern(baseRoundNeckPattern());
  const chart = r.neckShoulderShapingChart;
  const rcStart = armholeLocalRcActiveShoulderChecklistStart(chart, r.firstArmholeGarmentRc, {
    includeCenterNecklineSetupRow: true,
  });
  return renderNeckShoulderShapingChartTableOnlyHtml(chart, "print-regression-back", undefined, {
    activeSideOnly: true,
    activeSideRcStart: rcStart,
    includeCenterNecklineSetupRow: true,
    hideCenterNecklineSetupRow: true,
    tableHeading: "First Shoulder Checklist",
  });
}

describe("essential shaping disclosures print even when collapsed on screen", () => {
  const html = collapsedBackShoulderChecklistHtml();
  const sharedDisclosureCss = readWorkspaceFile(
    "src/styles/patterns/pattern-essential-disclosure-print.css",
  );
  const nsShapingChartCss = readWorkspaceFile("src/styles/ns-shaping-chart.css");
  const printCssImport = readWorkspaceFile("src/styles/print.css");
  const tooltipPrintCss = printBlock(readWorkspaceFile("src/styles/tooltip-print.css"));
  const patternTipsPrintCss = printBlock(readWorkspaceFile("src/styles/pattern-tips.css"));
  const helpCardCss = readWorkspaceFile("src/styles/pattern-help-card.css");
  const pageNotice = readWorkspaceFile("src/components/patterns/SleevelessPatternPrintNotice.astro");
  const pageScript = readWorkspaceFile("src/scripts/sleevelessPatternPageShared.ts");

  it("keeps the First Shoulder Checklist collapsed on screen while still emitting both tables", () => {
    const firstOpen = firstDetailsOpenTag(html);
    expect(firstOpen).toContain("ns-shaping-chart--collapsible");
    expect(firstOpen).toContain(PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS);
    expect(firstOpen).not.toMatch(/\sopen(\s|=|>)/);
    expect(html).toContain("First Shoulder Checklist");
    expect(html).toContain("Second Shoulder Checklist");
    expect(html).toContain("ns-shaping-chart__table--checklist");
    expect(html.match(/<tbody>[\s\S]*?<\/tbody>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/<td class="ns-shaping-chart__td-rc">/);
  });

  it("forces collapsed essential disclosure bodies visible under print CSS", () => {
    expect(printCssImport).toContain('pattern-essential-disclosure-print.css');
    const sharedPrintRules = sharedDisclosureCss.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sharedPrintRules).toMatch(/@media print/);
    expect(sharedPrintRules).toContain(`details.${PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS}::details-content`);
    expect(sharedPrintRules).toMatch(/content-visibility:\s*visible\s*!important/);
    expect(sharedPrintRules).not.toContain("pattern-help-card");
    expect(sharedPrintRules).not.toContain("pattern-quick-tip");
    expect(sharedPrintRules).not.toContain("glossary-tooltip-popup");

    const chartPrintCss = printBlock(nsShapingChartCss);
    expect(chartPrintCss).toMatch(
      /\.ns-shaping-chart--collapsible::details-content[\s\S]*content-visibility:\s*visible\s*!important/,
    );
    const screenCss = nsShapingChartCss.replace(chartPrintCss, "");
    expect(screenCss).not.toMatch(/::details-content[\s\S]*content-visibility:\s*visible/);
    expect(screenCss).toMatch(/\.ns-shaping-chart__disclosure-header[\s\S]*cursor:\s*pointer/);
  });

  it("does not print optional interactive help, videos, or glossary popups", () => {
    expect(buildPatternHelpCardInnerHtml({ title: "Help", bodyHtml: "<p>overlay</p>" })).not.toContain(
      PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS,
    );
    expect(buildPatternQuickTipInnerHtml({ summaryLabel: "Tip", bodyHtml: "<p>overlay</p>" })).not.toContain(
      PATTERN_PRINT_ESSENTIAL_DISCLOSURE_CLASS,
    );
    expect(printBlock(helpCardCss)).not.toMatch(/::details-content[\s\S]*content-visibility:\s*visible/);

    expect(tooltipPrintCss).toMatch(/\.glossary-tooltip-popup[\s\S]*display:\s*none\s*!important/);
    expect(tooltipPrintCss).toMatch(/\.glossary-popup[\s\S]*display:\s*none\s*!important/);
    expect(patternTipsPrintCss).toMatch(
      new RegExp(`\\.pattern-tip \\.${PATTERN_TIP_MEDIA_NO_PRINT_CLASS}[\\s\\S]*display:\\s*none\\s*!important`),
    );
  });

  it("sleeve shaping tables stay in the printed document without a collapsed details shell", () => {
    const sleeveHtml = renderDropShoulderSleeveShapingChartHtml(
      [{ rc: 12, action: "Decrease 1 st", edge: "Both edges", stitchesRemaining: 40 }],
      { chartId: "print-regression-sleeve" },
    );
    expect(sleeveHtml).toContain("ns-shaping-chart__table--checklist");
    expect(sleeveHtml).toContain("Decrease 1 st");
    expect(sleeveHtml).not.toContain("<details");
    expect(sleeveHtml).not.toContain("ns-shaping-chart--collapsible");
  });

  it("page-one print notice no longer says shaping rows print only when visible on screen", () => {
    expect(pageNotice).toContain("Interactive glossary popups, videos, and help overlays are not included");
    expect(pageNotice).not.toContain("visible on screen");
    expect(pageNotice).not.toContain("shaping chart rows");
  });

  it("chart-only print window also expands collapsed essential checklists", () => {
    expect(pageScript).toContain("collapsibleDefaultOpen: true");
    expect(pageScript).toContain(".ns-shaping-chart--collapsible::details-content");
    expect(pageScript).toMatch(/content-visibility:\s*visible\s*!important/);
  });
});

describe("print.css remains the shared entry for essential disclosure print rules", () => {
  it("is imported from BaseLayout so every Pattern Builder print path receives it", () => {
    const layout = readFileSync(resolve("src/layouts/BaseLayout.astro"), "utf8");
    expect(layout).toContain('import "../styles/print.css"');
  });
});
