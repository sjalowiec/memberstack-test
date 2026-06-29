import { applyAccountLoginReturnPath } from "../lib/memberstackLogin";

export function initAccountLoginRedirect(): void {
  applyAccountLoginReturnPath();

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
