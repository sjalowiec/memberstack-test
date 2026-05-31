import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sanitizeLegacyEbookDescriptionHtml } from "./legacyEbookDescriptionHtml";
import { loadLegacyEbookStorefrontWithSlugs } from "./legacyEbookSlug";
import type { LegacyEbookStorefrontWithSlug } from "./legacyEbookSlug";

export const LEGACY_EBOOK_SHOPIFY_IMPORT_CSV_PATH = join(
  process.cwd(),
  "src",
  "data",
  "legacy",
  "shopify-ebook-import.csv"
);

export const LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Product Category",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Variant Price",
  "Variant Inventory Tracker",
  "Variant Inventory Qty",
  "Variant Inventory Policy",
  "Variant Fulfillment Service",
  "Variant Requires Shipping",
  "Variant Taxable",
  "Image Src",
  "Image Position",
  "Gift Card",
  "Status",
] as const;

export type LegacyEbookShopifyImportColumn =
  (typeof LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS)[number];

export type LegacyEbookShopifyImportRow = Record<
  LegacyEbookShopifyImportColumn,
  string
>;

const SHOPIFY_VENDOR = "Knit it Now";
const SHOPIFY_PRODUCT_CATEGORY = "Media > Books";
const SHOPIFY_TYPE = "eBook";
const SHOPIFY_TAGS = "legacy-ebook, digital-download, machine-knitting";

/** Shopify image columns other than Image Src — must stay empty unless Src is HTTPS. */
export const LEGACY_EBOOK_SHOPIFY_IMAGE_METADATA_COLUMNS = [
  "Image Position",
  "Image Alt Text",
] as const;

function isPublicHttpsUrl(value: string): boolean {
  return /^https:\/\/.+/i.test(value.trim());
}

/** Public HTTPS cover URL for Shopify import, or blank when unavailable. */
export function legacyEbookShopifyPublicImageSrc(
  _product: LegacyEbookStorefrontWithSlug
): string {
  // Legacy thumbnails are site-relative paths; add HTTPS URLs here when ready.
  return "";
}

export function legacyEbookShopifyImageFields(
  product: LegacyEbookStorefrontWithSlug
): Pick<LegacyEbookShopifyImportRow, "Image Src" | "Image Position"> {
  const imageSrc = legacyEbookShopifyPublicImageSrc(product);
  if (!isPublicHttpsUrl(imageSrc)) {
    return { "Image Src": "", "Image Position": "" };
  }
  return { "Image Src": imageSrc, "Image Position": "1" };
}

/** True when Image Position / Alt Text (etc.) are set without a public Image Src. */
export function legacyEbookShopifyRowHasOrphanImageMetadata(
  row: LegacyEbookShopifyImportRow
): boolean {
  const imageSrc = (row["Image Src"] ?? "").trim();
  if (isPublicHttpsUrl(imageSrc)) return false;

  if ((row["Image Position"] ?? "").trim() !== "") return true;

  for (const col of LEGACY_EBOOK_SHOPIFY_IMAGE_METADATA_COLUMNS) {
    if (col === "Image Position") continue;
    const value = row[col as LegacyEbookShopifyImportColumn];
    if ((value ?? "").trim() !== "") return true;
  }

  return false;
}

/** RFC 4180 field encoding (quote when needed, double internal quotes). */
export function formatQuotedCsvField(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeLegacyEbookShopifyImportCsv(
  rows: LegacyEbookShopifyImportRow[]
): string {
  const header = LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS.join(",");
  const body = rows.map((row) =>
    LEGACY_EBOOK_SHOPIFY_IMPORT_COLUMNS.map((col) =>
      formatQuotedCsvField(row[col] ?? "")
    ).join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

export function mapLegacyEbookToShopifyImportRow(
  product: LegacyEbookStorefrontWithSlug
): LegacyEbookShopifyImportRow {
  return {
    Handle: product.slug,
    Title: product.title,
    "Body (HTML)": sanitizeLegacyEbookDescriptionHtml(product.descriptionHtml),
    Vendor: SHOPIFY_VENDOR,
    "Product Category": SHOPIFY_PRODUCT_CATEGORY,
    Type: SHOPIFY_TYPE,
    Tags: SHOPIFY_TAGS,
    Published: "TRUE",
    "Option1 Name": "Title",
    "Option1 Value": "Default Title",
    "Variant SKU": `legacy-ebook-${product.itemId}`,
    "Variant Price": product.sellPrice.toFixed(2),
    "Variant Inventory Tracker": "",
    "Variant Inventory Qty": "0",
    "Variant Inventory Policy": "deny",
    "Variant Fulfillment Service": "manual",
    "Variant Requires Shipping": "FALSE",
    "Variant Taxable": "TRUE",
    ...legacyEbookShopifyImageFields(product),
    "Gift Card": "FALSE",
    Status: "active",
  };
}

/** Active storefront eBooks as Shopify product-import rows. */
export function buildLegacyEbookShopifyImportRows(): LegacyEbookShopifyImportRow[] {
  return loadLegacyEbookStorefrontWithSlugs().map(mapLegacyEbookToShopifyImportRow);
}

export function buildLegacyEbookShopifyImportCsv(): string {
  return serializeLegacyEbookShopifyImportCsv(buildLegacyEbookShopifyImportRows());
}

export function writeLegacyEbookShopifyImportCsv(
  path: string = LEGACY_EBOOK_SHOPIFY_IMPORT_CSV_PATH
): void {
  writeFileSync(path, buildLegacyEbookShopifyImportCsv(), "utf-8");
}

/** True when HTML still exposes a direct PDF/download URL in href or src. */
export function legacyEbookShopifyBodyHasDirectDownloadLinks(html: string): boolean {
  return (
    /href\s*=\s*("([^"]*\.pdf[^"]*)"|'([^']*\.pdf[^']*)'|([^\s>]*\.pdf[^\s>]*))/i.test(
      html
    ) ||
    /src\s*=\s*("([^"]*\.pdf[^"]*)"|'([^']*\.pdf[^']*)'|([^\s>]*\.pdf[^\s>]*))/i.test(
      html
    )
  );
}
