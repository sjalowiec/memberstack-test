/**
 * Account-required gate for the Hat and Blanket pattern builders.
 *
 * Hat and Blanket patterns are FREE for anyone with a Knit It Now account. Anonymous visitors may
 * explore the builders, but generating/viewing the finished pattern (Create My Pattern, or opening
 * the Pattern tab) requires a logged-in Memberstack account. This is deliberately an
 * ACCOUNT-required gate, not a member-required gate: there is NO membership/subscription or
 * free-claim entitlement check for Hat or Blanket. Any logged-in visitor (no-subscription, member,
 * or beta) may generate for free.
 *
 * When logged out, the gate shows a signup-first prompt (Create Free Account, with a secondary
 * "already have an account? Log in" link) rather than a login-only prompt, so brand-new visitors
 * can hand us their email. It reuses the shared primitives:
 *   - `isSleevelessPatternMemberLoggedIn` for the logged-in decision (Memberstack + dev bypass)
 *   - `showPublicSignupModal` (the clean site-wide custom signup form) for the primary CTA ù NOT the prebuilt
 *     Memberstack SIGNUP modal, which exposes internal member fields
 *   - `openMemberstackLoginModal` for the secondary CTA
 */
import { openMemberstackLoginModal } from "../memberstackLogin";
import { showPublicSignupModal } from "../publicSignupModal";
import { isSleevelessPatternMemberLoggedIn } from "./sleevelessPatternLoginGate";

export const PATTERN_BUILDER_ACCOUNT_GATE_TITLE = "Create your free Knit It Now account";
export const PATTERN_BUILDER_ACCOUNT_GATE_BODY =
  "Hat and blanket patterns are free with a Knit It Now account. Create your free account to build your custom pattern.";
export const PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_LABEL = "Create Free Account";
export const PATTERN_BUILDER_ACCOUNT_GATE_SECONDARY_LABEL = "Already have an account? Log in";

const MODAL_SELECTOR = "[data-pattern-builder-account-gate]";
const BOUND_ATTR = "data-pattern-builder-account-gate-bound";

export interface EnsurePatternBuilderAccountDeps {
  /** Resolves the logged-in decision. Defaults to the shared Memberstack login check. */
  isLoggedIn?: () => Promise<boolean>;
  /** Shows the signup-first prompt when the visitor is logged out. Defaults to the gate modal. */
  openAccountPrompt?: () => void;
}

/**
 * Returns `true` when the visitor may generate/view a pattern (they have an account). When logged
 * out, opens the signup-first prompt (so the failure is never silent) and returns `false` so
 * callers can abort. No subscription/membership check is applied ù login alone is sufficient.
 */
export async function ensurePatternBuilderAccount(
  deps: EnsurePatternBuilderAccountDeps = {},
): Promise<boolean> {
  const isLoggedIn = deps.isLoggedIn ?? isSleevelessPatternMemberLoggedIn;
  const openAccountPrompt = deps.openAccountPrompt ?? (() => void showPatternBuilderAccountGate());

  let loggedIn = false;
  try {
    loggedIn = await isLoggedIn();
  } catch {
    loggedIn = false;
  }

  if (loggedIn) return true;

  openAccountPrompt();
  return false;
}

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
  if (typeof document === "undefined" && !root) return null;
  const scopes: ParentNode[] = [];
  if (root && typeof root.querySelector === "function") scopes.push(root);
  if (typeof document !== "undefined" && typeof document.querySelector === "function") {
    scopes.push(document);
  }
  for (const scope of scopes) {
    const el = scope.querySelector(MODAL_SELECTOR);
    if (isDialogElement(el)) return el;
  }
  return null;
}

/** Shows the signup-first account gate modal. Returns true when the modal was shown. */
export function showPatternBuilderAccountGate(options?: { root?: ParentNode }): boolean {
  const dialog = getDialog(options?.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;
  if (!dialog.open) dialog.showModal();
  return true;
}

export interface PatternBuilderAccountGateModalDeps {
  /** Primary CTA (Create Free Account). Defaults to opening the clean public signup modal. */
  openSignup?: (returnPath?: string) => void;
  /** Secondary CTA (Log in). Defaults to the Memberstack login modal. */
  openLogin?: (returnPath?: string) => void;
}

/**
 * Wires the account gate modal's CTAs once per dialog instance: primary opens the clean public
 * signup modal, secondary opens the Memberstack login modal, and dismiss/backdrop/Escape close it.
 */
export function initPatternBuilderAccountGate(
  root: ParentNode = typeof document !== "undefined" ? document : ({} as ParentNode),
  deps: PatternBuilderAccountGateModalDeps = {},
): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const openSignup = deps.openSignup ?? (() => void showPublicSignupModal());
  const openLogin = deps.openLogin ?? openMemberstackLoginModal;

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll("[data-account-gate-signup]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
      openSignup();
    });
  });

  dialog.querySelectorAll("[data-account-gate-login]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
      openLogin();
    });
  });

  dialog.querySelectorAll("[data-account-gate-dismiss]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
    });
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
}

/**
 * Installs the account-gate globals for inline builder scripts (e.g. the hat builder's
 * `define:vars` script) that cannot import modules directly.
 */
export function installPatternBuilderAccountGate(): void {
  if (typeof window === "undefined") return;
  window.kbmEnsurePatternBuilderAccountGate = () => ensurePatternBuilderAccount();
  window.kbmOpenPatternBuilderAccountPrompt = () => {
    void showPatternBuilderAccountGate();
  };
}
