/** My Patterns deep link on the account workspace. */
export const MY_PATTERNS_RETURN_PATH = "/account#my-patterns";

/**
 * Canonical public signup experience — the site's custom Memberstack signup form
 * (`data-ms-form="signup"` with only public fields). This is intentionally NOT the prebuilt
 * Memberstack SIGNUP modal, which auto-renders every internal member field (birthday,
 * date-joined, legacyMemberID). Keep dynamic signup CTAs pointed here.
 */
export const PUBLIC_SIGNUP_PATH = "/beta-signup";

/** Relative return path for Memberstack login/signup redirects (path + query + hash). */
export function getMemberstackReturnPath(loc: Location = window.location): string {
  return loc.pathname + loc.search + loc.hash;
}

/**
 * Post-login target for the account guest login form and modal triggers.
 * My Patterns entry always returns to the patterns panel, not the dashboard default (/videos).
 */
export function resolveAccountLoginRedirectPath(loc: Location = window.location): string {
  const path = loc.pathname.replace(/\/$/, "") || "/";
  if (path === "/account") {
    if (loc.hash === "#my-patterns") return MY_PATTERNS_RETURN_PATH;
    return getMemberstackReturnPath(loc);
  }
  return getMemberstackReturnPath(loc);
}

/** Sets Memberstack inline-form `redirect` to the current page (e.g. `/account#my-patterns`). */
export function applyMemberstackFormRedirect(form: HTMLFormElement, loc?: Location): void {
  form.setAttribute("redirect", resolveAccountLoginRedirectPath(loc));
}
