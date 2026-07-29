/**
 * Browser client for GET /.netlify/functions/account-membership-detail.
 * Sends the Memberstack session JWT; never sends a member id for identity.
 */

import type { AccountMembershipDetail } from "./accountMembershipDetail";
import { getMembershipStatusAuthHeaders } from "./membershipStatusClient";

export const ACCOUNT_MEMBERSHIP_DETAIL_API_PATH =
  "/.netlify/functions/account-membership-detail";

export type AccountMembershipDetailResponse = AccountMembershipDetail & {
  ok: boolean;
  error?: string;
};

export class AccountMembershipDetailAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountMembershipDetailAuthError";
  }
}

export async function fetchAccountMembershipDetail(): Promise<AccountMembershipDetailResponse> {
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) {
    throw new AccountMembershipDetailAuthError("Sign in required.");
  }

  const res = await fetch(ACCOUNT_MEMBERSHIP_DETAIL_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  let body: AccountMembershipDetailResponse | null = null;
  try {
    body = (await res.json()) as AccountMembershipDetailResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new AccountMembershipDetailAuthError(body?.error || "Sign in required.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Membership details are unavailable right now.");
  }

  if (!body.ok && res.status >= 400) {
    throw new Error(body.error || "Membership details are unavailable right now.");
  }

  return body;
}
