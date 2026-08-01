import { describe, expect, it } from "vitest";

import {
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
});
