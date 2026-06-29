import { applyMemberstackFormRedirect } from "../lib/memberstackReturnUrl";

export function initAccountLoginRedirect(): void {
  const form = document.querySelector<HTMLFormElement>(
    '.account-page__guest form[data-ms-form="login"]',
  );
  if (form) applyMemberstackFormRedirect(form);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccountLoginRedirect);
  } else {
    initAccountLoginRedirect();
  }
}
