/**
 * Gate for STARTING a brand-new sleeveless pattern.
 *
 * A logged-in free user who has already claimed their one-time free pattern (`freeClaimed=true`,
 * no system access) must be blocked from starting a new pattern — BEFORE the builder/setup
 * questions, the title field, or the notes field are shown. They keep full view / print / title /
 * notes access to their existing saved pattern; that access is governed elsewhere and is
 * intentionally untouched here.
 *
 * Pure helpers (no DOM) are unit-testable directly. The async resolver wires Memberstack access,
 * and the DOM helper renders the existing locked / upgrade copy in place of the setup wizard.
 */
import {
  canCreateSleevelessPattern,
  type SleevelessUserAccess,
} from "./sleevelessPatternSystemAccess";
import { resolveSleevelessUserAccess } from "./sleevelessPatternSystemAccessClient";
import {
  SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
  SLEEVELESS_SAVE_LOGGED_OUT_COPY,
} from "./sleevelessPatternProjectCloudSave";

export { SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY, SLEEVELESS_SAVE_LOGGED_OUT_COPY };

/** Marker attribute / selector for the injected locked-screen element. */
export const SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR =
  "[data-sleeveless-new-pattern-locked]";

/** Pure: may this resolved user start a brand-new sleeveless pattern? */
export function canStartNewSleevelessPattern(access: SleevelessUserAccess): boolean {
  return canCreateSleevelessPattern(access);
}

/** Pure: locked / upgrade copy to show when starting a new pattern is blocked. */
export function resolveSleevelessNewPatternBlockedCopy(access: SleevelessUserAccess): string {
  return access.loggedIn
    ? SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY
    : SLEEVELESS_SAVE_LOGGED_OUT_COPY;
}

/** Async: resolve Memberstack access and decide whether a new pattern may be started. */
export async function resolveCanStartNewSleevelessPattern(): Promise<boolean> {
  return canStartNewSleevelessPattern(await resolveSleevelessUserAccess());
}

function isElementLike(el: unknown): el is HTMLElement {
  return (
    typeof el === "object" &&
    el !== null &&
    "setAttribute" in el &&
    typeof (el as HTMLElement).setAttribute === "function"
  );
}

function hideEl(el: unknown): void {
  if (isElementLike(el)) el.hidden = true;
}

/**
 * Replace the Express new-pattern setup UI with the locked / upgrade message.
 *
 * Hides every interactive part of the new-pattern flow (the 5 setup questions, the step nav, the
 * "Start over" toolbar, and the resume editing bar) so the blocked user can neither answer the
 * setup questions nor reach the title / notes fields. Safe no-op on pages without the Express
 * builder (e.g. the saved-pattern workspace, where the New Pattern trigger is already hidden).
 *
 * @returns the injected notice element, or null when there is no Express builder to gate.
 */
export function showSleevelessNewPatternLockedScreen(
  root: ParentNode | null = typeof document !== "undefined" ? document : null,
  copy: string = SLEEVELESS_SAVE_ALREADY_CLAIMED_COPY,
): HTMLElement | null {
  if (!root || typeof document === "undefined") return null;

  const builder = root.querySelector?.("[data-express-builder]");
  if (!isElementLike(builder)) return null;

  // Hide the setup questions and every other new-pattern control so nothing is reachable.
  hideEl(builder);
  hideEl(root.querySelector(".express-builder-nav-row"));
  hideEl(root.querySelector(".sg-builder-nav-row"));
  hideEl(root.querySelector("[data-express-editing-bar]"));
  hideEl(root.querySelector(".pattern-subtext"));

  const panel = root.querySelector(".express-panel");
  const host = isElementLike(panel) ? panel : builder.parentElement;
  if (!isElementLike(host)) return null;

  let notice = host.querySelector<HTMLElement>(SLEEVELESS_NEW_PATTERN_LOCKED_SCREEN_SELECTOR);
  if (!notice) {
    notice = document.createElement("section");
    notice.setAttribute("data-sleeveless-new-pattern-locked", "");
    notice.className = "sleeveless-new-pattern-locked";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    host.insertBefore(notice, host.firstChild);
  }
  notice.replaceChildren();
  notice.hidden = false;

  const title = document.createElement("h2");
  title.className = "sleeveless-new-pattern-locked__title";
  title.textContent = "Unlock the Sleeveless Pattern System";
  notice.appendChild(title);

  const body = document.createElement("p");
  body.className = "sleeveless-new-pattern-locked__body";
  body.textContent = copy;
  notice.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "sleeveless-new-pattern-locked__actions";
  const viewLink = document.createElement("a");
  viewLink.className = "kbm-btn kbm-btn-outline sleeveless-new-pattern-locked__btn";
  viewLink.href = "/account#my-patterns";
  viewLink.textContent = "Open your saved pattern";
  actions.appendChild(viewLink);
  notice.appendChild(actions);

  return notice;
}
