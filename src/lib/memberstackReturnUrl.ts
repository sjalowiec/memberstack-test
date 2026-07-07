/** My Patterns deep link on the account workspace. */
export const MY_PATTERNS_RETURN_PATH = "/account#my-patterns";

/**
 * Post-login redirect target for the My Patterns entry. It deliberately carries a transient `view`
 * query param so the URL is NOT byte-for-byte identical to `/account#my-patterns` — the URL the
 * logged-out visitor is already on. Redirecting to the same URL is a fragment-only navigation that
 * never reloads, so the static `data-ms-content` gating stays stuck on the logged-out view. The
 * extra query forces a real navigation after login; the account page strips it once the logged-in
 * view has rendered (see account-login-redirect.ts).
 */
export const MY_PATTERNS_LOGIN_REDIRECT_PATH = "/account?view=my-patterns#my-patterns";

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
    if (loc.hash === "#my-patterns") {
      // Never return the exact URL we're already on (a same-URL redirect won't reload). If we're
      // already sitting on the query-param variant, hand back the clean deep link so the target
      // still differs; otherwise use the query-param variant to force a real navigation.
      return loc.search.includes("view=my-patterns")
        ? MY_PATTERNS_RETURN_PATH
        : MY_PATTERNS_LOGIN_REDIRECT_PATH;
    }
    return getMemberstackReturnPath(loc);
  }
  return getMemberstackReturnPath(loc);
}

/** Sets Memberstack inline-form `redirect` to the current page (e.g. `/account#my-patterns`). */
export function applyMemberstackFormRedirect(form: HTMLFormElement, loc?: Location): void {
  form.setAttribute("redirect", resolveAccountLoginRedirectPath(loc));
}
