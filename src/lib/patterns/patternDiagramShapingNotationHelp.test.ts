import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";
import {
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_BTN_CLASS,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID,
  buildPatternDiagramShapingNotationHelpHtml,
} from "./patternDiagramShapingNotationHelp";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("shared pattern diagram shaping-notation help", () => {
  it("renders the How to Read Shaping Notation KinCatalogVideoModal trigger", () => {
    const html = buildPatternDiagramShapingNotationHelpHtml();
    expect(html).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS);
    expect(html).toContain("no-print");
    expect(html).toContain("data-pattern-diagram-shaping-help");
    expect(html).toContain("kbm-btn");
    expect(html).toContain("kbm-btn-outline");
    expect(html).toContain("kbm-kin-catalog-video");
    expect(html).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_BTN_CLASS);
    expect(html).toContain(`data-vimeo-id="${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID}"`);
    expect(html).toContain(`data-video-title="${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL}"`);
    expect(html).toContain('data-testid="pattern-diagram-shaping-notation-help"');
    expect(html).toContain("fa-circle-info");
    expect(html).toContain(`<span>${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL}</span>`);
    expect(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL).toBe("How to Read Shaping Notation");
    expect(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID).toBe(
      SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
    );
  });

  it("lives in the shared diagram-tab stylesheet with sweater-matching button chrome", () => {
    const tabsCss = readFileSync(join(srcRoot, "styles/patterns/pattern-diagram-tabs.css"), "utf8");
    expect(tabsCss).toContain(".pattern-diagram-shaping-help");
    expect(tabsCss).toContain(".pattern-diagram-shaping-help__btn.kbm-btn");
    expect(tabsCss).toContain("min-height: 44px");
    expect(tabsCss).toContain("padding: 0.65rem 1.125rem");
    expect(tabsCss).toContain("font-size: 1rem");
    expect(tabsCss).toContain("font-weight: 600");
    expect(tabsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.pattern-diagram-shaping-help__btn\.kbm-btn[\s\S]*width:\s*100%/,
    );
    expect(tabsCss).toMatch(
      /@media print[\s\S]*\.pattern-diagram-shaping-help[\s\S]*display:\s*none/,
    );
  });
});
