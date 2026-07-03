/**
 * Clean public signup modal � the single "create a free account" experience used site-wide
 * (main menu Sign Up, Hat/Blanket account gate, sleeveless gate, and any `[data-open-public-signup]`
 * CTA).
 *
 * It is backed by a CUSTOM Memberstack signup form (`data-ms-form="signup"` with only First Name,
 * Email, and Password). It deliberately does NOT use the prebuilt Memberstack signup modal
 * (`openModal("SIGNUP")` / `data-ms-modal="signup"`), which auto-renders every internal member
 * custom field (birthday, date-joined, legacyMemberID). It also creates a free member � no plan is
 * attached � so it is not tied to the beta-specific `/beta-signup` page.
 */
import { openMemberstackLoginModal } from "./memberstackLogin";

/**
 * Post-signup destination for the public "create a free account" flow. A successful signup lands
 * here (a friendly account-created confirmation with next steps) instead of the current page or the
 * Memberstack dashboard default signup redirect (`/beta-welcome`).
 */
export const PUBLIC_SIGNUP_REDIRECT_PATH = "/signup/thank-you";

export const PUBLIC_SIGNUP_MODAL_TITLE = "Create your free Knit It Now account";
export const PUBLIC_SIGNUP_MODAL_SUBTITLE =
  "Create a free account to build custom patterns designed for your machine.";
export const PUBLIC_SIGNUP_FIRST_NAME_LABEL = "First Name";
export const PUBLIC_SIGNUP_EMAIL_LABEL = "Email Address";
export const PUBLIC_SIGNUP_PASSWORD_LABEL = "Create Password";
export const PUBLIC_SIGNUP_SUBMIT_LABEL = "Create Free Account";
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
 * Points the signup form at the public signup thank-you page. Memberstack inline forms honor the
 * `redirect` attribute (see account guest login / password reset forms); setting it here overrides
 * the dashboard-configured signup redirect (`/beta-welcome`) so a public signup lands on
 * `/signup/thank-you`. The form also carries this as a static `redirect` attribute so Memberstack
 * has it at bind time; this reasserts it whenever the modal is opened.
 */
function applySignupRedirect(dialog: HTMLDialogElement): void {
  const form = dialog.querySelector('[data-ms-form="signup"]');
  if (form && typeof form.setAttribute === "function") {
    form.setAttribute("redirect", PUBLIC_SIGNUP_REDIRECT_PATH);
  }
}

/** Shows the clean public signup modal. Returns true when the modal was shown. */
export function showPublicSignupModal(options?: { root?: ParentNode }): boolean {
  const dialog = getDialog(options?.root);
  if (!dialog || typeof dialog.showModal !== "function") return false;
  applySignupRedirect(dialog);
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
