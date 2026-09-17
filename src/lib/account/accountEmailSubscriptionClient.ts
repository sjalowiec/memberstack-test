/**
 * Browser client for Account-page email-list status and explicit resubscribe.
 * Sends the Memberstack session JWT; never sends an email address for identity.
 */

import { getMembershipStatusAuthHeaders } from "../membership/membershipStatusClient";
import type { AccountEmailSubscriptionState } from "./accountEmailSubscriptionShared";

export const ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH =
  "/.netlify/functions/account-email-subscription";

export type AccountEmailSubscriptionStatusResponse = {
  ok: boolean;
  state: AccountEmailSubscriptionState;
  canResubscribe?: boolean;
  error?: string;
};

export type AccountEmailSubscriptionResubscribeResponse =
  | { ok: true; state: "active"; message: string }
  | { ok: false; error: string; state?: AccountEmailSubscriptionState };

export class AccountEmailSubscriptionAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountEmailSubscriptionAuthError";
  }
}

async function parseJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAccountEmailSubscriptionStatus(): Promise<AccountEmailSubscriptionStatusResponse> {
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) {
    throw new AccountEmailSubscriptionAuthError("Sign in required.");
  }

  const res = await fetch(ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  const body = await parseJson<AccountEmailSubscriptionStatusResponse>(res);

  if (res.status === 401) {
    throw new AccountEmailSubscriptionAuthError(body?.error || "Sign in required.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Email updates are unavailable right now.");
  }

  return body;
}

/**
 * Explicit-consent resubscribe. Body must not include an email address;
 * the server derives identity from the verified session.
 */
export async function resubscribeAccountEmailUpdates(): Promise<AccountEmailSubscriptionResubscribeResponse> {
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) {
    throw new AccountEmailSubscriptionAuthError("Sign in required.");
  }

  const res = await fetch(ACCOUNT_EMAIL_SUBSCRIPTION_API_PATH, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({}),
  });

  const body = await parseJson<AccountEmailSubscriptionResubscribeResponse>(res);

  if (res.status === 401) {
    throw new AccountEmailSubscriptionAuthError(body && "error" in body ? body.error : "Sign in required.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Email updates are unavailable right now.");
  }

  return body;
}
