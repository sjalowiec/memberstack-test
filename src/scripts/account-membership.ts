/**
 * Account page membership panel — plan/status/actions from Memberstack.
 *
 * Prefer getAppAndMember (includes planConnections reliably); fall back to
 * getCurrentMember. Manage Billing uses Memberstack's native
 * data-ms-action="customer-portal" (no hard-coded Stripe portal URL).
 */

import { isMemberLoggedIn } from "../lib/memberAccess";
import {
  resolveAccountMembershipPanelView,
  type AccountMembershipPanelAction,
  type AccountMembershipPanelView,
} from "../lib/membership/accountMembershipPanel";
import { startJoinCheckout, type StartJoinCheckoutOptions } from "./joinCheckout";

const ALL_PANEL_ACTIONS: AccountMembershipPanelAction[] = [
  "join",
  "manageBilling",
  "switchToAnnual",
  "renewAnnual",
  "becomeMonthly",
];

const LOAD_ERROR_MESSAGE =
  "We couldn't load your membership details. Please refresh the page and try again.";

async function waitForMemberstackPayload(
  attempts = 35,
  delayMs = 200,
): Promise<unknown | null> {
  for (let i = 0; i < attempts; i++) {
    const ms = window.$memberstackDom;
    const api = ms?.getAppAndMember ?? ms?.getCurrentMember;
    if (typeof api === "function") {
      if (ms?.onReady) await ms.onReady;
      try {
        return await api.call(ms);
      } catch (error) {
        console.warn("[account membership] Memberstack member check failed", error);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function setVisible(el: Element | null, visible: boolean): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function applyView(root: Element, view: AccountMembershipPanelView): void {
  const planEl = root.querySelector("[data-kbm-account-membership-plan]");
  const statusEl = root.querySelector("[data-kbm-account-membership-status]");
  const renewsRow = root.querySelector("[data-kbm-account-membership-renews-row]");
  const renewsEl = root.querySelector("[data-kbm-account-membership-renews]");
  const autoRenewEl = root.querySelector("[data-kbm-account-membership-auto-renew]");
  const activeUntilEl = root.querySelector("[data-kbm-account-membership-active-until]");
  const billingDescriptionEl = root.querySelector(
    "[data-kbm-account-membership-billing-description]",
  );
  const annualSwitchWarningEl = root.querySelector(
    "[data-kbm-account-membership-annual-switch-warning]",
  );
  const visible = new Set(view.visibleActions);

  if (planEl) planEl.textContent = view.planDisplayLabel;
  if (statusEl) statusEl.textContent = view.statusLabel;

  if (view.renewsLabel && renewsEl && renewsRow) {
    renewsEl.textContent = view.renewsLabel;
    setVisible(renewsRow, true);
  } else {
    if (renewsEl) renewsEl.textContent = "";
    setVisible(renewsRow, false);
  }

  if (view.autoRenewNote && autoRenewEl instanceof HTMLElement) {
    autoRenewEl.textContent = view.autoRenewNote;
    setVisible(autoRenewEl, true);
  } else if (autoRenewEl instanceof HTMLElement) {
    autoRenewEl.textContent = "";
    setVisible(autoRenewEl, false);
  }

  if (view.activeUntilMessage && activeUntilEl instanceof HTMLElement) {
    activeUntilEl.textContent = view.activeUntilMessage;
    setVisible(activeUntilEl, true);
  } else if (activeUntilEl instanceof HTMLElement) {
    activeUntilEl.textContent = "";
    setVisible(activeUntilEl, false);
  }

  for (const action of ALL_PANEL_ACTIONS) {
    const el = root.querySelector(`[data-kbm-account-membership-action="${action}"]`);
    setVisible(el, visible.has(action));
  }

  if (view.annualSwitchWarning && annualSwitchWarningEl instanceof HTMLElement) {
    annualSwitchWarningEl.textContent = view.annualSwitchWarning;
    setVisible(annualSwitchWarningEl, true);
  } else if (annualSwitchWarningEl instanceof HTMLElement) {
    annualSwitchWarningEl.textContent = "";
    setVisible(annualSwitchWarningEl, false);
  }

  if (view.manageBillingDescription && billingDescriptionEl instanceof HTMLElement) {
    billingDescriptionEl.textContent = view.manageBillingDescription;
    setVisible(billingDescriptionEl, true);
  } else if (billingDescriptionEl instanceof HTMLElement) {
    billingDescriptionEl.textContent = "";
    setVisible(billingDescriptionEl, false);
  }

  root.setAttribute("data-kbm-account-membership-kind", view.kind);
  root.setAttribute("data-kbm-account-membership-canceling", view.isCanceling ? "true" : "false");
}

async function populateAccountMembership(): Promise<void> {
  const root = document.querySelector("[data-kbm-account-membership]");
  if (!root) return;

  const loadingEl = root.querySelector("[data-kbm-account-membership-loading]");
  const errorEl = root.querySelector("[data-kbm-account-membership-error]");
  const contentEl = root.querySelector("[data-kbm-account-membership-content]");
  const actionStatusEl = root.querySelector<HTMLElement>(
    "[data-kbm-account-membership-action-status]",
  );

  setVisible(loadingEl, true);
  setVisible(errorEl, false);
  setVisible(contentEl, false);
  if (actionStatusEl) {
    actionStatusEl.hidden = true;
    actionStatusEl.textContent = "";
  }

  const payload = await waitForMemberstackPayload();
  // Do not fall back to a free-account label when Memberstack did not return a member.
  if (!payload || !isMemberLoggedIn(payload)) {
    setVisible(loadingEl, false);
    if (errorEl instanceof HTMLElement) {
      errorEl.textContent = LOAD_ERROR_MESSAGE;
    }
    setVisible(errorEl, true);
    return;
  }

  applyView(root, resolveAccountMembershipPanelView(payload));
  setVisible(loadingEl, false);
  setVisible(contentEl, true);
}

/**
 * Manage Billing uses Memberstack's native customer-portal action (no JS portal
 * launch). Switch to Annual / Renew / Become Monthly reuse startJoinCheckout.
 */
function bindMembershipActionButtons(root: Element): void {
  bindLegacyCheckoutButton(
    root,
    "[data-kbm-account-membership-switch-annual]",
    "annual",
    {
      checkoutIntent: "switchToAnnual",
    },
  );
  bindLegacyCheckoutButton(
    root,
    "[data-kbm-account-membership-renew-annual]",
    "annual",
  );
  bindLegacyCheckoutButton(
    root,
    "[data-kbm-account-membership-become-monthly]",
    "monthly",
  );
}

function bindLegacyCheckoutButton(
  root: Element,
  selector: string,
  planKey: "annual" | "monthly",
  options?: { checkoutIntent?: "switchToAnnual" },
): void {
  root.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    if (btn.dataset.kbmBound === "1") return;
    btn.dataset.kbmBound = "1";

    btn.addEventListener("click", () => {
      btn.disabled = true;
      void startJoinCheckout(
        planKey,
        options as StartJoinCheckoutOptions | undefined,
      ).finally(() => {
        btn.disabled = false;
      });
    });
  });
}

export function bootAccountMembership(): void {
  const root = document.querySelector("[data-kbm-account-membership]");
  if (!root) return;

  bindMembershipActionButtons(root);
  void populateAccountMembership();

  window.addEventListener("auth:updated", () => {
    void populateAccountMembership();
  });

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", () => {
      void populateAccountMembership();
    });
    ms.on("member.logout", () => {
      void populateAccountMembership();
    });
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountMembership());
  } else {
    bootAccountMembership();
  }
}
