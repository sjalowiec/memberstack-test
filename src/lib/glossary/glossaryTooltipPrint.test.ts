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
    expect(html).not.toContain("data-aria-label");
  });

  it("optional ariaLabel is emitted as data-aria-label for hydration", () => {
    const html = buildGlossaryTooltipPlaceholderHtml(
      284,
      "hung hem",
      (s) => s.replace(/"/g, "&quot;"),
      (s) => s,
      { ariaLabel: "Learn about hung hems" },
    );
    expect(html).toContain('data-glossary-id="284"');
    expect(html).toContain('data-term="hung hem"');
    expect(html).toContain('data-aria-label="Learn about hung hems"');
    expect(html).toContain(">hung hem</span>");
  });
});
