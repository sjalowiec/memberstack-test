import { describe, expect, it } from "vitest";
import {
  canonicalHelpHubSolutionHtml,
  helpHubSolutionImageTag,
} from "./solutionHtml";

const IMAGE_AND_TEXT =
  '<img src="/images/thank-you.jpg" alt="Thank you from Sue">\n<p>Thanks for knitting with me.</p>';

const ENCODED_IMAGE =
  "&amp;amp;amp;amp;lt;img src=&amp;amp;amp;quot;/images/thank-you.jpg&amp;amp;amp;quot;&amp;amp;amp;amp;gt;";

const ORDINARY =
  'Use 2 & 4, and "needles" if a < b.';

describe("canonicalHelpHubSolutionHtml", () => {
  it("restores a repeatedly escaped image without changing it again", () => {
    const once = canonicalHelpHubSolutionHtml(ENCODED_IMAGE);
    expect(once).toBe('<img src="/images/thank-you.jpg">');
    expect(canonicalHelpHubSolutionHtml(once)).toBe(once);
  });

  it("keeps an image and a paragraph stable across repeated saves", () => {
    const once = canonicalHelpHubSolutionHtml(IMAGE_AND_TEXT);
    expect(once).toBe(IMAGE_AND_TEXT);
    expect(canonicalHelpHubSolutionHtml(once)).toBe(once);
  });

  it("preserves ordinary ampersands, quotes, and angle brackets", () => {
    expect(canonicalHelpHubSolutionHtml(ORDINARY)).toBe(ORDINARY);
    expect(canonicalHelpHubSolutionHtml(canonicalHelpHubSolutionHtml(ORDINARY))).toBe(ORDINARY);
  });

  it("keeps an existing link ampersand as written", () => {
    const link =
      'Browse: <a href="/stitch?machine=lk150&category=tuck">tuck stitches</a>.';
    expect(canonicalHelpHubSolutionHtml(link)).toBe(link);
    const stored =
      '<a href="/stitch?machine=lk150&amp;category=tuck">tuck stitches</a>';
    expect(canonicalHelpHubSolutionHtml(stored)).toBe(stored);
  });

  it("removes scripts and inline handlers", () => {
    expect(
      canonicalHelpHubSolutionHtml('<p>Hi</p><script>alert(1)</script><img src="/images/thank-you.jpg" onerror="alert(1)" alt="">'),
    ).toBe('<p>Hi</p><img src="/images/thank-you.jpg" alt="">');
  });

  it("drops javascript image addresses", () => {
    expect(canonicalHelpHubSolutionHtml('<img src="javascript:alert(1)" alt="x">')).toBe(
      '<img alt="x">',
    );
  });
});

describe("helpHubSolutionImageTag", () => {
  it("builds a site image with alt text", () => {
    expect(helpHubSolutionImageTag("/images/thank-you.jpg", "Thank you from Sue")).toBe(
      '<img src="/images/thank-you.jpg" alt="Thank you from Sue">',
    );
  });

  it("rejects remote and quoted addresses", () => {
    expect(helpHubSolutionImageTag("https://example.com/a.jpg", "Alt")).toBeNull();
    expect(helpHubSolutionImageTag('/images/a".jpg', "Alt")).toBeNull();
  });
});
