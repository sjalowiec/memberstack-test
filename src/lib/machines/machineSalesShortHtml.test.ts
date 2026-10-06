import { describe, expect, it } from "vitest";
import { sanitizeMachineSalesShortHtml } from "./machineSalesShortHtml";

describe("sanitizeMachineSalesShortHtml", () => {
  it("leaves plain text unchanged except for HTML escaping", () => {
    const plain =
      "At 9mm this Taitexma (tie-tex-ma) machine is the perfect gauge for popular hand knitting and hand-spun yarns.\n\nMetal bed, this machine will provide years of service.";
    expect(sanitizeMachineSalesShortHtml(plain)).toBe(plain);
    expect(sanitizeMachineSalesShortHtml(plain)).not.toContain("<p>");
    expect(sanitizeMachineSalesShortHtml(plain)).not.toContain("<br>");
  });

  it("escapes raw < and & in plain text", () => {
    expect(sanitizeMachineSalesShortHtml("A & B < C")).toBe("A &amp; B &lt; C");
  });

  it("renders the short-description tags used on shop cards", () => {
    const input = [
      "<strong>Temporarily Out of Stock</strong><br>",
      "Expected back in stock in early December.",
      "",
      "<p>At 9mm this Taitexma (tie-tex-ma) machine is the perfect gauge for popular hand knitting and hand-spun yarns.</p>",
    ].join("\n");
    expect(sanitizeMachineSalesShortHtml(input)).toBe(
      [
        "<strong>Temporarily Out of Stock</strong><br>",
        "Expected back in stock in early December.",
        "",
        "<p>At 9mm this Taitexma (tie-tex-ma) machine is the perfect gauge for popular hand knitting and hand-spun yarns.</p>",
      ].join("\n"),
    );
  });

  it("keeps existing emphasis markup", () => {
    expect(
      sanitizeMachineSalesShortHtml(
        "At 4.5mm this Taitexma <em>(tie-tex-ma)</em> machine is the perfect gauge for finer yarns.",
      ),
    ).toBe(
      "<p>At 4.5mm this Taitexma <em>(tie-tex-ma)</em> machine is the perfect gauge for finer yarns.</p>",
    );
  });

  it("normalizes b and i and keeps simple lists and safe links", () => {
    expect(
      sanitizeMachineSalesShortHtml(
        '<p><b>Bold</b> and <i>italic</i></p><ul><li>One</li></ul><ol><li>Two</li></ol><p><a href="https://knititnow.com/shop">Shop</a></p>',
      ),
    ).toBe(
      '<p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><ol><li>Two</li></ol><p><a href="https://knititnow.com/shop" rel="noopener noreferrer">Shop</a></p>',
    );
  });

  it("drops scripts, event handlers, and unsafe links", () => {
    expect(
      sanitizeMachineSalesShortHtml(
        '<p>Safe<script>alert(1)</script> text</p><p onclick="evil()">Click</p><p><a href="javascript:alert(1)">Bad</a></p>',
      ),
    ).toBe("<p>Safe text</p><p>Click</p><p>Bad</p>");
    expect(sanitizeMachineSalesShortHtml("<script>alert(1)</script>")).toBe("");
    expect(sanitizeMachineSalesShortHtml('<iframe src="https://evil.test"></iframe>')).toBe("");
  });
});
