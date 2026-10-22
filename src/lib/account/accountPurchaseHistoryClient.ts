/**
 * Browser client for GET /.netlify/functions/account-purchase-history.
 * Sends the Memberstack session JWT and never sends an email or member id.
 */
import type { AccountPurchaseHistory } from "./accountPurchaseHistory";
import { getMembershipStatusAuthHeaders } from "../membership/membershipStatusClient";

export const ACCOUNT_PURCHASE_HISTORY_API_PATH =
  "/.netlify/functions/account-purchase-history";

export type AccountPurchaseHistoryResponse = AccountPurchaseHistory & {
  ok: boolean;
  error?: string;
};

export class AccountPurchaseHistoryAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountPurchaseHistoryAuthError";
  }
}

export async function fetchAccountPurchaseHistory(): Promise<AccountPurchaseHistoryResponse> {
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) {
    throw new AccountPurchaseHistoryAuthError("Sign in required.");
  }

  const res = await fetch(ACCOUNT_PURCHASE_HISTORY_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  let body: AccountPurchaseHistoryResponse | null = null;
  try {
    body = (await res.json()) as AccountPurchaseHistoryResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new AccountPurchaseHistoryAuthError(body?.error || "Sign in required.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Purchase history is unavailable right now.");
  }

  if (!body.ok && res.status >= 400) {
    throw new Error(body.error || "Purchase history is unavailable right now.");
  }

  return body;
}
