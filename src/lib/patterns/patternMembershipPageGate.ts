/**
 * Page-shell membership gate for Dynamic Patterns (catalog, builders, workspaces, print).
 *
 * Unlocks for active Knit it Now member access (`hasMemberAccess` / MEMBER_PLAN_IDS).
 * Former members may unlock a completed saved-pattern view after an owner-scoped load succeeds.
 * Lifetime plans, JSON unlock flags, and free claims never unlock. Login alone never unlocks.
 * Content stays hidden until access is confirmed.
 */
import { getViewerAccessState, type ViewerAccessState } from "../memberAccess";
import { ensureLegacyPaidThroughContext } from "../memberAccessClient";
import { loadCustomPatternProject } from "./customPatternProjectClient";
import { memberIdFromMemberstackPayload } from "./memberstackMember";
import { enforcePatternDraftOwner } from "./patternDraftOwnerGuard";
import {
  resolveSleevelessUserAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import {
  resolveCurrentMemberIdForDraftGuard,
  waitForMemberstackDom,
  waitForMemberstackReady,
} from "./sleevelessPatternLoginGate";
import {
  isPaidPatternMutationRoute,
  isPaidSavedPatternReadOnlyCandidate,
} from "./savedPatternViewRoute";
import { readSavedPatternProjectIdFromUrl } from "./savedPatternViewUrl";
import {
  applySavedPatternReadOnlyChrome,
  setSavedPatternReadOnlyDocument,
} from "./savedPatternReadOnlyChrome";

/** Visual/gate states for `[data-sleeveless-pattern-gate]`. */
export type PatternMembershipGateState =
  | "pending"
  | "member"
  | "readonly"
  | "unavailable"
  | "locked"
  | "locked-no-access";

export type PatternMembershipGateDecision =
  | { state: "member"; access: SleevelessUserAccess }
  | { state: "readonly"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "unavailable"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "locked"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "locked-no-access"; access: SleevelessUserAccess; viewer: ViewerAccessState };

/**
 * Pure membership decision. Former-member read-only is applied afterwards when a
 * completed saved pattern loads under the verified member id.
 */
export function decidePatternMembershipGate(
  access: SleevelessUserAccess,
  viewer: ViewerAccessState = access.loggedIn ? "loggedInNoAccess" : "loggedOut",
): PatternMembershipGateDecision {
  if (access.hasSystemAccess || viewer === "memberAccess") {
    return { state: "member", access };
  }
  if (access.loggedIn || viewer === "loggedInNoAccess") {
    return { state: "locked-no-access", access, viewer: "loggedInNoAccess" };
  }
  return { state: "locked", access, viewer: "loggedOut" };
}

export type ApplyFormerMemberReadOnlyDeps = {
  href?: string;
  loadOwnedProject?: (id: string) => Promise<{ ok: boolean }>;
};

/**
 * Former members may view an owned completed pattern. Mutation routes stay locked.
 * A URL project id is not ownership — only a successful owner-scoped load unlocks readonly.
 */
export async function applyFormerMemberReadOnlyException(
  decision: PatternMembershipGateDecision,
  deps: ApplyFormerMemberReadOnlyDeps = {},
): Promise<PatternMembershipGateDecision> {
  if (decision.state !== "locked-no-access") return decision;
  if (isPaidPatternMutationRoute(deps.href)) return decision;
  if (!isPaidSavedPatternReadOnlyCandidate(deps.href)) return decision;

  const projectId = readSavedPatternProjectIdFromUrl(deps.href);
  if (!projectId) return decision;

  const load =
    deps.loadOwnedProject ?? ((id: string) => loadCustomPatternProject(id, "sleeveless"));
  let loaded = false;
  try {
    const res = await load(projectId);
    loaded = res.ok === true;
  } catch {
    loaded = false;
  }

  if (loaded) {
    return { state: "readonly", access: decision.access, viewer: "loggedInNoAccess" };
  }
  return { state: "unavailable", access: decision.access, viewer: "loggedInNoAccess" };
}

export async function resolvePatternMembershipGateDecision(
  deps: ApplyFormerMemberReadOnlyDeps = {},
): Promise<PatternMembershipGateDecision> {
  if (typeof window === "undefined") {
    return decidePatternMembershipGate(
      {
        loggedIn: false,
        activePlanIds: [],
        hasSystemAccess: false,
        freeClaimsBySystem: {},
      },
      "loggedOut",
    );
  }

  await waitForMemberstackDom();
  const ms = window.$memberstackDom;
  let viewer: ViewerAccessState = "loggedOut";
  if (ms?.getCurrentMember) {
    try {
      await waitForMemberstackReady(ms);
      const res = await ms.getCurrentMember();
      await ensureLegacyPaidThroughContext(res);
      viewer = getViewerAccessState(res);
      enforcePatternDraftOwner(memberIdFromMemberstackPayload(res));
    } catch {
      viewer = "loggedOut";
    }
  }

  const access = await resolveSleevelessUserAccess();
  const membership = decidePatternMembershipGate(access, viewer);
  return applyFormerMemberReadOnlyException(membership, deps);
}

function setGateState(root: HTMLElement, state: PatternMembershipGateState): void {
  root.dataset.gateState = state;
  root.removeAttribute("data-gate-pending");

  const content = root.querySelector("[data-sleeveless-pattern-gate-content]");
  const locked = root.querySelector("[data-sleeveless-pattern-gate-locked]");
  const loading = root.querySelector("[data-sleeveless-pattern-gate-loading]");
  const signin = root.querySelector("[data-sleeveless-pattern-gate-signin]");
  const noAccess = root.querySelector("[data-sleeveless-pattern-gate-no-access]");
  const readonlyNotice = root.querySelector("[data-sleeveless-pattern-gate-readonly]");
  const unavailable = root.querySelector("[data-sleeveless-pattern-gate-unavailable]");

  const showContent = state === "member" || state === "readonly";

  if (content instanceof HTMLElement) {
    content.hidden = !showContent;
    content.setAttribute("aria-hidden", showContent ? "false" : "true");
    if (!showContent) {
      content.setAttribute("inert", "");
    } else {
      content.removeAttribute("inert");
    }
  }

  if (locked instanceof HTMLElement) {
    locked.hidden = showContent;
  }

  if (loading instanceof HTMLElement) {
    loading.hidden = state !== "pending";
  }

  if (signin instanceof HTMLElement) {
    signin.hidden = state !== "locked";
  }

  if (noAccess instanceof HTMLElement) {
    noAccess.hidden = state !== "locked-no-access";
  }

  if (readonlyNotice instanceof HTMLElement) {
    readonlyNotice.hidden = state !== "readonly";
  }

  if (unavailable instanceof HTMLElement) {
    unavailable.hidden = state !== "unavailable";
  }

  if (state === "readonly") {
    applySavedPatternReadOnlyChrome(root);
  } else {
    setSavedPatternReadOnlyDocument(false);
  }
}

/** Wires `[data-sleeveless-pattern-gate]`. Fail closed while pending. */
export async function initPatternMembershipPageGate(root: HTMLElement): Promise<void> {
  setGateState(root, "pending");

  const decision = await resolvePatternMembershipGateDecision();
  setGateState(root, decision.state);
  enforcePatternDraftOwner(await resolveCurrentMemberIdForDraftGuard());

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    const refresh = (): void => {
      void resolvePatternMembershipGateDecision().then((next) => {
        setGateState(root, next.state);
      });
      void resolveCurrentMemberIdForDraftGuard().then((memberId) => {
        enforcePatternDraftOwner(memberId);
      });
    };
    ms.on("member.login", refresh);
    ms.on("member.logout", refresh);
  }
}
