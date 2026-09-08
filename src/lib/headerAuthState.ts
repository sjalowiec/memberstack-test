/**
 * Canonical Header auth state ? same membership definition as BaseLayout / content gates.
 *
 * Uses {@link hasMemberAccess} (paid ACTIVE/TRIALING plans, or a confirmed
 * Watson paid-through date today or later). Never treats a raw plan connection
 * as membership without the active-status filter.
 */
import { hasMemberAccess, isMemberLoggedIn, type MemberAccessOptions } from "./memberAccess";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

export type HeaderAuthState = {
  loggedIn: boolean;
  /** True only when {@link hasMemberAccess} is true. */
  isMember: boolean;
  memberId: string | null;
  member: Record<string, unknown> | null;
};

/**
 * Resolve Header / `window.__KBM_AUTH` fields from a Memberstack getCurrentMember payload
 * (or bare member record). Matches BaseLayout's membership decision.
 */
export function resolveHeaderAuthState(
  memberOrPayload: unknown,
  options?: MemberAccessOptions,
): HeaderAuthState {
  const loggedIn = isMemberLoggedIn(memberOrPayload);
  const isMember = hasMemberAccess(memberOrPayload, options);
  const member = memberRecordFromMemberstackPayload(memberOrPayload) ?? null;
  const nestedId =
    member && typeof member.id === "string" && member.id.trim() ? member.id.trim() : null;
  const memberId = loggedIn
    ? nestedId ?? memberIdFromMemberstackPayload(memberOrPayload) ?? null
    : null;

  return {
    loggedIn,
    isMember,
    memberId,
    member,
  };
}

/** Shape written to `window.__KBM_AUTH` by the Header. */
export function headerAuthWindowState(state: HeaderAuthState): {
  loggedIn: boolean;
  member: boolean;
  memberId: string | null;
} {
  return {
    loggedIn: state.loggedIn,
    member: state.isMember,
    memberId: state.memberId,
  };
}
