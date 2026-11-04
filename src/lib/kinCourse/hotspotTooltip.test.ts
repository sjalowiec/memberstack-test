import { describe, expect, it } from "vitest";
import { formatHotspotTooltipHtml, hotspotTooltipAccessibleName } from "./hotspotTooltip";

describe("formatHotspotTooltipHtml", () => {
  it("renders a bold title and a line break for the Operation Panel tooltip", () => {
    const html = formatHotspotTooltipHtml(
      '<b>Operation Panel</b><br>\r\nYour "keyboard" to give instructions to the machine',
    );
    expect(html).toBe(
      '<strong>Operation Panel</strong><br>\r\nYour &quot;keyboard&quot; to give instructions to the machine',
    );
    expect(html).not.toContain("&lt;b&gt;");
    expect(html).not.toContain("&lt;br&gt;");
  });

  it("keeps a plain-text label as text", () => {
    expect(formatHotspotTooltipHtml("Sponge Bar")).toBe("Sponge Bar");
    expect(formatHotspotTooltipHtml("A & B < C")).toBe("A &amp; B &lt; C");
    expect(formatHotspotTooltipHtml("Line one\nLine two")).toBe("Line one<br>Line two");
  });

  it("linkifies a plain-text web address", () => {
    expect(formatHotspotTooltipHtml("See https://knititnow.com/tools")).toBe(
      'See <a href="https://knititnow.com/tools" target="_blank" rel="noopener noreferrer">https://knititnow.com/tools</a>',
    );
  });

  it("keeps list formatting and drops wrappers, styles, and scripts", () => {
    const html = formatHotspotTooltipHtml(
      '<div style="text-align:left;"><b>Change Knob</b><br>Choose a setting<ul><li>N-L</li><li>KC</li></ul></div><script>alert(1)</script>',
    );
    expect(html).toContain("<strong>Change Knob</strong><br>Choose a setting");
    expect(html).toContain("<ul><li>N-L</li><li>KC</li></ul>");
    expect(html).not.toContain("text-align");
    expect(html).not.toContain("script");
    expect(html).not.toContain("alert");
  });

  it("drops an inline event handler", () => {
    expect(formatHotspotTooltipHtml('<b onclick="evil()">Power Switch</b>')).toBe(
      "<strong>Power Switch</strong>",
    );
  });
});

describe("hotspotTooltipAccessibleName", () => {
  it("reads the title and explanation without tags", () => {
    expect(
      hotspotTooltipAccessibleName(
        '<b>Operation Panel</b><br>\r\nYour "keyboard" to give instructions to the machine',
      ),
    ).toBe('Operation Panel Your "keyboard" to give instructions to the machine');
    expect(hotspotTooltipAccessibleName("Sponge Bar")).toBe("Sponge Bar");
  });
});
