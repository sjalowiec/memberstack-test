import { applyAccountLoginReturnPath } from "../lib/memberstackLogin";
import { isMemberstackLoggedInPayload } from "../lib/patterns/memberstackMember";

/**
 * The My Patterns login redirect lands on `/account?view=my-patterns#my-patterns` (see
 * memberstackReturnUrl.ts) so the post-login redirect is a genuine navigation instead of a
 * same-URL fragment change that never reloads. Once the logged-in view has rendered, strip the
 * transient `view` query param so the address bar shows the clean `/account#my-patterns` deep link.
 *
 * This only removes the param after Memberstack confirms a signed-in member, so it never fires
 * while the logged-out gate is still showing (e.g. a guest who lands on the query-param URL keeps
 * it, and their next login still redirects to a differing URL).
 */
function cleanUpMyPatternsViewParam(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get("view") !== "my-patterns") return;

  const ms = window.$memberstackDom;
  const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
  if (!ms || typeof api !== "function") return;

  const strip = (): void => {
    url.searchParams.delete("view");
    const clean = url.pathname + url.search + url.hash;
    window.history.replaceState(window.history.state, "", clean);
  };

  Promise.resolve(ms.onReady)
    .catch(() => undefined)
    .then(() => api.call(ms))
    .then((res) => {
      if (isMemberstackLoggedInPayload(res)) strip();
    })
    .catch(() => undefined);
}

export function initAccountLoginRedirect(): void {
  applyAccountLoginReturnPath();
  cleanUpMyPatternsViewParam();

  const ms = window.$memberstackDom;
  if (ms?.onReady) {
    void ms.onReady.then(() => {
      applyAccountLoginReturnPath();
    });
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccountLoginRedirect);
  } else {
    initAccountLoginRedirect();
  }
}
