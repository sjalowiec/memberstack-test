import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { revealHiddenPrintDiagramPanels } from "./patternPrintLayout";

function panel(hidden: boolean) {
  const attrs = new Set(hidden ? ["hidden"] : []);
  return {
    hasAttribute(name: string) {
      return attrs.has(name);
    },
    removeAttribute(name: string) {
      attrs.delete(name);
    },
    setAttribute(name: string) {
      attrs.add(name);
    },
    isHidden() {
      return attrs.has("hidden");
    },
  };
}

describe("set-in sleeve print diagrams", () => {
  it("clears the hidden attribute on the inactive diagram and restores it afterward", () => {
    const stitches = panel(false);
    const notation = panel(true);
    const restore = revealHiddenPrintDiagramPanels([stitches, notation]);
    expect(stitches.isHidden()).toBe(false);
    expect(notation.isHidden()).toBe(false);
    restore();
    expect(stitches.isHidden()).toBe(false);
    expect(notation.isHidden()).toBe(true);
  });

  it("prints both diagram types for charts and the complete pattern, and leaves them out of instructions", () => {
    const page = readFileSync("src/pages/patterns/set-in-sleeve/pattern/index.astro", "utf8");
    const layout = readFileSync("src/lib/patterns/patternPrintLayout.ts", "utf8");
    expect(page).toContain("set-in-sleeve-pattern-page");
    expect(page).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)');
    expect(page).toContain(
      'html[data-pattern-print-choice="charts"] .set-in-sleeve-pattern-page #pattern-content [data-pattern-diagram-panel="sts-rows"]',
    );
    expect(page).toContain(
      'html[data-pattern-print-choice="charts"] .set-in-sleeve-pattern-page #pattern-content [data-pattern-diagram-panel="shaping-notation"]',
    );
    expect(page).toContain(
      'html[data-pattern-print-choice="both"] .set-in-sleeve-pattern-page #pattern-content [data-pattern-diagram-panel="sts-rows"]',
    );
    expect(page).toContain(
      'html[data-pattern-print-choice="both"] .set-in-sleeve-pattern-page #pattern-content [data-pattern-diagram-panel="shaping-notation"]',
    );
    expect(page).toContain(
      'html[data-pattern-print-choice="instructions"] .set-in-sleeve-pattern-page #pattern-content .sleeveless-piece-split__diagram',
    );
    expect(page).toContain("overflow: visible !important");
    expect(layout).toContain('choice !== "charts" && choice !== "both"');
    expect(layout).toContain("revealHiddenPrintDiagramPanels");
    expect(layout).toContain(".set-in-sleeve-pattern-page #pattern-content [data-pattern-diagram-panel]");
  });
});
