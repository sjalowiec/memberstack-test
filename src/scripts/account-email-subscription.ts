/**
 * Account page Email updates — status check and explicit resubscribe.
 * Never sends an email address; the server uses the verified session.
 */

import {
  AccountEmailSubscriptionAuthError,
  fetchAccountEmailSubscriptionStatus,
  resubscribeAccountEmailUpdates,
} from "../lib/account/accountEmailSubscriptionClient";
import { resolveAccountEmailSubscriptionView } from "../lib/account/accountEmailSubscriptionView";
import {
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
  type AccountEmailSubscriptionState,
} from "../lib/account/accountEmailSubscriptionShared";

const ROOT_SELECTOR = "[data-kbm-account-email-updates]";

type StatusEls = {
  root: Element;
  statusEl: HTMLElement;
  checkEl: HTMLElement;
  extraEl: HTMLElement;
  errorEl: HTMLElement;
  actionsEl: HTMLElement;
  buttonEl: HTMLButtonElement;
  consentEl: HTMLElement;
};

function queryEls(root: Element): StatusEls | null {
  const statusEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-status]");
  const checkEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-check]");
  const extraEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-extra]");
  const errorEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-error]");
  const actionsEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-actions]");
  const buttonEl = root.querySelector<HTMLButtonElement>("[data-kbm-account-email-updates-subscribe]");
  const consentEl = root.querySelector<HTMLElement>("[data-kbm-account-email-updates-consent]");
  if (!statusEl || !checkEl || !extraEl || !errorEl || !actionsEl || !buttonEl || !consentEl) {
    return null;
  }
  return { root, statusEl, checkEl, extraEl, errorEl, actionsEl, buttonEl, consentEl };
}

function setBusy(els: StatusEls, busy: boolean): void {
  els.buttonEl.disabled = busy;
  els.buttonEl.setAttribute("aria-busy", busy ? "true" : "false");
}

function applyView(
  els: StatusEls,
  view: ReturnType<typeof resolveAccountEmailSubscriptionView>,
): void {
  els.statusEl.textContent = view.statusMessage;
  els.checkEl.hidden = !view.showCheckmark;
  els.extraEl.textContent = view.extraMessage ?? "";
  els.extraEl.hidden = !view.extraMessage;
  els.errorEl.textContent = view.errorMessage ?? "";
  els.errorEl.hidden = !view.errorMessage;
  els.actionsEl.hidden = !view.showButton;
  els.consentEl.hidden = !view.consentText;
  els.buttonEl.hidden = !view.showButton;
}

function unavailableView(errorMessage?: string) {
  return resolveAccountEmailSubscriptionView({
    state: "unavailable",
    errorMessage: errorMessage ?? ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
  });
}

async function loadStatus(els: StatusEls): Promise<void> {
  try {
    const result = await fetchAccountEmailSubscriptionStatus();
    const state: AccountEmailSubscriptionState = result.state || "unavailable";
    applyView(
      els,
      resolveAccountEmailSubscriptionView({
        state,
        errorMessage: result.ok ? null : result.error ?? ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
      }),
    );
  } catch (err) {
    if (err instanceof AccountEmailSubscriptionAuthError) {
      applyView(els, unavailableView());
      return;
    }
    applyView(els, unavailableView());
  }
}

async function onSubscribeClick(els: StatusEls): Promise<void> {
  if (els.buttonEl.disabled) return;
  setBusy(els, true);
  els.errorEl.hidden = true;
  els.errorEl.textContent = "";

  try {
    const result = await resubscribeAccountEmailUpdates();
    if (result.ok) {
      applyView(
        els,
        resolveAccountEmailSubscriptionView({
          state: "active",
          justSubscribed: true,
        }),
      );
      return;
    }
    if (result.state === "bounced") {
      applyView(els, resolveAccountEmailSubscriptionView({ state: "bounced" }));
      return;
    }
    applyView(
      els,
      resolveAccountEmailSubscriptionView({
        state: "unsubscribed",
        errorMessage: result.error || ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
      }),
    );
  } catch {
    applyView(
      els,
      resolveAccountEmailSubscriptionView({
        state: "unsubscribed",
        errorMessage: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
      }),
    );
  } finally {
    setBusy(els, false);
  }
}

function bindSubscribe(els: StatusEls): void {
  if (els.buttonEl.dataset.kbmBound === "1") return;
  els.buttonEl.dataset.kbmBound = "1";
  els.buttonEl.addEventListener("click", () => {
    void onSubscribeClick(els);
  });
}

export function bootAccountEmailUpdates(): void {
  const root = document.querySelector(ROOT_SELECTOR);
  if (!root) return;
  const els = queryEls(root);
  if (!els) return;

  bindSubscribe(els);
  void loadStatus(els);

  window.addEventListener("auth:updated", () => {
    void loadStatus(els);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountEmailUpdates());
  } else {
    bootAccountEmailUpdates();
  }
}
