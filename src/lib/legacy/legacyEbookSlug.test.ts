import { describe, expect, it } from "vitest";
import {
  findLegacyEbookStorefrontBySlug,
  legacyEbookSlugFromTitle,
  loadLegacyEbookStorefrontWithSlugs,
  withLegacyEbookStorefrontSlugs,
} from "./legacyEbookSlug";
import type { LegacyEbookStorefrontProduct } from "./legacyEbooksActive";

describe("legacyEbookSlugFromTitle", () => {
  it("slugifies titles for clean URLs", () => {
    expect(legacyEbookSlugFromTitle("A Shirt for All Seasons")).toBe(
      "a-shirt-for-all-seasons"
    );
    expect(legacyEbookSlugFromTitle("Cut 'n Sew Neckline Template")).toBe(
      "cut-n-sew-neckline-template"
    );
  });

  it("appends itemId when base slug collides", () => {
    const counts = new Map([
      ["duplicate-title", 2],
    ]);
    expect(
      legacyEbookSlugFromTitle("Duplicate Title", "418", counts)
    ).toBe("duplicate-title-418");
    expect(
      legacyEbookSlugFromTitle("Duplicate Title", "589", counts)
    ).toBe("duplicate-title-589");
  });
});

describe("withLegacyEbookStorefrontSlugs", () => {
  it("assigns unique slugs per product", () => {
    const sample: LegacyEbookStorefrontProduct[] = [
      {
        itemId: "1",
        title: "Same Name",
        sellPrice: 1,
        thumbnail: "a.jpg",
        downloadFile: "a.pdf",
        shortDescription: "",
        descriptionHtml: "",
        active: true,
        subscriberFree: false,
      },
      {
        itemId: "2",
        title: "Same Name",
        sellPrice: 2,
        thumbnail: "b.jpg",
        downloadFile: "b.pdf",
        shortDescription: "",
        descriptionHtml: "",
        active: true,
        subscriberFree: false,
      },
    ];

    const withSlugs = withLegacyEbookStorefrontSlugs(sample);
    const slugSet = new Set(withSlugs.map((p) => p.slug));
    expect(slugSet.size).toBe(2);
    expect(withSlugs.map((p) => p.slug).sort()).toEqual([
      "same-name-1",
      "same-name-2",
    ]);
  });
});

describe("loadLegacyEbookStorefrontWithSlugs", () => {
  it("assigns a unique slug to every storefront product", () => {
    const products = loadLegacyEbookStorefrontWithSlugs();
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s))).toBe(true);
  });
});

describe("findLegacyEbookStorefrontBySlug", () => {
  it("finds a live storefront product by slug", () => {
    const products = loadLegacyEbookStorefrontWithSlugs();
    const shirt = products.find((p) => p.itemId === "418");
    expect(shirt).toBeDefined();

    const found = findLegacyEbookStorefrontBySlug(shirt!.slug, products);
    expect(found?.itemId).toBe("418");
    expect(found?.title).toBe(shirt!.title);
  });

  it("returns undefined for unknown slugs", () => {
    const products = loadLegacyEbookStorefrontWithSlugs();
    expect(findLegacyEbookStorefrontBySlug("not-a-real-ebook", products)).toBe(
      undefined
    );
  });

  it("matches slugs case-insensitively", () => {
    const products = loadLegacyEbookStorefrontWithSlugs();
    const shirt = products.find((p) => p.itemId === "418");
    expect(
      findLegacyEbookStorefrontBySlug(shirt!.slug.toUpperCase(), products)
        ?.itemId
    ).toBe("418");
  });
});
