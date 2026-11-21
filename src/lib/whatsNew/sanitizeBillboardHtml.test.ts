import { describe, expect, it } from "vitest";

import {
  billboardCopyHasRichMarkup,
  billboardImageTag,
  billboardMessageHasContent,
  billboardMessageHasText,
  billboardMessagePlainText,
  plainTextToBillboardHtml,
  sanitizeBillboardHtml,
} from "./sanitizeBillboardHtml";

describe("sanitizeBillboardHtml", () => {
  it("normalizes plain text into paragraphs and line breaks", () => {
    expect(sanitizeBillboardHtml("Hello world")).toBe("<p>Hello world</p>");
    expect(sanitizeBillboardHtml("Line one\nLine two")).toBe("<p>Line one<br>Line two</p>");
    expect(sanitizeBillboardHtml("Para one\n\nPara two")).toBe(
      "<p>Para one</p><p>Para two</p>",
    );
    expect(plainTextToBillboardHtml("A & B < C")).toBe("<p>A &amp; B &lt; C</p>");
  });

  it("keeps paragraphs and br, and normalizes bold/italic tags", () => {
    expect(sanitizeBillboardHtml("<p>Hi<br>there</p>")).toBe("<p>Hi<br>there</p>");
    expect(sanitizeBillboardHtml("<p><b>Bold</b> and <i>italic</i></p>")).toBe(
      "<p><strong>Bold</strong> and <em>italic</em></p>",
    );
    expect(sanitizeBillboardHtml("<p><strong>Bold</strong> <em>italic</em></p>")).toBe(
      "<p><strong>Bold</strong> <em>italic</em></p>",
    );
  });

  it("allows bulleted and numbered lists", () => {
    expect(sanitizeBillboardHtml("<ul><li>One</li><li>Two</li></ul>")).toBe(
      "<ul><li>One</li><li>Two</li></ul>",
    );
    expect(sanitizeBillboardHtml("<ol><li>First</li><li>Second</li></ol>")).toBe(
      "<ol><li>First</li><li>Second</li></ol>",
    );
  });

  it("allows safe internal and external links", () => {
    expect(sanitizeBillboardHtml('<p><a href="/tools">Tools</a></p>')).toBe(
      '<p><a href="/tools">Tools</a></p>',
    );
    expect(
      sanitizeBillboardHtml('<p><a href="https://example.com/path">Out</a></p>'),
    ).toBe('<p><a href="https://example.com/path" rel="noopener noreferrer">Out</a></p>');
  });

  it("removes scripts, handlers, styles, unsupported tags, and unsafe hrefs", () => {
    expect(
      sanitizeBillboardHtml('<p>Safe<script>alert(1)</script> text</p>'),
    ).toBe("<p>Safe text</p>");

    expect(
      sanitizeBillboardHtml('<p onclick="evil()">Click</p>'),
    ).toBe("<p>Click</p>");

    expect(
      sanitizeBillboardHtml('<p style="color:red">Styled</p>'),
    ).toBe("<p>Styled</p>");

    expect(
      sanitizeBillboardHtml("<p>Hi</p><h2>Nope</h2><table><tr><td>x</td></tr></table>"),
    ).toBe("<p>Hi</p>Nopex");

    expect(
      sanitizeBillboardHtml('<p><a href="javascript:alert(1)">Bad</a></p>'),
    ).toBe("<p>Bad</p>");

    expect(
      sanitizeBillboardHtml('<p><a href="//evil.example">Proto</a></p>'),
    ).toBe("<p>Proto</p>");

    expect(
      sanitizeBillboardHtml('<p><a href="data:text/html,x">Data</a></p>'),
    ).toBe("<p>Data</p>");

    expect(
      sanitizeBillboardHtml('<p><a href="https://x.com" onclick="x">Ok</a></p>'),
    ).toBe('<p><a href="https://x.com/" rel="noopener noreferrer">Ok</a></p>');

    expect(
      sanitizeBillboardHtml('<p>Pic <img src="x.jpg" onerror="evil()"> done</p>'),
    ).toBe("<p>Pic  done</p>");

    expect(
      sanitizeBillboardHtml('<p>Vid</p><iframe src="https://evil.test"></iframe>'),
    ).toBe("<p>Vid</p>");
  });

  it("cleans pasted formatted content to the allowlist", () => {
    const pasted = `
      <div class="MsoNormal" style="margin:0">
        <b>Hello</b>
        <a href="javascript:void(0)">skip</a>
        <a href="/patterns">Patterns</a>
        <ul><li>Item</li></ul>
        <img src="paste.png">
      </div>
    `;
    const out = sanitizeBillboardHtml(pasted);
    expect(out).toContain("<strong>Hello</strong>");
    expect(out).toContain('<a href="/patterns">Patterns</a>');
    expect(out).toContain("<ul><li>Item</li></ul>");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("<img");
    expect(
      sanitizeBillboardHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you"><p>Hello</p>',
      ),
    ).toBe('<img src="/images/thank-you.jpg" alt="Thank you"><p>Hello</p>');
    expect(out).not.toContain("MsoNormal");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("<div");
  });

  it("treats empty markup as empty for visibility checks", () => {
    expect(billboardMessageHasText("<p></p>")).toBe(false);
    expect(billboardMessageHasText("<p><br></p>")).toBe(false);
    expect(billboardMessageHasText("<p>Hi</p>")).toBe(true);
    expect(billboardMessagePlainText("<p>A &amp; B</p>")).toBe("A & B");
  });

  it("turns nbsp into a non-breaking space without escaping it again", () => {
    const once = sanitizeBillboardHtml("<p>Hello&nbsp;world</p>");
    expect(once).toBe("<p>Hello\u00A0world</p>");
    expect(sanitizeBillboardHtml(once)).toBe(once);
    expect(sanitizeBillboardHtml("<p>Hello&amp;nbsp;world</p>")).toBe(once);
    expect(sanitizeBillboardHtml("<p>Hello&amp;amp;nbsp;world</p>")).toBe(once);
    expect(sanitizeBillboardHtml("Hello&nbsp;world")).toBe(once);
    const stacked = `<p>Hello${"&" + "amp;".repeat(12)}nbsp;world</p>`;
    expect(sanitizeBillboardHtml(stacked)).toBe(once);
    expect(sanitizeBillboardHtml(sanitizeBillboardHtml(stacked))).toBe(once);
    expect(sanitizeBillboardHtml("<p>A &amp; B</p>")).toBe("<p>A &amp; B</p>");
    expect(sanitizeBillboardHtml(sanitizeBillboardHtml("<p>A &amp; B</p>"))).toBe(
      "<p>A &amp; B</p>",
    );
  });

  it("keeps an image-only message and treats images as rich content", () => {
    const image = '<p><img src="/images/swatch.jpg" alt="Swatch"></p>';
    expect(sanitizeBillboardHtml('<img src="/images/swatch.jpg" alt="Swatch">')).toBe(image);
    expect(billboardMessageHasText(image)).toBe(false);
    expect(billboardMessageHasContent(image)).toBe(true);
    expect(billboardCopyHasRichMarkup(image)).toBe(true);
    expect(billboardCopyHasRichMarkup("<p>Hello</p>")).toBe(false);
    expect(billboardCopyHasRichMarkup("<p>One</p><p>Two</p>")).toBe(true);
  });

  it("builds a safe centered image tag with a width", () => {
    expect(
      billboardImageTag({
        src: "/images/swatch.jpg",
        alt: 'A "swatch"',
        width: "202",
        center: true,
      }),
    ).toBe('<img src="/images/swatch.jpg" alt="A &quot;swatch&quot;" class="center" width="202">');
    expect(
      billboardImageTag({ src: "/images/swatch.jpg", alt: "Swatch", width: "70%" }),
    ).toBe('<img src="/images/swatch.jpg" alt="Swatch" style="width: 70%">');
    expect(billboardImageTag({ src: "https://evil.test/a.jpg", alt: "No" })).toBeNull();
    expect(sanitizeBillboardHtml(billboardImageTag({
      src: "/images/swatch.jpg",
      alt: "Swatch",
      width: "202",
      center: true,
    })!)).toContain('width="202"');
  });
});
