import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PATTERN_CATALOG_HREF } from "../patterns/customPatternProjectNavigation";
import {
  buildBuilderReturnToPath,
  buildSweaterSizingChartHref,
  resolveSweaterSizingChartBackLink,
  sanitizeReturnToPath,
  SWEATER_SIZING_CHART_FALLBACK_LABEL,
  SWEATER_SIZING_CHART_PATH,
  SWEATER_SIZING_CHART_RETURN_LABEL,
} from "./sweaterSizingChartNavigation";

const sweaterSizingChartPage = readFileSync(
  resolve("src/pages/reference/sweater-sizing-chart.astro"),
  "utf8",
);
const sleevelessBuilderAstro = readFileSync(
  resolve("src/pages/patterns/sleeveless/builder.astro"),
  "utf8",
);
const dropShoulderBuilderAstro = readFileSync(
  resolve("src/pages/patterns/drop-shoulder/builder.astro"),
  "utf8",
);

describe("sanitizeReturnToPath", () => {
  it("accepts safe internal paths", () => {
    expect(sanitizeReturnToPath("/patterns/sleeveless/builder")).toBe(
      "/patterns/sleeveless/builder",
    );
    expect(sanitizeReturnToPath("/patterns/drop-shoulder/builder?edit=choices")).toBe(
      "/patterns/drop-shoulder/builder?edit=choices",
    );
  });

  it("rejects external and malformed paths", () => {
    expect(sanitizeReturnToPath("https://evil.example/phish")).toBeNull();
    expect(sanitizeReturnToPath("//evil.example/phish")).toBeNull();
    expect(sanitizeReturnToPath("patterns/sleeveless/builder")).toBeNull();
    expect(sanitizeReturnToPath("")).toBeNull();
    expect(sanitizeReturnToPath(null)).toBeNull();
  });
});

describe("buildSweaterSizingChartHref", () => {
  it("builds href with encoded returnTo for sleeveless builder", () => {
    expect(buildSweaterSizingChartHref("/patterns/sleeveless/builder")).toBe(
      "/reference/sweater-sizing-chart?returnTo=%2Fpatterns%2Fsleeveless%2Fbuilder",
    );
  });

  it("preserves safe builder query keys in returnTo", () => {
    expect(buildSweaterSizingChartHref("/patterns/sleeveless/builder", "?edit=choices&new=1")).toBe(
      "/reference/sweater-sizing-chart?returnTo=%2Fpatterns%2Fsleeveless%2Fbuilder%3Fedit%3Dchoices",
    );
    expect(buildBuilderReturnToPath("/patterns/drop-shoulder/builder", "?edit=choices&new=1")).toBe(
      "/patterns/drop-shoulder/builder?edit=choices",
    );
  });
});

describe("resolveSweaterSizingChartBackLink", () => {
  it("uses Return to Pattern Builder for a valid internal returnTo", () => {
    expect(resolveSweaterSizingChartBackLink("/patterns/sleeveless/builder")).toEqual({
      href: "/patterns/sleeveless/builder",
      label: SWEATER_SIZING_CHART_RETURN_LABEL,
    });
  });

  it("falls back to the pattern catalog when returnTo is unsafe", () => {
    expect(resolveSweaterSizingChartBackLink("https://evil.example")).toEqual({
      href: PATTERN_CATALOG_HREF,
      label: SWEATER_SIZING_CHART_FALLBACK_LABEL,
    });
    expect(resolveSweaterSizingChartBackLink(undefined)).toEqual({
      href: PATTERN_CATALOG_HREF,
      label: SWEATER_SIZING_CHART_FALLBACK_LABEL,
    });
  });
});

describe("sweater sizing chart reference page", () => {
  it("contains sweater sizing content and shared chart data", () => {
    expect(sweaterSizingChartPage).toContain("Sweater Sizing Chart");
    expect(sweaterSizingChartPage).toContain("body measurement");
    expect(sweaterSizingChartPage).toContain("finished sweater measurement");
    expect(sweaterSizingChartPage).toContain("ease is");
    expect(sweaterSizingChartPage).toContain("SWEATER_CHART_METADATA");
    expect(sweaterSizingChartPage).toContain("initSweaterSizingChartTable");
    expect(sweaterSizingChartPage).toContain("meta.audienceLabel");
    expect(sweaterSizingChartPage).toContain("resolveSweaterSizingChartBackLink");
  });

  it("does not include non-sweater sizing sections", () => {
    expect(sweaterSizingChartPage).not.toContain("Hats");
    expect(sweaterSizingChartPage).not.toContain("Mittens");
    expect(sweaterSizingChartPage).not.toContain("Socks");
    expect(sweaterSizingChartPage).not.toContain("Blankets");
    expect(sweaterSizingChartPage).not.toContain("Pillows");
    expect(sweaterSizingChartPage).not.toContain("Christmas Stockings");
    expect(sweaterSizingChartPage).not.toContain("sizing_hats.json");
    expect(sweaterSizingChartPage).not.toContain('backHref="/reference"');
    expect(sweaterSizingChartPage).not.toContain("Back to Reference");
  });

  it("wires return navigation through resolveSweaterSizingChartBackLink", () => {
    expect(sweaterSizingChartPage).toContain("returnToRaw");
    expect(sweaterSizingChartPage).toContain("backHref={backLink.href}");
    expect(sweaterSizingChartPage).toContain("backLabel={backLink.label}");
  });
});

describe("pattern builder sweater sizing chart links", () => {
  it("sleeveless builder links to the sweater sizing chart with returnTo", () => {
    expect(sleevelessBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/sleeveless/builder")',
    );
    expect(sleevelessBuilderAstro).toContain("href={sweaterSizingChartHref}");
    expect(sleevelessBuilderAstro).toContain("data-express-sweater-sizing-chart-link");
  });

  it("drop shoulder builder links to the sweater sizing chart with returnTo", () => {
    expect(dropShoulderBuilderAstro).toContain(
      'buildSweaterSizingChartHref("/patterns/drop-shoulder/builder")',
    );
    expect(dropShoulderBuilderAstro).toContain("href={sweaterSizingChartHref}");
    expect(dropShoulderBuilderAstro).toContain("data-express-sweater-sizing-chart-link");
  });

  it("uses the dedicated sweater sizing chart path", () => {
    expect(sleevelessBuilderAstro).toContain("buildSweaterSizingChartHref");
    expect(dropShoulderBuilderAstro).toContain("buildSweaterSizingChartHref");
    expect(sleevelessBuilderAstro).not.toContain('href="/reference/sizing-charts"');
    expect(dropShoulderBuilderAstro).not.toContain('href="/reference/sizing-charts"');
    expect(buildSweaterSizingChartHref("/patterns/sleeveless/builder")).toContain(
      SWEATER_SIZING_CHART_PATH,
    );
  });
});
