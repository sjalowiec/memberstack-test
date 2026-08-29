import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sharedCss = readFileSync(
  resolve("src/styles/patterns/sleeveless-pattern-shared.css"),
  "utf8",
);
const appShellCss = readFileSync(
  resolve("src/styles/patterns/pattern-app-shell.css"),
  "utf8",
);
const pageScript = readFileSync(
  resolve("src/scripts/sleevelessPatternPageShared.ts"),
  "utf8",
);
const hatPage = readFileSync(resolve("src/pages/patterns/hat/pattern.astro"), "utf8");
const hatLayoutTest = readFileSync(
  resolve("src/lib/patterns/hat/hatPatternReadingLayout.test.ts"),
  "utf8",
);

describe("sleeveless finished pattern reading layout (responsive)", () => {
  it("uses a two-column reading layout only at 1100px and wider", () => {
    expect(sharedCss).toContain("sleeveless-pattern-reading-layout");
    expect(sharedCss).toMatch(
      /@media \(min-width:\s*1100px\)\s*\{[\s\S]*?sleeveless-pattern-reading-layout[\s\S]*?grid-template-columns:\s*minmax\(0,\s*62fr\)\s+minmax\(0,\s*38fr\)/,
    );
    expect(sharedCss).not.toMatch(
      /@media \(min-width:\s*768px\)\s*\{[\s\S]*?sleeveless-pattern-reading-layout[\s\S]*?grid-template-columns:\s*minmax\(0,\s*62fr\)/,
    );
  });

  it("keeps a stacked layout below 1100px and puts the visual workspace first on phones", () => {
    expect(sharedCss).toMatch(
      /#pattern-content \.pattern-layout\.pattern-layout--garment-columns\.sleeveless-pattern-reading-layout\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/,
    );
    expect(sharedCss).toMatch(
      /@media \(min-width:\s*768px\) and \(max-width:\s*1099\.98px\)\s*\{[\s\S]*?sleeveless-pattern-reading-layout[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column/,
    );
    expect(sharedCss).toMatch(
      /\.sleeveless-pattern-reading-layout__diagram\s*\{[^}]*order:\s*-1/,
    );
  });

  it("does not keep the 320/420px schematic cap on the desktop visual workspace", () => {
    expect(sharedCss).not.toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?\.sleeveless-pattern-diagram-panel\s*\{[^}]*max-width:\s*420px/,
    );
    expect(sharedCss).not.toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?\.sleeveless-pattern-diagram-panel\s*\{[^}]*max-width:\s*320px/,
    );
    expect(sharedCss).toMatch(
      /@media \(min-width:\s*1100px\)[\s\S]*?sleeveless-pattern-diagram-panel\s*\{[^}]*max-width:\s*100%/,
    );
    expect(sharedCss).toMatch(
      /@media \(min-width:\s*768px\) and \(max-width:\s*1099\.98px\)[\s\S]*?sleeveless-pattern-diagram-panel\s*\{[^}]*max-width:\s*min\(100%,\s*36rem\)/,
    );
    expect(appShellCss).toContain(":not(.sleeveless-pattern-reading-layout)");
  });

  it("wires the shared Hat-style tab workspace without moving checklists", () => {
    expect(pageScript).toContain("buildSleevelessPatternDiagramTabsShellHtml");
    expect(pageScript).toContain("initSleevelessPatternDiagramTabs");
    expect(pageScript).toContain("sleeveless-pattern-reading-layout");
    expect(pageScript).toContain("SLEEVELESS_DIAGRAM_PANEL_TITLE");
    expect(pageScript).toContain("buildPatternVisualGuidesHtml");
    expect(pageScript).toContain("visualGuides:");
    expect(pageScript).toContain("notationSupported: false");
    expect(pageScript).toContain("sleeveless-piece-split__text");
    expect(pageScript).toContain('tableHeading: "First Shoulder Checklist"');
    const frontChartIntro = readFileSync(
      resolve("src/lib/patterns/sleevelessFrontChartIntroHtml.ts"),
      "utf8",
    );
    expect(frontChartIntro).toContain(
      'tableHeading: frontUsesShoulderTabs ? "First Side Checklist" : "First Shoulder Checklist"',
    );
  });

  it("Drop Shoulder Back and Front reuse wrapSleevelessPieceSplit (62/38 reading layout)", () => {
    const mountStart = pageScript.indexOf("async function renderDropShoulderMount");
    const mountEnd = pageScript.indexOf("async function renderMount(");
    const mount = pageScript.slice(
      mountStart,
      mountEnd > mountStart ? mountEnd : mountStart + 9000,
    );
    expect(mount).toContain("wrapSleevelessPieceSplit");
    expect(mount).toContain("enableVisualWorkspace: true");
    expect(pageScript).toContain("sleeveless-pattern-reading-layout");
    expect(sharedCss).toMatch(
      /@media \(min-width:\s*1100px\)\s*\{[\s\S]*?sleeveless-pattern-reading-layout[\s\S]*?grid-template-columns:\s*minmax\(0,\s*62fr\)\s+minmax\(0,\s*38fr\)/,
    );
  });

  it("does not change Hat reading-layout behavior", () => {
    expect(hatPage).toMatch(
      /@media \(min-width:\s*1100px\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*62fr\)\s+minmax\(0,\s*38fr\)/,
    );
    expect(hatPage).toContain("hat-pattern-reading-layout");
    expect(hatLayoutTest).toContain("hat finished pattern reading layout");
  });
});
