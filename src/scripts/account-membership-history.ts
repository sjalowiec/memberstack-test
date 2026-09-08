/**
 * Account page - server-fed membership detail (Member Since, Legacy Access) and
 * the read-only Membership History timeline.
 *
 * Live plan/status/billing/renewal + actions are populated separately by
 * account-membership.ts straight from the Memberstack payload. This script adds
 * the fields that require authoritative server data (legacy history, earliest
 * join date) via the customer-safe account-membership-detail endpoint. If that
 * request fails, the extra fields simply stay hidden - the core panel is
 * unaffected.
 */

import {
  fetchAccountMembershipDetail,
  type AccountMembershipDetailResponse,
} from "../lib/membership/accountMembershipDetailClient";
import { resolveAccountMembershipDetailView } from "../lib/membership/accountMembershipDetailView";
import type { MembershipHistoryEvent } from "../lib/membership/membershipHistory";
import { buildMembershipHistoryRow } from "../lib/membership/membershipHistoryRow";
import type { AccountMembershipPanelAction } from "../lib/membership/accountMembershipPanel";

const ALL_PANEL_ACTIONS: AccountMembershipPanelAction[] = [
  "join",
  "manageBilling",
  "switchToAnnual",
  "renewAnnual",
  "becomeMonthly",
];

function setText(root: Element, selector: string, value: string): void {
  const el = root.querySelector(selector);
  if (el instanceof HTMLElement) el.textContent = value;
}

/**
 * Fill the single primary date row (label + value). Legacy members read
 * "Legacy Access Through {date}"; everyone else keeps "Member Since {date}".
 * Hidden when there is no date/label so we never show an empty row.
 */
function setDateRow(root: Element, label: string | null, value: string | null): void {
  const row = root.querySelector("[data-kbm-account-membership-date-row]");
  const labelEl = root.querySelector("[data-kbm-account-membership-date-label]");
  const valueEl = root.querySelector("[data-kbm-account-membership-date-value]");
  if (
    !(row instanceof HTMLElement) ||
    !(labelEl instanceof HTMLElement) ||
    !(valueEl instanceof HTMLElement)
  ) {
    return;
  }
  if (label && label.trim() && value && value.trim()) {
    labelEl.textContent = label.trim();
    valueEl.textContent = value.trim();
    row.hidden = false;
  } else {
    valueEl.textContent = "";
    row.hidden = true;
  }
}

/** Collapse the history accordion (used on every (re)render). */
function collapseHistory(section: Element): void {
  const toggle = section.querySelector("[data-kbm-account-membership-history-toggle]");
  const panel = section.querySelector("[data-kbm-account-membership-history-panel]");
  if (toggle instanceof HTMLElement) toggle.setAttribute("aria-expanded", "false");
  if (panel instanceof HTMLElement) panel.hidden = true;
}

function renderHistory(
  root: Element,
  events: MembershipHistoryEvent[],
  headerLabel: string | null,
): void {
  const section = root.querySelector("[data-kbm-account-membership-history]");
  const list = root.querySelector("[data-kbm-account-membership-history-list]");
  if (!(section instanceof HTMLElement) || !(list instanceof HTMLElement)) return;

  list.textContent = "";
  // No events: hide the whole accordion (no header, no count).
  if (events.length === 0 || !headerLabel) {
    section.hidden = true;
    return;
  }

  setText(section, "[data-kbm-account-membership-history-title]", headerLabel);
  collapseHistory(section); // Collapsed by default; expands on demand.

  // Events arrive newest-first from the server DTO (shared display ordering).
  for (const event of events) {
    list.appendChild(buildMembershipHistoryRow(document, event));
  }
  section.hidden = false;
}

function setVisible(el: Element | null, visible: boolean): void {
  if (!(el instanceof HTMLElement)) return;
  el.hidden = !visible;
}

function applyActions(root: Element, actions: AccountMembershipPanelAction[] | null): void {
  if (!actions) return;
  const visible = new Set(actions);
  for (const action of ALL_PANEL_ACTIONS) {
    const el = root.querySelector(`[data-kbm-account-membership-action="${action}"]`);
    setVisible(el, visible.has(action));
  }
}

function applyDetail(root: Element, detail: AccountMembershipDetailResponse): void {
  const view = resolveAccountMembershipDetailView(detail);

  if (view.planOverride) {
    setText(root, "[data-kbm-account-membership-plan]", view.planOverride);
  }
  if (view.statusOverride) {
    setText(root, "[data-kbm-account-membership-status]", view.statusOverride);
  }
  applyActions(root, view.visibleActions);

  setDateRow(root, view.membershipDateLabel, view.membershipDateValue);

  renderHistory(
    root,
    Array.isArray(detail.history) ? detail.history : [],
    view.history.headerLabel,
  );
}

/** Wire the accordion trigger once. Real button + aria-expanded/-controls. */
function bindHistoryAccordion(root: Element): void {
  const toggle = root.querySelector("[data-kbm-account-membership-history-toggle]");
  const panel = root.querySelector("[data-kbm-account-membership-history-panel]");
  if (!(toggle instanceof HTMLElement) || !(panel instanceof HTMLElement)) return;
  if (toggle.dataset.kbmBound === "1") return;
  toggle.dataset.kbmBound = "1";

  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    panel.hidden = isOpen;
  });
}

async function populateAccountMembershipHistory(): Promise<void> {
  const root = document.querySelector("[data-kbm-account-membership]");
  if (!root) return;

  try {
    const detail = await fetchAccountMembershipDetail();
    applyDetail(root, detail);
  } catch (error) {
    console.warn("[account membership history] Unable to load membership detail", error);
    if (root.getAttribute("data-kbm-account-membership-kind") !== "member") {
      applyDetail(root, {
        ok: false,
        identified: false,
        membershipName: null,
        statusLabel: null,
        billingLabel: null,
        nextRenewalDate: null,
        activeThroughDate: null,
        legacyPaidThroughDate: null,
        legacyAccessActive: null,
        memberSince: null,
        history: [],
      });
    }
  }
}

export function bootAccountMembershipHistory(): void {
  const root = document.querySelector("[data-kbm-account-membership]");
  if (!root) return;

  bindHistoryAccordion(root);
  void populateAccountMembershipHistory();

  window.addEventListener("auth:updated", () => {
    void populateAccountMembershipHistory();
  });

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", () => {
      void populateAccountMembershipHistory();
    });
    ms.on("member.logout", () => {
      void populateAccountMembershipHistory();
    });
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => bootAccountMembershipHistory());
  } else {
    bootAccountMembershipHistory();
  }
}
