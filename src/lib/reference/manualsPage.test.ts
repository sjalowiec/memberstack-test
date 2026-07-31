import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve("src/pages/manuals.astro"), "utf8");
const referenceIndexSource = readFileSync(
  resolve("src/pages/reference/index.astro"),
  "utf8"
);

describe("manuals resource page", () => {
  it("targets /manuals with knititnow.com canonical and indexable SEO metadata", () => {
    expect(pageSource).toContain('export const prerender = true');
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/manuals"'
    );
    expect(pageSource).toContain('href={CANONICAL_URL}');
    expect(pageSource).toContain(
      'const SEO_TITLE = "Knitting Machine Manuals | Free Machine Knitting Manuals"'
    );
    expect(pageSource).toMatch(/free knitting machine manuals/i);
    expect(pageSource).not.toContain("noindex");
  });

  it("uses one H1 via ReferencePageShell and the requested heading copy", () => {
    expect(pageSource.match(/<h1\b/g)?.length ?? 0).toBe(0);
    expect(pageSource).toContain(
      'const PAGE_H1 = "Looking for a Knitting Machine Manual?"'
    );
    expect(pageSource).toContain("title={PAGE_H1}");
  });

  it("links to MK Manuals with safe external-link attributes", () => {
    expect(pageSource).toContain(
      'const MK_MANUALS_URL = "https://mkmanuals.com/"'
    );
    expect(pageSource).toContain("href={MK_MANUALS_URL}");
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain('rel="noopener noreferrer"');
    expect(pageSource).toContain(
      "MK Manuals is an independent website and is not operated by Knit It Now."
    );
  });

  it("links only to existing internal resource routes", () => {
    expect(pageSource).toContain('href: "/reference/machines"');
    expect(pageSource).toContain('href: "/reference/repairs"');
    expect(pageSource).toContain('href: "/getting-started"');
    expect(pageSource).toContain('href: "/troubleshoot"');
    expect(pageSource).not.toContain("/reference/manuals");
  });

  it("is listed on the References index at /manuals", () => {
    expect(referenceIndexSource).toContain(
      '{ title: "Machine Manuals", href: "/manuals"'
    );
    expect(referenceIndexSource).toContain('href="/manuals"');
    expect(referenceIndexSource).not.toContain('href="/reference/manuals"');
  });
});
