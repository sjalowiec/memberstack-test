import {
  resolveMembershipCheckoutDecision,
} from "../lib/membership/membershipCheckoutDecision";
import {
  buildPendingMembershipCheckout,
  clearPendingMembershipCheckout,
  isJoinCheckoutPlanKey,
  joinCheckoutPlanMeta,
  peekPendingMembershipCheckout,
  savePendingMembershipCheckout,
  type JoinCheckoutPlanKey,
} from "../lib/membership/pendingMembershipCheckout";
import { notifyMemberstackLoginSuccess } from "../lib/memberstackPostLogin";
import {
  memberIdFromMemberstackPayload,
} from "../lib/patterns/memberstackMember";

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

const LOGIN_FIRST_MESSAGE =
  "Log in with your existing Knit It Now account to continue checkout. Returning and canceled members must use the account they already have — do not create a new one. New here? Use Sign Up in the menu to create a free account, then return to join.";

/** Prevents double-click / overlapping checkout sessions. */
let checkoutInFlight = false;
let resumeListenerBound = false;

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

function currentReturnUrl(): string {
  return typeof window !== "undefined" ? window.location.href : "/membership";
}

async function openMembershipLoginModal(
  ms: NonNullable<Window["$memberstackDom"]>,
): Promise<boolean> {
  if (typeof ms.openModal !== "function") return false;

  showJoinStatus(LOGIN_FIRST_MESSAGE, "info");

  try {
    const result = await ms.openModal("LOGIN");
    // Prefer the resolved modal result; also treat a logged-in member as success
    // in case Memberstack resolves without a typed payload.
    const resultType = (result as { type?: string } | undefined)?.type;
    if (resultType && resultType !== "LOGIN") {
      return false;
    }
    try {
      notifyMemberstackLoginSuccess();
    } catch {
      /* hideModal / auth event may be unavailable in some environments */
    }
    return true;
  } catch {
    return false;
  }
}

async function launchPurchaseCheckout(
  ms: NonNullable<Window["$memberstackDom"]>,
  planKey: JoinCheckoutPlanKey,
  cancelUrl: string,
): Promise<boolean> {
  const plan = joinCheckoutPlanMeta(planKey);
  const purchasePlansWithCheckout = (ms as Record<string, unknown>)
    .purchasePlansWithCheckout as MemberstackPurchaseCheckout | undefined;

  if (typeof purchasePlansWithCheckout !== "function") {
    console.error(
      "[join checkout] purchasePlansWithCheckout is not available on $memberstackDom",
    );
    showJoinStatus("Checkout is unavailable. Please refresh and try again.", "error");
    return false;
  }

  console.log("[join checkout] calling purchasePlansWithCheckout", {
    planKey,
    priceId: plan.priceId,
  });
  showJoinStatus(`Opening checkout for ${plan.label}...`, "info");

  try {
    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId: plan.priceId,
      successUrl: `${window.location.origin}/account`,
      cancelUrl,
      autoRedirect: false,
    });

    console.log("[join checkout] purchasePlansWithCheckout result:", checkoutResult);

    const checkoutUrl = checkoutResult?.data?.url;
    if (typeof checkoutUrl === "string" && checkoutUrl.trim()) {
      clearPendingMembershipCheckout();
      console.log("[join checkout] redirecting to Stripe checkout:", checkoutUrl);
      window.location.href = checkoutUrl;
      return true;
    }

    showJoinStatus("Checkout did not return a redirect URL. Please try again.", "error");
    return false;
  } catch (error) {
    const info = memberstackErrorInfo(error);
    console.error("[join checkout] Memberstack error:", error);

    if (info.code === "already-have-plan") {
      clearPendingMembershipCheckout();
      showJoinStatus(
        `You already have ${plan.label}. Manage your membership from your workspace.`,
        "info",
      );
      await openBillingPortal(ms);
      return false;
    }

    const message =
      info.message?.trim() ||
      "Could not start checkout. Try a different plan or manage billing from your workspace.";
    showJoinStatus(message, "error");
    return false;
  }
}

export type StartJoinCheckoutOptions = {
  /** When true, do not open login again; pending intent is being resumed. */
  fromResume?: boolean;
  /** Override cancel/return URL (defaults to current location or pending returnUrl). */
  returnUrl?: string;
};

/**
 * Start (or resume) membership checkout for one Join plan button.
 * Logged-out visitors are sent to LOGIN (never SIGNUP) with a pending intent.
 */
export async function startJoinCheckout(
  planKey: JoinCheckoutPlanKey,
  options: StartJoinCheckoutOptions = {},
): Promise<void> {
  if (checkoutInFlight) {
    console.log("[join checkout] ignored — checkout already in flight");
    return;
  }

  checkoutInFlight = true;
  clearJoinStatus();
  setButtonsBusy(true);

  const plan = joinCheckoutPlanMeta(planKey);
  const returnUrl = options.returnUrl?.trim() || currentReturnUrl();

  console.log("[join checkout] button clicked", {
    planKey,
    label: plan.label,
    priceId: plan.priceId,
    fromResume: Boolean(options.fromResume),
  });

  try {
    const ms = await waitForMemberstackDom();
    if (!ms?.getCurrentMember) {
      console.error("[join checkout] Memberstack DOM not available");
      showJoinStatus("Membership checkout is not ready yet. Please refresh and try again.", "error");
      return;
    }

    let memberPayload: unknown = null;
    try {
      memberPayload = await ms.getCurrentMember();
    } catch (error) {
      console.error("[join checkout] getCurrentMember failed:", error);
    }

    let loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));
    console.log("[join checkout] logged in:", loggedIn);

    if (!loggedIn) {
      if (options.fromResume) {
        console.log("[join checkout] resume aborted — still logged out");
        showJoinStatus(LOGIN_FIRST_MESSAGE, "info");
        return;
      }

      // Persist intent before login so header login / auth:updated can also resume.
      savePendingMembershipCheckout(buildPendingMembershipCheckout(planKey, returnUrl));
      console.log("[join checkout] opening LOGIN modal (not signup)");

      const loginOk = await openMembershipLoginModal(ms);
      if (!loginOk) {
        console.log("[join checkout] login cancelled or closed, keeping pending intent");
        showJoinStatus(
          "Checkout paused. Log in with your existing account to continue, or use Sign Up in the menu only if you are new.",
          "info",
        );
        return;
      }

      try {
        memberPayload = await ms.getCurrentMember();
      } catch (error) {
        console.error("[join checkout] getCurrentMember after login failed:", error);
      }

      loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));
      if (!loggedIn) {
        console.error("[join checkout] still not logged in after LOGIN modal");
        showJoinStatus(
          "Login did not complete. Please log in with your existing account, then try Join again.",
          "error",
        );
        return;
      }
    }

    const memberId = memberIdFromMemberstackPayload(memberPayload);
    console.log("[join checkout] authenticated member:", memberId);

    const decision = resolveMembershipCheckoutDecision(memberPayload, planKey);
    if (decision.action === "manage") {
      clearPendingMembershipCheckout();
      console.log("[join checkout] blocked — manage billing:", decision.reason);
      showJoinStatus(decision.message, "info");
      await openBillingPortal(ms);
      return;
    }

    const cancelUrl =
      peekPendingMembershipCheckout()?.returnUrl ||
      returnUrl ||
      currentReturnUrl();

    await launchPurchaseCheckout(ms, planKey, cancelUrl);
  } finally {
    checkoutInFlight = false;
    setButtonsBusy(false);
  }
}

/** Resume a stashed membership checkout after login (auth:updated or page load). */
export async function resumePendingMembershipCheckout(): Promise<boolean> {
  const pending = peekPendingMembershipCheckout();
  if (!pending) return false;
  if (checkoutInFlight) return false;

  const ms = await waitForMemberstackDom();
  if (!ms?.getCurrentMember) return false;

  let memberPayload: unknown = null;
  try {
    memberPayload = await ms.getCurrentMember();
  } catch {
    return false;
  }

  if (!memberIdFromMemberstackPayload(memberPayload)) {
    return false;
  }

  console.log("[join checkout] resuming pending checkout", pending.planKey);
  await startJoinCheckout(pending.planKey, {
    fromResume: true,
    returnUrl: pending.returnUrl,
  });
  return true;
}

function bindPendingCheckoutResumeListener(): void {
  if (resumeListenerBound || typeof window === "undefined") return;
  resumeListenerBound = true;
  window.addEventListener("auth:updated", () => {
    void resumePendingMembershipCheckout();
  });
}

export function initJoinCheckout(root: ParentNode = document): void {
  bindPendingCheckoutResumeListener();

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
      const key = btn.getAttribute("data-join-checkout");
      if (!isJoinCheckoutPlanKey(key)) {
        console.error("[join checkout] unknown plan key:", key);
        showJoinStatus("Unknown membership option. Please refresh and try again.", "error");
        return;
      }
      void startJoinCheckout(key);
    });
  });

  // If the visitor logged in elsewhere and returned with a pending intent, resume.
  void resumePendingMembershipCheckout();
}

/** Test-only: reset module locks between cases. */
export function __resetJoinCheckoutForTests(): void {
  checkoutInFlight = false;
  resumeListenerBound = false;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-join-checkout]")) {
      initJoinCheckout();
    }
  });
}
