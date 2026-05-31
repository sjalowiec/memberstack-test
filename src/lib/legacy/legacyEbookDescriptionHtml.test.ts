import { describe, expect, it } from "vitest";
import { sanitizeLegacyEbookDescriptionHtml } from "./legacyEbookDescriptionHtml";

describe("sanitizeLegacyEbookDescriptionHtml", () => {
  it("removes style and script blocks", () => {
    const html =
      '<style>img { width: 9999px; }</style><script>alert(1)</script><p>Safe</p>';
    const out = sanitizeLegacyEbookDescriptionHtml(html);
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain("<p>Safe</p>");
  });

  it("strips pdf links and javascript urls", () => {
    const html =
      '<a href="book.pdf">Download</a><a href="javascript:evil()">X</a><p>Ok</p>';
    const out = sanitizeLegacyEbookDescriptionHtml(html);
    expect(out).not.toMatch(/book\.pdf/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('href="#"');
    expect(out).toContain("<p>Ok</p>");
  });

  it("removes fixed width attributes that break layout", () => {
    const html = '<table width="70%" align="center"><tr><td>Hi</td></tr></table>';
    const out = sanitizeLegacyEbookDescriptionHtml(html);
    expect(out).not.toMatch(/\bwidth=/i);
    expect(out).toContain("<table");
  });
});
