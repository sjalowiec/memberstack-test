/** Relative return path for Memberstack login/signup redirects (path + query + hash). */
export function getMemberstackReturnPath(loc: Location = window.location): string {
  return loc.pathname + loc.search + loc.hash;
}

/** Sets Memberstack inline-form `redirect` to the current page (e.g. `/account#my-patterns`). */
export function applyMemberstackFormRedirect(form: HTMLFormElement, loc?: Location): void {
  form.setAttribute("redirect", getMemberstackReturnPath(loc));
}
