import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const patternPage = readFileSync(
  resolve("src/pages/patterns/hat/pattern.astro"),
  "utf8",
);

describe("hat finished pattern reading layout (responsive)", () => {
  it("uses a two-column reading layout only at 1100px and wider", () => {
    expect(patternPage).toContain("data-hat-pattern-reading-layout");
    expect(patternPage).toContain("hat-pattern-reading-layout__instructions");
    expect(patternPage).toContain("hat-pattern-reading-layout__diagram");

    expect(patternPage).toMatch(
      /@media \(min-width:\s*1100px\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*62fr\)\s+minmax\(0,\s*38fr\)/,
    );
    expect(patternPage).not.toMatch(
      /@media \(min-width:\s*768px\)\s*\{[\s\S]*?hat-pattern-reading-layout[\s\S]*?grid-template-columns:/,
    );
  });

  it("keeps a single-column stack below 1100px with instructions above Hat Dimensions", () => {
    expect(patternPage).toMatch(
      /#pattern-content \.pattern-layout\.pattern-layout--garment-columns\.hat-pattern-reading-layout\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/,
    );
    expect(patternPage).toMatch(
      /@media \(min-width:\s*768px\) and \(max-width:\s*1099\.98px\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/,
    );
    expect(patternPage).toMatch(
      /\.hat-pattern-reading-layout__diagram\s*\{[^}]*order:\s*0/,
    );

    const instructionsIdx = patternPage.indexOf(
      "hat-pattern-reading-layout__instructions",
    );
    const diagramIdx = patternPage.indexOf(
      "hat-pattern-reading-layout__diagram",
    );
    expect(instructionsIdx).toBeGreaterThan(-1);
    expect(diagramIdx).toBeGreaterThan(instructionsIdx);
  });

  it("lets the Hat Dimensions panel use flexible column width without a fixed 420px clamp", () => {
    expect(patternPage).not.toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?\.hat-pattern-diagram-panel\s*\{[^}]*max-width:\s*420px/,
    );
    expect(patternPage).not.toContain("minmax(280px, 0.8fr)");
    expect(patternPage).toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?\.hat-pattern-diagram-panel\s*\{[^}]*max-width:\s*100%/,
    );
    expect(patternPage).toMatch(
      /@media \(min-width:\s*768px\) and \(max-width:\s*1099\.98px\)[\s\S]*?\.hat-pattern-diagram-panel__svg\s*\{[^}]*max-width:\s*min\(100%,\s*36rem\)/,
    );
  });

  it("keeps the diagram SVG from stretching and from overflowing its container", () => {
    expect(patternPage).toMatch(
      /\.hat-pattern-diagram-panel__svg\s*:global\(svg\)\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*height:\s*auto/,
    );
    expect(patternPage).toMatch(
      /\.hat-pattern-diagram-panel__svg\s*\{[^}]*overflow-x:\s*hidden/,
    );
    expect(patternPage).toMatch(
      /\.hat-pattern-reading-layout__diagram\s*\{[^}]*min-width:\s*0/,
    );
  });

  it("preserves phone help sizing; diagram tabs stay two side-by-side tabs", () => {
    const tabsCss = readFileSync(
      resolve("src/styles/patterns/pattern-diagram-tabs.css"),
      "utf8",
    );
    expect(patternPage).toMatch(
      /@media \(max-width:\s*767px\)[\s\S]*:global\(\.hat-pattern-diagram-shaping-help__btn\.kbm-btn\)\s*\{[^}]*width:\s*100%/,
    );
    expect(patternPage).toContain("pattern-diagram-tabs.css");
    expect(tabsCss).toContain("flex-wrap: nowrap");
    expect(tabsCss).toContain("flex: 1 1 50%");
    expect(tabsCss).toContain("white-space: normal");
    expect(tabsCss).not.toContain("flex-wrap: wrap");
  });

  it("preserves the existing desktop column gap when two columns are active", () => {
    expect(patternPage).toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?gap:\s*clamp\(1\.25rem,\s*2\.5vw,\s*2rem\)/,
    );
  });
});
