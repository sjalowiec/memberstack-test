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

describe("shaping-map label typography", () => {
  const shapingMapCss = readWorkspaceFile("src/styles/shaping-map.css");

  it("keeps row-number font size at least the step-label font size", () => {
    const stepSize = Number(shapingMapCss.match(/\.shaping-map-step-label\s*\{[^}]*font-size:\s*([\d.]+)px/)?.[1]);
    const rowSize = Number(shapingMapCss.match(/\.shaping-map-row-number\s*\{[^}]*font-size:\s*([\d.]+)px/)?.[1]);
    expect(stepSize).toBeGreaterThan(0);
    expect(rowSize).toBeGreaterThanOrEqual(stepSize);
  });
});

describe("ns-visual-guides print layout regression", () => {
  const shapingMapCss = readWorkspaceFile("src/styles/shaping-map.css");
  const printCss = printBlock(shapingMapCss);

  it("stacks visual guide cards in a single print column (notation then map)", () => {
    expect(printCss).toMatch(
      /\.ns-visual-guides__grid[\s\S]*grid-template-columns:\s*1fr\s*!important/,
    );
    expect(printCss).toMatch(
      /\.ns-visual-guides__grid:not\(\.ns-visual-guides__grid--single\)[\s\S]*grid-template-columns:\s*1fr\s*!important/,
    );
    expect(printCss).not.toMatch(/grid-template-columns:\s*repeat\(2/);
  });

  it("prints each visual guide card at full width without screen height caps", () => {
    expect(printCss).toMatch(/\.ns-visual-guides__card[\s\S]*break-inside:\s*avoid/);
    expect(printCss).toMatch(/\.ns-visual-guides__preview--notation svg[\s\S]*max-height:\s*none/);
    expect(printCss).toMatch(
      /\.ns-visual-guides__preview--map \.shaping-map__svg[\s\S]*max-height:\s*none/,
    );
    expect(printCss).toMatch(
      /\.ns-visual-guides__preview--map \.shaping-map__svg[\s\S]*width:\s*100%/,
    );
    expect(printCss).toMatch(
      /\.ns-visual-guides__preview--map \.shaping-map__svg[\s\S]*height:\s*auto/,
    );
  });

  it("keeps screen two-column layout in the default (non-print) stylesheet", () => {
    const screenCss = shapingMapCss.replace(printCss, "");
    expect(screenCss).toMatch(
      /@media \(min-width: 700px\)[\s\S]*\.ns-visual-guides__grid:not\(\.ns-visual-guides__grid--single\)[\s\S]*grid-template-columns:\s*repeat\(2/,
    );
  });
});
