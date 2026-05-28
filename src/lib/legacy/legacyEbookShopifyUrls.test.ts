import { describe, expect, it } from "vitest";
import { loadLegacyEbookStorefrontProducts } from "./legacyEbooksActive";
import {
  loadLegacyEbookShopifyUrlMap,
  resolveLegacyEbookShopifyUrl,
  withLegacyEbookShopifyUrls,
} from "./legacyEbookShopifyUrls";
import { loadLegacyEbookStorefrontWithSlugs } from "./legacyEbookSlug";

describe("loadLegacyEbookShopifyUrlMap", () => {
  it("has an entry for every active storefront product", () => {
    const products = loadLegacyEbookStorefrontProducts();
    const map = loadLegacyEbookShopifyUrlMap();

    expect(products).toHaveLength(24);
    for (const product of products) {
      expect(map).toHaveProperty(product.itemId);
    }
  });
});

describe("resolveLegacyEbookShopifyUrl", () => {
  it("returns undefined for blank values", () => {
    expect(resolveLegacyEbookShopifyUrl("418", { "418": "" })).toBeUndefined();
    expect(
      resolveLegacyEbookShopifyUrl("418", { "418": "   " })
    ).toBeUndefined();
  });

  it("resolves by itemId and slug", () => {
    const map = {
      "418": "https://shop.example/products/shirt",
      "a-shirt-for-all-seasons": "https://shop.example/products/by-slug",
    };
    expect(resolveLegacyEbookShopifyUrl("418", map)).toBe(
      "https://shop.example/products/shirt"
    );
    expect(
      resolveLegacyEbookShopifyUrl("999", map, "a-shirt-for-all-seasons")
    ).toBe("https://shop.example/products/by-slug");
  });
});

const SHOPIFY_PRODUCT_BASE = "https://vjzu11-86.myshopify.com/products/";

describe("withLegacyEbookShopifyUrls", () => {
  it("sets shopifyUrl for every storefront product from slug + base URL", () => {
    const products = loadLegacyEbookStorefrontWithSlugs();
    expect(products).toHaveLength(24);
    for (const product of products) {
      expect(product.shopifyUrl).toBe(`${SHOPIFY_PRODUCT_BASE}${product.slug}`);
    }
  });

  it("sets shopifyUrl for item 728 (Add a Hood)", () => {
    const hood = loadLegacyEbookStorefrontWithSlugs().find((p) => p.itemId === "728");
    expect(hood?.slug).toBe("add-a-hood-to-any-knitting-pattern");
    expect(hood?.shopifyUrl).toBe(
      "https://vjzu11-86.myshopify.com/products/add-a-hood-to-any-knitting-pattern"
    );
  });
});
