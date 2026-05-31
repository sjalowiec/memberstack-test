import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LegacyEbookCatalogRowAudited } from "./legacyEbookCatalog";
import {
  auditLegacyEbookCatalog,
  buildLegacyShopFileIndex,
  getLegacyShopDownloadHref,
  loadLegacyEbookCatalog,
} from "./legacyEbookCatalog";

export const LEGACY_EBOOK_PURCHASES_CSV_PATH = join(
  process.cwd(),
  "src",
  "data",
  "legacy",
  "legacy-ebook-purchases.csv"
);

/** Fixed leading columns in legacy-ebook-purchases.csv (ItemName may contain commas). */
const PURCHASE_CSV_HEAD_FIELDS = 7;
/** Trailing columns after ItemName: PricePerItem, TotalPrice, DownloadFile, Thumbnail, Active, SubscriberFree */
const PURCHASE_CSV_TAIL_FIELDS = 6;

export type LegacyEbookPurchaseRow = {
  storeTransactionId: string;
  purchaseDate: string;
  billingEmail: string;
  billingFirstName: string;
  billingLastName: string;
  paid: string;
  legacyItemId: string;
  itemName: string;
  pricePerItem: string;
  totalPrice: string;
  downloadFile: string | null;
  thumbnail: string | null;
  active: string | null;
  subscriberFree: string | null;
};

export type LegacyEbookPurchaseEnriched = LegacyEbookPurchaseRow & {
  /** Catalog title when itemid matches legacy-ebook-catalog.csv */
  catalogTitle: string | null;
  quantity: number;
  /** Public download URL when catalog audit finds the shop file */
  downloadHref: string | null;
  /** Catalog filename for display / link label */
  catalogDownloadFile: string | null;
  fileStatus: LegacyEbookCatalogRowAudited["fileStatus"] | null;
};

function normalizeField(value: string): string | null {
  const v = value.trim();
  if (!v || v.toUpperCase() === "NULL") return null;
  return v;
}

/** Parse one data line from legacy-ebook-purchases.csv (commas inside ItemName supported). */
export function parseLegacyEbookPurchaseCsvLine(
  line: string
): LegacyEbookPurchaseRow | null {
  const cols = line.split(",");
  const minCols = PURCHASE_CSV_HEAD_FIELDS + 1 + PURCHASE_CSV_TAIL_FIELDS;
  if (cols.length < minCols) return null;

  const head = cols.slice(0, PURCHASE_CSV_HEAD_FIELDS);
  const tail = cols.slice(-PURCHASE_CSV_TAIL_FIELDS);
  const itemName = cols.slice(PURCHASE_CSV_HEAD_FIELDS, -PURCHASE_CSV_TAIL_FIELDS).join(",");

  return {
    storeTransactionId: head[0]?.trim() ?? "",
    purchaseDate: head[1]?.trim() ?? "",
    billingEmail: head[2]?.trim() ?? "",
    billingFirstName: head[3]?.trim() ?? "",
    billingLastName: head[4]?.trim() ?? "",
    paid: head[5]?.trim() ?? "",
    legacyItemId: head[6]?.trim() ?? "",
    itemName: itemName.trim(),
    pricePerItem: tail[0]?.trim() ?? "",
    totalPrice: tail[1]?.trim() ?? "",
    downloadFile: normalizeField(tail[2] ?? ""),
    thumbnail: normalizeField(tail[3] ?? ""),
    active: normalizeField(tail[4] ?? ""),
    subscriberFree: normalizeField(tail[5] ?? ""),
  };
}

export function derivePurchaseQuantity(
  pricePerItem: string,
  totalPrice: string
): number {
  const unit = parseFloat(pricePerItem);
  const total = parseFloat(totalPrice);
  if (!Number.isFinite(unit) || !Number.isFinite(total) || unit <= 0) {
    return 1;
  }
  const ratio = total / unit;
  const rounded = Math.round(ratio * 1000) / 1000;
  if (rounded >= 1 && Math.abs(rounded - Math.round(rounded)) < 0.001) {
    return Math.round(rounded);
  }
  return 1;
}

export function formatPurchaseMoney(value: string): string {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return value.trim() || "—";
  return n.toFixed(2);
}

export function buildLegacyEbookCatalogById(
  books: LegacyEbookCatalogRowAudited[]
): Map<string, LegacyEbookCatalogRowAudited> {
  const map = new Map<string, LegacyEbookCatalogRowAudited>();
  for (const book of books) {
    const id = book.legacyId.trim();
    if (id) map.set(id, book);
  }
  return map;
}

export function enrichLegacyEbookPurchase(
  row: LegacyEbookPurchaseRow,
  catalogById: Map<string, LegacyEbookCatalogRowAudited>
): LegacyEbookPurchaseEnriched {
  const catalog = catalogById.get(row.legacyItemId.trim()) ?? null;
  const quantity = derivePurchaseQuantity(row.pricePerItem, row.totalPrice);

  return {
    ...row,
    catalogTitle: catalog?.title ?? null,
    quantity,
    downloadHref: catalog ? getLegacyShopDownloadHref(catalog) : null,
    catalogDownloadFile: catalog?.downloadFile ?? null,
    fileStatus: catalog?.fileStatus ?? null,
  };
}

export function loadLegacyEbookPurchases(): LegacyEbookPurchaseRow[] {
  const raw = readFileSync(LEGACY_EBOOK_PURCHASES_CSV_PATH, "utf-8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const [, ...dataLines] = lines;

  const rows: LegacyEbookPurchaseRow[] = [];
  for (const line of dataLines) {
    const parsed = parseLegacyEbookPurchaseCsvLine(line);
    if (parsed) rows.push(parsed);
  }

  return rows;
}

export function loadEnrichedLegacyEbookPurchases(
  catalogById?: Map<string, LegacyEbookCatalogRowAudited>
): LegacyEbookPurchaseEnriched[] {
  const catalog =
    catalogById ??
    buildLegacyEbookCatalogById(
      auditLegacyEbookCatalog(loadLegacyEbookCatalog(), buildLegacyShopFileIndex())
    );
  return loadLegacyEbookPurchases().map((row) =>
    enrichLegacyEbookPurchase(row, catalog)
  );
}

/** JSON-safe rows embedded for client-side email search on the admin page. */
export type LegacyEbookPurchaseClientRow = {
  purchaseDate: string;
  email: string;
  firstName: string;
  lastName: string;
  legacyItemId: string;
  title: string;
  quantity: number;
  totalPrice: string;
  downloadHref: string | null;
  downloadLabel: string | null;
};

export function toLegacyEbookPurchaseClientRows(
  purchases: LegacyEbookPurchaseEnriched[]
): LegacyEbookPurchaseClientRow[] {
  return purchases.map((p) => ({
    purchaseDate: p.purchaseDate,
    email: p.billingEmail,
    firstName: p.billingFirstName,
    lastName: p.billingLastName,
    legacyItemId: p.legacyItemId,
    title: p.catalogTitle ?? p.itemName,
    quantity: p.quantity,
    totalPrice: formatPurchaseMoney(p.totalPrice),
    downloadHref: p.downloadHref,
    downloadLabel: p.catalogDownloadFile ?? p.downloadFile,
  }));
}
