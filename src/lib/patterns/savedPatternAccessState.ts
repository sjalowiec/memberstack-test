/**
 * Pattern-specific saved-pattern access state.
 *
 * Separate from global {@link hasMemberAccess} used by courses, videos, and Help Hub.
 * Possession of a pattern ID or a client-supplied member ID is never proof of ownership.
 */

import { PATTERN_SYSTEM_IDS, type PatternSystemId } from "./patternSystemId";

export type SavedPatternAccessKind =
  | "loading"
  | "loggedOut"
  | "activeMember"
  | "formerMemberWithPatterns"
  | "authenticatedWithoutAccessOrPatterns";

export type SavedPatternAccessState = {
  kind: SavedPatternAccessKind;
  /** Signed-in Memberstack identity (JWT / getCurrentMember). */
  loggedIn: boolean;
  /** Verified Memberstack member id when known. Never taken from a client header. */
  memberId: string | null;
  /** Paid plan or valid Watson paid-through date. */
  hasActiveAccess: boolean;
  /** True when this account owns at least one cloud saved pattern. */
  hasOwnedPatterns: boolean;
  /** Pattern systems present in the owner-scoped list. */
  ownedPatternSystems: readonly PatternSystemId[];
};

export const SAVED_PATTERN_ACCESS_LOADING: SavedPatternAccessState = {
  kind: "loading",
  loggedIn: false,
  memberId: null,
  hasActiveAccess: false,
  hasOwnedPatterns: false,
  ownedPatternSystems: [],
};

export const MY_PATTERNS_ACCOUNT_HREF = "/account#my-patterns";

export const SAVED_PATTERN_READONLY_NOTICE =
  "This pattern is saved to your account. You can view, print, and download it anytime. Renew your membership to edit, recalculate, or create new patterns.";

export const SAVED_PATTERN_READONLY_RENEW_LABEL = "Renew Membership";
export const SAVED_PATTERN_READONLY_RENEW_HREF = "/membership";

export const MY_PATTERNS_READONLY_NOTICE =
  "These patterns are saved to your account. You can view, print, and download them anytime. Renew your membership to edit, recalculate, or create new patterns.";

export const MY_PATTERNS_NO_ACCESS_EMPTY_MESSAGE =
  "You do not have any saved patterns. Pattern Builders are included with an active Knit It Now membership.";

export const SAVED_PATTERN_UNAVAILABLE_TITLE = "This pattern isn’t available";
export const SAVED_PATTERN_UNAVAILABLE_BODY =
  "This saved pattern could not be opened. It may have been deleted, or it does not belong to this account.";

export type ResolveSavedPatternAccessStateInput = {
  loading?: boolean;
  loggedIn: boolean;
  memberId?: string | null;
  /** True when {@link hasMemberAccess} (paid or Watson paid-through) is granted. */
  hasActiveAccess: boolean;
  hasOwnedPatterns: boolean;
  ownedPatternSystems?: readonly PatternSystemId[];
};

function uniqueSystems(systems: readonly PatternSystemId[] | undefined): PatternSystemId[] {
  if (!systems?.length) return [];
  return [...new Set(systems.filter(Boolean))];
}

/**
 * Pure access-state decision. Watson paid-through callers must pass hasActiveAccess=true
 * so they resolve as {@link SavedPatternAccessKind activeMember}, not former members.
 */
export function resolveSavedPatternAccessState(
  input: ResolveSavedPatternAccessStateInput,
): SavedPatternAccessState {
  const memberId =
    typeof input.memberId === "string" && input.memberId.trim() ? input.memberId.trim() : null;
  const ownedPatternSystems = uniqueSystems(input.ownedPatternSystems);
  const hasOwnedPatterns = input.hasOwnedPatterns || ownedPatternSystems.length > 0;

  if (input.loading) {
    return {
      ...SAVED_PATTERN_ACCESS_LOADING,
      loggedIn: input.loggedIn,
      memberId,
      hasActiveAccess: input.hasActiveAccess,
      hasOwnedPatterns,
      ownedPatternSystems,
    };
  }

  if (!input.loggedIn || !memberId) {
    return {
      kind: "loggedOut",
      loggedIn: false,
      memberId: null,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
      ownedPatternSystems: [],
    };
  }

  if (input.hasActiveAccess) {
    return {
      kind: "activeMember",
      loggedIn: true,
      memberId,
      hasActiveAccess: true,
      hasOwnedPatterns,
      ownedPatternSystems,
    };
  }

  if (hasOwnedPatterns) {
    return {
      kind: "formerMemberWithPatterns",
      loggedIn: true,
      memberId,
      hasActiveAccess: false,
      hasOwnedPatterns: true,
      ownedPatternSystems,
    };
  }

  return {
    kind: "authenticatedWithoutAccessOrPatterns",
    loggedIn: true,
    memberId,
    hasActiveAccess: false,
    hasOwnedPatterns: false,
    ownedPatternSystems: [],
  };
}

/** Create, edit, recalculate, save, rename, notes, workflow, and copy. */
export function canMutateSavedPatterns(state: SavedPatternAccessState): boolean {
  return state.kind === "activeMember";
}

export function canCreatePaidPattern(state: SavedPatternAccessState): boolean {
  return state.kind === "activeMember";
}

/** List is allowed for any signed-in Memberstack identity (empty list is fine). */
export function canListOwnedSavedPatterns(state: SavedPatternAccessState): boolean {
  return state.loggedIn && Boolean(state.memberId);
}

export function canDeleteOwnedSavedPattern(state: SavedPatternAccessState): boolean {
  return (
    (state.kind === "activeMember" || state.kind === "formerMemberWithPatterns") &&
    Boolean(state.memberId)
  );
}

export function ownsSavedPatternSystem(
  state: SavedPatternAccessState,
  system: PatternSystemId,
): boolean {
  return state.ownedPatternSystems.includes(system);
}

/**
 * View permission for one loaded project.
 *
 * `ownerScopedLoadSucceeded` must come from the owner-scoped server load (JWT key prefix).
 * A URL `project=` id, query payload, or client-supplied member id is not ownership.
 */
export function canViewAfterOwnerScopedLoad(input: {
  access: SavedPatternAccessState;
  ownerScopedLoadSucceeded: boolean;
}): boolean {
  if (!input.ownerScopedLoadSucceeded) return false;
  if (!input.access.loggedIn || !input.access.memberId) return false;
  if (input.access.kind === "loading" || input.access.kind === "loggedOut") return false;
  return true;
}

/**
 * Compare verified session member id to a server-known owner id.
 * Both must be non-empty and equal. A pattern id is ignored on purpose.
 */
export function memberOwnsProjectRecord(input: {
  authenticatedMemberId: string | null | undefined;
  projectOwnerMemberId: string | null | undefined;
}): boolean {
  const memberId = String(input.authenticatedMemberId ?? "").trim();
  const ownerId = String(input.projectOwnerMemberId ?? "").trim();
  if (!memberId || !ownerId) return false;
  return memberId === ownerId;
}

export type SocksCatalogDestination = typeof MY_PATTERNS_ACCOUNT_HREF | "/patterns/socks";

/**
 * Pattern Catalog Socks card and `/patterns/socks` redirect target.
 * `loading` callers must not navigate or swap to a prospect CTA.
 */
export function resolveSocksSavedPatternDestination(
  state: SavedPatternAccessState,
): SocksCatalogDestination | null {
  if (state.kind === "loading") return null;
  if (state.kind === "activeMember") return MY_PATTERNS_ACCOUNT_HREF;
  if (state.kind === "formerMemberWithPatterns" && ownsSavedPatternSystem(state, "socks")) {
    return MY_PATTERNS_ACCOUNT_HREF;
  }
  return "/patterns/socks";
}

export function shouldRedirectSocksLandingToMyPatterns(state: SavedPatternAccessState): boolean {
  return resolveSocksSavedPatternDestination(state) === MY_PATTERNS_ACCOUNT_HREF;
}

export function shouldShowSocksCreateAction(state: SavedPatternAccessState): boolean {
  return state.kind === "activeMember";
}

export function patternSystemsFromSummaries(
  projects: readonly { patternSystem?: string | null }[],
): PatternSystemId[] {
  const systems: PatternSystemId[] = [];
  for (const project of projects) {
    const raw = project.patternSystem?.trim();
    if (raw && (PATTERN_SYSTEM_IDS as readonly string[]).includes(raw)) {
      systems.push(raw as PatternSystemId);
    }
  }
  return uniqueSystems(systems);
}
