/**
 * Lightweight login gate for the Hat and Blanket pattern builders.
 *
 * These builders let anonymous visitors view the builder intro, but generating the finished
 * pattern (clicking "Create My Pattern") requires a logged-in Memberstack member. This reuses
 * the existing sleeveless/drop-shoulder auth primitives:
 *   - `isSleevelessPatternMemberLoggedIn` for the logged-in decision (Memberstack + dev bypass)
 *   - `openMemberstackLoginModal` to prompt sign-in when logged out
 *
 * This is deliberately login-only: it does NOT apply membership/free-claim entitlement rules.
 */
import { openMemberstackLoginModal } from "../memberstackLogin";
import { isSleevelessPatternMemberLoggedIn } from "./sleevelessPatternLoginGate";

export interface EnsurePatternBuilderLoginDeps {
  /** Resolves the logged-in decision. Defaults to the shared Memberstack login check. */
  isLoggedIn?: () => Promise<boolean>;
  /** Opens the login prompt when the visitor is logged out. Defaults to the Memberstack modal. */
  openLoginModal?: (returnPath?: string) => void;
}

/**
 * Returns `true` when the visitor may generate a pattern. When logged out, opens the login
 * prompt (so the failure is never silent) and returns `false` so callers can abort generation.
 */
export async function ensurePatternBuilderLogin(
  deps: EnsurePatternBuilderLoginDeps = {},
): Promise<boolean> {
  const isLoggedIn = deps.isLoggedIn ?? isSleevelessPatternMemberLoggedIn;
  const openLoginModal = deps.openLoginModal ?? openMemberstackLoginModal;

  let loggedIn = false;
  try {
    loggedIn = await isLoggedIn();
  } catch {
    loggedIn = false;
  }

  if (loggedIn) return true;

  openLoginModal();
  return false;
}

/**
 * Installs `window.kbmEnsurePatternBuilderLogin` for inline builder scripts (e.g. the hat
 * builder's `define:vars` script) that cannot import modules directly.
 */
export function installPatternBuilderLoginGate(): void {
  if (typeof window === "undefined") return;
  window.kbmEnsurePatternBuilderLogin = () => ensurePatternBuilderLogin();
}
