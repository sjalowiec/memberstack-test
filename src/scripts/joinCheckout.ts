import { canPurchaseAnnualWhileCancelingMonthly } from "../lib/membership/cancelingMonthlyAnnualCheckout";
import {
  memberHasActivePaidMembership,
  resolveMembershipCheckoutDecision,
} from "../lib/membership/membershipCheckoutDecision";
import { resolveJoinCtaPresentation } from "../lib/membership/membershipPricingUi";
import { resolveMembershipSalesCta } from "../lib/membership/membershipSalesCta";
import {
  getMembershipStatusCtaMode,
  membershipStatusModeOwnsHeroCta,
  shouldBlockPurchaseForStatusMode,
} from "../lib/membership/membershipStatusCta";
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
/** Account panel status fallback when #join-checkout-status is absent. */
const ACCOUNT_ACTION_STATUS_SELECTOR =
  "[data-kbm-account-membership-action-status]";

/** Prevents double-click / overlapping checkout sessions. */
let checkoutInFlight = false;
let resumeListenerBound = false;
let lastKnownMemberPayload: unknown = null;

type MembershipAuthModalOutcome =
  | { status: "authenticated"; memberPayload: unknown }
  | { status: "dismissed" }
  | { status: "failed-to-open" };

function resolveJoinStatusElement(): HTMLElement | null {
  const byId = document.getElementById(STATUS_ID);
  if (byId) return byId;
  return document.querySelector<HTMLElement>(ACCOUNT_ACTION_STATUS_SELECTOR);
}

function setJoinStatusTone(el: HTMLElement, tone: "info" | "error" | "success"): void {
  el.classList.remove(
    "join-checkout-status--info",
    "join-checkout-status--error",
    "join-checkout-status--success",
  );
  el.classList.add(`join-checkout-status--${tone}`);
}

function showJoinStatus(message: string, tone: "info" | "error" | "success" = "info"): void {
  const el = resolveJoinStatusElement();
  if (!el) return;
  el.hidden = false;
  if (typeof el.replaceChildren === "function") {
    el.replaceChildren();
  }
  el.textContent = message;
  setJoinStatusTone(el, tone);
}

function clearJoinStatus(): void {
  const el = resolveJoinStatusElement();
  if (!el) return;
  el.hidden = true;
  if (typeof el.replaceChildren === "function") {
    el.replaceChildren();
  } else {
    el.textContent = "";
  }
}

/**
 * Prefer getAppAndMember (includes planConnections / payment.cancelAtDate reliably),
 * then fall back to getCurrentMember — same preference as the Account membership panel.
 */
async function readMemberPayloadForCheckout(
  ms: NonNullable<Window["$memberstackDom"]>,
): Promise<unknown> {
  const api = ms.getAppAndMember ?? ms.getCurrentMember;
  if (typeof api !== "function") return null;
  try {
    return await api.call(ms);
  } catch {
    if (api === ms.getCurrentMember || typeof ms.getCurrentMember !== "function") {
      return null;
    }
    try {
      return await ms.getCurrentMember();
    } catch {
      return null;
    }
  }
}

async function readCurrentMemberPayload(
  ms: NonNullable<Window["$memberstackDom"]>,
): Promise<unknown> {
  return readMemberPayloadForCheckout(ms);
}

/**
 * Fallback only when the Memberstack modal genuinely fails to open (e.g. localhost ORB).
 * Inline Signup / Login — never send visitors to the nav Sign Up link.
 */
function showAuthModalFailedFallback(
  ms: NonNullable<Window["$memberstackDom"]>,
  planKey: JoinCheckoutPlanKey,
): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;

  el.hidden = false;
  el.replaceChildren();
  setJoinStatusTone(el, "error");

  const message = document.createElement("p");
  message.className = "join-checkout-status__message";
  message.textContent = "Could not open the signup window. Continue here:";

  const actions = document.createElement("div");
  actions.className = "join-checkout-status__actions";

  const signupBtn = document.createElement("button");
  signupBtn.type = "button";
  signupBtn.className = "kbm-btn kbm-btn-accent";
  signupBtn.textContent = "Sign Up";
  signupBtn.addEventListener("click", () => {
    clearJoinStatus();
    void startJoinCheckout(planKey);
  });

  const loginBtn = document.createElement("button");
  loginBtn.type = "button";
  loginBtn.className = "kbm-btn kbm-btn-outline";
  loginBtn.textContent = "Log In";
  loginBtn.addEventListener("click", () => {
    clearJoinStatus();
    void (async () => {
      if (typeof ms.openModal !== "function") {
        showAuthModalFailedFallback(ms, planKey);
        return;
      }
      try {
        await ms.openModal("LOGIN");
      } catch (error) {
        console.error("[join checkout] LOGIN fallback failed to open:", error);
        showAuthModalFailedFallback(ms, planKey);
        return;
      }
      const memberPayload = await readCurrentMemberPayload(ms);
      if (!memberIdFromMemberstackPayload(memberPayload)) {
        clearJoinStatus();
        return;
      }
      try {
        notifyMemberstackLoginSuccess();
      } catch {
        /* ignore */
      }
      await resumePendingMembershipCheckout();
    })();
  });

  actions.append(signupBtn, loginBtn);
  el.append(message, actions);
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
    const key = btn.getAttribute("data-join-checkout");
    if (!isJoinCheckoutPlanKey(key)) {
      btn.disabled = busy;
      return;
    }
    const presentation = resolveJoinCtaPresentation(lastKnownMemberPayload, key);
    if (presentation.disabled) {
      btn.disabled = true;
      return;
    }
    btn.disabled = busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  });
}

function applyActiveMembershipConfirmation(memberOrPayload: unknown): void {
  const isActiveMember = memberHasActivePaidMembership(memberOrPayload);
  document
    .querySelectorAll<HTMLElement>("[data-membership-active-confirmation]")
    .forEach((el) => {
      el.hidden = !isActiveMember;
    });
}

/**
 * Sync the hero sales CTA (scroll to pricing vs manage) — never opens auth.
 * No-op when the authenticated status overlay owns the hero (loading / wait /
 * contact_support / renew_now / manage) so DOM active-member detection cannot contradict it.
 */
export function applyMembershipSalesCtaState(memberOrPayload: unknown): void {
  if (membershipStatusModeOwnsHeroCta()) return;
  const cta = resolveMembershipSalesCta(memberOrPayload);
  document.querySelectorAll<HTMLAnchorElement>("[data-membership-sales-cta]").forEach((el) => {
    el.textContent = cta.label;
    el.setAttribute("href", cta.href);
    el.setAttribute("data-membership-sales-cta-kind", cta.kind);
    el.setAttribute("aria-disabled", "false");
    el.classList.remove("contact-modal-trigger");
    el.removeAttribute("data-contact-source");
  });
}

/** Sync Join CTA labels/disabled state from the current member (no flash messages). */
export function applyJoinCheckoutButtonStates(memberOrPayload: unknown): void {
  lastKnownMemberPayload = memberOrPayload;
  const statusBlocksPurchase = shouldBlockPurchaseForStatusMode();
  const statusOwnsHero = membershipStatusModeOwnsHeroCta();
  document.querySelectorAll<HTMLButtonElement>("[data-join-checkout]").forEach((btn) => {
    const key = btn.getAttribute("data-join-checkout");
    if (!isJoinCheckoutPlanKey(key)) return;
    const presentation = resolveJoinCtaPresentation(memberOrPayload, key);
    btn.textContent = presentation.label;
    const disabled = presentation.disabled || statusBlocksPurchase;
    btn.disabled = disabled;
    btn.setAttribute("aria-disabled", disabled ? "true" : "false");
    btn.setAttribute("data-join-cta-state", presentation.kind);
    if (statusBlocksPurchase) {
      btn.setAttribute("data-membership-status-blocked", "true");
    }
    if (!disabled) {
      btn.setAttribute("aria-busy", "false");
    }
  });
  // Do not show DOM "active" confirmation while status overlay is still loading/wait/contact.
  if (!statusOwnsHero || getMembershipStatusCtaMode() === "manage") {
    applyActiveMembershipConfirmation(memberOrPayload);
  } else {
    document
      .querySelectorAll<HTMLElement>("[data-membership-active-confirmation]")
      .forEach((el) => {
        el.hidden = true;
      });
  }
  applyMembershipSalesCtaState(memberOrPayload);
}

async function syncJoinCheckoutButtonStatesFromMemberstack(
  ms?: NonNullable<Window["$memberstackDom"]> | null,
): Promise<void> {
  const dom = ms ?? (await waitForMemberstackDom());
  if (!dom?.getCurrentMember && !dom?.getAppAndMember) {
    applyJoinCheckoutButtonStates(null);
    return;
  }
  try {
    const payload = await readMemberPayloadForCheckout(dom!);
    applyJoinCheckoutButtonStates(payload);
  } catch {
    applyJoinCheckoutButtonStates(null);
  }
}

function currentReturnUrl(): string {
  return typeof window !== "undefined" ? window.location.href : "/membership";
}

/**
 * After a plan is chosen, open Memberstack SIGNUP (login available in-modal).
 *
 * Important Memberstack behavior: calling `hideModal()` (including from the
 * site-wide `member.login` → `notifyMemberstackLoginSuccess` handler) resolves
 * the openModal promise with `{ type: "CLOSED" }`. That must not be treated as
 * auth failure when the member is already logged in.
 */
async function openMembershipAuthModal(
  ms: NonNullable<Window["$memberstackDom"]>,
): Promise<MembershipAuthModalOutcome> {
  if (typeof ms.openModal !== "function") {
    return { status: "failed-to-open" };
  }

  try {
    const result = await ms.openModal("SIGNUP");
    const resultType = (result as { type?: string } | undefined)?.type;
    const memberPayload = await readCurrentMemberPayload(ms);
    const loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));

    if (loggedIn) {
      try {
        notifyMemberstackLoginSuccess();
      } catch {
        /* hideModal / auth event may be unavailable in some environments */
      }
      return { status: "authenticated", memberPayload };
    }

    // User dismissed, or hideModal closed the modal before auth completed.
    if (resultType === "CLOSED" || resultType === undefined) {
      return { status: "dismissed" };
    }

    // Typed SIGNUP/LOGIN without a member session — treat as incomplete, not open failure.
    if (resultType === "SIGNUP" || resultType === "LOGIN") {
      return { status: "dismissed" };
    }

    return { status: "dismissed" };
  } catch (error) {
    // Common on http://localhost when the prebuilt modal CDN script is ORB-blocked.
    console.error("[join checkout] SIGNUP modal failed to open:", error);
    return { status: "failed-to-open" };
  }
}

async function launchPurchaseCheckout(
  ms: NonNullable<Window["$memberstackDom"]>,
  planKey: JoinCheckoutPlanKey,
  cancelUrl: string,
  memberPayload: unknown,
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

  const allowAnnualWhileCancelingMonthly =
    planKey === "annual" && canPurchaseAnnualWhileCancelingMonthly(memberPayload);

  console.log("[join checkout] calling purchasePlansWithCheckout", {
    planKey,
    priceId: plan.priceId,
    allowAnnualWhileCancelingMonthly,
  });
  showJoinStatus(`Opening checkout for ${plan.label}...`, "info");

  try {
    const checkoutResult = await purchasePlansWithCheckout.call(ms, {
      priceId: plan.priceId,
      successUrl: `${window.location.origin}/signup/thank-you`,
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
      // Canceling-monthly → annual is an explicit allowed purchase of a different
      // price. Do NOT fall through to the Stripe portal (that was the production bug).
      if (allowAnnualWhileCancelingMonthly) {
        console.warn(
          "[join checkout] already-have-plan during allowed canceling-monthly annual switch; not opening portal",
        );
        showJoinStatus(
          "Could not start annual checkout while your monthly membership is still active. Please try again, or contact support if this continues.",
          "error",
        );
        return false;
      }
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
  /**
   * Account "Switch to Annual" path. Still requires
   * canPurchaseAnnualWhileCancelingMonthly; never opens the billing portal as a
   * substitute for checkout.
   */
  checkoutIntent?: "switchToAnnual";
};

/**
 * Start (or resume) membership checkout for one plan button (monthly / annual).
 * Logged-out visitors authenticate via SIGNUP (with login available in-modal)
 * after choosing a plan; pending intent resumes if auth completes elsewhere.
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

  const switchToAnnualIntent = options.checkoutIntent === "switchToAnnual";

  console.log("[join checkout] button clicked", {
    planKey,
    label: plan.label,
    priceId: plan.priceId,
    fromResume: Boolean(options.fromResume),
    checkoutIntent: options.checkoutIntent ?? null,
  });

  try {
    const ms = await waitForMemberstackDom();
    if (!ms?.getCurrentMember && !ms?.getAppAndMember) {
      console.error("[join checkout] Memberstack DOM not available");
      showJoinStatus("Membership checkout is not ready yet. Please refresh and try again.", "error");
      return;
    }

    let memberPayload: unknown = null;
    try {
      memberPayload = await readMemberPayloadForCheckout(ms);
    } catch (error) {
      console.error("[join checkout] member payload read failed:", error);
    }

    let loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));
    console.log("[join checkout] logged in:", loggedIn);

    if (!loggedIn) {
      if (switchToAnnualIntent) {
        // Switch-to-annual is only for an authenticated canceling monthly member.
        clearPendingMembershipCheckout();
        showJoinStatus("Please log in to switch to annual membership.", "error");
        return;
      }
      if (options.fromResume) {
        console.log("[join checkout] resume aborted — still logged out");
        clearJoinStatus();
        return;
      }

      // Persist intent before auth so header login / auth:updated can also resume.
      savePendingMembershipCheckout(buildPendingMembershipCheckout(planKey, returnUrl));
      console.log("[join checkout] opening SIGNUP modal (login available in-modal)");

      const authOutcome = await openMembershipAuthModal(ms);
      if (authOutcome.status === "failed-to-open") {
        console.log("[join checkout] auth modal failed to open — showing inline fallback");
        showAuthModalFailedFallback(ms, planKey);
        return;
      }
      if (authOutcome.status === "dismissed") {
        // Keep pending intent; do not strand the visitor with a "Checkout paused" banner.
        console.log("[join checkout] auth dismissed, keeping pending intent silently");
        clearJoinStatus();
        return;
      }

      memberPayload = authOutcome.memberPayload;
      loggedIn = Boolean(memberIdFromMemberstackPayload(memberPayload));
      if (!loggedIn) {
        console.error("[join checkout] authenticated outcome but member session missing");
        clearJoinStatus();
        return;
      }
    }

    const memberId = memberIdFromMemberstackPayload(memberPayload);
    console.log("[join checkout] authenticated member:", memberId);
    applyJoinCheckoutButtonStates(memberPayload);

    // Explicit Account switch path: only when canceling-monthly eligibility holds.
    if (switchToAnnualIntent) {
      if (planKey !== "annual" || !canPurchaseAnnualWhileCancelingMonthly(memberPayload)) {
        clearPendingMembershipCheckout();
        console.log(
          "[join checkout] switchToAnnual rejected — not eligible for canceling-monthly annual purchase",
        );
        showJoinStatus(
          "Annual checkout is only available while a monthly membership is canceling.",
          "info",
        );
        return;
      }
    }

    const decision = resolveMembershipCheckoutDecision(memberPayload, planKey);

    if (decision.action === "current") {
      clearPendingMembershipCheckout();
      console.log("[join checkout] current plan — no checkout or redirect");
      // Never open the billing portal here. Manage Billing is a separate control.
      if (switchToAnnualIntent) {
        showJoinStatus(
          "Annual checkout is only available while a monthly membership is canceling.",
          "info",
        );
      }
      return;
    }

    // Status panel overlay (ambiguous / unavailable / manage) must not be bypassed
    // for normal Join CTAs. The explicit Account switchToAnnual path is allowed when
    // canPurchaseAnnualWhileCancelingMonthly already passed above.
    if (!switchToAnnualIntent && shouldBlockPurchaseForStatusMode()) {
      clearPendingMembershipCheckout();
      console.log("[join checkout] blocked by membership status recommendation");
      showJoinStatus(
        "Please review your membership status above before purchasing.",
        "info",
      );
      return;
    }

    // decision.action === "purchase"
    const cancelUrl =
      peekPendingMembershipCheckout()?.returnUrl ||
      returnUrl ||
      currentReturnUrl();

    await launchPurchaseCheckout(ms, planKey, cancelUrl, memberPayload);
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
  if (!ms?.getCurrentMember && !ms?.getAppAndMember) return false;

  let memberPayload: unknown = null;
  try {
    memberPayload = await readMemberPayloadForCheckout(ms);
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
    void syncJoinCheckoutButtonStatesFromMemberstack();
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
      if (btn instanceof HTMLButtonElement && btn.disabled) {
        return;
      }
      void startJoinCheckout(key);
    });
  });

  void (async () => {
    const ms = await waitForMemberstackDom();
    // Warm the prebuilt modal UI so the first SIGNUP open is not delayed.
    const preload = (ms as { preloadModals?: () => Promise<unknown> } | null | undefined)
      ?.preloadModals;
    if (typeof preload === "function") {
      try {
        void preload.call(ms);
      } catch {
        /* optional */
      }
    }
    await syncJoinCheckoutButtonStatesFromMemberstack(ms);
    // If the visitor logged in elsewhere and returned with a pending intent, resume.
    await resumePendingMembershipCheckout();
  })();
}

/** Test-only: reset module locks between cases. */
export function __resetJoinCheckoutForTests(): void {
  checkoutInFlight = false;
  resumeListenerBound = false;
  lastKnownMemberPayload = null;
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-join-checkout]")) {
      initJoinCheckout();
    }
  });
}
