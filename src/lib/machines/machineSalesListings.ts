/**
 * Shopify hold-period shop listings shown on `/shop/machines` while
 * MACHINE_SALES_HOLD is true.
 *
 * Independent of the historical Machine Database.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MACHINE_SALES_LISTINGS_PATH = path.join(
  process.cwd(),
  "data",
  "machines-for-sale.json"
);

export const MACHINE_SALES_IMAGE_DIR = "/images/machines/";
export const MACHINE_SALES_IMAGE_DISK_DIR = path.join(
  process.cwd(),
  "public",
  "images",
  "machines"
);

export const MACHINE_SALES_STATUSES = ["available", "sold", "hidden"] as const;
export type MachineSalesStatus = (typeof MACHINE_SALES_STATUSES)[number];

export type MachineSalesListing = {
  id: string;
  name: string;
  brand: string;
  model: string;
  price: number | null;
  priceLabel: string | null;
  shopifyUrl: string;
  status: MachineSalesStatus;
  specs: string[];
  shortHtml: string;
  imageSrc: string;
  sortOrder: number;
};

export type ListingSaveMode = "new" | "edit";

export function formatSalePriceLabel(value: number | null): string | null {
  if (value == null) return null;
  return Number.isInteger(value)
    ? `$${value.toLocaleString("en-US")}`
    : `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function isMachineSalesStatus(value: unknown): value is MachineSalesStatus {
  return (
    typeof value === "string" &&
    (MACHINE_SALES_STATUSES as readonly string[]).includes(value)
  );
}

function clean(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

export function listingIdFromBrandModel(brand: string, model: string): string {
  return `${brand}-${model}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nextListingId(
  listings: MachineSalesListing[],
  brand: string,
  model: string
): string {
  const base = listingIdFromBrandModel(brand, model) || "machine-listing";
  const used = new Set(listings.map((l) => l.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function nextSortOrder(listings: MachineSalesListing[]): number {
  if (listings.length === 0) return 10;
  return Math.max(...listings.map((l) => l.sortOrder)) + 10;
}

export function displayPriceLabel(listing: Pick<MachineSalesListing, "price" | "priceLabel">): string | null {
  const labeled = clean(listing.priceLabel);
  if (labeled) return labeled;
  return formatSalePriceLabel(listing.price);
}

/** Images already used by current shop listings (not the historical machine photo library). */
export function shopListingImageSrcs(listings: MachineSalesListing[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const row of listings) {
    const src = clean(row.imageSrc);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    urls.push(src);
  }
  return urls;
}

export function normalizeMachineSalesListing(
  raw: unknown
): { ok: true; listing: MachineSalesListing } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Listing must be an object." };
  }
  const rec = raw as Record<string, unknown>;
  const id = clean(rec.id);
  if (!id) return { ok: false, error: "Listing id is required." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return { ok: false, error: "Listing id must be a lowercase slug." };
  }

  const name = clean(rec.name);
  if (!name) return { ok: false, error: "Machine name is required." };

  const status = isMachineSalesStatus(rec.status) ? rec.status : null;
  if (!status) return { ok: false, error: "Status must be available, sold, or hidden." };

  const shopifyUrl = clean(rec.shopifyUrl);
  if (status === "available") {
    if (!shopifyUrl) {
      return { ok: false, error: "Shopify product URL is required for Available listings." };
    }
    if (!/^https:\/\//i.test(shopifyUrl)) {
      return { ok: false, error: "Shopify product URL must start with https://." };
    }
  } else if (shopifyUrl && !/^https:\/\//i.test(shopifyUrl)) {
    return { ok: false, error: "Shopify product URL must start with https://." };
  }

  const imageSrc = clean(rec.imageSrc);
  if (status !== "hidden" && !imageSrc) {
    return { ok: false, error: "An image is required for listings shown on the shop." };
  }

  const specs = Array.isArray(rec.specs)
    ? rec.specs.map((s) => clean(s)).filter(Boolean).slice(0, 3)
    : [];

  const price = numberOrNull(rec.price);
  const priceLabel = clean(rec.priceLabel) || formatSalePriceLabel(price);

  let sortOrder = numberOrNull(rec.sortOrder);
  if (sortOrder == null) sortOrder = 0;

  return {
    ok: true,
    listing: {
      id,
      name,
      brand: clean(rec.brand),
      model: clean(rec.model),
      price,
      priceLabel,
      shopifyUrl,
      status,
      specs,
      shortHtml: typeof rec.shortHtml === "string" ? rec.shortHtml : clean(rec.shortHtml),
      imageSrc,
      sortOrder,
    },
  };
}

export function sortMachineSalesListings(list: MachineSalesListing[]): MachineSalesListing[] {
  return list.slice().sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
  });
}

export function parseMachineSalesListingsFile(raw: string): MachineSalesListing[] {
  const data = JSON.parse(raw) as unknown;
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { listings?: unknown }).listings)
      ? (data as { listings: unknown[] }).listings
      : null;
  if (!rows) {
    throw new Error("machines-for-sale.json must be a JSON array of listings.");
  }
  const listings: MachineSalesListing[] = [];
  for (let i = 0; i < rows.length; i++) {
    const normalized = normalizeMachineSalesListing(rows[i]);
    if (!normalized.ok) {
      throw new Error(`listings[${i}]: ${normalized.error}`);
    }
    listings.push(normalized.listing);
  }
  return sortMachineSalesListings(listings);
}

export function readMachineSalesListings(): MachineSalesListing[] {
  const raw = readFileSync(MACHINE_SALES_LISTINGS_PATH, "utf-8");
  return parseMachineSalesListingsFile(raw);
}

export function writeMachineSalesListings(listings: MachineSalesListing[]): void {
  writeFileSync(
    MACHINE_SALES_LISTINGS_PATH,
    JSON.stringify(sortMachineSalesListings(listings), null, 2) + "\n",
    "utf-8"
  );
}

/** Available and sold listings for the hold-period storefront. Hidden are omitted. */
export function getStorefrontHoldListings(
  listings: MachineSalesListing[] = readMachineSalesListings()
): MachineSalesListing[] {
  return sortMachineSalesListings(listings).filter(
    (row) => row.status === "available" || row.status === "sold"
  );
}

export function applyListingSave(
  listings: MachineSalesListing[],
  input: { listing: unknown; mode: ListingSaveMode }
): { ok: true; listings: MachineSalesListing[] } | { ok: false; error: string } {
  const normalized = normalizeMachineSalesListing(input.listing);
  if (!normalized.ok) return normalized;
  const nextListing = normalized.listing;
  const idx = listings.findIndex((row) => row.id === nextListing.id);

  if (input.mode === "new") {
    if (idx >= 0) {
      return { ok: false, error: `Listing id "${nextListing.id}" already exists.` };
    }
    return { ok: true, listings: sortMachineSalesListings([...listings, nextListing]) };
  }

  if (idx < 0) {
    return { ok: false, error: `No listing with id "${nextListing.id}" exists.` };
  }
  const copy = listings.slice();
  copy[idx] = nextListing;
  return { ok: true, listings: sortMachineSalesListings(copy) };
}
