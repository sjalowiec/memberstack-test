/**
 * Pattern Catalog Christmas Stocking card destination.
 * Same former-member rule as Socks. Does not change the Socks card.
 */
import {
  resolveChristmasStockingSavedPatternDestination,
  type SavedPatternAccessState,
} from "./savedPatternAccessState";
import { resolveSavedPatternAccessStateFromSession } from "./savedPatternAccessStateClient";

export const CHRISTMAS_STOCKING_CATALOG_CARD_ATTR = "data-christmas-stocking-catalog-card";
export const CHRISTMAS_STOCKING_CATALOG_DEFAULT_HREF = "/patterns/christmas-stocking";

export function applyChristmasStockingCatalogCardDestination(
  root: ParentNode,
  state: SavedPatternAccessState,
): void {
  const href =
    resolveChristmasStockingSavedPatternDestination(state) ?? CHRISTMAS_STOCKING_CATALOG_DEFAULT_HREF;
  root.querySelectorAll<HTMLAnchorElement>(`a[${CHRISTMAS_STOCKING_CATALOG_CARD_ATTR}]`).forEach((el) => {
    el.setAttribute("href", href);
    if (state.kind === "loading") {
      el.setAttribute("aria-busy", "true");
    } else {
      el.removeAttribute("aria-busy");
    }
  });
}

export async function initChristmasStockingCatalogCardRouting(
  root: ParentNode = document,
): Promise<void> {
  const cards = root.querySelectorAll(`a[${CHRISTMAS_STOCKING_CATALOG_CARD_ATTR}]`);
  if (!cards.length) return;

  applyChristmasStockingCatalogCardDestination(root, {
    kind: "loading",
    loggedIn: false,
    memberId: null,
    hasActiveAccess: false,
    hasOwnedPatterns: false,
    ownedPatternSystems: [],
  });

  const state = await resolveSavedPatternAccessStateFromSession();
  applyChristmasStockingCatalogCardDestination(root, state);
}
