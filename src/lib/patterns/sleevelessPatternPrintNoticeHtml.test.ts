import { describe, expect, it } from "vitest";
import { SLEEVELESS_PATTERN_PRINT_NOTICE_HTML } from "./sleevelessPatternPrintNoticeHtml";

describe("sleevelessPatternPrintNoticeHtml", () => {
  it("renders print-only notice markup with expected copy", () => {
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).toContain('class="print-only-pattern-note"');
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).toContain("Using a printed copy?");
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).toContain(
      "Interactive glossary popups, videos, and help overlays are not included in printed copies.",
    );
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).toContain(
      "<strong>only if they are visible on screen</strong>",
    );
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).toContain("Pattern Tips and shaping chart rows");
    expect(SLEEVELESS_PATTERN_PRINT_NOTICE_HTML).not.toContain("no-print");
  });
});
