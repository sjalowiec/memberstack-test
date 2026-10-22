/**
 * Published Help Hub tips a signed-in member can see in My Favorites.
 * Drafts, reviews, and other reference favorites stay out of this list.
 */

import { favoriteStarButtonHtml, escapeHtml } from "../favorites/favoriteStarUi";
import type { FavoriteRecord } from "../favorites/favoriteContentTypes";
import { filterPublicHelpHubTips, type HelpHubTipRecord } from "../helpHubPublic";
import { helpHubFavoriteContentId } from "./discovery";

export const HELP_HUB_FAVORITES_EMPTY_MESSAGE =
  "Save tips using the star, and you’ll find them here.";

export type HelpHubFavoriteTip = {
  slug: string;
  question: string;
  contentId: string;
};

export function helpHubFavoriteTipCatalog(tips: HelpHubTipRecord[]): HelpHubFavoriteTip[] {
  const seen = new Set<string>();
  const catalog: HelpHubFavoriteTip[] = [];
  for (const tip of filterPublicHelpHubTips(tips)) {
    const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
    const question = typeof tip.question === "string" ? tip.question.trim() : "";
    if (!slug || !question) continue;
    const contentId = helpHubFavoriteContentId(slug);
    const key = contentId.toLowerCase();
    if (!contentId || seen.has(key)) continue;
    seen.add(key);
    catalog.push({ slug, question, contentId });
  }
  return catalog;
}

/** Newest saved Help Hub tips first. Other favorite types are ignored. */
export function helpHubFavoriteTipRows(
  catalog: readonly HelpHubFavoriteTip[],
  favorites: readonly Pick<FavoriteRecord, "content_id" | "created_at">[],
): HelpHubFavoriteTip[] {
  const byId = new Map(catalog.map((tip) => [tip.contentId.toLowerCase(), tip]));
  const seen = new Set<string>();
  return [...favorites]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .map((row) => {
      const key = String(row.content_id ?? "").trim().toLowerCase();
      if (!key || seen.has(key)) return null;
      const tip = byId.get(key);
      if (!tip) return null;
      seen.add(key);
      return tip;
    })
    .filter((tip): tip is HelpHubFavoriteTip => tip != null);
}

/** One catalog question row with a filled star. Not a speech bubble. */
export function helpHubFavoriteRowHtml(tip: HelpHubFavoriteTip): string {
  const href = `/help-hub/${encodeURIComponent(tip.slug)}`;
  const star = favoriteStarButtonHtml({
    contentType: "reference",
    contentId: tip.contentId,
    title: tip.question,
    isFavorite: true,
    actionTooltip: true,
  });
  return (
    `<li class="help-hub-question-row" data-help-hub-favorite-row data-help-hub-entry data-help-hub-slug="${escapeHtml(tip.slug)}">` +
    `<a class="help-hub-question-summary" href="${escapeHtml(href)}"><strong>${escapeHtml(tip.question)}</strong></a>` +
    star +
    `</li>`
  );
}
