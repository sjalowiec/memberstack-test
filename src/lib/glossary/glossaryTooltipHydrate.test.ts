import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("glossaryTooltipHydrate", () => {
  it("uses data-term for visible label and does not inject print notes", () => {
    const src = readFileSync(join(import.meta.dirname, "glossaryTooltipHydrate.ts"), "utf8");
    expect(src).toContain("getGlossaryPlaceholderVisibleText(placeholder)");
    expect(src).not.toMatch(/\(placeholder\.textContent/);
    expect(src).not.toContain("ensureGlossaryWrapPrintNote");
    expect(src).not.toContain("tooltip-print-note");
  });
});
