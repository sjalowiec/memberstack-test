/**
 * Shared member-access publish rules for BaseLayout (authoritative) and Header.
 *
 * Unresolved Memberstack is pending, never a published logged-out / no-access
 * snapshot. An already-confirmed access grant is not replaced by a later empty
 * payload or a member object that is still missing `planConnections`.
 */
import {
  getViewerAccessState,
  hasMemberAccess,
  isMemberLoggedIn,
} from "./memberAccess";
import {
  resolveSharedMemberAccessSnapshot,
  type SharedMemberAccessSnapshot,
} from "./localMemberPreviewBypass";
import {
  memberIdFromMemberstackPayload,
  memberRecordFromMemberstackPayload,
} from "./patterns/memberstackMember";

export type { SharedMemberAccessSnapshot };

export type SharedMemberAccessPublishDecision =
  | { action: "pending" }
  | { action: "publish"; snapshot: SharedMemberAccessSnapshot };

export type HeaderAuthPublishDecision = {
  /** Write `window.__KBM_AUTH` / `__AUTH` from this poll. */
  applyWindowState: boolean;
  windowState: { loggedIn: boolean; member: boolean; memberId: string | null } | null;
  /** Paint the account control. `keep` leaves the current label alone. */
  label: "loggedIn" | "guest" | "keep";
  /** Header may notify listeners only for a resolved logged-in member. */
  dispatchAuthUpdated: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * `undefined` means plan connections have not loaded yet.
 * An empty array means they loaded and the member has none.
 */
export function memberstackPlanConnections(
  memberOrPayload: unknown,
): unknown[] | undefined {
  if (memberOrPayload == null) return undefined;
  const member = memberRecordFromMemberstackPayload(memberOrPayload);
  const root = asRecord(memberOrPayload);
  const data = asRecord(root.data ?? root);
  const connections = member?.planConnections ?? data.planConnections;
  return Array.isArray(connections) ? connections : undefined;
}

/**
 * True when Memberstack returned a finished auth/plan payload.
 * `null` is never resolved. A logged-in member without `planConnections`
 * is still loading. A non-member payload is resolved only after the SDK is ready.
 */
export function isSharedMemberstackPayloadResolved(
  payload: unknown,
  memberstackReady: boolean,
): boolean {
  if (payload == null) return false;
  if (!isMemberLoggedIn(payload)) return memberstackReady === true;
  return memberstackPlanConnections(payload) !== undefined;
}

function snapshotFromPayload(
  payload: unknown,
  bypassOn: boolean,
): SharedMemberAccessSnapshot {
  return resolveSharedMemberAccessSnapshot({
    memberHasAccess: hasMemberAccess(payload),
    viewerAccessState: getViewerAccessState(payload),
    bypassOn,
  });
}

/**
 * BaseLayout publish decision. Callers must not write `__KIN_MEMBER_ACCESS__`
 * or dispatch `kin:member-access` / `auth:updated` on `pending`.
 */
export function decideSharedMemberAccessPublish(input: {
  payload: unknown;
  memberstackReady: boolean;
  currentSnapshot?: SharedMemberAccessSnapshot | null;
  bypassOn?: boolean;
  logoutEvent?: boolean;
}): SharedMemberAccessPublishDecision {
  const bypassOn = input.bypassOn === true;
  const current = input.currentSnapshot ?? null;
  const granted = current?.hasMemberAccess === true;

  if (input.logoutEvent) {
    return {
      action: "publish",
      snapshot: resolveSharedMemberAccessSnapshot({
        memberHasAccess: false,
        viewerAccessState: "loggedOut",
        bypassOn,
      }),
    };
  }

  if (!isSharedMemberstackPayloadResolved(input.payload, input.memberstackReady)) {
    if (bypassOn && !granted) {
      return {
        action: "publish",
        snapshot: resolveSharedMemberAccessSnapshot({
          memberHasAccess: false,
          viewerAccessState: "loggedOut",
          bypassOn: true,
        }),
      };
    }
    return { action: "pending" };
  }

  const next = snapshotFromPayload(input.payload, bypassOn);
  if (granted && !next.hasMemberAccess) {
    return { action: "pending" };
  }
  return { action: "publish", snapshot: next };
}

/**
 * Header must not independently publish a guest `auth:updated` or overwrite a
 * BaseLayout access grant with a null / incomplete `getCurrentMember()` result.
 */
export function decideHeaderAuthPublish(input: {
  payload: unknown;
  snapshot?: SharedMemberAccessSnapshot | null;
}): HeaderAuthPublishDecision {
  const snapshot = input.snapshot ?? null;
  const granted = snapshot?.hasMemberAccess === true;
  const payload = input.payload;
  const loggedIn = isMemberLoggedIn(payload);
  const plansLoaded = memberstackPlanConnections(payload) !== undefined;
  const resolvedLoggedIn = loggedIn && plansLoaded;

  if (granted && !resolvedLoggedIn) {
    return {
      applyWindowState: false,
      windowState: null,
      label: "keep",
      dispatchAuthUpdated: false,
    };
  }

  if (resolvedLoggedIn) {
    const isMember = hasMemberAccess(payload);
    const memberId = memberIdFromMemberstackPayload(payload) ?? null;
    return {
      applyWindowState: true,
      windowState: {
        loggedIn: true,
        member: isMember,
        memberId,
      },
      label: "loggedIn",
      dispatchAuthUpdated: true,
    };
  }

  if (loggedIn && !plansLoaded) {
    return {
      applyWindowState: false,
      windowState: null,
      label: "keep",
      dispatchAuthUpdated: false,
    };
  }

  if (snapshot?.viewerAccessState === "loggedOut" && snapshot.hasMemberAccess === false) {
    return {
      applyWindowState: true,
      windowState: { loggedIn: false, member: false, memberId: null },
      label: "guest",
      dispatchAuthUpdated: false,
    };
  }

  return {
    applyWindowState: false,
    windowState: null,
    label: "keep",
    dispatchAuthUpdated: false,
  };
}
