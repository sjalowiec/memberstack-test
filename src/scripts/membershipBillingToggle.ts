const BILLING_SCOPE_SELECTOR = ".membership-billing-scope";
const BILLING_PERIOD_NAME = "membership-billing-period";

function syncBillingPeriod(scope: HTMLElement): void {
  const annual = scope.querySelector<HTMLInputElement>(
    'input[name="membership-billing-period"][value="annual"]',
  );
  scope.dataset.billingPeriod = annual?.checked ? "annual" : "monthly";
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

  syncAll();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector(BILLING_SCOPE_SELECTOR)) {
      initMembershipBillingToggle();
    }
  });
}
