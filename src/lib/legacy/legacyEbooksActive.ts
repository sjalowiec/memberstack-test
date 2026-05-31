import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseQuotedCsv } from "./parseQuotedCsv";

export const LEGACY_EBOOKS_ACTIVE_CSV_PATH = join(
  process.cwd(),
  "src",
  "data",
  "legacy",
  "legacy-ebooks-active.csv"
);

/** One row from legacy-ebooks-active.csv after CSV parsing (raw column names). */
export type LegacyEbooksActiveCsvRow = {
  ItemId: string;
  ItemName: string;
  SellPrice: string;
  Thumbnail: string;
  DownloadFile: string;
  Breif: string;
  Description: string;
  Active: string;
  SubscriberFree: string;
};

export type LegacyEbookStorefrontProduct = {
  itemId: string;
  title: string;
  sellPrice: number;
  thumbnail: string;
  downloadFile: string;
  shortDescription: string;
  descriptionHtml: string;
  active: true;
  subscriberFree: boolean;
  /** Shopify product page URL when configured in legacy-ebook-shopify-urls.json. */
  shopifyUrl?: string;
};

const UTF8_BOM = "\uFEFF";

function stripBom(value: string): string {
  return value.startsWith(UTF8_BOM) ? value.slice(UTF8_BOM.length) : value;
}

function normalizeCsvCell(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v || v.toUpperCase() === "NULL") return null;
  return v;
}

/** Parse legacy store flag columns (`0` / `1`). */
export function parseLegacyStoreFlag(value: unknown): boolean | null {
  const normalized = normalizeCsvCell(value);
  if (normalized === "1") return true;
  if (normalized === "0") return false;
  return null;
}

export function parseLegacySellPrice(value: unknown): number | null {
  const normalized = normalizeCsvCell(value);
  if (normalized === null) return null;
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function normalizeHeaderKey(key: string): string {
  return stripBom(key.trim());
}

const LEGACY_EBOOKS_ACTIVE_COLUMNS = [
  "ItemId",
  "ItemName",
  "SellPrice",
  "Thumbnail",
  "DownloadFile",
  "Breif",
  "Description",
  "Active",
  "SubscriberFree",
] as const;

/** Read and parse the active eBooks export (quoted fields, embedded commas). */
export function parseLegacyEbooksActiveCsv(
  csvText: string
): LegacyEbooksActiveCsvRow[] {
  const records = parseQuotedCsv(csvText);
  if (records.length === 0) return [];

  const headers = records[0].map((header) => normalizeHeaderKey(header));
  const columnIndex = Object.fromEntries(
    LEGACY_EBOOKS_ACTIVE_COLUMNS.map((name) => [
      name,
      headers.indexOf(name),
    ])
  ) as Record<(typeof LEGACY_EBOOKS_ACTIVE_COLUMNS)[number], number>;

  for (const name of LEGACY_EBOOKS_ACTIVE_COLUMNS) {
    if (columnIndex[name] < 0) {
      throw new Error(
        `legacy-ebooks-active.csv is missing required column: ${name}`
      );
    }
  }

  const rows: LegacyEbooksActiveCsvRow[] = [];

  for (const record of records.slice(1)) {
    if (record.length !== LEGACY_EBOOKS_ACTIVE_COLUMNS.length) {
      throw new Error(
        `legacy-ebooks-active.csv row has ${record.length} columns, expected ${LEGACY_EBOOKS_ACTIVE_COLUMNS.length} (ItemId=${record[0]?.slice(0, 20) ?? "?"})`
      );
    }

    rows.push({
      ItemId: stripBom(record[columnIndex.ItemId].trim()),
      ItemName: record[columnIndex.ItemName].trim(),
      SellPrice: record[columnIndex.SellPrice].trim(),
      Thumbnail: record[columnIndex.Thumbnail].trim(),
      DownloadFile: record[columnIndex.DownloadFile].trim(),
      Breif: record[columnIndex.Breif].trim(),
      Description: record[columnIndex.Description].trim(),
      Active: record[columnIndex.Active].trim(),
      SubscriberFree: record[columnIndex.SubscriberFree].trim(),
    });
  }

  return rows;
}

export function loadLegacyEbooksActiveCsv(): LegacyEbooksActiveCsvRow[] {
  const raw = readFileSync(LEGACY_EBOOKS_ACTIVE_CSV_PATH, "utf-8");
  return parseLegacyEbooksActiveCsv(raw);
}

export function isLegacyEbookStorefrontEligible(
  row: LegacyEbooksActiveCsvRow
): boolean {
  if (parseLegacyStoreFlag(row.Active) !== true) return false;
  if (!normalizeCsvCell(row.DownloadFile)) return false;
  if (!normalizeCsvCell(row.Thumbnail)) return false;
  return true;
}

export function mapLegacyEbookStorefrontProduct(
  row: LegacyEbooksActiveCsvRow
): LegacyEbookStorefrontProduct | null {
  if (!isLegacyEbookStorefrontEligible(row)) return null;

  const itemId = stripBom(row.ItemId.trim());
  const title = row.ItemName.trim();
  const sellPrice = parseLegacySellPrice(row.SellPrice);
  const thumbnail = normalizeCsvCell(row.Thumbnail);
  const downloadFile = normalizeCsvCell(row.DownloadFile);
  const shortDescription = row.Breif.trim();
  const descriptionHtml = row.Description.trim();
  const subscriberFree = parseLegacyStoreFlag(row.SubscriberFree) ?? false;

  if (!itemId || !title || sellPrice === null || !thumbnail || !downloadFile) {
    return null;
  }

  return {
    itemId,
    title,
    sellPrice,
    thumbnail,
    downloadFile,
    shortDescription,
    descriptionHtml,
    active: true,
    subscriberFree,
  };
}

/** Active legacy eBooks with download + thumbnail, ready for storefront use. */
export function loadLegacyEbookStorefrontProducts(): LegacyEbookStorefrontProduct[] {
  const rows = loadLegacyEbooksActiveCsv();
  const products: LegacyEbookStorefrontProduct[] = [];

  for (const row of rows) {
    const product = mapLegacyEbookStorefrontProduct(row);
    if (product) products.push(product);
  }

  return products.sort((a, b) => {
    const ai = Number.parseInt(a.itemId, 10);
    const bi = Number.parseInt(b.itemId, 10);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a.itemId.localeCompare(b.itemId);
  });
}
