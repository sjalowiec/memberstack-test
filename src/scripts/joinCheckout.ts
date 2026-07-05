import { MEMBERSHIPS, MEMBERSHIP_PRICE_IDS } from "../config/memberships";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "../lib/patterns/memberstackMember";

// Fallback map for "you already have this plan" detection when a member's
// active plan connection has no explicit priceId. Each current paid plan maps
// to its annual price id (a stable representative price for the plan).
const PLAN_ID_TO_PRICE_ID = new Map<string, string>([
  [MEMBERSHIPS.basic.memberstackPlanId, MEMBERSHIPS.basic.prices.annual.memberstackPriceId],
  [MEMBERSHIPS.premium.memberstackPlanId, MEMBERSHIPS.premium.prices.annual.memberstackPriceId],
]);

const JOIN_CHECKOUT_PLANS = {
  basicMonthly: { label: "Basic Monthly", priceId: MEMBERSHIP_PRICE_IDS.basicMonthly },
  basicAnnual: { label: "Basic Annual", priceId: MEMBERSHIP_PRICE_IDS.basicAnnual },
  premiumMonthly: { label: "Premium Monthly", priceId: MEMBERSHIP_PRICE_IDS.premiumMonthly },
  premiumAnnual: { label: "Premium Annual", priceId: MEMBERSHIP_PRICE_IDS.premiumAnnual },
} as const;

type JoinCheckoutPlanKey = keyof typeof JOIN_CHECKOUT_PLANS;

type MemberstackPurchaseCheckout = (opts: {
  priceId: string;
  successUrl?: string;
  cancelUrl?: string;
  autoRedirect?: boolean;
}) => Promise<{ data?: { url?: string } }>;

type MemberstackCustomerPortal = (opts?: {
  returnUrl?: string;
}) => Promise<{ data?: { url?: string } }>;

type MemberstackError = {
  code?: string;
  message?: string;
  category?: string;
};

const STATUS_ID = "join-checkout-status";

function showJoinStatus(message: string, tone: "info" | "error" | "success" = "info"): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.hidden = false;
  el.textContent = message;
  el.classList.remove("join-checkout-status--info", "join-checkout-status--error", "join-checkout-status--success");
  el.classList.add(`join-checkout-status--${tone}`);
}

function clearJoinStatus(): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
}

function memberstackErrorInfo(error: unknown): MemberstackError {
  if (error && typeof error === "object") return error as MemberstackError;
  if (typeof error === "string") return { message: error };
  return { message: "Something went wrong starting checkout." };
}

function activePriceIdsFromMemberPayload(payload: unknown): Set<string> {
  const member = memberRecordFromMemberstackPayload(payload);
  const connections = Array.isArray(member?.planConnections)
    ? (member!.planConnections as Record<string, unknown>[])
    : [];

  const ids = new Set<string>();
  for (const conn of connections) {
    const status = String(conn?.status ?? "").toUpperCase();
    if (status && status !== "ACTIVE" && status !== "TRIALING") continue;

    const priceId = conn?.priceId;
    if (typeof priceId === "string" && priceId.trim()) ids.add(priceId.trim());

    const planId = conn?.planId;
    if (typeof planId === "string" && planId.trim()) {
      const mappedPriceId = PLAN_ID_TO_PRICE_ID.get(planId.trim());
      if (mappedPriceId) ids.add(mappedPriceId);
    }
  }
  return ids;
}

async function waitForMemberstackDom() {
  for (let i = 0; i < 35; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return window.$memberstackDom;
}

async function openBillingPortal(ms: NonNullable<Window["$memberstackDom"]>): Promise<void> {
  const launchStripeCustomerPortal = (ms as Record<string, unknown>)
    .launchStripeCustomerPortal as MemberstackCustomerPortal | undefined;

  if (typeof launchStripeCustomerPortal !== "function") {
    showJoinStatus("Open your workspace to manage billing.", "info");
    return;
  }

  try {
    const portal = await launchStripeCustomerPortal.call(ms, {
      returnUrl: window.location.href,
    });
    const url = portal?.data?.url;
    if (url) {
      window.location.href = url;
      return;
    }
    showJoinStatus("Could not open billing portal. Visit your workspace instead.", "error");
  } catch (error) {
    console.error("[join checkout] billing portal error:", error);
    showJoinStatus("Could not open billing portal. Visit your workspace instead.", "error");
  }
}

function setButtonsBusy(busy: boolean): void {
  document.querySelectorAll<HTMLButtonElement>("[data-join-checkout]").forEach((btn) => {
    btn.disabled = busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  });
}

async function startJoinCheckout(planKey: JoinCheckoutPlanKey): Promise<void> {
  const plan = JOIN_CHECKOUT_PLANS[planKey];
  clearJoinStatus();
  setButtonsBusy(true);

  console.log("[join checkout] button clicked", {
    planKey,
    label: plan.label,
    priceId: plan.priceId,
  });

  try {
    const ms = await waitForMemberstackDom();
    const msAvailable = Boolean(ms?.getCurrentMember);
    const msMethods =
      ms && typeof ms === "object"
        ? Object.keys(ms).filter((key) => typeof (ms as Record<string, unknown>)[key] === "function")
        : [];

    console.log("[join checkout] Memberstack available:", msAvailable, msMethods);

    if (!ms?.getCurrentMember) {
      console.error("[join checkout] Memberstack DOM not available");
      showJoinStatus("Membership checkout is not ready yet. Please refresh and try again.", "error");
      return;
    }

    const purchasePlansWithCheckout = (ms as Record<string, unknown>)
      .purchasePlansWithCheckout as MemberstackPurchaseCheckout | undefined;

    if (typeof purchasePlansWithCheckout !== "function") {
      console.error(
        "[join checkout] purchasePlansWithCheckout is not available on $memberstackDom",
      );
      showJoinStatus("Checkout is unavailable. Please refresh and try again.", "error");
      return;
    }

    let memberPayload: unknown = null;
    try {
      memberPayload = await ms.getCurrentMember();
    } catch (error) {
      console.error("[join checkout] getCurrentMember failed:", error);
    }

    const loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));
    console.log("[join checkout] logged in:", loggedIn);

    if (!loggedIn) {
      console.log("[join checkout] opening SIGNUP modal");
      showJoinStatus("Create your account to continue to checkout...", "info");

      const signupResult = await ms.openModal?.("SIGNUP");
      console.log("[join checkout] signup modal result:", signupResult);

      const signupType = (signupResult as { type?: string } | undefined)?.type;
      if (signupType !== "SIGNUP") {
        console.log("[join checkout] signup cancelled or closed, aborting checkout");
        clearJoinStatus();
        return;
      }

      memberPayload = await ms.getCurrentMember();
      if (!memberIdFromMemberstackPayload(memberPayload)) {
        console.error("[join checkout] still not logged in after signup");
        showJoinStatus("Account created, but login did not complete. Try again or log in first.", "error");
        return;
      }
    }

    const activePriceIds = activePriceIdsFromMemberPayload(memberPayload);
    console.log("[join checkout] active price IDs:", [...activePriceIds]);

    if (activePriceIds.has(plan.priceId)) {
      const message = `You already have ${plan.label}. Manage your membership from your workspace or billing portal.`;
      console.log("[join checkout] already have this price:", plan.priceId);
      showJoinStatus(message, "info");
      return;
    }

    console.log("[join checkout] calling purchasePlansWithCheckout", {
      priceId: plan.priceId,
    });
    showJoinStatus(`Opening checkout for ${plan.label}...`, "info");

    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId: plan.priceId,
      successUrl: `${window.location.origin}/account`,
      cancelUrl: window.location.href,
      autoRedirect: false,
    });

    console.log("[join checkout] purchasePlansWithCheckout result:", checkoutResult);

    const checkoutUrl = checkoutResult?.data?.url;
    if (typeof checkoutUrl === "string" && checkoutUrl.trim()) {
      console.log("[join checkout] redirecting to Stripe checkout:", checkoutUrl);
      window.location.href = checkoutUrl;
      return;
    }

    showJoinStatus("Checkout did not return a redirect URL. Please try again.", "error");
  } catch (error) {
    const info = memberstackErrorInfo(error);
    console.error("[join checkout] Memberstack error:", error);

    if (info.code === "already-have-plan") {
      showJoinStatus(
        `You already have ${plan.label}. Manage your membership from your workspace.`,
        "info",
      );
      return;
    }

    const message =
      info.message?.trim() ||
      "Could not start checkout. Try a different plan or manage billing from your workspace.";
    showJoinStatus(message, "error");
  } finally {
    setButtonsBusy(false);
  }
}

export function initJoinCheckout(root: ParentNode = document): void {
  const billingLink = root.querySelector<HTMLAnchorElement>("[data-join-billing-portal]");
  billingLink?.addEventListener("click", (event) => {
    event.preventDefault();
    void (async () => {
      const ms = await waitForMemberstackDom();
      if (!ms) {
        showJoinStatus("Membership billing is not ready yet. Please refresh and try again.", "error");
        return;
      }
      await openBillingPortal(ms);
    })();
  });

  root.querySelectorAll<HTMLElement>("[data-join-checkout]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.getAttribute("data-join-checkout") as JoinCheckoutPlanKey | null;
      if (!key || !(key in JOIN_CHECKOUT_PLANS)) {
        console.error("[join checkout] unknown plan key:", key);
        showJoinStatus("Unknown membership option. Please refresh and try again.", "error");
        return;
      }
      void startJoinCheckout(key);
    });
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-join-checkout]")) {
      initJoinCheckout();
    }
  });
}
