import { describe, expect, it } from "vitest";
import {
  buildShapingNotationChartHelpHtml,
  buildShapingNotationChartHelpTriggerHtml,
  buildShapingNotationChartHelpVimeoSrc,
  SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
} from "./shapingNotationGlossary";

describe("buildShapingNotationChartHelpTriggerHtml", () => {
  it("renders a compact Watch How This Chart Works trigger for Visual Guides", () => {
    const html = buildShapingNotationChartHelpTriggerHtml(
      (s) => s.replace(/"/g, "&quot;"),
      (s) => s,
    );
    expect(html).toContain("Watch How This Chart Works");
    expect(html).toContain(`data-sleeveless-video-id="${SHAPING_NOTATION_CHART_HELP_VIMEO_ID}"`);
    expect(html).toContain("ns-visual-guides__notation-help");
  });
});

describe("buildShapingNotationChartHelpHtml", () => {
  it("embeds the shaping notation help Vimeo video with watch-larger modal trigger", () => {
    const html = buildShapingNotationChartHelpHtml(
      (s) => s.replace(/"/g, "&quot;"),
      (s) => s,
    );
    expect(html).toContain("Watch How This Chart Works");
    expect(html).toContain(
      "See how the shaping notation matches the row-by-row instructions while knitting.",
    );
    expect(html).toContain(
      buildShapingNotationChartHelpVimeoSrc(SHAPING_NOTATION_CHART_HELP_VIMEO_ID),
    );
    expect(html).toContain('allow="autoplay; fullscreen; picture-in-picture"');
    expect(html).toContain("allowfullscreen");
    expect(html).toContain(`data-sleeveless-video-id="${SHAPING_NOTATION_CHART_HELP_VIMEO_ID}"`);
    expect(html).toContain("Watch larger");
    expect(html).toContain("hidden");
  });
});
