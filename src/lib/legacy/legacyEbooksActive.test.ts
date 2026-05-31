import { describe, expect, it } from "vitest";
import {
  isLegacyEbookStorefrontEligible,
  loadLegacyEbookStorefrontProducts,
  loadLegacyEbooksActiveCsv,
  parseLegacyEbooksActiveCsv,
  parseLegacySellPrice,
  parseLegacyStoreFlag,
} from "./legacyEbooksActive";

/** Active=1 with non-null Thumbnail and DownloadFile in legacy-ebooks-active.csv. */
const EXPECTED_STOREFRONT_COUNT = 24;

describe("parseLegacyEbooksActiveCsv", () => {
  it("parses quoted fields with embedded commas and HTML", () => {
    const rows = parseLegacyEbooksActiveCsv(
      [
        "ItemId,ItemName,SellPrice,Thumbnail,DownloadFile,Breif,Description,Active,SubscriberFree",
        '418,"A Shirt for All Seasons",14.95,shirts.gif,shirts.pdf,"Short, with comma","<p>HTML ""quote""</p>",1,0',
      ].join("\n")
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].ItemId).toBe("418");
    expect(rows[0].ItemName).toBe("A Shirt for All Seasons");
    expect(rows[0].Breif).toBe("Short, with comma");
    expect(rows[0].Description).toBe('<p>HTML "quote"</p>');
  });

  it("strips BOM from ItemId header and values", () => {
    const rows = parseLegacyEbooksActiveCsv(
      `\uFEFFItemId,ItemName,SellPrice,Thumbnail,DownloadFile,Breif,Description,Active,SubscriberFree\n\uFEFF589,Title,4.99,thumb.jpg,book.pdf,Brief,Desc,1,1`
    );

    expect(rows[0].ItemId).toBe("589");
  });
});

describe("loadLegacyEbookStorefrontProducts", () => {
  it("loads the full CSV export", () => {
    const allRows = loadLegacyEbooksActiveCsv();
    expect(allRows.length).toBe(64);
  });

  it(`returns ${EXPECTED_STOREFRONT_COUNT} active storefront products`, () => {
    const products = loadLegacyEbookStorefrontProducts();

    expect(products).toHaveLength(EXPECTED_STOREFRONT_COUNT);
    expect(products.every((p) => p.active === true)).toBe(true);
    expect(products.every((p) => p.downloadFile.length > 0)).toBe(true);
    expect(products.every((p) => p.thumbnail.length > 0)).toBe(true);
    expect(products.every((p) => Number.isFinite(p.sellPrice))).toBe(true);
  });

  it("maps Breif and Description to storefront fields", () => {
    const product = loadLegacyEbookStorefrontProducts().find(
      (p) => p.itemId === "416"
    );

    expect(product).toBeDefined();
    expect(product!.shortDescription.toLowerCase()).toContain("cheat sheets");
    expect(product!.descriptionHtml).toMatch(/^<style>/);
    expect(parseLegacyStoreFlag("1")).toBe(true);
    expect(parseLegacyStoreFlag("0")).toBe(false);
    expect(parseLegacySellPrice("4.99")).toBe(4.99);
  });

  it("excludes inactive and incomplete rows", () => {
    const allRows = loadLegacyEbooksActiveCsv();
    const excluded = allRows.filter((row) => !isLegacyEbookStorefrontEligible(row));

    expect(excluded.some((row) => row.ItemId === "733")).toBe(true);
    expect(excluded.some((row) => row.ItemId === "657")).toBe(true);
    expect(excluded.some((row) => row.ItemId === "777")).toBe(true);
  });
});
