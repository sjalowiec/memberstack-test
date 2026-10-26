import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PATTERN_PRINT_FOOTER_ATTRIBUTION,
  patternPrintFooterBottomLeftCssValue,
  patternPrintFooterUrl,
} from "./patternPrintFooterText";

describe("shared pattern print footer", () => {
  it("keeps the pattern URL on a second line", () => {
    expect(patternPrintFooterUrl(" · KnitItNow.com/patterns/sideways-cardigan")).toBe(
      "KnitItNow.com/patterns/sideways-cardigan",
    );
    expect(patternPrintFooterUrl("")).toBe("");
    expect(patternPrintFooterBottomLeftCssValue()).toBe(`"${PATTERN_PRINT_FOOTER_ATTRIBUTION}"`);
    expect(
      patternPrintFooterBottomLeftCssValue(" · KnitItNow.com/patterns/christmas-stocking"),
    ).toBe(`"${PATTERN_PRINT_FOOTER_ATTRIBUTION}\\A KnitItNow.com/patterns/christmas-stocking"`);
    expect(
      patternPrintFooterBottomLeftCssValue(" · KnitItNow.com/patterns/sideways-cardigan"),
    ).toContain("\\A KnitItNow.com/patterns/sideways-cardigan");
  });

  it("reserves a column for the URL, the page number, and the date", () => {
    const css = readFileSync("src/styles/patterns/pattern-print-footer.css", "utf8");
    const left = css.slice(css.indexOf("@bottom-left"), css.indexOf("@bottom-center"));
    const center = css.slice(css.indexOf("@bottom-center"), css.indexOf("@bottom-right"));
    const rightStart = css.indexOf("@bottom-right");
    const right = css.slice(rightStart, css.indexOf("}", rightStart));

    expect(left).toContain("width: 2.55in");
    expect(left).toContain("white-space: pre-wrap");
    expect(left).not.toContain("nowrap");
    expect(center).toContain('content: "Page " counter(page) " of " counter(pages)');
    expect(center).toContain("width: 1.35in");
    expect(center).toContain("white-space: nowrap");
    expect(right).toContain("width: 2.45in");
    expect(right).toContain("white-space: nowrap");
    expect(css).toContain("margin: 0.75in 0.7in 1.15in 0.7in");
  });
});
