import { describe, expect, it } from "vitest";
import {
  renderPatternDisplayBlockHtml,
  renderPatternDisplayRowsHtml,
  wrapPatternSectionHtml,
} from "./sleevelessPatternDisplayHtml";
import type { SleevelessPatternDisplayRow } from "./sleevelessPatternOutput";

describe("narrow Sleeveless display-row renderer", () => {
  it("wraps collapsible sections with the established pattern-section markup", () => {
    const html = wrapPatternSectionHtml("sg-body-cast-on", "CAST ON", "<p>inner</p>", {
      sectionClassName: "pattern-subsection",
    });
    expect(html).toContain('id="sg-body-cast-on"');
    expect(html).toContain("pattern-section pattern-subsection");
    expect(html).toContain("pattern-section__collapse");
    expect(html).toContain("<h2>CAST ON</h2>");
    expect(html).toContain("<p>inner</p>");
  });

  it("renders piece, section, and block rows without chart mounts", () => {
    const rows: SleevelessPatternDisplayRow[] = [
      { kind: "piece", title: "BODY" },
      { kind: "section", title: "CAST ON" },
      { kind: "block", rc: "RC: 000", paragraphs: ["Bring needles into work."], stitchCount: 70 },
      { kind: "neckShoulderChartTableMount" },
    ];
    const html = renderPatternDisplayRowsHtml(rows, { pieceSectionId: "body", omitPieceBanner: true });
    expect(html).toContain("sleeveless-pattern-instructions");
    expect(html).toContain("CAST ON");
    expect(html).toContain("RC: 000");
    expect(html).toContain("70 sts");
    expect(html).not.toContain("neckline-chart");
  });

  it("renders a trusted instruction block with stitch count", () => {
    const html = renderPatternDisplayBlockHtml(
      {
        kind: "block",
        rc: "RC: 070",
        paragraphs: [],
        trustedParagraphs: ["Bind off 36 stitches."],
        stitchCount: 110,
      },
      { pieceSectionId: "body" },
    );
    expect(html).toContain("sleeveless-pattern-rc");
    expect(html).toContain("Bind off 36 stitches.");
    expect(html).toContain("110 sts");
  });
});
