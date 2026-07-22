/**
 * Memberstack helpers shared by Dynamic Pattern page gates.
 *
 * Page-shell membership enforcement lives in `patternMembershipPageGate.ts`
 * (active membership / lifetime builder entitlement — login alone is never enough).
 * These helpers remain for session readiness, draft ownership, and tests.
 */
import { isMemberstackLoggedInPayload, memberIdFromMemberstackPayload } from "./memberstackMember";

/** @deprecated Use PatternMembershipGateState from patternMembershipPageGate. */
export type SleevelessPatternGateState =
  | "pending"
  | "member"
  | "locked"
  | "locked-no-access";

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

/**
 * @deprecated Prefer {@link initPatternMembershipPageGate} from patternMembershipPageGate.
 * Kept as a thin alias so older imports keep working.
 */
export async function initSleevelessPatternMemberGate(root: HTMLElement): Promise<void> {
  const { initPatternMembershipPageGate } = await import("./patternMembershipPageGate");
  return initPatternMembershipPageGate(root);
}
