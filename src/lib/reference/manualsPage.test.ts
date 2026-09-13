import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(resolve("src/pages/manuals.astro"), "utf8");
const referenceIndexSource = readFileSync(
  resolve("src/pages/reference/index.astro"),
  "utf8"
);
const builtReferencePath = resolve("dist/reference/index.html");

describe("manuals resource page", () => {
  it("targets /manuals with knititnow.com canonical and indexable SEO metadata", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/manuals"'
    );
    expect(pageSource).toContain("href={CANONICAL_URL}");
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

  it("lists Knitting Machine Manuals on the References catalog source", () => {
    expect(referenceIndexSource).toContain(
      '{ title: "Knitting Machine Manuals", href: "/manuals", description: "Find free knitting machine, ribber, accessory, and service manuals." }'
    );
    expect(referenceIndexSource).toContain(
      '<a href="/manuals" class="reference-quick-links__item">Knitting Machine Manuals</a>'
    );
  });

  it("built /reference HTML contains exactly two /manuals links", () => {
    expect(existsSync(builtReferencePath)).toBe(true);

    const html = readFileSync(builtReferencePath, "utf8");
    const manualsHrefs = html.match(/href="\/manuals"/g) ?? [];
    expect(manualsHrefs).toHaveLength(2);

    const popularButtons =
      html.match(
        /<a\b(?=[^>]*href="\/manuals")(?=[^>]*class="[^"]*reference-quick-links__item[^"]*")[^>]*>\s*Knitting Machine Manuals\s*<\/a>/g
      ) ?? [];
    expect(popularButtons).toHaveLength(1);

    const machineCards =
      html.match(
        /<a\b(?=[^>]*href="\/manuals")(?=[^>]*class="[^"]*\bref-card\b[^"]*")[^>]*>[\s\S]*?Knitting Machine Manuals[\s\S]*?Find free knitting machine, ribber, accessory, and service manuals\.[\s\S]*?<\/a>/g
      ) ?? [];
    expect(machineCards).toHaveLength(1);
  });
});
