/**
 * Catalog of favoritable reference destinations (hub cards + linked pages).
 * content_id is the normalized site path.
 */

import { normalizeFavoriteHref } from "./favoriteHref";
import type { FavoriteItemMeta } from "./favoriteCatalog";

type RefItem = { title: string; href: string };

/** Keep in sync with cards on /reference (and related popular links). */
const RAW_REFERENCE_ITEMS: RefItem[] = [
  {
    title: "Wisdom from Machine Knitters",
    href: "/start-here/wisdom-from-machine-knitters",
  },
  { title: "Choose a Knitting Machine", href: "/reference/machines/choose" },
  { title: "Glossary", href: "/glossary" },
  { title: "Abbreviations", href: "/reference/abbreviations" },
  { title: "Machine Database", href: "/reference/machines" },
  {
    title: "Silver Reed vs. Taitexma",
    href: "/reference/machines/silver-reed-vs-taitexma",
  },
  { title: "Machine Knitter's Bookshelf", href: "/reference/bookshelf" },
  { title: "Machine Repairs", href: "/reference/repairs" },
  { title: "Machine Knitting Clubs", href: "/reference/clubs" },
  { title: "Machine Brands Worldwide", href: "/reference/machine-brands" },
  { title: "DAK Cables for Brother Machines", href: "/reference/DAK-brother-cables" },
  { title: "DesignaKnit Basics", href: "/reference/designaknit-basics" },
  { title: "Stitch Symbols", href: "/reference/stitch-symbols" },
  { title: "Sizing Charts", href: "/reference/sizing-charts" },
  { title: "Yarn Weight Reference", href: "/reference/yarn-weight" },
  { title: "Yarn Standards", href: "/reference/yarn-standards" },
  { title: "Sweater Sizing Chart", href: "/reference/sweater-sizing-chart" },
  { title: "Minimum Ease Comparison Chart", href: "/reference/minimum-ease-chart" },
];

export function buildReferenceFavoriteCatalog(
  extras: RefItem[] = [],
): FavoriteItemMeta[] {
  const byId = new Map<string, FavoriteItemMeta>();
  for (const item of [...RAW_REFERENCE_ITEMS, ...extras]) {
    const href = normalizeFavoriteHref(item.href);
    if (!href) continue;
    byId.set(href, {
      content_id: href,
      title: item.title.trim() || href,
      href,
    });
  }
  return Array.from(byId.values());
}

export const REFERENCE_FAVORITE_CATALOG = buildReferenceFavoriteCatalog();
