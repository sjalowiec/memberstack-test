/**
 * Browser client for GET /.netlify/functions/membership-status.
 * Sends the Memberstack session JWT; never sends a member id for identity.
 */

import { memberIdFromMemberstackPayload } from "../patterns/memberstackMember";
import type { MembershipStatusSummary } from "./membershipStatusSummary";

export const MEMBERSHIP_STATUS_API_PATH = "/.netlify/functions/membership-status";

export type MembershipStatusResponse = MembershipStatusSummary & {
  ok: boolean;
  error?: string;
};

async function waitForMemberstackDom(maxAttempts = 35, intervalMs = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const ms = window.$memberstackDom;
    if (ms?.getCurrentMember) {
      if (ms.onReady) await ms.onReady;
      return ms;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return window.$memberstackDom;
}

/**
 * Authorization header from Memberstack session cookie, or {} when logged out.
 * Retries briefly: getCurrentMember can be ready before getMemberCookie returns a JWT.
 */
export async function getMembershipStatusAuthHeaders(
  options: { attempts?: number; intervalMs?: number } = {},
): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const attempts = options.attempts ?? 6;
  const intervalMs = options.intervalMs ?? 150;
  try {
    const ms = await waitForMemberstackDom();
    for (let i = 0; i < attempts; i++) {
      const token = await ms?.getMemberCookie?.();
      if (typeof token === "string" && token.trim()) {
        return { Authorization: `Bearer ${token.trim()}` };
      }
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }
  } catch {
    /* unauthenticated */
  }
  return {};
}

export async function isMembershipStatusMemberLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const ms = await waitForMemberstackDom();
    const res = await ms?.getCurrentMember?.();
    return Boolean(memberIdFromMemberstackPayload(res));
  } catch {
    return false;
  }
}

export async function fetchMembershipStatus(): Promise<MembershipStatusResponse> {
  const headers = await getMembershipStatusAuthHeaders();
  if (!headers.Authorization) {
    throw new MembershipStatusAuthError("Sign in required.");
  }

  const res = await fetch(MEMBERSHIP_STATUS_API_PATH, {
    method: "GET",
    headers,
    credentials: "same-origin",
  });

  let body: MembershipStatusResponse | null = null;
  try {
    body = (await res.json()) as MembershipStatusResponse;
  } catch {
    body = null;
  }

  if (res.status === 401) {
    throw new MembershipStatusAuthError(body?.error || "Sign in required.");
  }

  if (!body || typeof body !== "object") {
    throw new Error("Membership status is unavailable right now.");
  }

  if (!body.ok && res.status >= 400) {
    throw new Error(body.error || "Membership status is unavailable right now.");
  }

  return body;
}

export class MembershipStatusAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipStatusAuthError";
  }
}
