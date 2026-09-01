import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../../glossary/shapingNotationGlossary";
import {
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL,
  PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID,
  buildPatternDiagramShapingNotationHelpHtml,
} from "../patternDiagramShapingNotationHelp";
import {
  PATTERN_DIAGRAM_TAB_SHAPING,
  PATTERN_DIAGRAM_TAB_STS_ROWS,
} from "../patternDiagramTabs";
import {
  SOCK_DIAGRAM_TAB_SHAPING,
  SOCK_DIAGRAM_TAB_STS_ROWS,
  buildSockPatternDiagramTabsShellHtml,
} from "./sockPatternDiagramTabs";

describe("Socks diagram tabs", () => {
  it("reuses the shared Stitches & Rows / Shaping Notation tab shell", () => {
    expect(SOCK_DIAGRAM_TAB_STS_ROWS).toBe(PATTERN_DIAGRAM_TAB_STS_ROWS);
    expect(SOCK_DIAGRAM_TAB_SHAPING).toBe(PATTERN_DIAGRAM_TAB_SHAPING);
    const html = buildSockPatternDiagramTabsShellHtml();
    expect(html).toContain("pattern-diagram-tabs");
    expect(html).toContain("Stitches &amp; Rows");
    expect(html).toContain("Shaping Notation");
    expect(html).toContain('data-sock-diagram-tab="sts-rows"');
    expect(html).toContain('data-sock-diagram-tab="shaping-notation"');
    expect(html).toContain("data-sock-diagram-sts-rows-host");
    expect(html).toContain("data-sock-diagram-shaping-host");
    expect(html).toContain('class="sock-pattern-diagram-print-heading">Stitches &amp; Rows</h3>');
    expect(html).toContain('class="sock-pattern-diagram-print-heading">Shaping Notation</h3>');
    expect(html).toMatch(/data-sock-diagram-panel="shaping-notation"[^>]*\shidden/);
  });

  it("places the shared shaping-notation help only in the Shaping Notation panel", () => {
    const html = buildSockPatternDiagramTabsShellHtml();
    const shapingStart = html.indexOf('data-sock-diagram-panel="shaping-notation"');
    const stsStart = html.indexOf('data-sock-diagram-panel="sts-rows"');
    expect(shapingStart).toBeGreaterThan(-1);
    expect(stsStart).toBeGreaterThan(-1);

    const shapingChunk = html.slice(shapingStart);
    const stsChunk = html.slice(stsStart, shapingStart);
    expect(shapingChunk).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_LABEL);
    expect(shapingChunk).toContain("How to Read Shaping Notation");
    expect(shapingChunk).toContain(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_CLASS);
    expect(shapingChunk).toContain(`data-vimeo-id="${PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID}"`);
    expect(shapingChunk).toContain("kbm-kin-catalog-video");
    expect(shapingChunk).toContain("fa-circle-info");
    expect(stsChunk).not.toContain("data-pattern-diagram-shaping-help");
    expect(PATTERN_DIAGRAM_SHAPING_NOTATION_HELP_VIMEO_ID).toBe(
      SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
    );
    expect(html).toContain(buildPatternDiagramShapingNotationHelpHtml());
  });

  it("Pattern page print CSS un-hides both diagram panels and hides the help control", () => {
    const page = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(page).toContain(".sock-pattern-diagram-tabs__panel[hidden]");
    expect(page).toContain(".sock-pattern-diagram-print-heading");
    expect(page).toContain("pattern-diagram-tabs.css");
    expect(page).toContain(".pattern-diagram-shaping-help");
    expect(page).not.toContain("hat-pattern-diagram-shaping-help");
    expect(page).not.toContain("sleeveless-pattern-diagram-shaping-help");
    expect(page).not.toContain("vimeo");
  });
});
