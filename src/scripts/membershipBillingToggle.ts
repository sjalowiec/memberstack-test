const BILLING_SCOPE_SELECTOR = ".membership-billing-scope";
const BILLING_PERIOD_NAME = "membership-billing-period";

function syncBillingPeriod(scope: HTMLElement): void {
  const annual = scope.querySelector<HTMLInputElement>(
    'input[name="membership-billing-period"][value="annual"]',
  );
  scope.dataset.billingPeriod = annual?.checked ? "annual" : "monthly";
}

function selectAnnualBilling(root: ParentNode): void {
  const annual = root.querySelector<HTMLInputElement>(
    `input[name="${BILLING_PERIOD_NAME}"][value="annual"]`,
  );
  if (!annual) return;
  annual.checked = true;
  annual.dispatchEvent(new Event("change", { bubbles: true }));
}

export function initMembershipBillingToggle(root: ParentNode = document): void {
  const scopes = root.querySelectorAll<HTMLElement>(BILLING_SCOPE_SELECTOR);
  if (!scopes.length) return;

  const syncAll = () => {
    scopes.forEach(syncBillingPeriod);
  };

  root
    .querySelectorAll<HTMLInputElement>(`input[name="${BILLING_PERIOD_NAME}"]`)
    .forEach((radio) => {
      radio.addEventListener("change", syncAll);
    });

  root.querySelectorAll<HTMLButtonElement>("[data-membership-view-annual]").forEach((button) => {
    button.addEventListener("click", () => {
      selectAnnualBilling(root);
      const pricing = button.closest(".membership-pricing");
      const toggle = pricing?.querySelector<HTMLElement>("[data-membership-billing-toggle]");
      toggle?.focus({ preventScroll: true });
    });
  });

  syncAll();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(BILLING_SCOPE_SELECTOR)) {
      initMembershipBillingToggle();
    }
  });
}
