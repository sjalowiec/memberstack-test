/**
 * Binds the local pattern **working draft** to the authenticated Memberstack member.
 *
 * The working draft (`kbm_current_pattern`, `kbm_sleeveless_express_builder`, `kbm_hat_draft`,
 * `kbm_socks_draft`, the
 * active saved-project links, etc.) lives in browser `localStorage`. It is NOT account storage and
 * is not cleared on logout. Without an owner check, a second member signing in on the same browser
 * would inherit the previous member's draft — a cross-user data leak (release blocker).
 *
 * This guard records which member owns the current local draft and clears the draft whenever the
 * authenticated member changes. Saved cloud projects are unaffected: those are always owner-scoped
 * server-side via `X-KBM-Member-Id` and are re-fetched explicitly by id.
 */
import { clearHatDraftStorage } from "./hat/hatDraft";
import { clearHatSavedProjectIdentity } from "./hat/hatSavedProject";
import { clearSleevelessExpressSession } from "./patternStorage";
import { clearSockDraftStorage } from "./sock/sockDraft";
import {
  getCachedSleevelessUserAccess,
  resolveSleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";

/** localStorage key holding the member id that owns the current local working draft. */
export const PATTERN_DRAFT_OWNER_KEY = "kbm_pattern_draft_owner_id";

export type PatternDraftOwnerResult = "unchanged" | "claimed" | "cleared";

function trimId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readPatternDraftOwnerId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    return localStorage.getItem(PATTERN_DRAFT_OWNER_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function writePatternDraftOwnerId(memberId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (memberId) localStorage.setItem(PATTERN_DRAFT_OWNER_KEY, memberId);
    else localStorage.removeItem(PATTERN_DRAFT_OWNER_KEY);
  } catch {
    /* ignore quota / disabled storage */
  }
}

/**
 * Reconciles the local draft owner with the supplied authenticated member id (pure + synchronous,
 * so it is unit-testable without Memberstack):
 *
 * - **No member id** (logged out / identity unavailable): does nothing destructive. The draft stays
 *   tagged with its current owner; the next *different* sign-in will clear it. Cloud reads are
 *   independently blocked when identity is unavailable (server returns 401, client `mode: "none"`).
 * - **Member matches the recorded owner**: unchanged.
 * - **No recorded owner**: claims the draft for this member (does not clear — preserves a draft this
 *   member just loaded from their own account before any owner tag existed).
 * - **Member differs from the recorded owner**: clears the entire local draft session, then claims
 *   it for the new member. This is the cross-user leak guard.
 */
export function enforcePatternDraftOwner(
  memberId: string | null | undefined,
): PatternDraftOwnerResult {
  const current = trimId(memberId);
  const owner = readPatternDraftOwnerId();

  if (!current) return "unchanged";
  if (owner === current) return "unchanged";

  if (!owner) {
    writePatternDraftOwnerId(current);
    return "claimed";
  }

  // owner is set and differs from the current member → never expose the prior member's draft.
  clearSleevelessExpressSession();
  clearHatDraftStorage();
  clearHatSavedProjectIdentity();
  clearSockDraftStorage();
  writePatternDraftOwnerId(current);
  return "cleared";
}

/**
 * Marks the current local draft as owned by `memberId` WITHOUT clearing it. Call after a verified,
 * owner-scoped cloud load/save so the draft cannot later be wiped by {@link enforcePatternDraftOwner}
 * on a subsequent page (the server already proved the project belongs to this member).
 */
export function claimPatternDraftForMember(memberId: string | null | undefined): void {
  const id = trimId(memberId);
  if (!id) return;
  writePatternDraftOwnerId(id);
}

/** Claims draft ownership for the currently cached member (sync). No-op when identity is unknown. */
export function claimPatternDraftForCurrentMember(): void {
  const access = getCachedSleevelessUserAccess();
  if (access?.loggedIn) claimPatternDraftForMember(access.memberId ?? null);
}

/**
 * Resolves the authenticated member from Memberstack and reconciles draft ownership. Call at pattern
 * page boot BEFORE any hydration so a mismatched draft is cleared before it can be read/rendered.
 */
export async function reconcilePatternDraftOwner(): Promise<PatternDraftOwnerResult> {
  const access = await resolveSleevelessUserAccess();
  return enforcePatternDraftOwner(access.loggedIn ? access.memberId ?? null : null);
}
