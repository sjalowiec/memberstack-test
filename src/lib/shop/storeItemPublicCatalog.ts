/**
 * Public shop catalogs at request time: deployed files, plus saved items
 * from this Netlify site when the page is not running on localhost.
 */
import type { LegacyEbookStorefrontWithSlug } from "../legacy/legacyEbookSlug";
import { withLegacyEbookStorefrontSlugs } from "../legacy/legacyEbookSlug";
import {
  legacyEbookStorefrontProductsFromRows,
  type LegacyEbookStorefrontProduct,
} from "../legacy/legacyEbooksActive";
import type { Printable } from "../../data/printables";
import { readStoreCatalogForShop, type StoreItemRequestContext } from "./storeItemLive";
import { storeItemAstroDev, storeItemAstroEnv } from "./storeItemAstroEnv";
import type { StoreCatalogSnapshot } from "./storeItemCatalog";

export type PublicCable = {
  id: number | string;
  name: string;
  price: number;
  stripeLink: string;
  thumbnail: string;
  shortdescription: string;
  longDescription: string;
  active: boolean | string;
  sortOrder: number;
};

export type PublicDesignaknitProduct = {
  id: string;
  title: string;
  price: string;
  short: string;
  href: string;
  recommended?: boolean;
  category: string;
  active: boolean;
};

export function storeItemShopContext(hostname: string | null | undefined): StoreItemRequestContext {
  return {
    hostname,
    isViteDev: storeItemAstroDev.isViteDev,
    env: storeItemAstroEnv(),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function publicCablesFromSnapshot(snapshot: StoreCatalogSnapshot): PublicCable[] {
  return snapshot.cables.map((row) => ({
    id: typeof row.id === "number" || typeof row.id === "string" ? row.id : text(row.id),
    name: text(row.name),
    price: Number(row.price),
    stripeLink: text(row.stripeLink),
    thumbnail: text(row.thumbnail),
    shortdescription: text(row.shortdescription),
    longDescription: text(row.longDescription),
    active: typeof row.active === "boolean" || typeof row.active === "string" ? row.active : text(row.active),
    sortOrder: Number(row.sortOrder ?? 0),
  }));
}

export function publicPrintablesFromSnapshot(snapshot: StoreCatalogSnapshot): Printable[] {
  return snapshot.downloads as Printable[];
}

export function publicDesignaknitFromSnapshot(snapshot: StoreCatalogSnapshot): PublicDesignaknitProduct[] {
  return snapshot.software.map((row) => ({
    id: text(row.id),
    title: text(row.title),
    price: text(row.price),
    short: text(row.short),
    href: text(row.href),
    recommended: row.recommended === true,
    category: text(row.category),
    active: row.active !== false,
  }));
}

export function publicEbooksFromSnapshot(
  snapshot: StoreCatalogSnapshot,
): (LegacyEbookStorefrontProduct & { slug: string; shopifyUrl?: string })[] {
  const products = legacyEbookStorefrontProductsFromRows(snapshot.ebooks);
  return withLegacyEbookStorefrontSlugs(products).map((product) => {
    const shopifyUrl = snapshot.ebookShopify[product.itemId]?.trim();
    return shopifyUrl ? { ...product, shopifyUrl } : product;
  });
}

async function liveSnapshot(hostname: string | null | undefined): Promise<StoreCatalogSnapshot> {
  return readStoreCatalogForShop(storeItemShopContext(hostname));
}

export async function loadPublicCables(hostname: string | null | undefined): Promise<PublicCable[]> {
  return publicCablesFromSnapshot(await liveSnapshot(hostname));
}

export async function loadPublicPrintables(hostname: string | null | undefined): Promise<Printable[]> {
  return publicPrintablesFromSnapshot(await liveSnapshot(hostname));
}

export async function loadPublicDesignaknitProducts(
  hostname: string | null | undefined,
): Promise<PublicDesignaknitProduct[]> {
  return publicDesignaknitFromSnapshot(await liveSnapshot(hostname));
}

export async function loadPublicEbooks(
  hostname: string | null | undefined,
): Promise<LegacyEbookStorefrontWithSlug[]> {
  return publicEbooksFromSnapshot(await liveSnapshot(hostname));
}

export const STORE_CATALOG_CACHE_CONTROL = "public, max-age=0, must-revalidate";
