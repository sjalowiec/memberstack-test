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

let lastResolvedMemberstackPayload: unknown = null;

/** Last getAppAndMember payload from Hat resolution (for temporary diagnostics). */
export function readLastHatPatternMemberstackPayload(): unknown {
  return lastResolvedMemberstackPayload;
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
  /** Already-resolved candidate (e.g. a late getAppAndMember result). */
  candidate?: ViewerAccessState;
};

/**
 * Pure decision used by the async resolver and tests.
 *
 * BaseLayout `__KIN_MEMBER_ACCESS__` is the shared source of truth once it has
 * granted `memberAccess`. A parallel `getAppAndMember()` call can return a
 * logged-in member without `planConnections` and must not downgrade that.
 */
export function decideHatPatternViewerAccessState(
  input: ResolveHatPatternViewerAccessStateInput,
): ViewerAccessState {
  const fromPayload =
    input.memberPayload !== undefined
      ? getViewerAccessState(input.memberPayload)
      : input.candidate;
  const fromSnapshot = input.persistedSnapshot?.viewerAccessState;
  if (fromSnapshot === "memberAccess" || fromPayload === "memberAccess") {
    return "memberAccess";
  }
  if (fromPayload) return fromPayload;
  return fromSnapshot ?? "loggedOut";
}

export function readHatPatternAccessSnapshot(): HatMemberAccessSnapshot | null {
  return readPersistedSnapshot();
}

/**
 * Apply a `kin:member-access` detail without a second Memberstack round-trip.
 * Re-fetching can omit planConnections and mark a real member as a guest.
 */
export function applyHatPatternMemberAccessEvent(
  detail: Partial<HatMemberAccessSnapshot> | null | undefined,
  apply: (state: ViewerAccessState) => void,
): ViewerAccessState | null {
  if (!detail) return null;
  if (detail.viewerAccessState) {
    if (typeof window !== "undefined") {
      window.__KIN_MEMBER_ACCESS__ = {
        hasMemberAccess:
          detail.hasMemberAccess ?? detail.viewerAccessState === "memberAccess",
        viewerAccessState: detail.viewerAccessState,
      };
    }
    apply(detail.viewerAccessState);
    return detail.viewerAccessState;
  }
  if (detail.hasMemberAccess === true) {
    if (typeof window !== "undefined") {
      window.__KIN_MEMBER_ACCESS__ = {
        hasMemberAccess: true,
        viewerAccessState: "memberAccess",
      };
    }
    apply("memberAccess");
    return "memberAccess";
  }
  return null;
}

export type HatPatternWorkspaceAccessLifecycle = {
  apply: (state: ViewerAccessState) => void;
  resolve?: () => Promise<ViewerAccessState>;
  onKinMemberAccess?: (state: ViewerAccessState) => void;
};

/**
 * Bind shared member-access events first, apply any existing snapshot, then
 * resolve Memberstack. A late `getAppAndMember()` result cannot downgrade
 * `memberAccess` from the snapshot or a `kin:member-access` event that arrived
 * while the resolve was in flight.
 */
export function bindHatPatternWorkspaceAccessLifecycle(
  options: HatPatternWorkspaceAccessLifecycle,
): () => void {
  const apply = options.apply;
  const resolve = options.resolve ?? resolveHatPatternViewerAccessState;

  const commit = (candidate: ViewerAccessState): void => {
    apply(
      decideHatPatternViewerAccessState({
        candidate,
        persistedSnapshot: readPersistedSnapshot(),
      }),
    );
  };

  const onMemberAccess = (event: Event): void => {
    const detail = (event as CustomEvent<HatMemberAccessSnapshot>).detail;
    if (detail?.viewerAccessState) {
      options.onKinMemberAccess?.(detail.viewerAccessState);
    }
    applyHatPatternMemberAccessEvent(detail, apply);
  };

  const onAuthUpdated = (): void => {
    const snapshot = readPersistedSnapshot();
    if (snapshot?.viewerAccessState === "memberAccess") {
      apply("memberAccess");
      return;
    }
    void resolve().then(commit);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("kin:member-access", onMemberAccess);
    window.addEventListener("auth:updated", onAuthUpdated);
  }

  const snapshot = readPersistedSnapshot();
  if (snapshot?.viewerAccessState) {
    apply(snapshot.viewerAccessState);
  } else {
    apply("loggedOut");
  }

  void resolve().then(commit);

  let memberstackBound = false;
  let cancelled = false;
  const attachMemberstack = (): boolean => {
    if (memberstackBound || cancelled || typeof window === "undefined") return true;
    const ms = window.$memberstackDom;
    if (!ms || typeof ms.on !== "function") return false;
    ms.on("member.login", onAuthUpdated);
    ms.on("member.logout", () => apply("loggedOut"));
    memberstackBound = true;
    return true;
  };
  if (!attachMemberstack()) {
    void (async () => {
      for (let i = 0; i < 40 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (attachMemberstack()) return;
      }
    })();
  }

  return () => {
    cancelled = true;
    if (typeof window === "undefined") return;
    window.removeEventListener("kin:member-access", onMemberAccess);
    window.removeEventListener("auth:updated", onAuthUpdated);
  };
}

export async function resolveHatPatternViewerAccessState(): Promise<ViewerAccessState> {
  if (typeof window === "undefined") return "loggedOut";

  const payload = await waitForHatPatternMemberstackPayload();
  lastResolvedMemberstackPayload = payload;
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
