import {
  getMemberstackReturnPath,
  MY_PATTERNS_RETURN_PATH,
  resolveAccountLoginRedirectPath,
} from "./memberstackReturnUrl";

export { MY_PATTERNS_RETURN_PATH, resolveAccountLoginRedirectPath };

/** Id of the static login proxy anchor rendered in BaseLayout (bound at Memberstack init). */
export const MEMBERSTACK_LOGIN_PROXY_ID = "kbm-ms-login-proxy";

/**
 * Opens the Memberstack login modal with an explicit post-login return path.
 * Uses a static proxy anchor; dynamically injected `data-ms-modal` markup is not bound at init.
 */
export function openMemberstackLoginModal(returnPath?: string): void {
  const path = returnPath ?? getMemberstackReturnPath();
  const proxy = document.getElementById(MEMBERSTACK_LOGIN_PROXY_ID);

  if (proxy instanceof HTMLAnchorElement) {
    proxy.setAttribute("data-ms-redirect", path);
    proxy.click();
    return;
  }

  const ms = window.$memberstackDom;
  if (typeof ms?.openModal === "function") {
    void ms.openModal("LOGIN");
  }
}

/** Account page: form redirect + modal login triggers use the same explicit return path. */
export function applyAccountLoginReturnPath(loc: Location = window.location): string {
  const returnPath = resolveAccountLoginRedirectPath(loc);

  const form = document.querySelector<HTMLFormElement>(
    '.account-page__guest form[data-ms-form="login"]',
  );
  if (form) form.setAttribute("redirect", returnPath);

  document.querySelectorAll<HTMLElement>('[data-ms-modal="login"]').forEach((el) => {
    el.setAttribute("data-ms-redirect", returnPath);
  });

  return returnPath;
}
