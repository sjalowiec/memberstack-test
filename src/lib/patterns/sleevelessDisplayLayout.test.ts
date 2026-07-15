import { describe, expect, it } from "vitest";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { generateSleevelessBackPattern } from "./sleevelessPatternOutput";
import { SLEEVELESS_QA_SCENARIOS } from "./testScenarios/sleevelessPatternQaMatrix";

/** Minimal mirror of renderSleevelessDisplayHtml placement logic for back neckline subsection. */
function simulateBackDisplayPlacement(rows: ReturnType<typeof generateSleevelessBackPattern>["displayRows"]) {
  const NECK_SHOULDER_SECTION_RE = /NECKLINE\s*&\s*SHOULDERS/i;
  const splitParts: string[] = [];
  const postParts: string[] = [];
  let openSectionIsPost = false;
  let openSectionSlugSource: string | null = null;
  const openSectionParts: string[] = [];
  const visualGuides = {
    enabled: true,
    piece: "back" as const,
    notationSupported: true,
    construction: "sleeveless" as const,
  };
  let visualGuidesPlaced = false;

  const flush = () => {
    if (!openSectionSlugSource) return;
    let sectionInner = openSectionParts.join("");
    if (visualGuides && !visualGuidesPlaced && openSectionIsPost) {
      sectionInner += buildPatternVisualGuidesHtml(visualGuides);
      visualGuidesPlaced = true;
    }
    const target = openSectionIsPost ? postParts : splitParts;
    target.push(`<section data-section="${openSectionSlugSource}">${sectionInner}</section>`);
    openSectionSlugSource = null;
    openSectionIsPost = false;
    openSectionParts.length = 0;
  };

  for (const row of rows) {
    if (row.kind === "section") {
      flush();
      openSectionSlugSource = row.title;
      openSectionIsPost = NECK_SHOULDER_SECTION_RE.test(row.title);
      continue;
    }
    if (row.kind === "neckShoulderChartTableMount") {
      if (visualGuides) {
        openSectionParts.push(buildPatternVisualGuidesHtml(visualGuides));
        visualGuidesPlaced = true;
        openSectionParts.push("<div id=chart></div>");
        continue;
      }
    }
    if (row.kind === "block") {
      const chunk = `<div class="block">${row.paragraphs?.[0] ?? "block"}</div>`;
      if (openSectionSlugSource) openSectionParts.push(chunk);
      else splitParts.push(chunk);
    }
  }
  flush();

  return {
    splitInner: splitParts.join(""),
    postSplit: postParts.join(""),
    visualGuidesInPost: postParts.some((p) => p.includes("ns-visual-guides")),
    visualGuidesInSplit: splitParts.some((p) => p.includes("ns-visual-guides")),
    necklineSectionInPost: postParts.some((p) => p.includes("BACK NECKLINE")),
  };
}

describe("sleeveless back neckline subsection placement", () => {
  it("places BACK NECKLINE subsection in postSplit (outside garment text column)", () => {
    const scenario = SLEEVELESS_QA_SCENARIOS.find((s) => s.id === "pullover-round")!;
    const result = generateSleevelessBackPattern(scenario.patternData);
    const placement = simulateBackDisplayPlacement(result.displayRows);
    expect(placement.visualGuidesInPost).toBe(true);
    expect(placement.visualGuidesInSplit).toBe(false);
    expect(placement.necklineSectionInPost).toBe(true);
    expect(placement.postSplit).not.toContain("sleeveless-neckline-preview-split");
    expect(placement.postSplit).not.toContain("pattern-layout__sidebar");
  });

  it("wraps postSplit in a full-width block after the garment split (not inside the sticky grid)", () => {
    const post = '<section class="pattern-subsection sleeveless-piece-chart-fullwidth">neck</section>';
    const wrapped = `<div class="sleeveless-piece-layout">
  <div class="sleeveless-piece-split">
  <div class="sleeveless-piece-split__text"></div>
  <aside class="sleeveless-piece-split__diagram"></aside>
</div><div class="sleeveless-piece-neckline-fullwidth">${post}</div>
</div>`;
    expect(wrapped).toContain("sleeveless-piece-neckline-fullwidth");
    expect(wrapped).toMatch(/sleeveless-piece-split[\s\S]*<\/div>\s*<div class="sleeveless-piece-neckline-fullwidth">/);
    expect(wrapped).not.toContain("sleeveless-neckline-preview-split");
  });
});
