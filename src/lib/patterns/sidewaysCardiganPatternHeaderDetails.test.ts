import { describe, expect, it } from "vitest";
import { buildSidewaysCardiganPatternHeaderDetailsHtml } from "./sidewaysCardiganPatternHeaderDetails";

describe("buildSidewaysCardiganPatternHeaderDetailsHtml", () => {
  it("lists saved choices without stitch or row counts", () => {
    const html = buildSidewaysCardiganPatternHeaderDetailsHtml({
      style: {
        garmentStyle: "cardigan",
        recipientCategory: "misses",
        sleeveDirection: "cuff-up",
        sleeveLength: "long",
      },
      fit: { selectedSize: "8", easeChoice: "standard" },
      yarnGaugeMachine: {
        gaugeStitchRaw: "20",
        gaugeRowRaw: "28",
        gaugeRawUnit: "in",
      },
    });

    expect(html).toContain("Cardigan");
    expect(html).toContain("Women's");
    expect(html).toContain("Chart size 8");
    expect(html).toContain("Standard");
    expect(html).toContain("Cuff up · Long");
    expect(html).toContain("20 sts / 28 rows over 4&quot;");
    expect(html).not.toContain("bust rows");
    expect(html).not.toContain("Garment length");
  });

  it("returns nothing when the saved pattern has no header details", () => {
    expect(buildSidewaysCardiganPatternHeaderDetailsHtml({})).toBe("");
  });
});
