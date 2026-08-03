import { describe, expect, it } from "vitest";

import {
  cardDescriptionPlainText,
  sanitizeCardDescriptionHtml,
} from "./sanitizeBillboardHtml";

describe("sanitizeCardDescriptionHtml", () => {
  it("keeps existing plain text as a safe paragraph", () => {
    expect(sanitizeCardDescriptionHtml("A brand new tool is here")).toBe(
      "<p>A brand new tool is here</p>",
    );
    expect(cardDescriptionPlainText("A brand new tool is here")).toBe(
      "A brand new tool is here",
    );
  });

  it("normalizes plain text paragraphs and line breaks", () => {
    expect(sanitizeCardDescriptionHtml("Line one\nLine two")).toBe(
      "<p>Line one<br>Line two</p>",
    );
    expect(sanitizeCardDescriptionHtml("Para one\n\nPara two")).toBe(
      "<p>Para one</p><p>Para two</p>",
    );
    expect(sanitizeCardDescriptionHtml("A & B < C")).toBe("<p>A &amp; B &lt; C</p>");
  });

  it("keeps paragraphs and <br>", () => {
    expect(sanitizeCardDescriptionHtml("<p>Hi<br>there</p>")).toBe("<p>Hi<br>there</p>");
  });

  it("normalizes <b> to <strong> and <i> to <em>", () => {
    expect(sanitizeCardDescriptionHtml("<p><b>Bold</b> and <i>italic</i></p>")).toBe(
      "<p><strong>Bold</strong> and <em>italic</em></p>",
    );
  });

  it("keeps bold and italic emphasis", () => {
    expect(
      sanitizeCardDescriptionHtml("<p><strong>Bold</strong> <em>italic</em></p>"),
    ).toBe("<p><strong>Bold</strong> <em>italic</em></p>");
  });

  it("allows bulleted lists", () => {
    expect(sanitizeCardDescriptionHtml("<ul><li>One</li><li>Two</li></ul>")).toBe(
      "<ul><li>One</li><li>Two</li></ul>",
    );
  });

  it("allows numbered lists", () => {
    expect(sanitizeCardDescriptionHtml("<ol><li>First</li><li>Second</li></ol>")).toBe(
      "<ol><li>First</li><li>Second</li></ol>",
    );
  });

  it("removes links but preserves their visible text", () => {
    expect(
      sanitizeCardDescriptionHtml('<p>See <a href="/tools">Tools</a> now</p>'),
    ).toBe("<p>See Tools now</p>");
    expect(
      sanitizeCardDescriptionHtml('<p><a href="https://example.com">External</a></p>'),
    ).toBe("<p>External</p>");
    expect(
      sanitizeCardDescriptionHtml('<p><a href="javascript:alert(1)">Bad</a></p>'),
    ).toBe("<p>Bad</p>");
  });

  it("removes scripts, iframes, images, styles, handlers, and unsupported tags", () => {
    expect(
      sanitizeCardDescriptionHtml("<p>Safe<script>alert(1)</script> text</p>"),
    ).toBe("<p>Safe text</p>");

    expect(sanitizeCardDescriptionHtml('<p onclick="evil()">Click</p>')).toBe(
      "<p>Click</p>",
    );

    expect(sanitizeCardDescriptionHtml('<p style="color:red">Styled</p>')).toBe(
      "<p>Styled</p>",
    );

    expect(
      sanitizeCardDescriptionHtml('<p>Pic <img src="x.jpg" onerror="evil()"> done</p>'),
    ).toBe("<p>Pic  done</p>");

    expect(
      sanitizeCardDescriptionHtml('<p>Vid</p><iframe src="https://evil.test"></iframe>'),
    ).toBe("<p>Vid</p>");

    expect(
      sanitizeCardDescriptionHtml("<p>Hi</p><h2>Nope</h2><table><tr><td>x</td></tr></table>"),
    ).toBe("<p>Hi</p>Nopex");
  });

  it("cleans pasted formatted content to the allowlist without links", () => {
    const pasted = `
      <div class="MsoNormal" style="margin:0">
        <b>Hello</b>
        <a href="/patterns">Patterns</a>
        <ul><li>Item</li></ul>
        <img src="paste.png">
      </div>
    `;
    const out = sanitizeCardDescriptionHtml(pasted);
    expect(out).toContain("<strong>Hello</strong>");
    expect(out).toContain("<ul><li>Item</li></ul>");
    expect(out).toContain("Patterns");
    expect(out).not.toContain("<a");
    expect(out).not.toContain("href");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("MsoNormal");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("<div");
  });

  it("treats markup with no visible text as empty", () => {
    expect(sanitizeCardDescriptionHtml("<p></p>")).toBe("");
    expect(sanitizeCardDescriptionHtml("<p><br></p>")).toBe("");
    expect(sanitizeCardDescriptionHtml("<script>alert(1)</script>")).toBe("");
  });

  it("summarizes formatted descriptions as plain text for admin previews", () => {
    expect(
      cardDescriptionPlainText("<p><strong>New</strong> tool</p><ul><li>Fast</li></ul>"),
    ).toBe("New tool Fast");
  });
});
