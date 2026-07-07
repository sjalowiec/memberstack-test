/**
 * Clean public signup modal - the single "create a free account" experience used site-wide
 * (main menu Sign Up, Hat/Blanket account gate, sleeveless gate, and any `[data-open-public-signup]`
 * CTA).
 *
 * It is backed by a CUSTOM Memberstack signup form (`data-ms-form="signup"` with only First Name,
 * Email, and Password). It deliberately does NOT use the prebuilt Memberstack signup modal
 * (`openModal("SIGNUP")` / `data-ms-modal="signup"`), which auto-renders every internal member
 * custom field (birthday, date-joined, legacyMemberID). It also creates a free member - no plan is
 * attached - so it is not tied to the beta-specific `/beta-signup` page.
 */
import { openMemberstackLoginModal } from "./memberstackLogin";

/**
 * Post-signup destination for the public "create a free account" flow. A successful signup lands
 * here (a friendly account-created confirmation with next steps) instead of the current page or the
 * Memberstack dashboard default signup redirect (`/beta-welcome`).
 */
export const PUBLIC_SIGNUP_REDIRECT_PATH = "/signup/thank-you";

/**
 * sessionStorage key holding a pending post-signup return path for the Hat/Blanket builder flow.
 *
 * WHY THIS EXISTS: Memberstack v2 captures a `data-ms-form`'s `redirect` attribute at BIND time
 * (page load) and treats a form-level redirect as authoritative; changing the attribute later (at
 * modal-open/click time) is ignored. The builder's return target is only known at click time, so we
 * cannot express it via the cached attribute. Instead the builder gate stashes the target here, lets
 * Memberstack land on the static `/signup/thank-you`, and the thank-you page immediately bounces to
 * the stored path. Site-wide signups (no override) never set this key and stay on `/signup/thank-you`.
 */
export const PUBLIC_SIGNUP_RETURN_STORAGE_KEY = "kbm:public-signup-return";

/** Pending returns older than this are ignored (defensive against a stale, unconsumed entry). */
const PUBLIC_SIGNUP_RETURN_TTL_MS = 15 * 60 * 1000;

function isSafeInternalPath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//");
}

function isSignupThankYouPath(pathname?: string | null): boolean {
  if (!pathname) return false;
  return pathname.replace(/\/+$/, "") === PUBLIC_SIGNUP_REDIRECT_PATH;
}

/**
 * Records (or clears) the pending post-signup return path. Called with the override when the builder
 * gate opens signup, and with `undefined` for site-wide opens (which clears any lingering entry so
 * a dismissed builder gate can never bounce a later, unrelated signup).
 */
function persistSignupReturnPath(redirectPath?: string): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (isSafeInternalPath(redirectPath)) {
      sessionStorage.setItem(
        PUBLIC_SIGNUP_RETURN_STORAGE_KEY,
        JSON.stringify({ path: redirectPath, ts: Date.now() }),
      );
    } else {
      sessionStorage.removeItem(PUBLIC_SIGNUP_RETURN_STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode / disabled) — fall back to the default thank-you landing */
  }
}

/**
 * Reads and CONSUMES the pending post-signup return path. Returns a validated same-origin relative
 * path (or null). Used by the `/signup/thank-you` bounce. TTL-guarded so an old entry never fires.
 */
export function consumePublicSignupReturnPath(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(PUBLIC_SIGNUP_RETURN_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PUBLIC_SIGNUP_RETURN_STORAGE_KEY);
    const parsed = JSON.parse(raw) as { path?: unknown; ts?: unknown };
    if (!isSafeInternalPath(parsed.path)) return null;
    if (isSignupThankYouPath(parsed.path)) return null;
    const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
    if (Date.now() - ts > PUBLIC_SIGNUP_RETURN_TTL_MS) return null;
    return parsed.path;
  } catch {
    return null;
  }
}

/** Clears any pending post-signup return path (e.g. on non-thank-you page loads). */
export function clearPublicSignupReturnPath(): void {
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(PUBLIC_SIGNUP_RETURN_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export const PUBLIC_SIGNUP_MODAL_TITLE = "Share your email address";
export const PUBLIC_SIGNUP_MODAL_SUBTITLE =
  "Enter your information below to start building custom hat and blanket patterns.";
export const PUBLIC_SIGNUP_FIRST_NAME_LABEL = "First Name";
export const PUBLIC_SIGNUP_EMAIL_LABEL = "Email Address";
export const PUBLIC_SIGNUP_PASSWORD_LABEL = "Create Password";
export const PUBLIC_SIGNUP_SUBMIT_LABEL = "Continue";
export const PUBLIC_SIGNUP_LOGIN_LABEL = "Already have an account? Log in";

const MODAL_SELECTOR = "[data-public-signup-modal]";
const BOUND_ATTR = "data-public-signup-modal-bound";
const OPEN_TRIGGER_SELECTOR = "[data-open-public-signup]";
const DELEGATED_ATTR = "data-public-signup-delegated";

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root?: ParentNode): HTMLDialogElement | null {
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

/**
 * Points the signup form at its post-signup destination via the `redirect` attribute.
 *
 * IMPORTANT: Memberstack v2 captures this attribute at BIND time and a form-level redirect overrides
 * everything, so a value set here at modal-open time is only honored if it matches the bind-time
 * value. The static `/signup/thank-you` in the markup is what actually takes effect for signups.
 * We still set it (harmless, and honored by Memberstack builds that read it live), but the
 * builder's dynamic return is enforced separately via {@link persistSignupReturnPath} + the
 * `/signup/thank-you` bounce — do NOT rely on this attribute for the override.
 */
function applySignupRedirect(
  dialog: HTMLDialogElement,
  redirectPath: string = PUBLIC_SIGNUP_REDIRECT_PATH,
): void {
  const form = dialog.querySelector('[data-ms-form="signup"]');
  if (form && typeof form.setAttribute === "function") {
    form.setAttribute("redirect", redirectPath);
  }
}

/**
 * Shows the clean public signup modal. Returns true when the modal was shown.
 *
 * `redirectPath` overrides where the new member returns after signup; when omitted the site-wide
 * `/signup/thank-you` landing is used. Only the Hat/Blanket builder account gate passes an override
 * (the current builder page). Because Memberstack ignores post-bind changes to the form redirect,
 * the override is enforced via a stored return path that the thank-you page bounces from — every
 * other caller keeps the default behavior.
 */
export function showPublicSignupModal(options?: {
  root?: ParentNode;
  redirectPath?: string;
}): boolean {
  const dialog = getDialog(options?.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;
  applySignupRedirect(dialog, options?.redirectPath);
  persistSignupReturnPath(options?.redirectPath);
  if (!dialog.open) dialog.showModal();
  return true;
}

export interface PublicSignupModalDeps {
  /** Secondary CTA (Log in). Defaults to the Memberstack login modal. */
  openLogin?: (returnPath?: string) => void;
}

/**
 * Wires the signup modal once per dialog instance: the "Log in" link opens the login modal, the
 * close control / backdrop / Escape dismiss it, and a successful Memberstack login (which a
 * successful signup triggers) auto-closes it. The custom `data-ms-form="signup"` inside is wired
 * by Memberstack itself.
 */
export function initPublicSignupModal(
  root: ParentNode = typeof document !== "undefined" ? document : ({} as ParentNode),
  deps: PublicSignupModalDeps = {},
): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const openLogin = deps.openLogin ?? openMemberstackLoginModal;

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll("[data-public-signup-login]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
      openLogin();
    });
  });

  dialog.querySelectorAll("[data-public-signup-dismiss]").forEach((el) => {
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

  const ms = typeof window !== "undefined" ? window.$memberstackDom : undefined;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", close);
  }
}

/**
 * Installs `window.kbmOpenPublicSignupModal` and a delegated click handler so any element with
 * `data-open-public-signup` opens the modal (header Sign Up, gate CTAs, etc.).
 */
export function installPublicSignupModal(): void {
  if (typeof window === "undefined") return;

  // Any non-thank-you page load invalidates a lingering pending return (e.g. the builder gate was
  // opened then dismissed without signing up), so it can never bounce a later, unrelated signup.
  // The thank-you page consumes the entry itself and is deliberately excluded here.
  if (!isSignupThankYouPath(window.location?.pathname)) {
    clearPublicSignupReturnPath();
  }

  window.kbmOpenPublicSignupModal = () => {
    void showPublicSignupModal();
  };

  if (typeof document === "undefined") return;
  const host = document.documentElement;
  if (host && host.getAttribute(DELEGATED_ATTR) !== "true") {
    host.setAttribute(DELEGATED_ATTR, "true");
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(OPEN_TRIGGER_SELECTOR);
      if (!trigger) return;
      event.preventDefault();
      void showPublicSignupModal();
    });
  }
}
