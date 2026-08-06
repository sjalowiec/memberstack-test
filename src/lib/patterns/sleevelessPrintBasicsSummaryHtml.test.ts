import { describe, expect, it } from "vitest";
import {
  buildSleevelessPrintBasicsSummaryDlHtml,
  buildSleevelessScreenBasicsSummaryDlHtml,
} from "./sleevelessPrintBasicsSummaryHtml";

function mergedPattern(fit: Record<string, unknown>): Record<string, unknown> {
  return {
    style: {
      recipientCategory: "misses",
      bodyShape: "straight",
      frontStyle: "closed",
      garmentStyle: "pullover",
      neckline: "round",
      length: "top",
      patternMode: "express",
    },
    fit: { selectedSize: "M", sizingChart: "misses", ...fit },
    yarnGauge: { gaugeStitchRaw: "24", gaugeRowRaw: "32", gaugeRawUnit: "in" },
  };
}

function patternData(): Record<string, unknown> {
  return {
    yarnGaugeMachine: { gaugeStitchRaw: "24", gaugeRowRaw: "32", gaugeRawUnit: "in" },
  };
}

describe("sleeveless basics summary — Fit row", () => {
  it("screen summary shows Fit alongside pattern/audience/size/style/neckline/gauge", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(
      mergedPattern({ fitChoice: "relaxed", easeChoice: "relaxed" }),
      patternData(),
    );
    expect(html).toContain("<dt>Pattern</dt><dd>Sleeveless</dd>");
    expect(html).toContain("<dt>Audience</dt><dd>Women's</dd>");
    expect(html).toContain("<dt>Size</dt><dd>Chart size M</dd>");
    expect(html).toContain("<dt>Style</dt><dd>Pullover</dd>");
    expect(html).toContain("<dt>Neckline</dt>");
    expect(html).toContain("<dt>Gauge</dt>");
    // The choice under test:
    expect(html).toContain("<dt>Fit</dt><dd>Relaxed</dd>");
    expect(html).not.toContain("Bust darts");
  });

  it("includes Bust darts row when style.bustDart is enabled", () => {
    const merged = mergedPattern({ fitChoice: "standard" });
    (merged.style as Record<string, unknown>).bustDart = { enabled: true, cupSize: "C" };
    const html = buildSleevelessPrintBasicsSummaryDlHtml(merged, patternData());
    expect(html).toContain("<dt>Bust darts</dt><dd>Cup C</dd>");
  });

  it("renders Created and Last updated rows from metadata when provided", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(
      mergedPattern({ fitChoice: "standard" }),
      patternData(),
      { createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-03-04T00:00:00.000Z" },
    );
    expect(html).toContain("<dt>Created</dt><dd>Jan 2, 2026</dd>");
    expect(html).toContain("<dt>Last updated</dt><dd>Mar 4, 2026</dd>");
  });

  it("omits date rows when metadata is absent", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(mergedPattern({}), patternData());
    expect(html).not.toContain("<dt>Created</dt>");
    expect(html).not.toContain("<dt>Last updated</dt>");
  });

  it("print summary shows the Fit row", () => {
    const html = buildSleevelessPrintBasicsSummaryDlHtml(
      mergedPattern({ fitChoice: "close" }),
      patternData(),
    );
    expect(html).toContain("<dt>Fit</dt><dd>Close</dd>");
  });

  it("falls back to easeChoice when fitChoice is absent", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(
      mergedPattern({ easeChoice: "standard" }),
      patternData(),
    );
    expect(html).toContain("<dt>Fit</dt><dd>Standard</dd>");
  });

  it("omits the Fit row when no fit/ease choice is stored", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(mergedPattern({}), patternData());
    expect(html).not.toContain("<dt>Fit</dt>");
    // Other choices still render.
    expect(html).toContain("<dt>Neckline</dt>");
  });
});
