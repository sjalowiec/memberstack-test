import { describe, expect, it } from "vitest";
import { buildGlossaryTooltipPlaceholderHtml } from "./glossaryTooltipPrint";

describe("glossaryTooltipPrint", () => {
  it("placeholder HTML contains trigger text only (no print note)", () => {
    const html = buildGlossaryTooltipPlaceholderHtml(
      186,
      "Decrease",
      (s) => s.replace(/"/g, "&quot;"),
      (s) => s,
    );
    expect(html).toContain('data-glossary-id="186"');
    expect(html).toContain('data-term="Decrease"');
    expect(html).toContain(">Decrease</span>");
    expect(html).not.toContain("tooltip-print-note");
    expect(html).not.toContain("(Note:");
  });
});
