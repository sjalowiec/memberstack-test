/**
 * Account page welcome block — shows signed-in member name and email.
 */
import {
  accountWelcomeGreetingFromMemberstackPayload,
  memberEmailFromMemberstackPayload,
} from "../lib/patterns/memberstackMember";

async function populateAccountWelcome(): Promise<void> {
  const root = document.querySelector("[data-kbm-account-welcome]");
  if (!root) return;

  const greetingEl = root.querySelector<HTMLElement>("[data-kbm-account-welcome-greeting]");
  const emailEl = root.querySelector<HTMLElement>("[data-kbm-account-welcome-email]");
  if (!greetingEl) return;

  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return;

  try {
    const payload = await ms.getCurrentMember();
    greetingEl.textContent = accountWelcomeGreetingFromMemberstackPayload(payload);

    if (emailEl) {
      const email = memberEmailFromMemberstackPayload(payload);
      if (email) {
        emailEl.textContent = email;
        emailEl.hidden = false;
      } else {
        emailEl.textContent = "";
        emailEl.hidden = true;
      }
    }
  } catch {
    /* Keep default greeting on Memberstack errors. */
  }
}

export function bootAccountWelcome(): void {
  void populateAccountWelcome();
  window.addEventListener("auth:updated", () => {
    void populateAccountWelcome();
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountWelcome());
  } else {
    bootAccountWelcome();
  }
}
