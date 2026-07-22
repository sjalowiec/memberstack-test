import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const footerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "Footer.astro"),
  "utf8",
);

describe("Footer Membership link", () => {
  it("shows a single Membership link to /membership in the essential footer links", () => {
    const membershipAnchors = [
      ...footerSource.matchAll(
        /<a\b[^>]*\bhref="(\/membership)"[^>]*>\s*Membership\s*<\/a>/g,
      ),
    ];

    expect(membershipAnchors).toHaveLength(1);
    expect(membershipAnchors[0]?.[1]).toBe("/membership");
    expect(footerSource).toContain('data-testid="footer-membership"');

    // Restored in the essential links block (after Work With Sue).
    expect(footerSource).toMatch(
      /data-testid="footer-work-with-sue">Work With Sue<\/a>\s*<a href="\/membership" data-testid="footer-membership">Membership<\/a>/,
    );
  });

  it("does not leave the previously commented-out Membership link in place", () => {
    expect(footerSource).not.toContain(
      '<!--<a href="/membership" data-testid="footer-membership">Membership</a>-->',
    );
    expect(footerSource).not.toMatch(
      /<!--\s*<a[^>]*href="\/membership"[^>]*>\s*Membership\s*<\/a>\s*-->/,
    );
  });

  it("does not render a second Membership footer link", () => {
    const testIds = [...footerSource.matchAll(/data-testid="footer-membership"/g)];
    expect(testIds).toHaveLength(1);

    const labelMatches = [...footerSource.matchAll(/>\s*Membership\s*</g)];
    expect(labelMatches).toHaveLength(1);
  });
});
