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

function setText(root: Element, selector: string, value: string): void {
  const el = root.querySelector(selector);
  if (el instanceof HTMLElement) el.textContent = value;
}

function setRow(
  root: Element,
  rowSelector: string,
  valueSelector: string,
  value: string | null,
): void {
  const row = root.querySelector(rowSelector);
  const valueEl = root.querySelector(valueSelector);
  if (!(row instanceof HTMLElement) || !(valueEl instanceof HTMLElement)) return;
  if (value && value.trim()) {
    valueEl.textContent = value.trim();
    row.hidden = false;
  } else {
    valueEl.textContent = "";
    row.hidden = true;
  }
}

function buildEventItem(event: MembershipHistoryEvent): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "account-membership-panel__event";

  const marker = document.createElement("span");
  marker.className = "account-membership-panel__event-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = "\u2713"; // ?
  item.appendChild(marker);

  const title = document.createElement("p");
  title.className = "account-membership-panel__event-title";
  title.textContent = event.title;
  item.appendChild(title);

  if (event.date) {
    const date = document.createElement("p");
    date.className = "account-membership-panel__event-date";
    date.textContent = event.date;
    item.appendChild(date);
  }

  if (event.description) {
    const description = document.createElement("p");
    description.className = "account-membership-panel__event-description";
    description.textContent = event.description;
    item.appendChild(description);
  }

  return item;
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

  for (const event of events) {
    list.appendChild(buildEventItem(event));
  }
  section.hidden = false;
}

function applyDetail(root: Element, detail: AccountMembershipDetailResponse): void {
  if (!detail.identified) {
    return;
  }

  const view = resolveAccountMembershipDetailView(detail);

  // Reconcile Plan + Status so legacy-only members tell one consistent story.
  // account-membership.ts only sees Memberstack plans (shows "No active
  // membership"); the server detail knows about legacy access.
  if (view.planOverride) {
    setText(root, "[data-kbm-account-membership-plan]", view.planOverride);
  }
  if (view.statusOverride) {
    setText(root, "[data-kbm-account-membership-status]", view.statusOverride);
  }

  setRow(
    root,
    "[data-kbm-account-membership-legacy-access-row]",
    "[data-kbm-account-membership-legacy-access]",
    view.legacyAccessValue,
  );

  setRow(
    root,
    "[data-kbm-account-membership-member-since-row]",
    "[data-kbm-account-membership-member-since]",
    detail.memberSince,
  );

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
    // Auth or network failure: leave the server-fed fields hidden. The live
    // summary rendered by account-membership.ts remains intact.
    console.warn("[account membership history] Unable to load membership detail", error);
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
