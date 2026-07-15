import { describe, expect, it } from "vitest";
import { SHAPING_NOTATION_CHART_HELP_VIMEO_ID } from "../glossary/shapingNotationGlossary";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { SAMPLE_SHAPING_MAP_DATA } from "./shapingMapSvg";

describe("buildPatternVisualGuidesHtml", () => {
  it("returns empty string when notation is unsupported and no shaping map", () => {
    expect(buildPatternVisualGuidesHtml({ piece: "back" })).toBe("");
    expect(
      buildPatternVisualGuidesHtml({ piece: "front", notationSupported: false, shapingMapData: null }),
    ).toBe("");
  });

  it("renders a Shaping Notation card with inline host and help video trigger", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "back",
      notationSupported: true,
      construction: "sleeveless",
    });
    expect(html).toContain("Visual Guides");
    expect(html).toContain("Shaping Notation");
    expect(html).not.toContain("Japanese Notation");
    expect(html).not.toContain("Shaping Map");
    expect(html).toContain("ns-visual-guides__grid--single");
    expect(html).toContain("data-pattern-notation-host");
    expect(html).toContain('data-pattern-notation-piece="back"');
    expect(html).toContain("data-pattern-notation-enlarge");
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
    expect(html).not.toContain("ns-visual-guides__zoom");
    expect(html).not.toContain("ns-visual-guides__preview-img");
    expect(html).toContain("Watch How This Chart Works");
    expect(html).toContain(`data-sleeveless-video-id="${SHAPING_NOTATION_CHART_HELP_VIMEO_ID}"`);
    expect(html).toContain('aria-label="Enlarge shaping notation"');
  });

  it("renders Shaping Notation and Shaping Map side by side when both exist", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      shapingMapData: SAMPLE_SHAPING_MAP_DATA,
    });
    expect(html).toContain("Shaping Notation");
    expect(html).toContain("Shaping Map");
    expect(html).toContain("data-pattern-notation-host");
    expect(html).toContain('data-pattern-notation-piece="front"');
    expect(html).toContain("data-pattern-notation-enlarge");
    expect(html).toContain("data-shaping-map-enlarge");
    expect(html).not.toContain("ns-visual-guides__grid--single");
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
    expect(html).toContain('id="ns-visual-guides-heading-front"');
    expect(html).toContain("Watch How This Chart Works");
  });

  it("sleeves use inline notation host with enlarge control", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "sleeve",
      notationSupported: true,
      construction: "drop-shoulder",
    });
    expect(html).toContain('data-pattern-notation-piece="sleeve"');
    expect(html).toContain("data-pattern-notation-enlarge");
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
    expect(html).toContain('id="ns-visual-guides-heading-sleeve"');
    expect(html).toContain("Shaping Notation");
  });

  it("omits shaping map card when shapingMapData is null", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      shapingMapData: null,
    });
    expect(html).not.toContain("Shaping Map");
    expect(html).toContain("ns-visual-guides__grid--single");
    expect(html).toContain("Shaping Notation");
  });
});
