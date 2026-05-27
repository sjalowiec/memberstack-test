import { describe, expect, it } from "vitest";
import {
  buildShapingNotationChartHelpHtml,
  buildShapingNotationChartHelpVimeoSrc,
  SHAPING_NOTATION_CHART_HELP_VIMEO_ID,
} from "./shapingNotationGlossary";

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
