/**
 * Titles and links for Tip of the Week and Knit-able favorites.
 * Favorite rows store only a stable id. Display copy comes from the live catalog.
 */
import { KNIT_ABLES_CARDS } from "../knit-ables/knitAblesLanding";
import { knitAbleSlugFromPath } from "../knit-ables/schedule";
import { tipIsPubliclyFeatured, tipLosAngelesCalendarDate } from "../tipOfTheWeek/schedule";
import type { TipOfTheWeekRecord, TipOfTheWeekStatus } from "../tipOfTheWeek/types";

export type SavedContentMeta = {
  contentId: string;
  title: string;
  /** Empty when the item exists but is not currently public. */
  href: string;
};

export type TipVisibilityInput = {
  tipId: string;
  status: TipOfTheWeekStatus;
  availableFrom: string;
  availableThrough: string;
};

export function tipFavoriteHref(tipId: string): string {
  return `/tip-of-the-week?tip=${encodeURIComponent(tipId)}`;
}

/**
 * Tips a member may open and save.
 * The current featured tip, a past active tip, and an archived tip whose start
 * date has arrived. Drafts and future scheduled tips stay private.
 */
export function isMemberVisibleTip(
  tip: TipVisibilityInput,
  today: string = tipLosAngelesCalendarDate(),
): boolean {
  const tipId = tip.tipId.trim();
  if (!tipId) return false;
  if (tipIsPubliclyFeatured(tip, today)) return true;
  if (tip.status !== "active" && tip.status !== "archived") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tip.availableFrom)) return false;
  return tip.availableFrom <= today;
}

export function tipSavedMeta(
  tips: readonly TipOfTheWeekRecord[],
  today: string = tipLosAngelesCalendarDate(),
): SavedContentMeta[] {
  return tips
    .filter((tip) => isMemberVisibleTip(tip, today))
    .map((tip) => ({
      contentId: tip.tipId.trim(),
      title: tip.title.trim() || "Tip of the Week",
      href: tipFavoriteHref(tip.tipId.trim()),
      availableFrom: tip.availableFrom,
    }))
    .sort((a, b) => {
      if (a.availableFrom !== b.availableFrom) {
        return a.availableFrom < b.availableFrom ? 1 : -1;
      }
      return a.contentId < b.contentId ? -1 : a.contentId > b.contentId ? 1 : 0;
    })
    .map(({ contentId, title, href }) => ({ contentId, title, href }));
}

export function knitAbleFavoriteEntries(
  publishedSlugs: ReadonlySet<string>,
): SavedContentMeta[] {
  const rows: SavedContentMeta[] = [];
  for (const card of KNIT_ABLES_CARDS) {
    const slug = knitAbleSlugFromPath(card.href);
    if (!slug) continue;
    rows.push({
      contentId: slug,
      title: card.title.trim() || "Knit-able",
      href: publishedSlugs.has(slug) ? card.href : "",
    });
  }
  return rows;
}
