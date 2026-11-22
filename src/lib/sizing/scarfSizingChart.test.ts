import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ALL_SIZING_CHART_DATA_URLS, ALL_SIZING_CHART_METADATA } from "./sizingChartCatalog";
import { projectChartTableHtml, renderProjectChartView } from "./projectSizingChart";

const sizingChartsPage = readFileSync(resolve("src/pages/reference/sizing-charts.astro"), "utf8");
const projectChart = readFileSync(resolve("src/lib/sizing/projectSizingChart.ts"), "utf8");
const scarfIcon = readFileSync(resolve("public/images/scarf.svg"), "utf8");
const scarfRows = JSON.parse(
  readFileSync(resolve("public/data/sizing_scarves.json"), "utf8"),
) as Array<{ size: string; width: number; length: number }>;

/** Same rounding the sizing charts page uses for every numeric measurement. */
function toCm(inches: number): number {
  return Math.round(inches * 2.54);
}

function formatPair(width: number, length: number, metric: boolean): string {
  const format = (inches: number) => (metric ? `${toCm(inches)} cm` : `${inches}″`);
  return `${format(width)} × ${format(length)}`;
}

describe("scarf sizing chart", () => {
  it("publishes the five suggested finished sizes", () => {
    expect(scarfRows.map((row) => row.size)).toEqual([
      "Child",
      "Teen or narrow adult",
      "Classic adult",
      "Long adult",
      "Wide adult",
    ]);
    expect(scarfRows.map((row) => formatPair(row.width, row.length, false))).toEqual([
      "6″ × 45″",
      "6″ × 60″",
      "8″ × 60″",
      "8″ × 72″",
      "12″ × 72″",
    ]);
    expect(scarfRows.map((row) => formatPair(row.width, row.length, true))).toEqual([
      "15 cm × 114 cm",
      "15 cm × 152 cm",
      "20 cm × 152 cm",
      "20 cm × 183 cm",
      "30 cm × 183 cm",
    ]);
  });

  it("is a sizing-chart choice with the same unit conversion as the other charts", () => {
    expect(ALL_SIZING_CHART_DATA_URLS.scarves).toBe("/data/sizing_scarves.json");
    expect(ALL_SIZING_CHART_METADATA.scarves).toEqual({
      label: "Suggested Finished Scarf Sizes",
      icon: "/images/scarf.svg",
      hash: "scarves-chart",
    });
    expect(sizingChartsPage).toContain('data-type="scarves"');
    expect(sizingChartsPage).toContain("public/images/scarf.svg");
    expect(sizingChartsPage).toContain(".project-pills .scarf-icon");
    expect(sizingChartsPage).not.toContain("shawl.svg");
    expect(scarfIcon).toContain('stroke="currentColor"');
    expect(scarfIcon).toContain('class="button-icon scarf-icon"');
    expect(sizingChartsPage).toContain("scarves: '/data/sizing_scarves.json'");
    expect(sizingChartsPage).toContain("Suggested Finished Scarf Sizes");
    expect(sizingChartsPage).toContain("function toCm(inches)");
    expect(sizingChartsPage).toContain("return Math.round(inches * 2.54);");
    expect(sizingChartsPage).toContain("currentType === 'scarves'");
  });

  it("publishes the sizing guidance and leaves out the workshop notes", () => {
    expect(projectChart).toContain(
      "Use these sizes as a starting point. Choose the width and length to suit the person, the fabric, and the way the scarf will be worn.",
    );
    expect(projectChart).toContain(
      "All sizes are width × length. Measurements refer to the finished scarf body, excluding fringe. Centimeters are rounded.",
    );
    expect(projectChart).toContain(
      "Have a scarf you enjoy wearing? Measure it and use those dimensions for your own design.",
    );
    expect(projectChart).toContain(
      "The chart describes finished wearing dimensions. If a scarf is folded or seamed into a double layer, allow for that construction when drafting the fabric width.",
    );
    expect(sizingChartsPage).toContain("KinProjectSizing.guidanceHtml");
    expect(sizingChartsPage).toContain("KinProjectSizing.notesHtml");
    expect(projectChart).not.toContain("Create your scarf pattern");
    const inches = renderProjectChartView("scarves", scarfRows, false);
    expect(inches).toContain("Suggested Finished Scarf Sizes");
    expect(inches).toContain("8″ × 60″");
    expect(inches).not.toContain("Create your scarf pattern");
    expect(inches).not.toContain("/tools/rectangle-tool");
    expect(projectChartTableHtml("scarves", scarfRows, true)).toContain("20 cm × 152 cm");
    const pillows = JSON.parse(
      readFileSync(resolve("public/data/sizing_pillows.json"), "utf8"),
    ) as Array<Record<string, unknown>>;
    const pillowTable = projectChartTableHtml("pillows", pillows, false);
    expect(pillowTable).toContain("<th>Depth</th>");
    expect(pillowTable).toContain("16″");
    expect(sizingChartsPage).toContain(
      '<a href="/tools/rectangle-tool">Create your scarf pattern</a>',
    );
    expect(sizingChartsPage).not.toContain("DesignaKnit");
    expect(sizingChartsPage).not.toContain("Ferguson");
    expect(sizingChartsPage).not.toContain("Lion Brand");
    expect(sizingChartsPage).not.toContain("Research notes");
  });
});
