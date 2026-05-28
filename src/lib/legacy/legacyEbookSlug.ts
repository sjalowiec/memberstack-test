import { slugify } from "../slugify";
import type { LegacyEbookStorefrontProduct } from "./legacyEbooksActive";
import { loadLegacyEbookStorefrontProducts } from "./legacyEbooksActive";

/** URL slug from title; appends `-{itemId}` when titles collide. */
export function legacyEbookSlugFromTitle(
  title: string,
  itemId?: string,
  slugCounts?: Map<string, number>
): string {
  const base = slugify(title);
  if (!base) {
    return itemId ? `ebook-${itemId}` : "ebook";
  }
  if (!slugCounts || !itemId) return base;
  if ((slugCounts.get(base) ?? 0) > 1) return `${base}-${itemId}`;
  return base;
}

export type LegacyEbookStorefrontWithSlug = LegacyEbookStorefrontProduct & {
  slug: string;
};

/** Assign stable storefront slugs to active products (sorted by itemId). */
export function withLegacyEbookStorefrontSlugs(
  products: LegacyEbookStorefrontProduct[]
): LegacyEbookStorefrontWithSlug[] {
  const slugCounts = new Map<string, number>();
  for (const product of products) {
    const base = slugify(product.title);
    if (base) slugCounts.set(base, (slugCounts.get(base) ?? 0) + 1);
  }

  return products.map((product) => ({
    ...product,
    slug: legacyEbookSlugFromTitle(
      product.title,
      product.itemId,
      slugCounts
    ),
  }));
}

export function loadLegacyEbookStorefrontWithSlugs(): LegacyEbookStorefrontWithSlug[] {
  return withLegacyEbookStorefrontSlugs(loadLegacyEbookStorefrontProducts());
}

export function findLegacyEbookStorefrontBySlug(
  slug: string,
  products?: LegacyEbookStorefrontWithSlug[]
): LegacyEbookStorefrontWithSlug | undefined {
  const normalized = slug.trim().toLowerCase();
  const list = products ?? loadLegacyEbookStorefrontWithSlugs();
  return list.find((p) => p.slug.toLowerCase() === normalized);
}
