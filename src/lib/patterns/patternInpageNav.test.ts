import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SWEATER_NAV_PAGES = [
  "src/pages/patterns/sleeveless/pattern/index.astro",
  "src/pages/patterns/drop-shoulder/pattern/index.astro",
  "src/pages/patterns/sleeveless/beta-pattern.astro",
];

describe("sweater in-page navigation remains unchanged", () => {
  it("keeps the shared nav shell, CSS contract, and sweater item catalog", () => {
    const shared = readFileSync(
      resolve("src/scripts/sleevelessPatternPageShared.ts"),
      "utf8",
    );
    expect(shared).toContain("SLEEVELESS_PATTERN_INPAGE_NAV_ITEMS");
    expect(shared).toContain('label: "Back"');
    expect(shared).toContain('ids: ["sg-back"]');
    expect(shared).toContain('label: "Back Armhole"');
    expect(shared).toContain('ids: ["sg-back-armhole"]');
    expect(shared).toContain('label: "Back Neckline"');
    expect(shared).toContain("discoverNecklinePiece: \"back\"");
    expect(shared).toContain('label: "Front"');
    expect(shared).toContain('ids: ["sg-front"]');
    expect(shared).toContain('label: "Front Armhole"');
    expect(shared).toContain('ids: ["sg-front-armhole"]');
    expect(shared).toContain('label: "Front Neckline"');
    expect(shared).toContain("discoverNecklinePiece: \"front\"");
    expect(shared).toContain('label: "Sleeve"');
    expect(shared).toContain('ids: ["sg-sleeve"]');
    expect(shared).toContain('label: "Finishing"');
    expect(shared).toContain('ids: ["sg-finishing"]');
    expect(shared).toContain("syncPatternInpageNav");
    expect(shared).toContain("onHasItems: mountSleevelessPrintAction");
    expect(shared).not.toContain("sockPatternInpageNavItems");
    expect(shared).not.toContain("SOCK_CUFF_TO_TOE_INPAGE_NAV_LABELS");

    const css = readFileSync(
      resolve("src/styles/patterns/sleeveless-pattern-shared.css"),
      "utf8",
    );
    expect(css).toContain(".sleeveless-pattern-inpage-nav");
    expect(css).toContain(".sleeveless-pattern-inpage-nav__pill");
    expect(css).toContain(".sleeveless-pattern-inpage-nav__pill.is-active");
    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain("overflow-x: auto");

    for (const pagePath of SWEATER_NAV_PAGES) {
      const page = readFileSync(resolve(pagePath), "utf8");
      expect(page).toContain('data-sleeveless-pattern-inpage-nav');
      expect(page).toContain('aria-label="Jump to pattern section"');
      expect(page).toContain("sleeveless-pattern-inpage-nav no-print");
    }
  });
});
