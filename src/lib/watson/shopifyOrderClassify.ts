/**
 * Classify Shopify line items / orders as DesignaKnit vs Knit it Now.
 *
 * Evidence in this repo: one Shopify store (vjzu11-86.myshopify.com) sells both
 * KIN merchandise and DesignaKnit software. Known DAK product handles live in
 * src/data/designaknit-products.json. Learn DesignaKnit courses are not sold
 * through this Shopify store (Memberstack / learndesignaknit.com).
 */

export type ShopifySiteBrand = "knit_it_now" | "designaknit";

/** Handles from src/data/designaknit-products.json (and close variants). */
export const KNOWN_DESIGNAKNIT_HANDLES = [
  "designaknit-hand-knit",
  "designaknit-machine-standard",
  "designaknit-machine-pro",
  "designaknit-complete",
] as const;

const DESIGNAKNIT_TITLE_RE = /design\s*a\s*knit|designaknit/i;
const DESIGNAKNIT_TAG_RE = /designaknit|learn[-_\s]?designaknit|\bdak\b/i;
const DESIGNAKNIT_HANDLE_RE = /^designaknit[-_]/i;

export interface ClassifiableLineItem {
  title?: string | null;
  vendor?: string | null;
  sku?: string | null;
  productHandle?: string | null;
  productType?: string | null;
}

export function normalizeProductHandle(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

export function isDesignaKnitLineItem(item: ClassifiableLineItem): boolean {
  const handle = normalizeProductHandle(item.productHandle);
  if (handle) {
    if (KNOWN_DESIGNAKNIT_HANDLES.includes(handle as (typeof KNOWN_DESIGNAKNIT_HANDLES)[number])) {
      return true;
    }
    if (DESIGNAKNIT_HANDLE_RE.test(handle)) {
      return true;
    }
  }

  if (item.title && DESIGNAKNIT_TITLE_RE.test(item.title)) {
    return true;
  }
  if (item.vendor && DESIGNAKNIT_TITLE_RE.test(item.vendor)) {
    return true;
  }
  if (item.productType && DESIGNAKNIT_TITLE_RE.test(item.productType)) {
    return true;
  }
  if (item.sku && DESIGNAKNIT_TITLE_RE.test(item.sku)) {
    return true;
  }
  return false;
}

export function orderTagsIndicateDesignaKnit(tags: string | null | undefined): boolean {
  if (!tags) return false;
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .some((tag) => DESIGNAKNIT_TAG_RE.test(tag));
}

export function classifyShopifyOrder(input: {
  lineItems: ClassifiableLineItem[];
  tags?: string | null;
}): { siteBrand: ShopifySiteBrand; isDesignaknit: boolean } {
  const fromItems = input.lineItems.some(isDesignaKnitLineItem);
  const fromTags = orderTagsIndicateDesignaKnit(input.tags);
  const isDesignaknit = fromItems || fromTags;
  return {
    isDesignaknit,
    siteBrand: isDesignaknit ? "designaknit" : "knit_it_now",
  };
}

export function siteBrandLabel(brand: ShopifySiteBrand): string {
  return brand === "designaknit" ? "DesignaKnit" : "Knit it Now";
}
