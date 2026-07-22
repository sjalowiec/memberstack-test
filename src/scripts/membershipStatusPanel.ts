/**
 * Hydrate the /membership status UI.
 *
 * Logged-out visitors keep the normal sales page: no status panel, no loading /
 * wait overlays, and no membership-status endpoint call. Personalized status
 * runs only after Memberstack confirms the visitor is logged in.
 *
 * - Active / canceling: once-per-session modal + reopen trigger near the hero.
 * - Blocking transition / lookup failure: inline beige panel (always visible).
 * - Free / purchase: compact inline note only (no auto-modal).
 *
 * Current paid membership comes from the same Memberstack client payload as
 * AccountMembershipPanel / joinCheckout. The membership-status server endpoint
 * supplies legacy transition context only when the client has no active paid plan.
 */

import { isMemberLoggedIn } from "../lib/memberAccess";
import {
  fetchMembershipStatus,
  MembershipStatusAuthError,
} from "../lib/membership/membershipStatusClient";
import { applyMembershipStatusCtaMode } from "../lib/membership/membershipStatusCta";
import {
  MEMBERSHIP_STATUS_FREE_ACCOUNT_COMPACT_MESSAGE,
  membershipStatusUiMode,
  resolveMembershipStatusPageView,
  type MembershipStatusPageFactKey,
  type MembershipStatusPageView,
} from "../lib/membership/membershipStatusPageView";
import {
  hasMembershipStatusModalAutoOpened,
  markMembershipStatusModalAutoOpened,
} from "../lib/membership/membershipStatusSession";
import { applyMembershipHeroHeading } from "../lib/membership/membershipHero";
import { applyMembershipPageContentMode } from "../lib/membership/membershipThankYou";
import { bindMembershipWhatsIncludedModal } from "../lib/membership/membershipWhatsIncluded";
import type { MembershipStatusSummary } from "../lib/membership/membershipStatusSummary";
import { memberRecordFromMemberstackPayload } from "../lib/patterns/memberstackMember";

const BOUND_ATTR = "data-membership-status-modal-bound";
const FACT_KEYS: MembershipStatusPageFactKey[] = [
  "status",
  "plan",
  "billing",
  "renews",
  "through",
  "previous",
];

/** Ignore stale async results when auth:updated overlaps a prior load. */
let loadGeneration = 0;

/** Element that opened the modal (reopen trigger or null for auto-open). */
let modalReturnFocus: HTMLElement | null = null;

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
        console.warn("[membership status] Memberstack member check failed", error);
        return null;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

function memberIdFromPayload(payload: unknown): string | null {
  const member = memberRecordFromMemberstackPayload(payload);
  const id = member?.id ?? member?._id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function isDialogElement(el: Element | null): el is HTMLDialogElement {
  return (
    !!el &&
    typeof (el as HTMLDialogElement).showModal === "function" &&
    typeof (el as HTMLDialogElement).close === "function"
  );
}

function getDialog(root: ParentNode): HTMLDialogElement | null {
  const el = root.querySelector("[data-membership-status-modal]");
  return isDialogElement(el) ? el : null;
}

function setFact(
  root: ParentNode,
  key: MembershipStatusPageFactKey,
  value: string | null | undefined,
  opts: { factAttr: string; valueAttr: string },
): void {
  const row = root.querySelector<HTMLElement>(`[${opts.factAttr}="${key}"]`);
  const valueEl = root.querySelector<HTMLElement>(`[${opts.valueAttr}="${key}"]`);
  if (!row || !valueEl) return;
  if (!value) {
    row.hidden = true;
    valueEl.textContent = "";
    return;
  }
  row.hidden = false;
  valueEl.textContent = value;
}

function applyFacts(
  root: ParentNode,
  facts: MembershipStatusPageView["facts"],
  opts: {
    factsSelector: string;
    factAttr: string;
    valueAttr: string;
    keys?: MembershipStatusPageFactKey[];
  },
): void {
  const factsEl = root.querySelector<HTMLElement>(opts.factsSelector);
  if (!factsEl) return;
  const keys = opts.keys ?? FACT_KEYS;
  // Hide any fact rows not in this presentation (e.g. Active through on the active modal).
  for (const key of FACT_KEYS) {
    if (!keys.includes(key)) {
      setFact(root, key, null, opts);
      continue;
    }
    setFact(root, key, facts[key], opts);
  }
  const visibleFact = factsEl.querySelector(`[${opts.factAttr}]:not([hidden])`);
  factsEl.hidden = !visibleFact;
}

function hideInlinePanel(root: ParentNode): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (!panel) return;
  panel.hidden = true;
  panel.setAttribute("data-membership-status-state", "idle");
  panel.removeAttribute("data-membership-status-ui");
  panel.removeAttribute("data-membership-status-source");
}

/**
 * Ordinary logged-out sales experience: no status panel, no modal, no overlays.
 * Purchase CTAs stay enabled; hero stays on the normal choose-plan CTA.
 */
function settleLoggedOutSalesExperience(
  root: ParentNode,
  panel: HTMLElement,
): void {
  hideInlinePanel(root);
  setOpenTriggerVisible(root, false);
  const dialog = getDialog(root);
  if (dialog?.open) dialog.close();
  applyMembershipPageContentMode("sales", root);
  applyMembershipHeroHeading("default", root);
  panel.setAttribute("data-membership-status-state", "idle");
  applyMembershipStatusCtaMode("hidden", root);
}

function setOpenTriggerVisible(root: ParentNode, visible: boolean): void {
  root.querySelectorAll<HTMLElement>("[data-membership-status-open]").forEach((el) => {
    el.hidden = !visible;
  });
}

function modalFactKeys(
  view: MembershipStatusPageView,
): MembershipStatusPageFactKey[] {
  if (view.source === "client_canceling") {
    return ["plan", "status", "billing", "through"];
  }
  // Active membership modal: Plan, Status, Billing, Renews only.
  return ["plan", "status", "billing", "renews"];
}

function renderModalContent(root: ParentNode, view: MembershipStatusPageView): void {
  const heading = root.querySelector<HTMLElement>("[data-membership-status-modal-heading]");
  const message = root.querySelector<HTMLElement>("[data-membership-status-modal-message]");
  if (heading) heading.textContent = view.heading;
  if (message) message.textContent = view.message;
  applyFacts(root, view.facts, {
    factsSelector: "[data-membership-status-modal-facts]",
    factAttr: "data-membership-status-modal-fact",
    valueAttr: "data-membership-status-modal-value",
    keys: modalFactKeys(view),
  });
}

export function openMembershipStatusModal(
  root: ParentNode = document,
  options?: { returnFocus?: HTMLElement | null },
): boolean {
  const dialog = getDialog(root);
  if (!dialog) return false;

  if (options && "returnFocus" in options) {
    modalReturnFocus = options.returnFocus ?? null;
  } else if (document.activeElement instanceof HTMLElement) {
    modalReturnFocus = document.activeElement;
  }

  if (!dialog.open) {
    dialog.showModal();
  }

  const closeBtn = dialog.querySelector<HTMLElement>("[data-membership-status-modal-close]");
  (closeBtn ?? dialog).focus({ preventScroll: true });
  return true;
}

export function closeMembershipStatusModal(root: ParentNode = document): void {
  const dialog = getDialog(root);
  if (!dialog?.open) return;
  dialog.close();
}

function restoreModalFocus(): void {
  const target = modalReturnFocus;
  modalReturnFocus = null;
  if (target && typeof target.focus === "function" && document.contains(target)) {
    target.focus({ preventScroll: true });
  }
}

function renderInlineBlocking(root: ParentNode, view: MembershipStatusPageView): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  const heading = root.querySelector<HTMLElement>("[data-membership-status-heading]");
  const message = root.querySelector<HTMLElement>("[data-membership-status-message]");

  if (!panel || !loading || !body || !heading || !message) return;

  setOpenTriggerVisible(root, false);
  panel.hidden = false;
  panel.setAttribute(
    "data-membership-status-state",
    view.source === "client_unavailable" ? "error" : "ready",
  );
  panel.setAttribute("data-membership-status-source", view.source);
  panel.setAttribute("data-membership-status-ui", "inline_blocking");
  loading.hidden = true;
  body.hidden = false;

  heading.hidden = false;
  heading.textContent = view.heading;
  message.textContent = view.message;

  applyFacts(root, view.facts, {
    factsSelector: "[data-membership-status-facts]",
    factAttr: "data-membership-status-fact",
    valueAttr: "data-membership-status-value",
  });

  applyMembershipStatusCtaMode(view.ctaMode, root);
}

function renderInlineCompact(root: ParentNode, view: MembershipStatusPageView): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  const heading = root.querySelector<HTMLElement>("[data-membership-status-heading]");
  const message = root.querySelector<HTMLElement>("[data-membership-status-message]");
  const facts = root.querySelector<HTMLElement>("[data-membership-status-facts]");

  if (!panel || !loading || !body || !heading || !message) return;

  setOpenTriggerVisible(root, false);
  panel.hidden = false;
  panel.setAttribute("data-membership-status-state", "ready");
  panel.setAttribute("data-membership-status-source", view.source);
  panel.setAttribute("data-membership-status-ui", "inline_compact");
  loading.hidden = true;
  body.hidden = false;

  heading.hidden = false;
  heading.textContent = view.heading;
  message.textContent =
    view.message?.trim() || MEMBERSHIP_STATUS_FREE_ACCOUNT_COMPACT_MESSAGE;

  if (facts) {
    applyFacts(root, {
      status: null,
      plan: null,
      billing: null,
      renews: null,
      through: null,
      previous: null,
    }, {
      factsSelector: "[data-membership-status-facts]",
      factAttr: "data-membership-status-fact",
      valueAttr: "data-membership-status-value",
    });
  }

  applyMembershipStatusCtaMode(view.ctaMode, root);
}

function presentPageView(
  root: ParentNode,
  view: MembershipStatusPageView,
  memberId: string | null,
  memberPayload: unknown | null = null,
  options?: { autoOpenModal?: boolean },
): void {
  const uiMode = membershipStatusUiMode(view);

  if (uiMode === "modal") {
    hideInlinePanel(root);
    setOpenTriggerVisible(root, true);
    renderModalContent(root, view);
    applyMembershipStatusCtaMode(view.ctaMode, root);
    // Active / canceling paid: thank-you replaces sales content.
    applyMembershipPageContentMode("thank_you", root);
    applyMembershipHeroHeading("welcome", root, memberPayload);

    const shouldAutoOpen =
      options?.autoOpenModal !== false &&
      Boolean(memberId) &&
      !hasMembershipStatusModalAutoOpened(memberId!);

    if (shouldAutoOpen && memberId) {
      markMembershipStatusModalAutoOpened(memberId);
      openMembershipStatusModal(root, { returnFocus: null });
    }
    return;
  }

  const dialog = getDialog(root);
  if (dialog?.open) dialog.close();
  setOpenTriggerVisible(root, false);
  applyMembershipPageContentMode("sales", root);
  applyMembershipHeroHeading("default", root);

  if (uiMode === "inline_compact") {
    renderInlineCompact(root, view);
    return;
  }

  renderInlineBlocking(root, view);
}

function renderLoading(root: ParentNode): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  if (!panel || !loading || !body) return;
  setOpenTriggerVisible(root, false);
  panel.hidden = false;
  panel.setAttribute("data-membership-status-state", "loading");
  panel.setAttribute("data-membership-status-ui", "loading");
  loading.hidden = false;
  body.hidden = true;
  applyMembershipStatusCtaMode("loading", root);
}

async function loadServerSummaryForLegacy(): Promise<MembershipStatusSummary | null> {
  try {
    return await fetchMembershipStatus();
  } catch (err) {
    if (err instanceof MembershipStatusAuthError) {
      return null;
    }
    return null;
  }
}

export async function loadAndRenderMembershipStatusPanel(
  root: ParentNode = document,
): Promise<void> {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (!panel) return;

  const generation = ++loadGeneration;

  // Do not apply loading/wait/contact overlays until Memberstack confirms login.
  // Logged-out prospects must keep the SSR sales page fully usable meanwhile.
  const payload = await waitForMemberstackPayload();
  if (generation !== loadGeneration) return;

  if (!payload || !isMemberLoggedIn(payload)) {
    // Anonymous / logged-out (including Memberstack not ready): normal sales page.
    // Never show status panel, cannot-confirm, or call the authenticated endpoint.
    settleLoggedOutSalesExperience(root, panel);
    return;
  }

  // Authenticated only from here.
  applyMembershipStatusCtaMode("loading", root);
  const memberId = memberIdFromPayload(payload);
  renderLoading(root);

  // Client paid membership wins immediately — do not wait on / fail because of the server.
  const clientFirst = resolveMembershipStatusPageView({
    clientLoaded: true,
    memberPayload: payload,
    serverSummary: null,
  });

  if (
    clientFirst.source === "client_active" ||
    clientFirst.source === "client_canceling"
  ) {
    if (generation !== loadGeneration) return;
    presentPageView(root, clientFirst, memberId, payload);
    return;
  }

  // No active paid plan on the client — legacy / transition context from the server.
  const serverSummary = await loadServerSummaryForLegacy();
  if (generation !== loadGeneration) return;

  presentPageView(
    root,
    resolveMembershipStatusPageView({
      clientLoaded: true,
      memberPayload: payload,
      serverSummary,
    }),
    memberId,
    payload,
  );
}

function bindMembershipStatusModal(root: ParentNode): void {
  const dialog = getDialog(root);
  if (!dialog || dialog.getAttribute(BOUND_ATTR) === "true") return;
  dialog.setAttribute(BOUND_ATTR, "true");

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  dialog.querySelectorAll("[data-membership-status-modal-close]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      close();
    });
  });

  // Backdrop click closes; clicks inside the inner content do not.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener("close", () => {
    restoreModalFocus();
  });
}

export function initMembershipStatusPanel(root: ParentNode = document): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (!panel) return;

  bindMembershipStatusModal(root);
  bindMembershipWhatsIncludedModal(root);

  const retry = root.querySelector<HTMLButtonElement>("[data-membership-status-retry]");
  retry?.addEventListener("click", () => {
    void loadAndRenderMembershipStatusPanel(root);
  });

  root.querySelectorAll<HTMLElement>("[data-membership-status-open]").forEach((trigger) => {
    if (trigger.getAttribute("data-membership-status-open-bound") === "true") return;
    trigger.setAttribute("data-membership-status-open-bound", "true");
    trigger.addEventListener("click", () => {
      openMembershipStatusModal(root, { returnFocus: trigger });
    });
  });

  if (panel.getAttribute("data-membership-status-auth-bound") !== "true") {
    panel.setAttribute("data-membership-status-auth-bound", "true");
    window.addEventListener("auth:updated", () => {
      void loadAndRenderMembershipStatusPanel(root);
    });
  }

  void loadAndRenderMembershipStatusPanel(root);
}

/** Test-only: reset in-flight generation between cases. */
export function __resetMembershipStatusPanelForTests(): void {
  loadGeneration = 0;
  modalReturnFocus = null;
}

function bootMembershipStatusPanel(): void {
  if (document.querySelector("[data-membership-status-panel]")) {
    initMembershipStatusPanel();
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootMembershipStatusPanel);
  } else {
    bootMembershipStatusPanel();
  }
}
