import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function printBlock(css: string): string {
  const match = css.match(/@media print\s*\{[\s\S]*/);
  return match?.[0] ?? "";
}

describe("ns-shaping-chart print layout regression", () => {
  const nsShapingChartCss = readWorkspaceFile("src/styles/ns-shaping-chart.css");
  const sleevelessSharedCss = readWorkspaceFile("src/styles/patterns/sleeveless-pattern-shared.css");
  const sharedPrintCss = printBlock(sleevelessSharedCss);

  it("removes interactive overflow containers from chart wrappers in print", () => {
    const printCss = printBlock(nsShapingChartCss);
    expect(printCss).toMatch(/\.ns-shaping-chart__table-wrap[\s\S]*overflow:\s*visible\s*!important/);
    expect(printCss).toMatch(/\.ns-shaping-chart__table-wrap[\s\S]*overflow-x:\s*visible\s*!important/);
    expect(printCss).toMatch(/\.ns-shaping-chart__table-scroll[\s\S]*overflow:\s*visible\s*!important/);
    expect(printCss).toMatch(/\.ns-shaping-chart__table-scroll[\s\S]*max-height:\s*none\s*!important/);
  });

  it("lets chart tables size naturally in print instead of a fixed layout", () => {
    const printCss = printBlock(nsShapingChartCss);
    expect(printCss).toMatch(/\.ns-shaping-chart__table[\s\S]*table-layout:\s*auto\s*!important/);
    expect(printCss).toMatch(/\.ns-shaping-chart__table[\s\S]*width:\s*100%\s*!important/);
  });

  it("spans shaping charts across the garment print grid diagram column", () => {
    expect(sharedPrintCss).toMatch(/--garment-print-diagram-track:\s*2\.6in/);
    expect(sharedPrintCss).toMatch(
      /\.sleeveless-piece-split__text[\s\S]*\.ns-shaping-chart[\s\S]*margin-right:\s*calc/,
    );
    expect(sharedPrintCss).toMatch(
      /#front-neckline-shoulder-chart-print-area[\s\S]*max-width:\s*none\s*!important/,
    );
  });

  it("does not leave pattern-page chart wrappers width-constrained in print", () => {
    expect(sharedPrintCss).toMatch(
      /\.ns-shaping-chart__table-wrap[\s\S]*overflow-x:\s*visible\s*!important/,
    );
    expect(sharedPrintCss).toMatch(/\.ns-shaping-chart__table[\s\S]*table-layout:\s*auto\s*!important/);
  });
});
