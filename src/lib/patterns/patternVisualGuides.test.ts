import { describe, expect, it } from "vitest";
import { buildPatternVisualGuidesHtml } from "./patternVisualGuides";
import { SAMPLE_SHAPING_MAP_DATA } from "./shapingMapSvg";

describe("buildPatternVisualGuidesHtml", () => {
  it("returns empty string when notation is unsupported and no shaping map", () => {
    expect(buildPatternVisualGuidesHtml({ piece: "back" })).toBe("");
    expect(
      buildPatternVisualGuidesHtml({ piece: "front", notationSupported: false, shapingMapData: null }),
    ).toBe("");
  });

  it("renders a single Japanese Notation card when only notation is available", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "back",
      notationSupported: true,
      construction: "sleeveless",
    });
    expect(html).toContain("Visual Guides");
    expect(html).toContain("Japanese Notation");
    expect(html).not.toContain("Shaping Map");
    expect(html).toContain("ns-visual-guides__grid--single");
    expect(html).toContain('data-neckline-notation-preview-trigger="back"');
    expect(html).toContain("diagram-jp-back-preview.svg");
  });

  it("renders inline notation host when notationInline is true", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      notationInline: true,
      shapingMapData: SAMPLE_SHAPING_MAP_DATA,
    });
    expect(html).toContain("data-pattern-notation-host");
    expect(html).toContain('data-pattern-notation-piece="front"');
    expect(html).toContain("data-pattern-notation-enlarge");
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
  });

  it("renders Japanese Notation and Shaping Map side by side when both exist", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      notationInline: true,
      shapingMapData: SAMPLE_SHAPING_MAP_DATA,
    });
    expect(html).toContain("Japanese Notation");
    expect(html).toContain("Shaping Map");
    expect(html).toContain("data-shaping-map-enlarge");
    expect(html).not.toContain("ns-visual-guides__grid--single");
    expect(html).toContain('id="ns-visual-guides-heading-front"');
  });

  it("sleeves always use inline notation (no quick-reference preview)", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "sleeve",
      notationSupported: true,
      construction: "drop-shoulder",
    });
    expect(html).toContain('data-pattern-notation-piece="sleeve"');
    expect(html).not.toContain("data-neckline-notation-preview-trigger");
    expect(html).toContain('id="ns-visual-guides-heading-sleeve"');
  });

  it("omits shaping map card when shapingMapData is null", () => {
    const html = buildPatternVisualGuidesHtml({
      piece: "front",
      notationSupported: true,
      shapingMapData: null,
    });
    expect(html).not.toContain("Shaping Map");
    expect(html).toContain("ns-visual-guides__grid--single");
  });
});
