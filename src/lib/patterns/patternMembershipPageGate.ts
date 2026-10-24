/**
 * Page-shell membership gate for Dynamic Patterns (catalog, builders, workspaces, print).
 *
 * Unlocks for active Knit it Now member access (`hasMemberAccess` / MEMBER_PLAN_IDS).
 * Former members may unlock a completed saved-pattern view after an owner-scoped load succeeds.
 * Lifetime plans, JSON unlock flags, and free claims never unlock. Login alone never unlocks.
 * Content stays hidden until access is confirmed.
 */
import { type ViewerAccessState } from "../memberAccess";
import {
  invalidateVerifiedMemberAccess,
  readFreshVerifiedMemberAccess,
  resolveVerifiedMemberAccess,
} from "../memberAccessClient";
import {
  isLocalPatternTestingEnabled,
  localPatternTestingAccess,
} from "./localPatternTesting";
import {
  hostedSetInSleeveDraftOwnerId,
  isHostedSetInSleeveDevTesting,
  setInSleeveDevTestingAccess,
} from "./setInSleeveDevTesting";
import { loadCustomPatternProject } from "./customPatternProjectClient";
import { enforcePatternDraftOwner } from "./patternDraftOwnerGuard";
import {
  invalidateSleevelessUserAccessCache,
  resolveSleevelessUserAccess,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccessClient";
import { resolveCurrentMemberIdForDraftGuard } from "./sleevelessPatternLoginGate";
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
  | "locked-no-access"
  /** Membership could not be verified (network/Memberstack). Offers Retry. */
  | "error";

export type PatternMembershipGateDecision =
  | { state: "member"; access: SleevelessUserAccess }
  | { state: "readonly"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "unavailable"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "locked"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "locked-no-access"; access: SleevelessUserAccess; viewer: ViewerAccessState }
  | { state: "error"; reason: string };

/** Upper bound on the whole gate decision so "Checking membership" never hangs. */
export const PATTERN_MEMBERSHIP_GATE_TIMEOUT_MS = 20_000;

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
  deps: ApplyFormerMemberReadOnlyDeps & { force?: boolean } = {},
): Promise<PatternMembershipGateDecision> {
  if (isLocalPatternTestingEnabled()) {
    return decidePatternMembershipGate(localPatternTestingAccess());
  }

  if (isHostedSetInSleeveDevTesting()) {
    return decidePatternMembershipGate(setInSleeveDevTestingAccess());
  }

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

  // Shared, deduped verification (payload includes planConnections; Watson
  // dates reused across pages). A failure is an error, not "logged out".
  const verified = await resolveVerifiedMemberAccess({ force: deps.force });
  if (verified.status === "error") {
    return { state: "error", reason: verified.reason };
  }
  const viewer = verified.viewer;

  if (deps.force) invalidateSleevelessUserAccessCache();
  const access = await resolveSleevelessUserAccess();
  try {
    enforcePatternDraftOwner(access.loggedIn ? access.memberId ?? null : null);
  } catch {
    /* Draft cleanup must not turn a confirmed member into the login panel. */
  }

  const membership = decidePatternMembershipGate(access, viewer);
  return applyFormerMemberReadOnlyException(membership, deps);
}

function withGateTimeout(
  work: Promise<PatternMembershipGateDecision>,
): Promise<PatternMembershipGateDecision> {
  return Promise.race([
    work.catch((): PatternMembershipGateDecision => ({ state: "error", reason: "exception" })),
    new Promise<PatternMembershipGateDecision>((resolve) =>
      setTimeout(
        () => resolve({ state: "error", reason: "timeout" }),
        PATTERN_MEMBERSHIP_GATE_TIMEOUT_MS,
      ),
    ),
  ]);
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
  const errorPanel = root.querySelector("[data-sleeveless-pattern-gate-error]");

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

  if (errorPanel instanceof HTMLElement) {
    errorPanel.hidden = state !== "error";
  }

  if (state === "readonly") {
    applySavedPatternReadOnlyChrome(root);
  } else {
    setSavedPatternReadOnlyDocument(false);
  }
}

/**
 * On hosted Set-In Sleeve testing the draft belongs to the fixed test identity,
 * even when a Memberstack session is also present. Using the Memberstack id
 * here clears the test draft (selected size and loaded pattern).
 */
async function enforceDraftOwnerForCurrentPage(): Promise<void> {
  const hostedOwner = hostedSetInSleeveDraftOwnerId();
  enforcePatternDraftOwner(hostedOwner ?? (await resolveCurrentMemberIdForDraftGuard()));
}

/**
 * Next visible state after a decision. A verification error keeps an
 * already-shown member view that came from a fresh verified cache (the server
 * still authorizes saves and loads); otherwise it shows the Retry panel.
 */
export function nextPatternMembershipGateState(
  current: PatternMembershipGateState | undefined,
  decided: PatternMembershipGateState,
  hasFreshVerifiedMember: boolean,
): PatternMembershipGateState {
  if (decided === "error" && current === "member" && hasFreshVerifiedMember) return "member";
  return decided;
}

/**
 * Wires `[data-sleeveless-pattern-gate]`. Fail closed while pending, except
 * that a member verified within the freshness window sees content at once
 * while the check re-runs in the background.
 */
export async function initPatternMembershipPageGate(root: HTMLElement): Promise<void> {
  const cached = readFreshVerifiedMemberAccess();
  setGateState(root, cached?.viewer === "memberAccess" ? "member" : "pending");

  let generation = 0;
  const run = async (force: boolean): Promise<void> => {
    const mine = ++generation;
    const decision = await withGateTimeout(resolvePatternMembershipGateDecision({ force }));
    if (mine !== generation) return;
    const current = root.dataset.gateState as PatternMembershipGateState | undefined;
    const fresh = readFreshVerifiedMemberAccess()?.viewer === "memberAccess";
    setGateState(root, nextPatternMembershipGateState(current, decision.state, fresh));
  };

  /** Login/logout: drop cached member state and show Checking while re-verifying. */
  const refresh = (): void => {
    invalidateVerifiedMemberAccess();
    setGateState(root, "pending");
    void run(true);
    void enforceDraftOwnerForCurrentPage();
  };

  root.querySelectorAll<HTMLElement>("[data-sleeveless-pattern-gate-retry]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      setGateState(root, "pending");
      void run(true);
    });
  });

  await run(false);
  await enforceDraftOwnerForCurrentPage();

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    ms.on("member.login", refresh);
    ms.on("member.logout", refresh);
  }

  // BaseLayout publishes this after getAppAndMember settles. Session restore does not
  // fire member.login, so a gate that read an empty session stays on Log In unless it
  // listens here. Membership rules are unchanged: the refresh re-reads the session.
  window.addEventListener("kin:member-access", () => {
    const state = root.dataset.gateState;
    if (state === "member" || state === "readonly") return;
    void run(true);
    void enforceDraftOwnerForCurrentPage();
  });
}
