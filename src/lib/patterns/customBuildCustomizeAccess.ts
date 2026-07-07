/**
 * Custom Build — Style & Shaping / workspace Customize access (Memberstack hook placeholder).
 * Reuses {@link canCustomizePattern} so dev defaults stay editable unless `?customize=0`.
 */
import { canCustomizePattern } from "./sleevelessPatternAccessGate";

export const CUSTOM_BUILD_STYLE_STEP_LOCKED_TITLE =
  "Style and shaping choices are included with membership.";

export const CUSTOM_BUILD_WORKSPACE_CUSTOMIZE_LOCKED_LABEL =
  "Pattern setup is included with membership.";

const CUSTOM_BUILD_STYLE_STEP_MIN = 2;

function isElementLike(el: unknown): el is HTMLElement {
  return (
    !!el &&
    typeof el === "object" &&
    "setAttribute" in el &&
    "classList" in el &&
    "getAttribute" in el
  );
}

export function canAccessCustomBuildStyleAndShaping(pageUrl?: URL): boolean {
  return canCustomizePattern(pageUrl);
}

function isCustomBuildStyleFlowPill(btn: HTMLElement): boolean {
  const step = parseInt(btn.getAttribute("data-cb-flow-pill") ?? "0", 10);
  return Number.isFinite(step) && step >= CUSTOM_BUILD_STYLE_STEP_MIN;
}

/** Workspace Customize tab + in-flow Style & Shaping pills when entitlement is missing. */
export function syncCustomBuildCustomizeAccessChrome(
  root: ParentNode | null | undefined = typeof document !== "undefined" ? document : null,
  pageUrl?: URL,
): void {
  if (!root?.querySelectorAll) return;

  const hasAccess = canAccessCustomBuildStyleAndShaping(pageUrl);
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("kbm-custom-build-customize-locked", !hasAccess);
  }

  root.querySelectorAll('[data-tab="custom"]').forEach((el) => {
    if (!isElementLike(el)) return;
    if (hasAccess) {
      el.classList.remove("is-disabled", "kbm-customize-tab--locked");
      el.removeAttribute("aria-disabled");
      el.removeAttribute("title");
      return;
    }
    el.classList.add("is-disabled", "kbm-customize-tab--locked");
    el.setAttribute("aria-disabled", "true");
    el.setAttribute("title", CUSTOM_BUILD_WORKSPACE_CUSTOMIZE_LOCKED_LABEL);
  });

  root.querySelectorAll("[data-cb-flow-pill]").forEach((el) => {
    if (!isElementLike(el)) return;
    if (!isCustomBuildStyleFlowPill(el)) return;
    if (hasAccess) {
      if (el.getAttribute("data-cb-customize-entitlement-locked") === "true") {
        el.removeAttribute("data-cb-customize-entitlement-locked");
        el.removeAttribute("title");
      }
      return;
    }
    el.classList.add("is-upcoming");
    el.setAttribute("aria-disabled", "true");
    el.setAttribute("data-cb-customize-entitlement-locked", "true");
    el.setAttribute("title", CUSTOM_BUILD_STYLE_STEP_LOCKED_TITLE);
    el.setAttribute("aria-label", `${el.getAttribute("data-cb-flow-label") || "Style & Shaping"}, locked`);
  });

  root.querySelectorAll("[data-cb-continue-link]").forEach((el) => {
    if (!isElementLike(el)) return;
    if (hasAccess) {
      el.removeAttribute("data-cb-customize-entitlement-locked");
      return;
    }
    el.setAttribute("data-cb-customize-entitlement-locked", "true");
    el.setAttribute("title", CUSTOM_BUILD_STYLE_STEP_LOCKED_TITLE);
  });
}
