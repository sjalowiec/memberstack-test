import { resolveAccountLoginRedirectPath } from "../lib/memberstackReturnUrl";
import { showPublicSignupModal } from "../lib/publicSignupModal";

/**
 * Wires the account guest gate's "Create Free Account" CTA to the shared public signup modal,
 * overriding the post-signup destination so a brand-new visitor who arrived via My Patterns lands
 * back on `/account#my-patterns` (not the default `/signup/thank-you`). Login already returns there
 * via the form redirect, so this only covers the signup path — the previous dead end for new users.
 */
export function initAccountSignupReturn(): void {
  document.querySelectorAll<HTMLElement>("[data-account-signup]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      showPublicSignupModal({ redirectPath: resolveAccountLoginRedirectPath() });
    });
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccountSignupReturn);
  } else {
    initAccountSignupReturn();
  }
}
