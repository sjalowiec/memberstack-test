/**
 * Shared click / keyboard handling for favorite star buttons.
 */

import { openMemberstackLoginModal } from "../memberstackLogin";
import { getMemberstackReturnPath } from "../memberstackReturnUrl";
import {
  FavoritesAuthError,
  FAVORITES_CHANGE_EVENT,
  isFavoritesMemberLoggedIn,
  toggleFavorite,
  type FavoritesChangeDetail,
} from "./favoritesClient";
import { isFavoriteContentType, type FavoriteContentType } from "./favoriteContentTypes";
import { applyFavoriteStarState, syncFavoriteStarsInDocument } from "./favoriteStarUi";

export type FavoriteStarControllerOptions = {
  root?: ParentNode;
  /** Called after a successful toggle (and sync). */
  onChanged?: (detail: FavoritesChangeDetail) => void;
  /** Status element for accessible error messages (aria-live). */
  statusEl?: HTMLElement | null;
  /** When true, listen for kin-favorites-change to keep stars in sync. */
  syncFromEvents?: boolean;
};

function announce(statusEl: HTMLElement | null | undefined, message: string): void {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function readButtonState(button: HTMLButtonElement): {
  contentType: FavoriteContentType;
  contentId: string;
  title: string;
  isFavorite: boolean;
} | null {
  const contentTypeRaw = button.getAttribute("data-content-type");
  const contentId = button.getAttribute("data-content-id")?.trim() || "";
  if (!isFavoriteContentType(contentTypeRaw) || !contentId) return null;
  const title = button.getAttribute("data-favorite-title")?.trim() || "this item";
  const isFavorite = button.getAttribute("aria-pressed") === "true";
  return { contentType: contentTypeRaw, contentId, title, isFavorite };
}

/**
 * Bind delegated click handling for `[data-favorite-star]` under root.
 * Returns an unsubscribe function.
 */
export function initFavoriteStarController(options: FavoriteStarControllerOptions = {}): () => void {
  const root = options.root ?? document;
  const statusEl = options.statusEl ?? null;

  async function handleStarClick(button: HTMLButtonElement, _event: Event): Promise<void> {
    const state = readButtonState(button);
    if (!state) return;

    if (button.disabled || button.getAttribute("aria-busy") === "true") return;

    const loggedIn = await isFavoritesMemberLoggedIn();
    if (!loggedIn) {
      openMemberstackLoginModal(getMemberstackReturnPath());
      return;
    }

    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    announce(statusEl, "");

    try {
      await toggleFavorite({
        contentType: state.contentType,
        contentId: state.contentId,
        currentlyFavorite: state.isFavorite,
        onOptimistic: (next) => {
          syncFavoriteStarsInDocument(state.contentType, state.contentId, next);
        },
        onRollback: (previous) => {
          syncFavoriteStarsInDocument(state.contentType, state.contentId, previous);
        },
        onSuccess: (next) => {
          options.onChanged?.({
            contentType: state.contentType,
            contentId: state.contentId,
            isFavorite: next,
          });
        },
        onError: (error) => {
          if (error instanceof FavoritesAuthError) {
            openMemberstackLoginModal(getMemberstackReturnPath());
            announce(statusEl, "Please sign in to save favorites.");
          } else {
            announce(statusEl, "Could not update favorites. Please try again.");
          }
        },
      });
    } catch {
      /* announced via onError */
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  function onClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>("[data-favorite-star]");
    if (!button || !rootContains(root, button)) return;
    // Capture phase + stopPropagation keeps the surrounding catalog card <a> from navigating.
    event.preventDefault();
    event.stopPropagation();
    void handleStarClick(button, event);
  }

  function onFavoritesChange(event: Event): void {
    const detail = (event as CustomEvent<FavoritesChangeDetail>).detail;
    if (!detail?.contentType || !detail.contentId) return;
    syncFavoriteStarsInDocument(detail.contentType, detail.contentId, detail.isFavorite, root);
  }

  // Use capture so we beat the parent card link's default navigation.
  root.addEventListener("click", onClick, true);
  if (options.syncFromEvents !== false) {
    window.addEventListener(FAVORITES_CHANGE_EVENT, onFavoritesChange);
  }

  return () => {
    root.removeEventListener("click", onClick, true);
    if (options.syncFromEvents !== false) {
      window.removeEventListener(FAVORITES_CHANGE_EVENT, onFavoritesChange);
    }
  };
}

function rootContains(root: ParentNode, node: Node): boolean {
  if (root === document) return document.contains(node);
  return root.contains(node);
}

/** Set initial pressed state for stars matching a Set of content ids. */
export function hydrateFavoriteStars(
  contentType: FavoriteContentType,
  favoriteIds: Set<string>,
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLButtonElement>("[data-favorite-star]").forEach((btn) => {
    if (btn.getAttribute("data-content-type") !== contentType) return;
    const id = btn.getAttribute("data-content-id") || "";
    applyFavoriteStarState(btn, favoriteIds.has(id));
  });
}
