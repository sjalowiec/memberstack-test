/**
 * Page-shell membership gate for Dynamic Patterns (catalog, builders, workspaces, print).
 *
 * Unlocks only for active Knit it Now member access (`hasMemberAccess` / MEMBER_PLAN_IDS).
 * Lifetime plans, JSON unlock flags, and free claims never unlock. Login alone never unlocks.
 * Content stays hidden until access is confirmed.
 */
import { getViewerAccessState, type ViewerAccessState } from "../memberAccess";
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

/** Visual/gate states for `[data-sleeveless-pattern-gate]`. */
export type PatternMembershipGateState =
  | "pending"
  | "member"
  | "locked"
  | "locked-no-access";

export type PatternMembershipGateDecision =
  | { state: "member"; access: SleevelessUserAccess }
  | { state: "locked"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "locked-no-access"; access: SleevelessUserAccess; viewer: ViewerAccessState };

/**
 * Pure decision: unlock when entitlement grants at least one pattern system (or full membership
 * reflected as `hasSystemAccess`). Logged-in without entitlement ? membership CTA, not signup.
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

export async function resolvePatternMembershipGateDecision(): Promise<PatternMembershipGateDecision> {
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
      viewer = getViewerAccessState(res);
      // Keep draft ownership in sync even when the gate stays locked.
      enforcePatternDraftOwner(memberIdFromMemberstackPayload(res));
    } catch {
      viewer = "loggedOut";
    }
  }

  const access = await resolveSleevelessUserAccess();
  return decidePatternMembershipGate(access, viewer);
}

function setGateState(root: HTMLElement, state: PatternMembershipGateState): void {
  root.dataset.gateState = state;
  root.removeAttribute("data-gate-pending");

  const content = root.querySelector("[data-sleeveless-pattern-gate-content]");
  const locked = root.querySelector("[data-sleeveless-pattern-gate-locked]");
  const loading = root.querySelector("[data-sleeveless-pattern-gate-loading]");
  const signin = root.querySelector("[data-sleeveless-pattern-gate-signin]");
  const noAccess = root.querySelector("[data-sleeveless-pattern-gate-no-access]");

  const isMember = state === "member";

  if (content instanceof HTMLElement) {
    content.hidden = !isMember;
    content.setAttribute("aria-hidden", isMember ? "false" : "true");
    if (!isMember) {
      content.setAttribute("inert", "");
    } else {
      content.removeAttribute("inert");
    }
  }

  if (locked instanceof HTMLElement) {
    locked.hidden = isMember;
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
}

/** Wires `[data-sleeveless-pattern-gate]` ù membership required; fail closed while pending. */
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
