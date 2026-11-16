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

  it("keeps safe links and drops unsafe addresses", () => {
    expect(
      sanitizeCardDescriptionHtml('<p>See <a href="/tools">Tools</a> now</p>'),
    ).toBe('<p>See <a href="/tools">Tools</a> now</p>');
    expect(
      sanitizeCardDescriptionHtml('<p><a href="https://example.com/path">External</a></p>'),
    ).toBe(
      '<p><a href="https://example.com/path" rel="noopener noreferrer">External</a></p>',
    );
    expect(
      sanitizeCardDescriptionHtml('<p><a href="javascript:alert(1)">Bad</a></p>'),
    ).toBe("<p>Bad</p>");
  });

  it("removes scripts, iframes, unsafe images, styles, handlers, and unsupported tags", () => {
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

  it("cleans pasted formatted content to the allowlist", () => {
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
    expect(out).toContain('<a href="/patterns">Patterns</a>');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("MsoNormal");
    expect(out).not.toContain("style=");
    expect(out).not.toContain("<div");
  });

  it("keeps an editable image width through another save", () => {
    const sized =
      '<img src="/images/thank-you.jpg" alt="Thank you for your support" class="center" width="202"><p>Happy Thanksgiving!<br>Sue</p>';
    expect(sanitizeCardDescriptionHtml(sized)).toBe(sized);
    expect(sanitizeCardDescriptionHtml(sanitizeCardDescriptionHtml(sized))).toBe(sized);
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" class="center" style="width: 202px; height: 100px" onerror="alert(1)">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you" class="center" width="202"></p>');
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" width="70%">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you" style="width: 70%"></p>');
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" width="9999">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you"></p>');
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" style="width: expression(alert(1))">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you"></p>');
  });

  it("keeps a centered site image through another save", () => {
    const centered =
      '<img src="/images/thank-you.jpg" alt="Thank you for your support" class="center"><p>Happy Thanksgiving!<br>Sue</p>';
    expect(sanitizeCardDescriptionHtml(centered)).toBe(centered);
    expect(sanitizeCardDescriptionHtml(sanitizeCardDescriptionHtml(centered))).toBe(centered);
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" align="center" onerror="alert(1)">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you" class="center"></p>');
    expect(
      sanitizeCardDescriptionHtml(
        '<img src="/images/thank-you.jpg" alt="Thank you" class="center evil">',
      ),
    ).toBe('<p><img src="/images/thank-you.jpg" alt="Thank you" class="center"></p>');
  });

  it("keeps a site image and leaves other saved descriptions unchanged", () => {
    const image =
      '<img src="/images/thank-you.jpg" alt="Thank you"><p>It\u2019s been an interesting year! Thank you for your patience and support.</p><p>Sue</p>';
    expect(sanitizeCardDescriptionHtml(image)).toBe(image);
    expect(sanitizeCardDescriptionHtml(sanitizeCardDescriptionHtml(image))).toBe(image);

    const escaped =
      '<p>&amp;amp;lt;img src=&amp;quot;/images/thank-you.jpg&amp;quot;&amp;amp;gt; &amp;amp;lt;br&amp;amp;gt;</p><p>It\u2019s been an interesting year! Thank you for your patience and support.</p><p>Sue</p>';
    const restored = sanitizeCardDescriptionHtml(escaped);
    expect(restored).toBe(
      '<p><img src="/images/thank-you.jpg" alt=""> <br></p><p>It\u2019s been an interesting year! Thank you for your patience and support.</p><p>Sue</p>',
    );
    expect(sanitizeCardDescriptionHtml(restored)).toBe(restored);
  });

  it("drops remote, script, and traversal image addresses and event handlers", () => {
    expect(
      sanitizeCardDescriptionHtml(
        '<p>Hi <img src="/images/thank-you.jpg" alt="Thank you" onerror="alert(1)"> there</p>',
      ),
    ).toBe('<p>Hi <img src="/images/thank-you.jpg" alt="Thank you"> there</p>');
    expect(
      sanitizeCardDescriptionHtml('<p>No <img src="https://evil.test/a.jpg" alt="x"> pic</p>'),
    ).toBe("<p>No  pic</p>");
    expect(
      sanitizeCardDescriptionHtml('<p>No <img src="javascript:alert(1)" alt="x"> pic</p>'),
    ).toBe("<p>No  pic</p>");
    expect(
      sanitizeCardDescriptionHtml('<p>No <img src="//evil.test/a.jpg" alt="x"> pic</p>'),
    ).toBe("<p>No  pic</p>");
    expect(
      sanitizeCardDescriptionHtml('<p>No <img src="/images/../secret.jpg" alt="x"> pic</p>'),
    ).toBe("<p>No  pic</p>");
  });

  it("does not escape a saved message again", () => {
    const saved = "<p>A &amp; B</p>";
    expect(sanitizeCardDescriptionHtml(saved)).toBe(saved);
    expect(sanitizeCardDescriptionHtml(sanitizeCardDescriptionHtml(saved))).toBe(saved);
    const comparison = "<p>Use 2 &amp; 4, and a &lt; b.</p>";
    expect(sanitizeCardDescriptionHtml(comparison)).toBe(comparison);
    expect(sanitizeCardDescriptionHtml("&lt;p&gt;Hello&lt;/p&gt;")).toBe("<p>Hello</p>");
    expect(
      sanitizeCardDescriptionHtml("<p><strong>New</strong> tool</p><ul><li>Fast</li></ul>"),
    ).toBe("<p><strong>New</strong> tool</p><ul><li>Fast</li></ul>");
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
