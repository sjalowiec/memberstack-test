/**
 * Help Hub rows for the account My Favorites panel.
 * Uses the same reference favorites and /help-hub/{slug} ids as the Help Hub page.
 */

import { helpHubSlugFromFavoriteContentId } from "../helpHub/discovery";
import {
  helpHubFavoriteHref,
  helpHubFavoriteTipRows,
  type HelpHubFavoriteTip,
} from "../helpHub/favoriteTips";
import { titleFromFavoriteHref } from "./favoriteHref";
import { favoriteStarButtonHtml, escapeHtml } from "./favoriteStarUi";

export type AccountHelpHubFavorite = {
  /** Stored reference favorite id. Removing uses this, not a new content type. */
  contentId: string;
  title: string;
  href: string;
};

type SavedReference = {
  content_id: string;
  created_at?: string;
};

function sameFavoriteId(a: string, b: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\/+$/, "").toLowerCase();
  return normalize(a) === normalize(b);
}

function storedContentId(
  favorites: readonly SavedReference[],
  canonicalId: string,
): string {
  const stored = favorites.find((row) => sameFavoriteId(row.content_id, canonicalId));
  return stored?.content_id.trim() || canonicalId;
}

/**
 * Saved Help Hub tips for the account panel.
 * `catalog` null means the live catalog could not be loaded, so titles fall back
 * to the slug while the permanent link is kept. A loaded catalog matches the
 * Help Hub page: published questions only, newest first.
 */
export function accountHelpHubFavorites(
  favorites: readonly SavedReference[],
  catalog: readonly HelpHubFavoriteTip[] | null,
): AccountHelpHubFavorite[] {
  if (catalog == null) {
    return [...favorites]
      .filter((row) => helpHubSlugFromFavoriteContentId(row.content_id))
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
      .map((row) => {
        const slug = helpHubSlugFromFavoriteContentId(row.content_id) || "";
        const href = helpHubFavoriteHref(slug);
        return {
          contentId: row.content_id.trim(),
          title: titleFromFavoriteHref(href) || "Help Hub",
          href,
        };
      });
  }

  return helpHubFavoriteTipRows(
    catalog,
    favorites.map((row) => ({
      content_id: row.content_id.trim().replace(/\/+$/, ""),
      created_at: row.created_at,
    })),
  ).map((tip) => ({
    contentId: storedContentId(favorites, tip.contentId),
    title: tip.question,
    href: helpHubFavoriteHref(tip.slug),
  }));
}

/** Reference favorites that belong in Reference Pages, not Help Hub or the rotating tip. */
export function referenceFavoriteIdsForAccount(
  favorites: readonly SavedReference[],
  isRotatingTip: (contentId: string) => boolean,
): string[] {
  return favorites
    .map((row) => row.content_id.trim())
    .filter((id) => id && !helpHubSlugFromFavoriteContentId(id) && !isRotatingTip(id));
}

/** Title, permanent link, and the same reference-star remove control Help Hub uses. */
export function accountHelpHubFavoriteItemHtml(item: AccountHelpHubFavorite): string {
  const star = favoriteStarButtonHtml({
    contentType: "reference",
    contentId: item.contentId,
    title: item.title,
    isFavorite: true,
    actionTooltip: true,
  });
  return (
    `<li class="account-favorites__item" data-favorite-content-id="${escapeHtml(item.contentId)}" data-favorite-content-type="reference">` +
    `<div class="account-favorites__body">` +
    `<div class="favorite-title-row">` +
    `<a class="account-favorites__title-link" href="${escapeHtml(item.href)}" data-kbm-saved-favorite-link data-content-type="reference" data-content-id="${escapeHtml(item.contentId)}">${escapeHtml(item.title)}</a>` +
    star +
    `</div></div></li>`
  );
}
