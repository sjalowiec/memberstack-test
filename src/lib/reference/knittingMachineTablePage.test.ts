import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  resolve("src/pages/reference/knitting-machine-table.astro"),
  "utf8",
);
const referenceIndexSource = readFileSync(
  resolve("src/pages/reference/index.astro"),
  "utf8",
);
const favoriteCatalogSource = readFileSync(
  resolve("src/lib/favorites/referenceFavoriteCatalog.ts"),
  "utf8",
);

const primaryImage = resolve(
  "public/images/references/knitting-machine-table/ultra2.jpg",
);
const supportingImage = resolve(
  "public/images/references/knitting-machine-table/adjustable-knitting-machine-table.jpg",
);

describe("knitting machine table reference page", () => {
  it("is a public prerendered reference page with SEO metadata", () => {
    expect(pageSource).toContain("export const prerender = true");
    expect(pageSource).toContain(
      'const CANONICAL_URL = "https://knititnow.com/reference/knitting-machine-table"',
    );
    expect(pageSource).toContain("href={CANONICAL_URL}");
    expect(pageSource).toContain('const SEO_TITLE = "Best Knitting Machine Table"');
    expect(pageSource).toMatch(/sturdy, height-adjustable knitting machine table/i);
    expect(pageSource).not.toContain("noindex");
  });

  it("uses the site reference route and expected page heading", () => {
    expect(pageSource).toContain(
      'const PAGE_H1 = "The Best Knitting Machine Table... Ever!"',
    );
    expect(pageSource).toContain("title={PAGE_H1}");
    expect(pageSource).toContain('href="/reference"');
    expect(pageSource).toContain("Back to References");
  });

  it("links to Amazon with sponsored external-link attributes", () => {
    expect(pageSource).toContain(
      "https://www.amazon.com/gp/product/B071VFXPFB/ref=as_li_tl?ie=UTF8&tag=knititnow-20&camp=1789&creative=9325&linkCode=as2&creativeASIN=B071VFXPFB&linkId=3110375e7e6b40bd6e2b8763451655be",
    );
    expect(pageSource).toContain('target="_blank"');
    expect(pageSource).toContain('rel="sponsored noopener noreferrer"');
    expect(pageSource).toContain("View the Table on Amazon");
    expect(pageSource).toContain(
      "Affiliate note: If you purchase through this link, Knit It Now may earn a",
    );
  });

  it("places the in-use setup photo first and the product photo second", () => {
    expect(existsSync(primaryImage)).toBe(true);
    expect(existsSync(supportingImage)).toBe(true);
    expect(pageSource).toContain(
      'src: "/images/references/knitting-machine-table/ultra2.jpg"',
    );
    expect(pageSource).toContain(
      'src: "/images/references/knitting-machine-table/adjustable-knitting-machine-table.jpg"',
    );

    const primaryIndex = pageSource.indexOf("PRIMARY_IMAGE");
    const supportingIndex = pageSource.indexOf("SUPPORTING_IMAGE");
    expect(primaryIndex).toBeGreaterThan(-1);
    expect(supportingIndex).toBeGreaterThan(primaryIndex);
  });

  it("is listed on the References catalog and favorite catalog", () => {
    expect(referenceIndexSource).toContain(
      'title: "The Best Knitting Machine Table... Ever!"',
    );
    expect(referenceIndexSource).toContain(
      'href: "/reference/knitting-machine-table"',
    );
    expect(referenceIndexSource).toContain(
      "My favorite sturdy, adjustable table for a knitting machine and ribber",
    );
    expect(referenceIndexSource).toContain(
      '<a href="/reference/knitting-machine-table" class="reference-quick-links__item">Knitting Machine Table</a>',
    );
    expect(referenceIndexSource).not.toContain("ref-card-image");
    expect(referenceIndexSource).not.toContain(
      'image: "/images/references/knitting-machine-table/adjustable-knitting-machine-table.jpg"',
    );
    expect(favoriteCatalogSource).toContain(
      'href: "/reference/knitting-machine-table"',
    );
    expect(favoriteCatalogSource).toContain(
      'title: "The Best Knitting Machine Table... Ever!"',
    );
  });

  it("redirects the plural /references/ catalog path to the guide", () => {
    const redirectSource = readFileSync(
      resolve("src/pages/references/knitting-machine-table.astro"),
      "utf8",
    );
    expect(redirectSource).toContain("export const prerender = true");
    expect(redirectSource).toContain(
      'Astro.redirect("/reference/knitting-machine-table", 301)',
    );
  });
});
