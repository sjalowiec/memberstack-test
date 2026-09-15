/**
 * `/patterns/socks` destination for saved-pattern access states.
 * Stays pending until identity + ownership are known so Become a Member cannot flash.
 */
import {
  MY_PATTERNS_ACCOUNT_HREF,
  shouldRedirectSocksLandingToMyPatterns,
  type SavedPatternAccessState,
} from "./savedPatternAccessState";

export type SocksLandingAction =
  | { type: "pending" }
  | { type: "redirect"; href: typeof MY_PATTERNS_ACCOUNT_HREF }
  | { type: "show-prospect" };

export function resolveSocksLandingAction(state: SavedPatternAccessState): SocksLandingAction {
  if (state.kind === "loading") return { type: "pending" };
  if (shouldRedirectSocksLandingToMyPatterns(state)) {
    return { type: "redirect", href: MY_PATTERNS_ACCOUNT_HREF };
  }
  return { type: "show-prospect" };
}

export const SOCKS_SAVED_PATTERN_LANDING_ATTR = "data-socks-saved-pattern-landing";
