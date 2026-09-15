/**
 * Browser resolver for {@link SavedPatternAccessState}.
 * Lists owner-scoped cloud projects only after a verified Memberstack session exists.
 */
import {
  getViewerAccessState,
  hasMemberAccess,
  isMemberLoggedIn,
} from "../memberAccess";
import { ensureLegacyPaidThroughContext } from "../memberAccessClient";
import { memberIdFromMemberstackPayload } from "./memberstackMember";
import { listCustomPatternProjects } from "./customPatternProjectClient";
import {
  patternSystemsFromSummaries,
  resolveSavedPatternAccessState,
  SAVED_PATTERN_ACCESS_LOADING,
  type SavedPatternAccessState,
} from "./savedPatternAccessState";
import { waitForMemberstackDom, waitForMemberstackReady } from "./sleevelessPatternLoginGate";

export type ResolveSavedPatternAccessStateFromSessionDeps = {
  getMemberPayload?: () => Promise<unknown>;
  listProjects?: () => Promise<{ ok: boolean; projects?: { patternSystem?: string | null }[] }>;
};

async function defaultMemberPayload(): Promise<unknown> {
  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return null;
  await waitForMemberstackReady(ms);
  return ms.getCurrentMember();
}

/**
 * Resolve pattern access after Memberstack (and Watson paid-through) are ready.
 * Ownership comes only from the owner-scoped list API, never from a URL id.
 */
export async function resolveSavedPatternAccessStateFromSession(
  deps: ResolveSavedPatternAccessStateFromSessionDeps = {},
): Promise<SavedPatternAccessState> {
  const getMemberPayload = deps.getMemberPayload ?? defaultMemberPayload;
  let payload: unknown = null;
  try {
    payload = await getMemberPayload();
    await ensureLegacyPaidThroughContext(payload);
  } catch {
    return resolveSavedPatternAccessState({
      loggedIn: false,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
  }

  const loggedIn = isMemberLoggedIn(payload);
  const memberId = memberIdFromMemberstackPayload(payload);
  const hasActiveAccess = hasMemberAccess(payload);

  if (!loggedIn || !memberId) {
    return resolveSavedPatternAccessState({
      loggedIn: false,
      hasActiveAccess: false,
      hasOwnedPatterns: false,
    });
  }

  if (hasActiveAccess) {
    return resolveSavedPatternAccessState({
      loggedIn: true,
      memberId,
      hasActiveAccess: true,
      hasOwnedPatterns: false,
    });
  }

  const listProjects =
    deps.listProjects ??
    (async () => {
      const res = await listCustomPatternProjects("sleeveless");
      return res.ok ? { ok: true, projects: res.projects } : { ok: false, projects: [] };
    });

  let projects: { patternSystem?: string | null }[] = [];
  try {
    const list = await listProjects();
    if (list.ok) projects = list.projects ?? [];
  } catch {
    projects = [];
  }

  const ownedPatternSystems = patternSystemsFromSummaries(projects);
  return resolveSavedPatternAccessState({
    loggedIn: true,
    memberId,
    hasActiveAccess: false,
    hasOwnedPatterns: projects.length > 0,
    ownedPatternSystems,
  });
}

export function savedPatternAccessLoadingState(): SavedPatternAccessState {
  return SAVED_PATTERN_ACCESS_LOADING;
}

/** ViewerAccessState from Memberstack is independent of saved-pattern ownership. */
export { getViewerAccessState };
