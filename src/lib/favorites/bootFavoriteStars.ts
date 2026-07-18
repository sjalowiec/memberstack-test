/**
 * One-shot page boot: bind star clicks + hydrate pressed state for a content type.
 */

import {
  initFavoriteStarController,
  hydrateFavoriteStars,
} from "./favoriteStarController";
import {
  isFavoritesMemberLoggedIn,
  listFavorites,
} from "./favoritesClient";
import type { FavoriteContentType } from "./favoriteContentTypes";

let controllerBound = false;

export type BootFavoriteStarsOptions = {
  contentType: FavoriteContentType;
  statusEl?: HTMLElement | null;
  root?: ParentNode;
};

/**
 * Idempotent controller bind + hydrate for the given content type.
 * Safe to call from multiple FavoritesRuntime mounts on one page.
 */
export async function bootFavoriteStars(options: BootFavoriteStarsOptions): Promise<void> {
  const statusEl =
    options.statusEl ??
    document.querySelector<HTMLElement>("[data-favorites-status]") ??
    null;

  if (!controllerBound) {
    initFavoriteStarController({
      statusEl,
      root: options.root ?? document,
    });
    controllerBound = true;
  }

  const loggedIn = await isFavoritesMemberLoggedIn();
  if (!loggedIn) return;

  try {
    const rows = await listFavorites(options.contentType);
    const ids = new Set(rows.map((row) => String(row.content_id)));
    hydrateFavoriteStars(options.contentType, ids, options.root ?? document);
  } catch {
    if (statusEl) statusEl.textContent = "Could not load favorite status.";
  }
}

/** Read `data-favorites-boot` markers and boot each content type once. */
export async function bootFavoriteStarsFromDom(root: ParentNode = document): Promise<void> {
  const markers = root.querySelectorAll<HTMLElement>("[data-favorites-boot]");
  const types = new Set<FavoriteContentType>();
  markers.forEach((el) => {
    const t = el.getAttribute("data-favorites-boot");
    if (t === "video" || t === "stitch" || t === "reference" || t === "tool") {
      types.add(t);
    }
  });
  for (const contentType of types) {
    await bootFavoriteStars({ contentType, root });
  }
}
