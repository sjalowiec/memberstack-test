import { notifyMemberstackLoginSuccess } from "./memberstackPostLogin";
import {
  MY_PATTERNS_RETURN_PATH,
  getMemberstackReturnPath,
  resolveAccountLoginRedirectPath,
} from "./memberstackReturnUrl";

export { MY_PATTERNS_RETURN_PATH, resolveAccountLoginRedirectPath };

/** Id of the static login proxy anchor rendered in BaseLayout (bound at Memberstack init). */
export const MEMBERSTACK_LOGIN_PROXY_ID = "kbm-ms-login-proxy";

/**
 * Opens the Memberstack login modal with an explicit post-login return path.
 * Programmatic opens use `openModal("LOGIN")` so its promise resolves on success;
 * Memberstack prebuilt modals do not auto-close unless `hideModal()` runs (see post-login handler).
 */
export function openMemberstackLoginModal(returnPath?: string): void {
  const redirect = returnPath ?? getMemberstackReturnPath();

  function openViaModal(ms: NonNullable<typeof window.$memberstackDom>): boolean {
    if (typeof ms.openModal !== "function") return false;
    void ms
      .openModal("LOGIN")
      .then(() => {
        notifyMemberstackLoginSuccess();
      })
      .catch(() => {
        /* dismissed or failed to open */
      });
    return true;
  }

  function openViaProxy(): boolean {
    const proxy = document.getElementById(MEMBERSTACK_LOGIN_PROXY_ID);
    if (!(proxy instanceof HTMLAnchorElement)) return false;
    proxy.setAttribute("data-ms-redirect", redirect);
    proxy.click();
    return true;
  }

  const ms = window.$memberstackDom;
  if (ms && openViaModal(ms)) return;
  if (openViaProxy()) return;

  void ms?.onReady?.then(() => {
    const readyMs = window.$memberstackDom;
    if (readyMs && openViaModal(readyMs)) return;
    openViaProxy();
  });
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
