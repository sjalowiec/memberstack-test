/**
 * Finished scarf “My Patterns” control. Active members open the shared library
 * drawer. Everyone else sees the Hat’s membership tooltip and no navigation.
 */
import type { ViewerAccessState } from "../../memberAccess";
import {
  HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE,
  hatPatternMyPatternsIsActive,
} from "../hat/hatPatternMyPatternsAccess";

export const TRIANGLE_SCARF_PATTERN_MY_PATTERNS_DISABLED_TITLE =
  HAT_PATTERN_MY_PATTERNS_DISABLED_TITLE;

export function applyTriangleScarfPatternMyPatternsAccess(
  root: ParentNode | null,
  state: ViewerAccessState,
): void {
  if (!root || typeof root.querySelector !== "function") return;
  const btn = root.querySelector("[data-triangle-scarf-pattern-my-patterns]");
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

  btn.disabled = false;
  btn.setAttribute("aria-disabled", "true");
  btn.setAttribute("title", TRIANGLE_SCARF_PATTERN_MY_PATTERNS_DISABLED_TITLE);
  btn.removeAttribute("data-pattern-workspace-library-trigger");
}

export function bindTriangleScarfPatternMyPatternsDisabledGuard(root: ParentNode | null): void {
  if (!root || typeof root.querySelector !== "function") return;
  const btn = root.querySelector("[data-triangle-scarf-pattern-my-patterns]");
  if (!(btn instanceof HTMLButtonElement) || btn.dataset.triangleScarfMyPatternsGuardBound === "true") {
    return;
  }
  btn.dataset.triangleScarfMyPatternsGuardBound = "true";
  btn.addEventListener("click", (event) => {
    if (btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("is-disabled")) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}
