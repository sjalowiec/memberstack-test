/**
 * Memberstack login gate for sleeveless pattern builder pages.
 * Logged-out visitors cannot use builder, review, pattern, print, or saved-pattern UI.
 */
import { devBypass } from "../devBypass";
import { isMemberstackLoggedInPayload } from "./memberstackMember";

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

/** True when the visitor may use sleeveless pattern pages (Memberstack member or local dev bypass). */
export async function isSleevelessPatternMemberLoggedIn(): Promise<boolean> {
  if (devBypass) return true;
  if (typeof window === "undefined") return false;

  const ms = window.$memberstackDom;
  if (!ms?.getCurrentMember) return false;

  try {
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

/** Wires `[data-sleeveless-pattern-gate]` on sleeveless pattern pages. */
export async function initSleevelessPatternMemberGate(root: HTMLElement): Promise<void> {
  setGateState(root, "pending");

  await waitForMemberstackDom();
  const loggedIn = await isSleevelessPatternMemberLoggedIn();
  setGateState(root, loggedIn ? "member" : "locked");

  const ms = window.$memberstackDom;
  if (ms && typeof ms.on === "function") {
    const refresh = (): void => {
      void isSleevelessPatternMemberLoggedIn().then((ok) => {
        setGateState(root, ok ? "member" : "locked");
      });
    };
    ms.on("member.login", refresh);
    ms.on("member.logout", refresh);
  }
}
