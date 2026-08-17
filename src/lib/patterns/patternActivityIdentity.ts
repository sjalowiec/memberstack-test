/**
 * Shared Pattern Activity identity + membership helpers.
 *
 * Membership is recorded at event time and must not be inferred later from
 * the current Memberstack plan. Guest ids are a hash of the email — never the
 * raw address — so `userEmail` remains the human-readable field.
 */
import type { ViewerAccessState } from "../memberAccess";

export const PATTERN_ACTIVITY_MEMBERSHIPS = ["free", "member"] as const;
export type PatternActivityMembership = (typeof PATTERN_ACTIVITY_MEMBERSHIPS)[number];

export const PATTERN_ACTIVITY_GUEST_USER_PREFIX = "guest_";

export function normalizeActivityEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hexFromBytes(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Stable guest userId from a captured email. Uses SHA-256 so the raw address
 * is never embedded in `userId`.
 */
export async function guestActivityUserIdFromEmail(email: string): Promise<string> {
  const normalized = normalizeActivityEmail(email);
  if (!normalized) {
    throw new Error("guestActivityUserIdFromEmail: email is required.");
  }

  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized),
    );
    return `${PATTERN_ACTIVITY_GUEST_USER_PREFIX}${hexFromBytes(new Uint8Array(digest)).slice(0, 16)}`;
  }

  const { createHash } = await import("node:crypto");
  const hex = createHash("sha256").update(normalized).digest("hex");
  return `${PATTERN_ACTIVITY_GUEST_USER_PREFIX}${hex.slice(0, 16)}`;
}

export function isPatternActivityMembership(
  value: unknown,
): value is PatternActivityMembership {
  return value === "free" || value === "member";
}

export function membershipFromViewerAccess(
  state: ViewerAccessState | null | undefined,
): PatternActivityMembership {
  return state === "memberAccess" ? "member" : "free";
}

export function resolveActivityMembershipFromSnapshot(
  snapshot?: {
    hasMemberAccess?: boolean;
    viewerAccessState?: ViewerAccessState | string;
  } | null,
): PatternActivityMembership {
  const snap =
    snapshot !== undefined
      ? snapshot
      : typeof window !== "undefined"
        ? window.__KIN_MEMBER_ACCESS__
        : null;
  if (snap?.viewerAccessState === "memberAccess" || snap?.hasMemberAccess === true) {
    return "member";
  }
  return "free";
}

/** Read membership from a stored event. Historical rows without it are unknown. */
export function membershipFromActivityEvent(
  event: { metadata?: Record<string, unknown> } | null | undefined,
): PatternActivityMembership | "unknown" {
  const value = event?.metadata?.membership;
  return isPatternActivityMembership(value) ? value : "unknown";
}

export function membershipLabel(
  membership: PatternActivityMembership | "unknown" | null | undefined,
): "Free" | "Member" | "Unknown" {
  if (membership === "member") return "Member";
  if (membership === "free") return "Free";
  return "Unknown";
}
