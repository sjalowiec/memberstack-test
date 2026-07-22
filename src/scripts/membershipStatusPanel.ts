/**
 * Hydrate the /membership status panel from the authenticated membership-status endpoint.
 */

import {
  fetchMembershipStatus,
  isMembershipStatusMemberLoggedIn,
  MembershipStatusAuthError,
} from "../lib/membership/membershipStatusClient";
import {
  applyMembershipStatusCtaMode,
  membershipStatusCtaModeFromAction,
} from "../lib/membership/membershipStatusCta";
import {
  membershipStatusPanelHeading,
  type MembershipStatusSummary,
} from "../lib/membership/membershipStatusSummary";

function statusLabel(summary: MembershipStatusSummary): string {
  switch (summary.currentStatus) {
    case "active":
      return "Active";
    case "canceling":
      return "Active through paid-through date";
    case "no_plan":
      return "No active membership";
    case "inactive":
      return "No active membership";
    default:
      return "Status unavailable";
  }
}

function setFact(
  root: ParentNode,
  key: string,
  value: string | null | undefined,
): void {
  const row = root.querySelector<HTMLElement>(`[data-membership-status-fact="${key}"]`);
  const valueEl = root.querySelector<HTMLElement>(`[data-membership-status-value="${key}"]`);
  if (!row || !valueEl) return;
  if (!value) {
    row.hidden = true;
    valueEl.textContent = "";
    return;
  }
  row.hidden = false;
  valueEl.textContent = value;
}

function renderSummary(root: ParentNode, summary: MembershipStatusSummary): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  const heading = root.querySelector<HTMLElement>("[data-membership-status-heading]");
  const message = root.querySelector<HTMLElement>("[data-membership-status-message]");
  const facts = root.querySelector<HTMLElement>("[data-membership-status-facts]");

  if (!panel || !loading || !body || !heading || !message) return;

  panel.hidden = false;
  panel.setAttribute("data-membership-status-state", "ready");
  loading.hidden = true;
  body.hidden = false;

  heading.textContent = membershipStatusPanelHeading(summary);
  message.textContent = summary.customerFacingMessage;

  if (facts) {
    // Future/today legacy paid-through and ambiguous/unavailable states: message is enough.
    const hideFacts =
      summary.recommendedAction === "contact_support" ||
      summary.recommendedAction === "wait" ||
      summary.currentStatus === "unknown";

    if (hideFacts) {
      facts.hidden = true;
      setFact(root, "status", null);
      setFact(root, "plan", null);
      setFact(root, "through", null);
      setFact(root, "previous", null);
    } else {
      facts.hidden = false;
      setFact(root, "status", statusLabel(summary));
      setFact(root, "plan", summary.currentPlanName);
      setFact(root, "through", summary.activeThroughDate);
      if (summary.previousPlanName && summary.legacyExpirationDate) {
        setFact(
          root,
          "previous",
          `${summary.previousPlanName} (ended ${summary.legacyExpirationDate})`,
        );
      } else if (summary.legacyExpirationDate) {
        setFact(root, "previous", `Ended ${summary.legacyExpirationDate}`);
      } else if (summary.previousPlanName) {
        setFact(root, "previous", summary.previousPlanName);
      } else {
        setFact(root, "previous", null);
      }

      // If every fact row is empty/hidden, hide the whole list (no blank labels).
      const visibleFact = facts.querySelector(
        "[data-membership-status-fact]:not([hidden])",
      );
      if (!visibleFact) {
        facts.hidden = true;
      }
    }
  }

  applyMembershipStatusCtaMode(
    membershipStatusCtaModeFromAction(summary.recommendedAction),
    root,
  );
}

function renderLoading(root: ParentNode): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  if (!panel || !loading || !body) return;
  panel.hidden = false;
  panel.setAttribute("data-membership-status-state", "loading");
  loading.hidden = false;
  body.hidden = true;
  // Block purchase until status is verified — do not rewrite hero CTA yet.
  applyMembershipStatusCtaMode("loading", root);
}

function renderUnavailable(root: ParentNode, message: string): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  const loading = root.querySelector<HTMLElement>("[data-membership-status-loading]");
  const body = root.querySelector<HTMLElement>("[data-membership-status-body]");
  const heading = root.querySelector<HTMLElement>("[data-membership-status-heading]");
  const messageEl = root.querySelector<HTMLElement>("[data-membership-status-message]");
  const facts = root.querySelector<HTMLElement>("[data-membership-status-facts]");

  if (!panel || !loading || !body || !heading || !messageEl) return;

  panel.hidden = false;
  panel.setAttribute("data-membership-status-state", "error");
  loading.hidden = true;
  body.hidden = false;
  heading.textContent = "We could not confirm your membership";
  messageEl.textContent = message;
  if (facts) facts.hidden = true;
  setFact(root, "status", null);
  setFact(root, "plan", null);
  setFact(root, "through", null);
  setFact(root, "previous", null);
  applyMembershipStatusCtaMode("wait", root);
}

export async function loadAndRenderMembershipStatusPanel(
  root: ParentNode = document,
): Promise<void> {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (!panel) return;

  // Do not encourage purchase until login + status are resolved.
  applyMembershipStatusCtaMode("loading", root);

  const loggedIn = await isMembershipStatusMemberLoggedIn();
  if (!loggedIn) {
    panel.hidden = true;
    panel.setAttribute("data-membership-status-state", "idle");
    applyMembershipStatusCtaMode("hidden", root);
    return;
  }

  renderLoading(root);

  try {
    const summary = await fetchMembershipStatus();
    renderSummary(root, summary);
  } catch (err) {
    if (err instanceof MembershipStatusAuthError) {
      panel.hidden = true;
      applyMembershipStatusCtaMode("hidden", root);
      return;
    }
    renderUnavailable(
      root,
      "We could not confirm your membership status right now. Please try again or contact us before purchasing another membership.",
    );
  }
}

export function initMembershipStatusPanel(root: ParentNode = document): void {
  const panel = root.querySelector<HTMLElement>("[data-membership-status-panel]");
  if (!panel) return;

  const retry = root.querySelector<HTMLButtonElement>("[data-membership-status-retry]");
  retry?.addEventListener("click", () => {
    void loadAndRenderMembershipStatusPanel(root);
  });

  window.addEventListener("auth:updated", () => {
    void loadAndRenderMembershipStatusPanel(root);
  });

  void loadAndRenderMembershipStatusPanel(root);
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-membership-status-panel]")) {
      initMembershipStatusPanel();
    }
  });
}
