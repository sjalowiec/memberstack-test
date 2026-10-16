import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("course lesson root font size", () => {
  it("uses the site 18px root and does not load Bootstrap 3", () => {
    const layout = readFileSync(resolve("src/layouts/KinCourseLayout.astro"), "utf8");
    expect(layout).toContain("font-size: 112.5% !important");
    expect(layout).not.toContain("bootstrap/3.3.7");
    expect(layout).not.toContain('ul[style*="font-size:1rem"]');
    expect(layout).not.toContain('table[style*="font-size"]');
    expect(layout).toContain("font-awesome/4.7.0/css/font-awesome.min.css");
    expect(layout).toContain("legacy-lesson-compat.css");
    expect(layout).toContain("font-size: 18px");
    expect(layout).toContain("Yarn by Machine Pitch");
  });

  it("does not override lesson table font size", () => {
    const css = readFileSync(resolve("src/styles/kin-course/legacy-lesson-compat.css"), "utf8");
    const tableRules = css
      .split("}")
      .filter((block) => /\.table\b/.test(block.split("{")[0] ?? ""));
    expect(tableRules.length).toBeGreaterThan(0);
    for (const block of tableRules) {
      expect(block).not.toMatch(/font-size\s*:/);
    }
  });
});

describe("legacy lesson compatibility stylesheet", () => {
  const css = readFileSync(resolve("src/styles/kin-course/legacy-lesson-compat.css"), "utf8");

  it("scopes Bootstrap-like rules to lesson content", () => {
    const selectorText = css.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const block of selectorText.split("}")) {
      const head = block.split("{")[0] ?? "";
      for (const part of head.split(",")) {
        const selector = part.trim();
        if (!selector || selector.startsWith("@")) continue;
        expect(selector).toContain(".legacy-content");
      }
    }
    expect(css).toContain(".legacy-content .col-md-6");
    expect(css).toContain(".legacy-content .col-sm-offset-1");
    expect(css).toContain(".legacy-content .col-xs-12");
    expect(css).toContain(".legacy-content .btn-primary");
    expect(css).toContain(".legacy-content .table-responsive");
    expect(css).toContain(".legacy-content .img-thumbnail");
    expect(css).toContain(".legacy-content .text-center");
    expect(css).toContain(".legacy-content .pull-left");
    expect(css).toContain(".legacy-content .embed-responsive-16by9");
    expect(css).toContain(".legacy-content .collapse");
    expect(css).toContain(".legacy-content .tab-pane.active");
    expect(css).toContain(".legacy-content .modal");
    expect(css).not.toContain(".kin-site-header");
    expect(css).not.toContain(".course-sticky-nav");
    expect(css).not.toContain(".glossaryModal");
  });
});
