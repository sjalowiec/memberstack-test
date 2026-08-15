/**
 * Hat finished-pattern workspace access.
 *
 * Free Hat view/build is independent of member saved-project privileges.
 * Everyone can view the free pattern; only active members get persistent
 * My Patterns / save / rename / copy behavior.
 */
import {
  getActivePlanIds,
  getViewerAccessState,
  isMemberLoggedIn,
  logMemberAccessDebug,
  type ViewerAccessState,
} from "../../memberAccess";
import {
  localMemberPreviewBypassIsOn,
  type SharedMemberAccessSnapshot,
} from "../../localMemberPreviewBypass";
import { applyHatPatternPersistNotice } from "./hatPatternPersistNotice";
import {
  applyHatPatternMyPatternsAccess,
  hatPatternMyPatternsIsActive,
} from "./hatPatternMyPatternsAccess";

export type HatPatternWorkspaceAccess = {
  /** Free Hat remains viewable without membership. */
  canViewPattern: true;
  /** Persistent save / My Patterns / rename / copy — members only. */
  hasMemberSavedProjectPrivileges: boolean;
  viewerAccessState: ViewerAccessState;
};

export function resolveHatPatternWorkspaceAccess(
  state: ViewerAccessState,
): HatPatternWorkspaceAccess {
  return {
    canViewPattern: true,
    hasMemberSavedProjectPrivileges: hatPatternMyPatternsIsActive(state),
    viewerAccessState: state,
  };
}

export function hatPatternHasMemberSavedProjectPrivileges(
  state: ViewerAccessState,
): boolean {
  return resolveHatPatternWorkspaceAccess(state).hasMemberSavedProjectPrivileges;
}

export { shouldShowHatTemporaryPatternNotice } from "./hatPatternPersistNotice";

function readPersistedSnapshot(): SharedMemberAccessSnapshot | null {
  if (typeof window === "undefined") return null;
  return window.__KIN_MEMBER_ACCESS__ ?? null;
}

/**
 * Wait for getAppAndMember (never prefer getCurrentMember).
 * Early getCurrentMember can return a logged-in member without planConnections,
 * which misclassifies active members as loggedInNoAccess.
 */
export async function waitForHatPatternMemberstackPayload(options?: {
  attempts?: number;
  delayMs?: number;
}): Promise<unknown> {
  const attempts = options?.attempts ?? 40;
  const delayMs = options?.delayMs ?? 200;
  if (typeof window === "undefined") return null;

  for (let i = 0; i < attempts; i++) {
    try {
      const ms = window.$memberstackDom;
      const api = ms?.getAppAndMember;
      if (typeof api === "function") {
        const res = await api.call(ms);
        if (
          res &&
          isMemberLoggedIn(res) &&
          getActivePlanIds(res).length === 0 &&
          i < attempts - 1
        ) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        return res;
      }
    } catch {
      /* keep polling until getAppAndMember is ready */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export type ResolveHatPatternViewerAccessStateInput = {
  persistedSnapshot?: SharedMemberAccessSnapshot | null;
  bypassOn?: boolean;
  memberPayload?: unknown;
};

/**
 * Pure decision used by the async resolver and tests.
 *
 * Localhost `?member=true` preview must not unlock Hat saved-project controls.
 * A real BaseLayout snapshot of `memberAccess` (bypass off) can be trusted
 * immediately so the page does not wait on a second Memberstack round-trip.
 */
export function decideHatPatternViewerAccessState(
  input: ResolveHatPatternViewerAccessStateInput,
): ViewerAccessState {
  if (input.memberPayload !== undefined) {
    return getViewerAccessState(input.memberPayload);
  }
  if (input.bypassOn) return "loggedOut";
  if (input.persistedSnapshot?.viewerAccessState === "memberAccess") {
    return "memberAccess";
  }
  return input.persistedSnapshot?.viewerAccessState ?? "loggedOut";
}

export async function resolveHatPatternViewerAccessState(): Promise<ViewerAccessState> {
  if (typeof window === "undefined") return "loggedOut";

  const bypassOn = localMemberPreviewBypassIsOn();
  const persisted = bypassOn ? null : readPersistedSnapshot();
  if (persisted?.viewerAccessState === "memberAccess") {
    logMemberAccessDebug("hat-pattern.workspace", null, {
      source: "persisted-snapshot",
      viewerAccessState: "memberAccess",
    });
    return "memberAccess";
  }

  const payload = await waitForHatPatternMemberstackPayload();
  const state = getViewerAccessState(payload);
  logMemberAccessDebug("hat-pattern.workspace", payload, {
    source: "getAppAndMember",
    persistedViewerAccessState: persisted?.viewerAccessState ?? null,
  });
  return state;
}

export function applyHatPatternWorkspaceChrome(
  root: ParentNode | null,
  state: ViewerAccessState,
  options?: { isEditingSavedProject?: boolean },
): void {
  applyHatPatternPersistNotice(root, state, options);
  applyHatPatternMyPatternsAccess(root, state);
}
