/**
 * Pending membership checkout intent (sessionStorage).
 *
 * Used when a logged-out visitor chooses monthly/annual: we stash the plan they
 * requested, open Memberstack signup/login, then resume the exact checkout after
 * authentication (including when auth completes via the header).
 */

import { MEMBERSHIP_PRICE_IDS } from "../../config/memberships";

export const PENDING_MEMBERSHIP_CHECKOUT_KEY = "kbm:pending-membership-checkout";

/** Pending intents older than this are ignored. */
export const PENDING_MEMBERSHIP_CHECKOUT_TTL_MS = 30 * 60 * 1000;

export const JOIN_CHECKOUT_PLAN_KEYS = ["monthly", "annual"] as const;

export type JoinCheckoutPlanKey = (typeof JOIN_CHECKOUT_PLAN_KEYS)[number];

export type PendingMembershipCheckout = {
  version: 1;
  planKey: JoinCheckoutPlanKey;
  priceId: string;
  label: string;
  /** Page URL to use as Stripe cancelUrl / resume context. */
  returnUrl: string;
  createdAt: number;
};

const PLAN_META: Record<JoinCheckoutPlanKey, { label: string; priceId: string }> = {
  monthly: { label: "Membership Monthly", priceId: MEMBERSHIP_PRICE_IDS.monthly },
  annual: { label: "Membership Annual", priceId: MEMBERSHIP_PRICE_IDS.annual },
};

export function isJoinCheckoutPlanKey(value: unknown): value is JoinCheckoutPlanKey {
  return (
    typeof value === "string" &&
    (JOIN_CHECKOUT_PLAN_KEYS as readonly string[]).includes(value)
  );
}

export function joinCheckoutPlanMeta(planKey: JoinCheckoutPlanKey): {
  label: string;
  priceId: string;
} {
  return PLAN_META[planKey];
}

function storageAvailable(): boolean {
  return typeof sessionStorage !== "undefined";
}

export function buildPendingMembershipCheckout(
  planKey: JoinCheckoutPlanKey,
  returnUrl: string,
  now = Date.now(),
): PendingMembershipCheckout {
  const meta = PLAN_META[planKey];
  return {
    version: 1,
    planKey,
    priceId: meta.priceId,
    label: meta.label,
    returnUrl,
    createdAt: now,
  };
}

export function savePendingMembershipCheckout(intent: PendingMembershipCheckout): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.setItem(PENDING_MEMBERSHIP_CHECKOUT_KEY, JSON.stringify(intent));
  } catch {
    /* private mode / quota */
  }
}

export function clearPendingMembershipCheckout(): void {
  if (!storageAvailable()) return;
  try {
    sessionStorage.removeItem(PENDING_MEMBERSHIP_CHECKOUT_KEY);
  } catch {
    /* ignore */
  }
}

export function peekPendingMembershipCheckout(
  now = Date.now(),
): PendingMembershipCheckout | null {
  if (!storageAvailable()) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_MEMBERSHIP_CHECKOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingMembershipCheckout>;
    if (parsed?.version !== 1 || !isJoinCheckoutPlanKey(parsed.planKey)) {
      clearPendingMembershipCheckout();
      return null;
    }
    const createdAt = typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    if (!createdAt || now - createdAt > PENDING_MEMBERSHIP_CHECKOUT_TTL_MS) {
      clearPendingMembershipCheckout();
      return null;
    }
    const meta = PLAN_META[parsed.planKey];
    const returnUrl =
      typeof parsed.returnUrl === "string" && parsed.returnUrl.trim()
        ? parsed.returnUrl.trim()
        : "";
    if (!returnUrl) {
      clearPendingMembershipCheckout();
      return null;
    }
    return {
      version: 1,
      planKey: parsed.planKey,
      priceId: meta.priceId,
      label: meta.label,
      returnUrl,
      createdAt,
    };
  } catch {
    clearPendingMembershipCheckout();
    return null;
  }
}

/** Read and remove a still-valid pending intent. */
export function consumePendingMembershipCheckout(
  now = Date.now(),
): PendingMembershipCheckout | null {
  const pending = peekPendingMembershipCheckout(now);
  if (pending) clearPendingMembershipCheckout();
  return pending;
}
