import { describe, expect, it } from "vitest";
import { helpHubArticleAbsoluteUrl, helpHubArticlePath } from "./articleLink";

const PRINT_SLUG = "my-pattern-has-a-lot-of-pages-how-can-i-print-just-the-pages-i-want";

describe("helpHubArticlePath", () => {
  it("uses the stored slug and stays the same when the title changes", () => {
    const path = helpHubArticlePath(PRINT_SLUG);
    expect(path).toBe(`/help-hub/${PRINT_SLUG}`);
    expect(path).not.toContain("My pattern");
    expect(path).not.toContain("print just the pages");
    expect(helpHubArticlePath(`  ${PRINT_SLUG}  `)).toBe(path);
  });

  it("rejects an empty slug and a path that is not a single article id", () => {
    expect(helpHubArticlePath("")).toBe("");
    expect(helpHubArticlePath("   ")).toBe("");
    expect(helpHubArticlePath("../account")).toBe("");
    expect(helpHubArticlePath("print pages")).toBe("");
    expect(helpHubArticlePath("https://example.com/help-hub/other")).toBe("");
  });

  it("builds an absolute URL on the current site", () => {
    expect(helpHubArticleAbsoluteUrl(PRINT_SLUG, "https://kin-dev.netlify.app")).toBe(
      `https://kin-dev.netlify.app/help-hub/${PRINT_SLUG}`,
    );
    expect(helpHubArticleAbsoluteUrl(PRINT_SLUG, "https://kin-dev.netlify.app/")).toBe(
      `https://kin-dev.netlify.app/help-hub/${PRINT_SLUG}`,
    );
  });
});
