/**
 * Finished hat pattern “My Patterns” control — active members open the shared library drawer;
 * logged-out / non-members see a disabled control (no navigation to an empty library).
 */
import type { ViewerAccessState } from "../../memberAccess";

export const HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE =
  "Saving patterns is available with membership.";

export function hatPatternMyPatternsIsActive(state: ViewerAccessState): boolean {
  return state === "memberAccess";
}

/**
 * Enable My Patterns (library drawer trigger) for active members; otherwise disable
 * without link behavior and show a membership tooltip.
 */
export function applyHatPatternMyPatternsAccess(
  root: ParentNode | null,
  state: ViewerAccessState,
): void {
  if (!root || typeof root.querySelector !== "function") return;
  const btn = root.querySelector("[data-hat-pattern-my-patterns]");
  if (!(btn instanceof HTMLButtonElement)) return;

  const canUse = hatPatternMyPatternsIsActive(state);
  btn.classList.toggle("is-disabled", !canUse);

  if (canUse) {
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
    btn.removeAttribute("title");
    btn.setAttribute("data-pattern-workspace-library-trigger", "");
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-controls", "pattern-workspace-library-drawer-panel");
    if (!btn.hasAttribute("aria-expanded")) {
      btn.setAttribute("aria-expanded", "false");
    }
    return;
  }

  // Keep native disabled off so the title tooltip remains hoverable; block activation via
  // aria-disabled + removing the library trigger (drawer uses event delegation on that attr).
  btn.disabled = false;
  btn.setAttribute("aria-disabled", "true");
  btn.setAttribute("title", HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE);
  btn.removeAttribute("data-pattern-workspace-library-trigger");
}

/** Guard clicks when the control is membership-locked (no drawer / no navigation). */
export function bindHatPatternMyPatternsDisabledGuard(root: ParentNode | null): void {
  if (!root || typeof root.querySelector !== "function") return;
  const btn = root.querySelector("[data-hat-pattern-my-patterns]");
  if (!(btn instanceof HTMLButtonElement) || btn.dataset.hatMyPatternsGuardBound === "true") {
    return;
  }
  btn.dataset.hatMyPatternsGuardBound = "true";
  btn.addEventListener("click", (event) => {
    if (btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("is-disabled")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}
