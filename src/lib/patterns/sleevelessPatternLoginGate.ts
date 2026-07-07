/**
 * Memberstack login gate for sleeveless pattern builder pages.
 * Logged-out visitors cannot use builder, review, pattern, print, or saved-pattern UI.
 */
import { getMemberstackReturnPath } from "../memberstackReturnUrl";
import { showPublicSignupModal } from "../publicSignupModal";
import { isMemberstackLoggedInPayload, memberIdFromMemberstackPayload } from "./memberstackMember";
import { enforcePatternDraftOwner } from "./patternDraftOwnerGuard";

export type SleevelessPatternGateState = "pending" | "member" | "locked";

export async function waitForMemberstackDom(
  attempts = 40,
  delayMs = 200,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  for (let i = 0; i < attempts; i++) {
    if (window.$memberstackDom?.getCurrentMember) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return Boolean(window.$memberstackDom?.getCurrentMember);
}

/**
 * Waits (best-effort, time-bounded) for Memberstack to finish restoring the current session.
 *
 * `waitForMemberstackDom` only waits for the `getCurrentMember` METHOD to exist, not for the member
 * state to be loaded. Immediately after a login/signup redirects back to the builder,
 * `getCurrentMember()` can otherwise resolve as logged-out before the restored session is processed
 * — and `member.login` does NOT fire on that reload, so the gate would stay locked / the builder
 * would stay disabled for an already-signed-in member. Awaiting `onReady` (which resolves once the
 * app + member are loaded) makes the logged-in decision reliable on that first post-login page load.
 * Never rejects/hangs the gate. Mirrors the Hat/Blanket account gate.
 */
export async function waitForMemberstackReady(
  ms: NonNullable<Window["$memberstackDom"]>,
): Promise<void> {
  const onReady = ms.onReady;
  if (!onReady || typeof (onReady as Promise<unknown>).then !== "function") return;
  await Promise.race([
    Promise.resolve(onReady).catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, 4000)),
  ]);
}

/**
 * Concrete Memberstack member id for the current visitor, or `null` when unavailable (logged out,
 * Memberstack unavailable, or local dev-bypass where no member exists). Used to scope the local
 * pattern working draft to its owner — never for the gate's logged-in decision.
 */
export async function resolveCurrentMemberIdForDraftGuard(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return null;
  try {
    const res = await ms.getCurrentMember();
    return memberIdFromMemberstackPayload(res) ?? null;
  } catch {
    return null;
  }
}

/**
 * Strict logged-in decision for the sleeveless/sweater login gate. Resolves `true` ONLY when
 * Memberstack reports a real signed-in member — it deliberately does NOT honor the localhost dev
 * bypass, so a logged-out visitor sees the login/signup gate on localhost exactly as in production
 * (and matching the Hat/Blanket account gate, which is also strict). This is a login-gate decision
 * only; entitlement/plan resolution lives elsewhere and is unchanged. Because the dev bypass is
 * always false off localhost, dropping it here affects local development only.
 *
 * It DOES wait for Memberstack to finish initializing (`onReady`) before reading the member, so a
 * member returning to the builder right after logging in is recognized instead of being read as
 * logged-out (which would leave the builder gated/disabled on that first post-login load).
 */
export async function isSleevelessPatternMemberLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return false;
  try {
    await waitForMemberstackReady(ms);
    const res = await ms.getCurrentMember();
    return isMemberstackLoggedInPayload(res);
  } catch {
    return false;
  }
}

function setGateState(root: HTMLElement, state: SleevelessPatternGateState): void {
  root.dataset.gateState = state;
  root.removeAttribute("data-gate-pending");

  const content = root.querySelector("[data-sleeveless-pattern-gate-content]");
  const locked = root.querySelector("[data-sleeveless-pattern-gate-locked]");
  const loading = root.querySelector("[data-sleeveless-pattern-gate-loading]");
  const signin = root.querySelector("[data-sleeveless-pattern-gate-signin]");

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
}

/**
 * Wires the gate's "Create Free Account" CTA to the shared public signup modal — the same helper
 * the Hat/Blanket account gate uses — passing the current builder URL so a brand-new member is
 * returned to the builder they were on (not the site-wide `/signup/thank-you` landing). The "Log In"
 * CTA uses Memberstack's login modal with a current-url redirect (in the markup), so it likewise
 * returns to the builder; a successful login is also caught by the `member.login` refresh below,
 * which reveals the builder in place.
 */
function wireGateSignupCta(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>("[data-sleeveless-gate-signup]").forEach((btn) => {
    if (btn.dataset.signupBound === "true") return;
    btn.dataset.signupBound = "true";
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      showPublicSignupModal({ redirectPath: getMemberstackReturnPath() });
    });
  });
}

/** Wires `[data-sleeveless-pattern-gate]` on sleeveless pattern pages. */
export async function initSleevelessPatternMemberGate(root: HTMLElement): Promise<void> {
  setGateState(root, "pending");
  wireGateSignupCta(root);

  await waitForMemberstackDom();
  const loggedIn = await isSleevelessPatternMemberLoggedIn();
  setGateState(root, loggedIn ? "member" : "locked");
  // Scope the local working draft to its owner: clears another member's draft when the signed-in
  // member changes. Best-effort here (other pages); the Express builder also reconciles before it
  // hydrates so the catalog "Create" / direct entry never renders a stale draft.
  enforcePatternDraftOwner(await resolveCurrentMemberIdForDraftGuard());

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    const refresh = (): void => {
      void isSleevelessPatternMemberLoggedIn().then((ok) => {
        setGateState(root, ok ? "member" : "locked");
      });
      void resolveCurrentMemberIdForDraftGuard().then((memberId) => {
        enforcePatternDraftOwner(memberId);
      });
    };
    ms.on("member.login", refresh);
    ms.on("member.logout", refresh);
  }
}
