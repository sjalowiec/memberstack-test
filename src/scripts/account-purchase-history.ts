/**
 * Hydrate Account Purchase History from the signed-in member's shop orders.
 */
import { fetchAccountPurchaseHistory, AccountPurchaseHistoryAuthError } from "../lib/account/accountPurchaseHistoryClient";
import {
  renderAccountPurchaseNotes,
  renderAccountPurchaseOrders,
} from "../lib/account/accountPurchaseHistoryView";
import {
  reportAccountPurchaseHistoryView,
  reportAccountPurchaseTrackingClick,
} from "../lib/analytics/accountPurchaseHistoryGa";

function setStatus(root: HTMLElement, text: string): void {
  const status = root.querySelector<HTMLElement>("[data-kbm-account-purchases-status]");
  if (status) status.textContent = text;
}

function setNote(root: HTMLElement, selector: string, text: string): void {
  const note = root.querySelector<HTMLElement>(selector);
  if (!note) return;
  note.textContent = text;
  note.hidden = text.trim().length === 0;
}

function renderHistory(
  root: HTMLElement,
  history: Awaited<ReturnType<typeof fetchAccountPurchaseHistory>>,
): void {
  const notes = renderAccountPurchaseNotes(history);
  setNote(root, "[data-kbm-account-purchases-sync]", notes.syncNote);
  setNote(root, "[data-kbm-account-purchases-legacy]", notes.legacyNote);
  setNote(root, "[data-kbm-account-purchases-email]", notes.emailNote);

  const list = root.querySelector<HTMLElement>("[data-kbm-account-purchases-list]");
  const empty = root.querySelector<HTMLElement>("[data-kbm-account-purchases-empty]");
  const orders = Array.isArray(history.orders) ? history.orders : [];

  if (!list || !empty) return;

  if (orders.length === 0) {
    list.hidden = true;
    list.replaceChildren();
    empty.hidden = false;
    setStatus(root, "");
    reportAccountPurchaseHistoryView("empty");
    return;
  }

  empty.hidden = true;
  list.innerHTML = renderAccountPurchaseOrders(orders);
  list.hidden = false;
  setStatus(root, "");
  reportAccountPurchaseHistoryView("orders");
}

async function hydrate(root: HTMLElement): Promise<void> {
  const list = root.querySelector<HTMLElement>("[data-kbm-account-purchases-list]");
  const empty = root.querySelector<HTMLElement>("[data-kbm-account-purchases-empty]");
  if (list) {
    list.hidden = true;
    list.replaceChildren();
  }
  if (empty) empty.hidden = true;
  setNote(root, "[data-kbm-account-purchases-sync]", "");
  setNote(root, "[data-kbm-account-purchases-legacy]", "");
  setNote(root, "[data-kbm-account-purchases-email]", "");
  setStatus(root, "Loading your purchases…");

  try {
    const history = await fetchAccountPurchaseHistory();
    renderHistory(root, history);
  } catch (err) {
    if (err instanceof AccountPurchaseHistoryAuthError) {
      setStatus(root, "Sign in to see your purchases.");
      return;
    }
    setStatus(root, "We couldn’t load your purchases right now. Please try again.");
    reportAccountPurchaseHistoryView("error");
  }
}

export function bootAccountPurchaseHistory(): void {
  const root = document.querySelector<HTMLElement>("[data-kbm-account-purchases]");
  if (!root || root.dataset.accountPurchasesReady === "true") return;
  root.dataset.accountPurchasesReady = "true";

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-kbm-account-purchase-tracking]")) return;
    reportAccountPurchaseTrackingClick();
  });

  void hydrate(root);

  window.addEventListener("auth:updated", () => {
    void hydrate(root);
  });

  const ms = window.$memberstackDom;
  if (ms?.on) {
    ms.on("member.login", () => {
      void hydrate(root);
    });
    ms.on("member.logout", () => {
      void hydrate(root);
    });
  }
}

bootAccountPurchaseHistory();
