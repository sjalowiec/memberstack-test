/**
 * `/patterns/christmas-stocking` destination for saved-pattern access states.
 * Same membership rule as Basic Socks: active members start a pattern here.
 * Former members who still own a Christmas Stocking go to My Patterns.
 */
import {
  MY_PATTERNS_ACCOUNT_HREF,
  shouldRedirectChristmasStockingLandingToMyPatterns,
  type SavedPatternAccessState,
} from "./savedPatternAccessState";

export type ChristmasStockingLandingAction =
  | { type: "pending" }
  | { type: "redirect"; href: typeof MY_PATTERNS_ACCOUNT_HREF }
  | { type: "show-member" }
  | { type: "show-prospect" };

export function resolveChristmasStockingLandingAction(
  state: SavedPatternAccessState,
): ChristmasStockingLandingAction {
  if (state.kind === "loading") return { type: "pending" };
  if (shouldRedirectChristmasStockingLandingToMyPatterns(state)) {
    return { type: "redirect", href: MY_PATTERNS_ACCOUNT_HREF };
  }
  if (state.kind === "activeMember") return { type: "show-member" };
  return { type: "show-prospect" };
}

export const CHRISTMAS_STOCKING_SAVED_PATTERN_LANDING_ATTR =
  "data-christmas-stocking-saved-pattern-landing";
