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
 * When logged out, the gate shows a signup-first prompt (a benefit-led "Get Started" primary CTA,
 * with a secondary "already have an account? Log in" link) rather than a login-only prompt, so
 * brand-new visitors can hand us their email. It reuses the shared primitives:
 *   - `isPatternBuilderMemberSignedIn` for the logged-in decision. IMPORTANT: this is a STRICT
 *     real-Memberstack check that intentionally does NOT honor the local dev bypass and never treats
 *     "Memberstack not ready/unavailable" as logged in. The gate MUST fail closed (block) for anyone
 *     it cannot positively confirm is signed in — otherwise a logged-out visitor could generate a
 *     pattern (on localhost the dev bypass would otherwise report them as logged in).
 *   - `showPublicSignupModal` (the clean site-wide custom signup form) for the primary CTA - NOT the prebuilt
 *     Memberstack SIGNUP modal, which exposes internal member fields
 *   - `openMemberstackLoginModal` for the secondary CTA
 */
import { openMemberstackLoginModal } from "../memberstackLogin";
import { getMemberstackReturnPath } from "../memberstackReturnUrl";
import { showPublicSignupModal } from "../publicSignupModal";
import { isMemberstackLoggedInPayload } from "./memberstackMember";
import { waitForMemberstackDom } from "./sleevelessPatternLoginGate";

/**
 * Strict logged-in decision for the account gate. Resolves `true` ONLY when Memberstack reports a
 * real signed-in member. Unlike `isSleevelessPatternMemberLoggedIn`, it NEVER falls back to the dev
 * bypass and NEVER treats a missing/slow Memberstack as logged in — it fails closed so anonymous
 * visitors (including on localhost) cannot generate or view a pattern.
 */
async function isPatternBuilderMemberSignedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return false;
  try {
    const res = await ms.getCurrentMember();
    return isMemberstackLoggedInPayload(res);
  } catch {
    return false;
  }
}

export const PATTERN_BUILDER_ACCOUNT_GATE_TITLE = "Build custom hat and blanket patterns";
export const PATTERN_BUILDER_ACCOUNT_GATE_BODY =
  "Create a Knit It Now account to build and print your custom hat and blanket patterns.";
export const PATTERN_BUILDER_ACCOUNT_GATE_PRIMARY_LABEL = "Get Started";
export const PATTERN_BUILDER_ACCOUNT_GATE_SECONDARY_LABEL = "Already have an account? Log in";

const MODAL_SELECTOR = "[data-pattern-builder-account-gate]";
const BOUND_ATTR = "data-pattern-builder-account-gate-bound";

export interface EnsurePatternBuilderAccountDeps {
  /**
   * Resolves the logged-in decision. Defaults to the STRICT real-Memberstack check
   * ({@link isPatternBuilderMemberSignedIn}) — no dev bypass, fails closed when it cannot confirm.
   */
  isLoggedIn?: () => Promise<boolean>;
  /** Shows the signup-first prompt when the visitor is logged out. Defaults to the gate modal. */
  openAccountPrompt?: () => void;
}

/**
 * Returns `true` when the visitor may generate/view a pattern (they have an account). When logged
 * out, opens the signup-first prompt (so the failure is never silent) and returns `false` so
 * callers can abort. No subscription/membership check is applied - login alone is sufficient.
 *
 * Fails closed: any error or unconfirmed login resolves to `false` (block + prompt), never `true`.
 */
export async function ensurePatternBuilderAccount(
  deps: EnsurePatternBuilderAccountDeps = {},
): Promise<boolean> {
  const isLoggedIn = deps.isLoggedIn ?? isPatternBuilderMemberSignedIn;
  const openAccountPrompt = deps.openAccountPrompt ?? (() => void showPatternBuilderAccountGate());

  let loggedIn = false;
  try {
    loggedIn = await isLoggedIn();
  } catch {
    loggedIn = false;
  }

  if (import.meta.env?.DEV) {
    // Dev-only visibility into the actual gate decision (never logs in production builds).
    console.debug("[pattern-builder-account-gate] login check resolved:", loggedIn);
  }

  if (loggedIn) return true;

  openAccountPrompt();
  return false;
}

/**
 * Upfront account gate for the builder pages: prompt logged-out visitors to create/log into a free
 * account BEFORE they start building, rather than only at Create My Pattern. Waits for Memberstack
 * to initialize first so a logged-in visitor is never shown the prompt during the brief pre-init
 * window, then defers to {@link ensurePatternBuilderAccount} (same signup-first modal + wiring).
 *
 * This is an upfront nudge only and does not lock the builder — the modal stays dismissible and the
 * Create My Pattern / Pattern tab gates remain the fail-closed backup that blocks generation/viewing.
 * Returns the same boolean as {@link ensurePatternBuilderAccount} (true = has account).
 */
export async function promptPatternBuilderAccountOnLoad(
  deps: EnsurePatternBuilderAccountDeps = {},
): Promise<boolean> {
  await waitForMemberstackDom();
  return ensurePatternBuilderAccount(deps);
}

const BUILDER_LOCK_CLASS = "pattern-builder-locked";
const BUILDER_LOCK_OUT_CLASS = "pattern-builder-locked--out";
const BUILDER_LOCK_OVERLAY_CLASS = "pattern-builder-lock-overlay";
const BUILDER_LOCK_FOCUS_HANDLER = "__kbmBuilderLockFocusIn";

/**
 * Locks the builder's interactive area (fail-closed): drops a transparent, click-catching overlay
 * over the container and bounces keyboard focus back out. Any interaction re-opens the account
 * prompt. Safe to call repeatedly — the overlay/handler are installed once.
 */
function applyBuilderLock(container: HTMLElement, openPrompt: () => void): void {
  container.classList.add(BUILDER_LOCK_CLASS);

  if (!container.querySelector(`.${BUILDER_LOCK_OVERLAY_CLASS}`)) {
    const overlay = document.createElement("div");
    overlay.className = BUILDER_LOCK_OVERLAY_CLASS;
    overlay.setAttribute("role", "button");
    overlay.setAttribute("tabindex", "0");
    overlay.setAttribute("aria-label", PATTERN_BUILDER_ACCOUNT_GATE_TITLE);
    const trigger = (event: Event): void => {
      event.preventDefault();
      event.stopPropagation();
      openPrompt();
    };
    overlay.addEventListener("click", trigger);
    overlay.addEventListener("keydown", (event) => {
      const key = (event as KeyboardEvent).key;
      if (key === "Enter" || key === " " || key === "Spacebar") trigger(event);
    });
    container.appendChild(overlay);
  }

  if (!(container as unknown as Record<string, unknown>)[BUILDER_LOCK_FOCUS_HANDLER]) {
    const onFocusIn = (event: FocusEvent): void => {
      if (!container.classList.contains(BUILDER_LOCK_CLASS)) return;
      const target = event.target as HTMLElement | null;
      if (!target || target.classList?.contains(BUILDER_LOCK_OVERLAY_CLASS)) return;
      // Keyboard focus reached a real control behind the overlay — bounce back to the prompt.
      target.blur?.();
      openPrompt();
    };
    container.addEventListener("focusin", onFocusIn, true);
    (container as unknown as Record<string, unknown>)[BUILDER_LOCK_FOCUS_HANDLER] = onFocusIn;
  }
}

function releaseBuilderLock(container: HTMLElement): void {
  container.classList.remove(BUILDER_LOCK_CLASS, BUILDER_LOCK_OUT_CLASS);
  container.querySelector(`.${BUILDER_LOCK_OVERLAY_CLASS}`)?.remove();
  const store = container as unknown as Record<string, unknown>;
  const handler = store[BUILDER_LOCK_FOCUS_HANDLER] as EventListener | undefined;
  if (handler) {
    container.removeEventListener("focusin", handler, true);
    delete store[BUILDER_LOCK_FOCUS_HANDLER];
  }
}

export interface LockPatternBuilderDeps extends EnsurePatternBuilderAccountDeps {
  /** Resolves the logged-in decision. Defaults to the STRICT real-Memberstack check. */
  isLoggedIn?: () => Promise<boolean>;
}

/**
 * Upfront, fail-closed gate for the builder pages. On load the interactive builder area is locked
 * immediately (so nothing is usable during the async login check). If the visitor is confirmed
 * logged in, the lock is released and the builder works normally. Otherwise the lock stays on
 * (dimmed), the signup-first prompt is shown, and any click/focus on the builder re-opens the
 * prompt — the visitor cannot make meaningful builder choices until they log in. Logging in via the
 * modal unlocks the builder live (signup redirects/reloads back to this page, which re-checks).
 *
 * The Create My Pattern / Pattern tab gates remain as backup fail-closed protection.
 */
export async function lockPatternBuilderForLoggedOut(
  container: HTMLElement | null,
  deps: LockPatternBuilderDeps = {},
): Promise<boolean> {
  if (typeof window === "undefined" || !container) {
    // No container to lock (or SSR) — fall back to the plain upfront prompt.
    return promptPatternBuilderAccountOnLoad(deps);
  }

  const openPrompt = deps.openAccountPrompt ?? (() => void showPatternBuilderAccountGate());
  const isLoggedIn = deps.isLoggedIn ?? isPatternBuilderMemberSignedIn;

  // Lock first (fail-closed) so nothing is interactive while we resolve the login state.
  applyBuilderLock(container, openPrompt);

  let loggedIn = false;
  try {
    loggedIn = await isLoggedIn();
  } catch {
    loggedIn = false;
  }

  if (import.meta.env?.DEV) {
    console.debug("[pattern-builder-account-gate] builder lock login check:", loggedIn);
  }

  if (loggedIn) {
    releaseBuilderLock(container);
    return true;
  }

  // Logged out: reveal the dimmed locked state and show the prompt now.
  container.classList.add(BUILDER_LOCK_OUT_CLASS);
  openPrompt();

  // Unlock live when they log in via the modal.
  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    try {
      ms.on("member.login", () => releaseBuilderLock(container));
    } catch {
      /* memberstack event wiring is best-effort */
    }
  }
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
  /** Primary CTA (Get Started). Defaults to opening the clean public signup modal. */
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

  // For the builder gate, signup returns the new member to the SAME builder page (login already
  // does via its default return path). We only override the redirect for this gate — the site-wide
  // public signup flow (header Sign Up, other CTAs) still lands on `/signup/thank-you`.
  const openSignup =
    deps.openSignup ??
    (() => void showPublicSignupModal({ redirectPath: getMemberstackReturnPath() }));
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
