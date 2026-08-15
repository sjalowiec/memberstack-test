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

/** BaseLayout `window.__KIN_MEMBER_ACCESS__` snapshot (getAppAndMember). */
export type HatMemberAccessSnapshot = {
  hasMemberAccess: boolean;
  viewerAccessState: ViewerAccessState;
};

function readPersistedSnapshot(): HatMemberAccessSnapshot | null {
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
  persistedSnapshot?: HatMemberAccessSnapshot | null;
  memberPayload?: unknown;
};

/**
 * Pure decision used by the async resolver and tests.
 *
 * A Memberstack payload is authoritative. Otherwise reuse the BaseLayout
 * `getAppAndMember` snapshot (`__KIN_MEMBER_ACCESS__`) when present.
 */
export function decideHatPatternViewerAccessState(
  input: ResolveHatPatternViewerAccessStateInput,
): ViewerAccessState {
  if (input.memberPayload !== undefined) {
    return getViewerAccessState(input.memberPayload);
  }
  return input.persistedSnapshot?.viewerAccessState ?? "loggedOut";
}

export async function resolveHatPatternViewerAccessState(): Promise<ViewerAccessState> {
  if (typeof window === "undefined") return "loggedOut";

  const payload = await waitForHatPatternMemberstackPayload();
  const persisted = readPersistedSnapshot();
  const state = decideHatPatternViewerAccessState({
    memberPayload: payload ?? undefined,
    persistedSnapshot: persisted,
  });

  logMemberAccessDebug("hat-pattern.workspace", payload, {
    source: payload == null ? "persisted-snapshot" : "getAppAndMember",
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
