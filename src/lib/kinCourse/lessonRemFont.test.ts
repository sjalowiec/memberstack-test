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

  it("leaves Course 33 lesson 1079 table rem sizes in the saved HTML", () => {
    const course = readFileSync(
      resolve("src/data/legacy_kin/cleaned/course_33_beginner_workshop.poc.json"),
      "utf8",
    );
    expect(course).toContain('"assignId": 1079');
    expect(course).toContain("Common Machine Knitting Terms");
    expect(course).toContain("Yarn by Machine Pitch");
    expect(course).toContain("font-size:1.3rem;");
    expect(course).toContain("font-size:1rem;");
    expect(course).toContain("font-size:0.95rem;");
    expect(course).toContain("wraps-per-inch");
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
