/**
 * Pattern Catalog Socks card destination.
 * Default href stays `/patterns/socks` until access is known — no CTA swap while loading.
 */
import {
  resolveSocksSavedPatternDestination,
  type SavedPatternAccessState,
} from "./savedPatternAccessState";
import { resolveSavedPatternAccessStateFromSession } from "./savedPatternAccessStateClient";

export const SOCKS_CATALOG_CARD_ATTR = "data-socks-catalog-card";
export const SOCKS_CATALOG_DEFAULT_HREF = "/patterns/socks";

export function applySocksCatalogCardDestination(
  root: ParentNode,
  state: SavedPatternAccessState,
): void {
  const href = resolveSocksSavedPatternDestination(state) ?? SOCKS_CATALOG_DEFAULT_HREF;
  root.querySelectorAll<HTMLAnchorElement>(`a[${SOCKS_CATALOG_CARD_ATTR}]`).forEach((el) => {
    el.setAttribute("href", href);
    if (state.kind === "loading") {
      el.setAttribute("aria-busy", "true");
    } else {
      el.removeAttribute("aria-busy");
    }
  });
}

/** Wires catalog Socks cards after Memberstack + owner-scoped list are known. */
export async function initSocksCatalogCardRouting(root: ParentNode = document): Promise<void> {
  const cards = root.querySelectorAll(`a[${SOCKS_CATALOG_CARD_ATTR}]`);
  if (!cards.length) return;

  applySocksCatalogCardDestination(root, {
    kind: "loading",
    loggedIn: false,
    memberId: null,
    hasActiveAccess: false,
    hasOwnedPatterns: false,
    ownedPatternSystems: [],
  });

  const state = await resolveSavedPatternAccessStateFromSession();
  applySocksCatalogCardDestination(root, state);
}
