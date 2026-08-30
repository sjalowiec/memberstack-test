import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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

  it("Pattern page print CSS un-hides both diagram panels", () => {
    const page = readFileSync(resolve("src/pages/patterns/socks/pattern.astro"), "utf8");
    expect(page).toContain(".sock-pattern-diagram-tabs__panel[hidden]");
    expect(page).toContain(".sock-pattern-diagram-print-heading");
    expect(page).toContain("pattern-diagram-tabs.css");
    expect(page).not.toContain("hat-pattern-diagram-shaping-help");
    expect(page).not.toContain("vimeo");
  });
});
