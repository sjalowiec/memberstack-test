import { describe, expect, it } from "vitest";
import {
  buildShapingNotationChartHelpHtml,
  SHAPING_NOTATION_KIN_GLOSSARY_ID,
} from "./shapingNotationGlossary";

describe("buildShapingNotationChartHelpHtml", () => {
  it("links Shaping Notation to the KiN glossary entry", () => {
    const html = buildShapingNotationChartHelpHtml(
      (s) => s.replace(/"/g, "&quot;"),
      (s) => s,
    );
    expect(html).toContain("Need help reading this chart?");
    expect(html).toContain(`data-glossary-id="${SHAPING_NOTATION_KIN_GLOSSARY_ID}"`);
    expect(html).toContain(">Shaping Notation</span>");
    expect(html).toContain("hidden");
  });
});
