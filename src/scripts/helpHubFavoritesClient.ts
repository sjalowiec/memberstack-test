/**
 * My Favorites on the Help Hub landing page.
 * Uses the shared member favorites list. It does not open login by itself.
 */

import {
  FAVORITES_CHANGE_EVENT,
  FavoritesAuthError,
  isFavoritesMemberLoggedIn,
  listFavorites,
  type FavoritesChangeDetail,
} from "../lib/favorites/favoritesClient";
import type { FavoriteRecord } from "../lib/favorites/favoriteContentTypes";
import { helpHubSlugFromFavoriteContentId } from "../lib/helpHub/discovery";
import {
  helpHubFavoriteRowHtml,
  helpHubFavoriteTipRows,
  type HelpHubFavoriteTip,
} from "../lib/helpHub/favoriteTips";
import { openMemberstackLoginModal } from "../lib/memberstackLogin";
import { getMemberstackReturnPath } from "../lib/memberstackReturnUrl";
import { isPlainHelpHubReadMoreClick } from "../lib/helpHub/landingReturn";
import { rememberHelpHubLandingDestination } from "./helpHubLandingReturnClient";

type FavoritesMode = "loading" | "guest" | "member" | "error";

function readCatalog(root: ParentNode): HelpHubFavoriteTip[] {
  const node = root.querySelector("[data-help-hub-favorite-catalog]");
  if (!node) return [];
  try {
    const parsed = JSON.parse(node.textContent || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is HelpHubFavoriteTip => {
      if (!item || typeof item !== "object") return false;
      const tip = item as HelpHubFavoriteTip;
      return Boolean(tip.slug && tip.question && tip.contentId);
    });
  } catch {
    return [];
  }
}

function listedQuestion(root: ParentNode, slug: string): HTMLDetailsElement | null {
  const want = slug.trim().toLowerCase();
  if (!want) return null;
  const entries = root.querySelectorAll("[data-help-hub-entry]");
  for (const entry of entries) {
    if (!(entry instanceof HTMLElement)) continue;
    if (entry.closest("[data-help-hub-favorites]")) continue;
    const got = (entry.dataset.helpHubSlug ?? "").trim().toLowerCase();
    if (got !== want) continue;
    const details = entry.querySelector("details[data-help-hub-answer]");
    if (details instanceof HTMLDetailsElement) return details;
  }
  return null;
}

export function initHelpHubFavorites(root: ParentNode): void {
  const section = root.querySelector("[data-help-hub-favorites]");
  if (!(section instanceof HTMLDetailsElement)) return;
  if (section.dataset.helpHubFavoritesBound === "true") return;
  section.dataset.helpHubFavoritesBound = "true";

  const catalog = readCatalog(root);
  const guest = section.querySelector("[data-help-hub-favorites-guest]");
  const empty = section.querySelector("[data-help-hub-favorites-empty]");
  const error = section.querySelector("[data-help-hub-favorites-error]");
  const list = section.querySelector("[data-help-hub-favorites-list]");
  if (
    !(guest instanceof HTMLElement) ||
    !(empty instanceof HTMLElement) ||
    !(error instanceof HTMLElement) ||
    !(list instanceof HTMLElement)
  ) {
    return;
  }

  let mode: FavoritesMode = "loading";
  let favorites: FavoriteRecord[] = [];
  let request = 0;
  /** Changes made while a list request is in flight, keyed by content id. */
  const overlay = new Map<string, FavoritesChangeDetail>();

  function paint(): void {
    const rows = mode === "member" ? helpHubFavoriteTipRows(catalog, favorites) : [];
    guest.hidden = mode !== "guest";
    empty.hidden = !(mode === "member" && rows.length === 0);
    error.hidden = mode !== "error";
    list.hidden = rows.length === 0;
    list.innerHTML = rows.map((tip) => helpHubFavoriteRowHtml(tip)).join("");
  }

  function withOverlay(server: FavoriteRecord[]): FavoriteRecord[] {
    let next = server.filter((row) => {
      const change = overlay.get(row.content_id.trim().toLowerCase());
      return change?.isFavorite !== false;
    });
    for (const change of overlay.values()) {
      if (!change.isFavorite) continue;
      const key = change.contentId.trim().toLowerCase();
      if (next.some((row) => row.content_id.trim().toLowerCase() === key)) continue;
      next = [
        {
          id: `local-${change.contentId}`,
          member_id: "",
          content_type: "reference",
          content_id: change.contentId,
          created_at: new Date().toISOString(),
        },
        ...next,
      ];
    }
    return next;
  }

  async function refresh(): Promise<void> {
    const id = ++request;
    overlay.clear();
    let loggedIn = false;
    try {
      loggedIn = await isFavoritesMemberLoggedIn();
    } catch {
      loggedIn = false;
    }
    if (id !== request) return;
    if (!loggedIn) {
      mode = "guest";
      favorites = [];
      paint();
      return;
    }
    try {
      const next = await listFavorites("reference");
      if (id !== request) return;
      favorites = withOverlay(next);
      overlay.clear();
      mode = "member";
      paint();
    } catch (cause) {
      if (id !== request) return;
      if (overlay.size > 0 && mode === "member") {
        paint();
        return;
      }
      favorites = [];
      mode = cause instanceof FavoritesAuthError ? "guest" : "error";
      paint();
    }
  }

  function applyChange(detail: FavoritesChangeDetail): void {
    if (detail.contentType !== "reference") return;
    if (!helpHubSlugFromFavoriteContentId(detail.contentId)) return;
    if (mode === "guest") return;
    const key = detail.contentId.trim().toLowerCase();
    overlay.set(key, detail);
    if (detail.isFavorite) {
      if (!favorites.some((row) => row.content_id.trim().toLowerCase() === key)) {
        favorites = [
          {
            id: `local-${detail.contentId}`,
            member_id: "",
            content_type: "reference",
            content_id: detail.contentId,
            created_at: new Date().toISOString(),
          },
          ...favorites,
        ];
      }
    } else {
      favorites = favorites.filter((row) => row.content_id.trim().toLowerCase() !== key);
    }
    if (mode === "loading") mode = "member";
    paint();
  }

  section.querySelector("[data-help-hub-favorites-login]")?.addEventListener("click", () => {
    openMemberstackLoginModal(getMemberstackReturnPath());
  });

  list.addEventListener("click", (event) => {
    if (!(event instanceof MouseEvent) || !isPlainHelpHubReadMoreClick(event)) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-favorite-star]")) return;
    const link = target.closest("a");
    const row = target.closest("[data-help-hub-favorite-row]");
    if (!(link instanceof HTMLAnchorElement) || !(row instanceof HTMLElement)) return;
    if (!list.contains(row)) return;
    const slug = row.dataset.helpHubSlug?.trim() ?? "";
    const details = listedQuestion(root, slug);
    if (details) {
      event.preventDefault();
      if (!details.open) details.open = true;
      return;
    }
    rememberHelpHubLandingDestination(root, slug);
  });

  window.addEventListener(FAVORITES_CHANGE_EVENT, (event) => {
    const detail = (event as CustomEvent<FavoritesChangeDetail>).detail;
    if (!detail?.contentType || !detail.contentId) return;
    applyChange(detail);
  });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    void refresh();
  });

  void (async () => {
    try {
      const ms = window.$memberstackDom;
      if (ms?.onReady) await ms.onReady;
      window.$memberstackDom?.on?.("member.login", () => {
        void refresh();
      });
      window.$memberstackDom?.on?.("member.logout", () => {
        void refresh();
      });
    } catch {
      /* The login button still opens the shared prompt. */
    }
  })();

  void refresh();
}
