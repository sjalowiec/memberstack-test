import {
  filterPublicHelpHubTips,
  type HelpHubTipRecord,
} from "../helpHubPublic";
import {
  helpHubCategoryChoices,
  helpHubTipsInCategory,
} from "./categories";
import type { HelpHubManagedCategory } from "./categoryTypes";

export type HelpHubIndexCard = {
  slug: string;
  heading: string;
};

export type HelpHubIndexCategorySection = {
  key: string;
  label: string;
  cards: HelpHubIndexCard[];
};

function helpHubTipSortOrder(item: { sortOrder?: unknown; id?: unknown }): number {
  const v = item.sortOrder;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return Number.POSITIVE_INFINITY;
}

function helpHubTipId(item: { id?: unknown }): number {
  const v = item.id;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function sortHelpHubIndexTips<T extends { sortOrder?: unknown; id?: unknown }>(tips: T[]): T[] {
  return [...tips].sort((a, b) => {
    const c = helpHubTipSortOrder(a) - helpHubTipSortOrder(b);
    if (c !== 0) return c;
    return helpHubTipId(a) - helpHubTipId(b);
  });
}

/** Catalog cards show the stored question only. Titles stay on the entry for search and the tip page. */
export function helpHubIndexCardCopy(tip: {
  question?: unknown;
  title?: unknown;
}): { heading: string } {
  const question = typeof tip.question === "string" ? tip.question.trim() : "";
  return { heading: question };
}

function helpHubIndexCardFromTip(tip: HelpHubTipRecord): HelpHubIndexCard | null {
  const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
  if (!slug) return null;
  const copy = helpHubIndexCardCopy(tip);
  if (!copy.heading) return null;
  return { slug, heading: copy.heading };
}

export function helpHubIndexNewCards(tips: HelpHubTipRecord[]): HelpHubIndexCard[] {
  return sortHelpHubIndexTips(filterPublicHelpHubTips(tips).filter((tip) => tip.isNew === true))
    .map(helpHubIndexCardFromTip)
    .filter((card): card is HelpHubIndexCard => card != null);
}

/**
 * Public category sections in shared catalog order.
 * Empty catalog categories are omitted. Draft/review entries never appear.
 * Entries whose stored category is missing or not in the catalog are omitted
 * from these sections (they may still appear in New when isNew).
 */
export function helpHubIndexCategorySections(
  tips: HelpHubTipRecord[],
  categories?: HelpHubManagedCategory[],
): HelpHubIndexCategorySection[] {
  const published = sortHelpHubIndexTips(filterPublicHelpHubTips(tips));
  const sections: HelpHubIndexCategorySection[] = [];
  for (const choice of helpHubCategoryChoices(categories)) {
    const cards = helpHubTipsInCategory(published, choice.key)
      .map(helpHubIndexCardFromTip)
      .filter((card): card is HelpHubIndexCard => card != null);
    if (cards.length === 0) continue;
    sections.push({ key: choice.key, label: choice.label, cards });
  }
  return sections;
}
