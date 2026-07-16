import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadLegacyEbookStorefrontWithSlugs } from "./legacyEbookSlug";
import { parseQuotedCsv } from "./parseQuotedCsv";
import {
  LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS,
  LEGACY_EBOOK_SHOPIFY_IMPORT_CSV_PATH,
  buildLegacyEbookShopifyImportRows,
  legacyEbookShopifyBodyHasDirectDownloadLinks,
  legacyEbookShopifyRowHasOrphanImageMetadata,
  serializeLegacyEbookShopifyImportCsv,
} from "./legacyEbookShopifyImport";

const EXPECTED_STOREFRONT_COUNT = 24;

function parseShopifyImportCsv(csvText: string): Record<string, string>[] {
  const records = parseQuotedCsv(csvText);
  const headers = records[0];
  return records.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""]))
  );
}

describe("legacyEbookShopifyImport", () => {
  it(`exports ${EXPECTED_STOREFRONT_COUNT} storefront products`, () => {
    const rows = buildLegacyEbookShopifyImportRows();
    expect(rows).toHaveLength(EXPECTED_STOREFRONT_COUNT);
  });

  it("includes all required Shopify columns", () => {
    const csv = serializeLegacyEbookShopifyImportCsv(
      buildLegacyEbookShopifyImportRows()
    );
    const [header] = parseQuotedCsv(csv);
    expect(header).toEqual([...LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS]);
  });

  it("assigns unique handles from ebook slugs", () => {
    const rows = buildLegacyEbookShopifyImportRows();
    const handles = rows.map((r) => r.Handle);
    expect(new Set(handles).size).toBe(handles.length);

    const slugs = loadLegacyEbookStorefrontWithSlugs().map((p) => p.slug);
    expect(handles.sort()).toEqual(slugs.sort());
  });

  it("maps variant prices to source sellPrice", () => {
    const source = loadLegacyEbookStorefrontWithSlugs();
    const rows = buildLegacyEbookShopifyImportRows();

    for (const product of source) {
      const row = rows.find((r) => r["Variant SKU"] === `legacy-ebook-${product.itemId}`);
      expect(row).toBeDefined();
      expect(row!["Variant Price"]).toBe(product.sellPrice.toFixed(2));
    }
  });

  it("leaves image import fields blank without a public HTTPS Image Src", () => {
    const rows = buildLegacyEbookShopifyImportRows();
    for (const row of rows) {
      expect(row["Image Src"]).toBe("");
      expect(row["Image Position"]).toBe("");
      expect(legacyEbookShopifyRowHasOrphanImageMetadata(row)).toBe(false);
    }

    const parsed = parseShopifyImportCsv(
      serializeLegacyEbookShopifyImportCsv(rows)
    );
    for (const row of parsed) {
      expect(row["Image Src"] ?? "").toBe("");
      expect(row["Image Position"] ?? "").toBe("");
    }
  });

  it("sanitizes Body (HTML) with no direct PDF/download links", () => {
    const rows = buildLegacyEbookShopifyImportRows();
    for (const row of rows) {
      expect(legacyEbookShopifyBodyHasDirectDownloadLinks(row["Body (HTML)"])).toBe(
        false
      );
    }
  });

  it("quotes Body (HTML) fields with commas and embedded quotes", () => {
    const csv = serializeLegacyEbookShopifyImportCsv(
      buildLegacyEbookShopifyImportRows()
    );
    const parsed = parseShopifyImportCsv(csv);
    const shirt = parsed.find((r) => r.Handle === "a-shirt-for-all-seasons");
    expect(shirt).toBeDefined();
    expect(shirt!["Body (HTML)"]).toContain('"A Winning Classic"');
    expect(shirt!["Body (HTML)"]).toMatch(/<p>/);
  });

  it("committed shopify-ebook-import.csv matches the generator", () => {
    const onDisk = readFileSync(LEGACY_EBOOK_SHOPIFY_IMPORT_CSV_PATH, "utf-8");
    const generated = serializeLegacyEbookShopifyImportCsv(
      buildLegacyEbookShopifyImportRows()
    );
    // Checkout may rewrite EOL on Windows; compare content, not platform line endings.
    expect(onDisk.replace(/\r\n/g, "\n")).toBe(generated.replace(/\r\n/g, "\n"));
  });
});
