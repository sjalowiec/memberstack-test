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
  it("screen summary shows Fit alongside recipient/size/garment/neckline/gauge", () => {
    const html = buildSleevelessScreenBasicsSummaryDlHtml(
      mergedPattern({ fitChoice: "relaxed", easeChoice: "relaxed" }),
      patternData(),
    );
    expect(html).toContain("<dt>Size</dt>");
    expect(html).toContain("<dt>Garment type</dt>");
    expect(html).toContain("<dt>Neckline</dt>");
    expect(html).toContain("<dt>Gauge</dt>");
    // The choice under test:
    expect(html).toContain("<dt>Fit</dt><dd>Relaxed</dd>");
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
